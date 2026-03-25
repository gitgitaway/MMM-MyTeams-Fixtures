/*
 * node_helper for MMM-MyTeams-Fixtures
 * Primary: TheSportsDB API
 * Secondary: Scrapers (sportsdb site, fwp, bbc, livefootballontv, cfc) when enabled and needed
 *
 * - Auto season detection ("auto") with fallbackSeason
 * - Team ID resolution (/searchteams.php) when teamId is not provided
 * - Rate limiting + retry/backoff for API
 * - Memory + disk cache
 */
const SharedRequestManager = require("./shared-request-manager.js");
const requestManager = SharedRequestManager.getInstance();
const NodeHelper = require("node_helper");

// Prefer native fetch (Node 18+), fallback to node-fetch v2
let _fetchImpl = null;
let _fetchType = "unknown";
function initializeFetch() {
  try {
    if (typeof globalThis.fetch === "function") {
      _fetchImpl = globalThis.fetch.bind(globalThis);
      _fetchType = "native";
      return true;
    }
  } catch (_) {}
  try {
    // npm install node-fetch@2
    const nodeFetch = require("node-fetch");
    if (typeof nodeFetch === "function") {
      _fetchImpl = nodeFetch;
      _fetchType = "node-fetch-v2";
      return true;
    }
  } catch (_) {}

  console.error("[MyTeams:helper] ERROR: No fetch implementation available. Install node-fetch@2 or use Node.js 18+");
  _fetchImpl = null;
  _fetchType = "none";
  return false;
}
const fetchInitialized = initializeFetch();

const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const EXPECTED_MODULE_DIR = "MMM-MyTeams-Fixtures";
const ACTUAL_MODULE_DIR = path.basename(__dirname);
if (ACTUAL_MODULE_DIR !== EXPECTED_MODULE_DIR) {
  console.error(
    `[MMM-MyTeams-Fixtures] FATAL: node_helper.js is running from the wrong directory!\n` +
    `  Expected: ${EXPECTED_MODULE_DIR}\n` +
    `  Got:      ${ACTUAL_MODULE_DIR}\n` +
    `  This usually means the wrong node_helper.js was installed. Re-clone the module from GitHub.`
  );
}

const CACHE_FILE = path.join(__dirname, "fixtures-cache.json");
let cache = {
  ts: 0,
  ttl: 0,
  source: null,
  key: null,
  data: null
};

// Load any existing cache from disk at startup
function loadCacheFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.data)) {
        cache = {
          ts: Number(parsed.ts) || 0,
          ttl: Number(parsed.ttl) || 0,
          source: parsed.source || null,
          key: parsed.key || null,
          data: parsed.data
        };
        console.log(`[MyTeams:helper] ✓ Loaded ${cache.data.length} fixtures from disk cache`);
      }
    }
  } catch (e) {
    console.warn("[MyTeams:helper] Cache load failed:", e.message);
  }
}

function saveCacheToDisk(ttl) {
  try {
    if (cache.data && Array.isArray(cache.data) && cache.data.length > 0) {
      const payload = {
        ts: cache.ts,
        ttl: ttl || cache.ttl || 300000,
        source: cache.source,
        key: cache.key || null,
        data: cache.data
      };
      fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), "utf8");
      console.log(`[MyTeams:helper] ✓ Wrote ${cache.data.length} fixtures to disk cache`);
    }
  } catch (e) {
    console.warn("[MyTeams:helper] Cache save failed:", e.message);
  }
}

// FWP-specific browser headers used in pre-flight and main request
const FWP_BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-GB,en;q=0.9,en-US;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Sec-CH-UA": "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": "\"Windows\"",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache"
};

// Two-step FWP fetch: pre-flight homepage to capture session cookies, then fetch target URL
async function fetchFWPWithCookieSupport(url, timeoutMs, debug) {
  const FWP_ORIGIN = "https://www.footballwebpages.co.uk";
  let cookieString = "";

  // Step 1: Pre-flight to homepage — establishes a session and collects any anti-bot cookies
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), Math.min(timeoutMs, 8000));
    const preRes = await _fetchImpl(FWP_ORIGIN + "/", {
      headers: { ...FWP_BROWSER_HEADERS },
      signal: controller.signal
    });
    clearTimeout(tid);

    // Extract Set-Cookie headers (getSetCookie() is Node 18+; fall back to get('set-cookie'))
    let setCookies = [];
    if (typeof preRes.headers.getSetCookie === "function") {
      setCookies = preRes.headers.getSetCookie();
    } else {
      const raw = preRes.headers.get("set-cookie");
      if (raw) setCookies = raw.split(/,(?=[^ ])/);
    }
    cookieString = setCookies.map(c => c.split(";")[0]).filter(Boolean).join("; ");
    if (debug) {
      console.log(`[MyTeams:helper] FWP pre-flight status: ${preRes.status}, cookies obtained: ${cookieString ? "yes (" + cookieString.substring(0, 50) + "...)" : "none"}`);
    }
  } catch (e) {
    console.warn("[MyTeams:helper] FWP pre-flight failed (will retry without cookies):", e.message);
  }

  // Step 2: Fetch fixtures page with session cookies and same-origin Sec-Fetch-Site
  const extraHeaders = {
    "Referer": FWP_ORIGIN + "/",
    "Sec-Fetch-Site": "same-origin"
  };
  if (cookieString) {
    extraHeaders["Cookie"] = cookieString;
  }
  return await doFetch(url, { headers: extraHeaders }, timeoutMs);
}

// Generic fetch with timeout and headers - NOW USES SHARED REQUEST MANAGER
async function doFetch(url, options = {}, timeoutMs = 15000) {
  if (!_fetchImpl) throw new Error(`Fetch not available (${_fetchType})`);

  // Merge headers, avoiding case-insensitive duplicates
  const finalHeaders = { ...FWP_BROWSER_HEADERS };
  if (options.headers) {
    Object.keys(options.headers).forEach(k => {
      // Find and delete any existing header with same name (case-insensitive)
      const lowerK = k.toLowerCase();
      Object.keys(finalHeaders).forEach(existingK => {
        if (existingK.toLowerCase() === lowerK) delete finalHeaders[existingK];
      });
      finalHeaders[k] = options.headers[k];
    });
  }

  // Add Referer if not present (helps with some scrapers)
  if (!Object.keys(finalHeaders).some(k => k.toLowerCase() === "referer")) {
    try {
      const urlObj = new URL(url);
      finalHeaders["Referer"] = `${urlObj.protocol}//${urlObj.hostname}/`;
    } catch (_) {}
  }

  const fetchOptions = {
    ...options,
    headers: finalHeaders
  };

  try {
    const result = await requestManager.queueRequest({
      url: url,
      options: fetchOptions,
      timeout: timeoutMs,
      priority: 0,  // High priority - fixtures load first
      moduleId: 'MMM-MyTeams-Fixtures',
      deduplicate: true
    });

    if (!result.success) {
      throw new Error(`HTTP ${result.status}: Request failed`);
    }

    return {
      ok: true,
      status: result.status,
      json: async () => typeof result.data === 'string' ? JSON.parse(result.data) : result.data,
      text: async () => typeof result.data === 'string' ? result.data : JSON.stringify(result.data)
    };
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Request timeout after ${timeoutMs}ms`);
    throw err;
  }
}
// Helpers: throttle and retry for TheSportsDB free tier
const MIN_API_INTERVAL_MS = 1200;
let lastApiAt = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rateLimitWait() {
  const now = Date.now();
  const wait = Math.max(0, MIN_API_INTERVAL_MS - (now - lastApiAt));
  if (wait > 0) await sleep(wait);
  lastApiAt = Date.now();
}
async function apiFetchWithRetry(url, options = {}, timeoutMs = 20000, retries = 2) {
  let delay = 800;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await rateLimitWait();
      return await doFetch(url, options, timeoutMs);
    } catch (err) {
      const msg = String(err.message || "");
      if ((/429|timeout|ECONN|ENOTFOUND/i).test(msg) && attempt < retries) {
        const jitter = Math.floor(Math.random() * 300);
        const wait = delay + jitter;
        console.warn(`[MyTeams:helper] API retry ${attempt + 1}/${retries} after ${wait}ms due to: ${msg}`);
        await sleep(wait);
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}

// Competition classification to support client filtering/styling
function classifyCompetition(name) {
  if (!name) return "domestic";
  const n = name.toLowerCase();
  const euroTokens = [
    "uefa", "champions league", "ucl",
    "europa league", "uel",
    "conference league", "uecl",
    "europe", "european"
  ];
  if (euroTokens.some(tok => n.includes(tok))) return "european";
  if (n.includes("friendly") || n.includes("pre-season")) return "friendly";
  // Domestic league markers (helps when idLeague is missing)
  if (/(scottish|spfl|premiership|league cup|viaplay|premier sports|english|efl|championship)/i.test(n)) return "domestic";
  return "domestic";
}

// Utility: normalize text for opponent extraction
function sanitizeOpponent(text) {
  if (!text) return text;
  // Strip leading times like "12:45 ", "20:00 "
  let t = text.replace(/^\d{1,2}:\d{2}\s*/, "").replace(/\s+/g, " ").trim();
  const cuts = [" TV", " Kick", " KO", " | ", " - ", " (", " @ "];
  for (const cut of cuts) {
    const idx = t.indexOf(cut);
    if (idx > 0) { t = t.slice(0, idx).trim(); break; }
  }
  return t.replace(/[|–—-]+$/g, "").trim();
}

// Extract date/time from a noisy text chunk (scraper fallback)
function extractDateTimeFallback(allText) {
  // Normalize text: collapse spaces, insert spaces between letters and digits, and handle MDx<time> cases
  const base = String(allText || "").replace(/\s+/g, " ").trim();
  const norm1 = base.replace(/([A-Za-z])(\d)/g, "$1 $2").replace(/(\d)([A-Za-z])/g, "$1 $2"); // Premiership3pm -> Premiership 3pm, 12:45pmManchester -> 12:45pm Manchester
  const norm2 = norm1.replace(/(MD\s*\d)(\d)(am|pm)\b/i, "$1 $2$3"); // MD1 8pm when stuck as MD18pm
  const txt = norm2;

  const dateMatch =
    txt.match(/\b(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\b/i) ||
    txt.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);

  // Accept formats: 19:45, 7:45pm, 7.45pm, 7pm, 3pm
  let timeText = "";
  // 1) H[:.|.]MM with optional am/pm (e.g., 7:45pm, 7.45pm, 19:45)
  const tA = txt.match(/(?:^|\s)(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i);
  // 2) H am/pm (e.g., 3pm)
  const tB = txt.match(/(?:^|\s)(\d{1,2})\s*(am|pm)\b/i);
  if (tA) {
    const hh = tA[1];
    const mm = tA[2];
    const ap = tA[3];
    timeText = ap ? (mm === "00" ? `${hh}${ap.toLowerCase()}` : `${hh}:${mm}${ap.toLowerCase()}`) : `${hh}:${mm}`;
  } else if (tB) {
    const hh = tB[1];
    const ap = tB[2];
    timeText = `${hh}${ap.toLowerCase()}`; // prefer 8pm over 8:00pm
  }

  const dateText = dateMatch ? dateMatch[1] : "";
  return { dateText, timeText };
}

/* ---------------------------
 * API integration (primary)
 * ---------------------------
 */

// Convert dateText like "Sun 21 Sep" or "21 Sep" to ISO using season (e.g., 2025-2026)
function inferISOFromDateText(dateText, seasonStr) {
  try {
    if (!dateText) return null;
    const txt = String(dateText).replace(/\s+/g, ' ').trim();
    const m = txt.match(/^(?:[A-Za-z]{3,9}\s+)?(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?$/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const monName = m[2].toLowerCase().slice(0,3);
    const yearExplicit = m[3] ? parseInt(m[3], 10) : null;
    const monMap = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    const month = monMap[monName];
    if (!month || !day || day < 1 || day > 31) return null;
    let year = yearExplicit;
    if (!year) {
      const s = String(seasonStr || '').match(/^(\d{4})-(\d{4})$/);
      if (s) {
        const y1 = parseInt(s[1],10);
        const y2 = parseInt(s[2],10);
        year = (month >= 7) ? y1 : y2; // Jul-Dec -> first year, Jan-Jun -> second year
      } else {
        // Fallback: pick current year sensibly by month
        const now = new Date();
        const cy = now.getFullYear();
        year = (month >= 7 && now.getMonth()+1 < 7) ? cy-1 : cy;
      }
    }
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  } catch (_) { return null; }
}

// Auto-detect season like "2025-2026"
function resolveSeasonAuto(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (m >= 7) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}

// Resolve team ID via /searchteams.php if needed (uses generic scoring for any team)
async function resolveTeamIdIfNeeded(apiUrl, teamName, providedTeamId, timeoutMs, debug = false) {
  const safeId = String(providedTeamId || "").trim();
  if (safeId) return safeId;
  if (!teamName) throw new Error("No teamName or teamId provided");

  const url = `${apiUrl}/searchteams.php?t=${encodeURIComponent(teamName)}`;
  const res = await apiFetchWithRetry(url, {}, timeoutMs);
  const data = await res.json();
  const teams = Array.isArray(data?.teams) ? data.teams : [];
  if (!teams.length) throw new Error("Team ID resolution failed (no candidates)");

  // Score candidates - generic scoring that works for any team
  const lname = teamName.toLowerCase();
  const scored = teams.map(t => {
    const name = (t?.strTeam || "").toLowerCase();
    const alt = (t?.strAlternate || "").toLowerCase();
    const country = (t?.strCountry || "").toLowerCase();
    const city = (t?.strStadiumLocation || "").toLowerCase();
    const id = String(t?.idTeam || "");
    let score = 0;
    // Exact match gets highest score
    if (name === lname) score += 100;
    // Partial match in team name
    if (name.includes(lname)) score += 50;
    // Partial match in alternate name
    if (alt.includes(lname)) score += 40;
    // If provided teamId matches, strongly prefer it
    if (providedTeamId && id === String(providedTeamId)) score += 200;
    return { t, score };
  }).sort((a,b) => b.score - a.score);

  const best = scored[0]?.t;
  if (debug) {
    const dbg = scored.slice(0,5).map(s => ({ id: s.t?.idTeam, name: s.t?.strTeam, country: s.t?.strCountry, alt: s.t?.strAlternate, score: s.score }));
    console.log("[MyTeams:helper] Team candidates:", dbg);
  }
  if (!best?.idTeam) throw new Error("Team ID resolution failed (no best)");
  return String(best.idTeam);
}

// Always resolve team ID from name (ignores providedTeamId)
async function resolveTeamIdByName(apiUrl, teamName, timeoutMs) {
  if (!teamName) throw new Error("No teamName provided");
  const url = `${apiUrl}/searchteams.php?t=${encodeURIComponent(teamName)}`;
  const res = await apiFetchWithRetry(url, {}, timeoutMs);
  const data = await res.json();
  const team = Array.isArray(data?.teams) ? data.teams.find(t => (t?.strTeam || "").toLowerCase() === teamName.toLowerCase()) : null;
  return team?.idTeam ? String(team.idTeam) : null;
}

// Convert TheSportsDB event into front-end fixture shape
function toFixtureFromEvent(e, teamName = "Celtic") {
  const home = e?.strHomeTeam || "";
  const away = e?.strAwayTeam || "";
  const league = e?.strLeague || "";
  const tv = e?.strTVStation || "";

  let opponent = "";
  let homeAway = null;
  if (home.toLowerCase().includes(teamName.toLowerCase())) {
    opponent = away || "TBD";
    homeAway = "H";
  } else if (away.toLowerCase().includes(teamName.toLowerCase())) {
    opponent = home || "TBD";
    homeAway = "A";
  } else {
    opponent = home && away ? `${home} / ${away}` : (home || away || "TBD");
    homeAway = null;
  }

  const dateISO = e?.dateEvent || null; // "YYYY-MM-DD"
  // Normalize time to HH:MM (strip seconds if present)
  let timeText = e?.strTime || (e?.strTimestamp ? new Date(e.strTimestamp).toTimeString().slice(0,5) : "");
  if (timeText && /^\d{1,2}:\d{2}:\d{2}$/.test(timeText)) {
    timeText = timeText.slice(0,5);
  }

  return {
    date: dateISO,
    dateText: dateISO || "",
    timeText: timeText || "",
    opponent,
    homeAway,
    competition: league || "",
    competitionType: classifyCompetition(league),
    tv: tv || "",
    status: e?.strStatus || null,
    homeScore: (e?.intHomeScore != null && e.intHomeScore !== "") ? Number(e.intHomeScore) : null,
    awayScore: (e?.intAwayScore != null && e.intAwayScore !== "") ? Number(e.intAwayScore) : null
  };
}

// Fetch next events; if empty, fall back to season fixtures
async function getFixturesFromAPI({
  apiUrl,
  teamId,
  teamName,
  season,
  fallbackSeason,
  requestTimeoutMs = 20000,
  maxFixtures = 24,
 leagueIds = [],
  uefaLeagueIds = [],
  useSearchEventsFallback = true,
  strictLeagueFiltering = false,
  debug = false
}) {
  if (!apiUrl) throw new Error("apiUrl not provided");
  const resolvedTeamId = await resolveTeamIdIfNeeded(apiUrl, teamName, teamId, requestTimeoutMs, debug);
  if (debug) console.log(`[MyTeams:helper] API: resolvedTeamId=${resolvedTeamId}, teamName=${teamName}`);

  // Step 1: /eventsnext.php
  const nextUrl = `${apiUrl}/eventsnext.php?id=${encodeURIComponent(resolvedTeamId)}`;
  if (debug) console.log("[MyTeams:helper] API GET", nextUrl);
  try {
    const res = await apiFetchWithRetry(nextUrl, {}, requestTimeoutMs);
    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : [];

    if (debug) {
      const total = events.length;
      const h = events.filter(e => String(e?.idHomeTeam||"") === String(resolvedTeamId)).length;
      const a = events.filter(e => String(e?.idAwayTeam||"") === String(resolvedTeamId)).length;
      console.log(`[MyTeams:helper] Next-events: total=${total}, home=${h}, away=${a}`);
    }

    // Filter by teamId and league IDs with optional strict mode
    let filteredEvents = events.filter(e => {
      const idHome = String(e?.idHomeTeam || "");
      const idAway = String(e?.idAwayTeam || "");
      const leagueId = String(e?.idLeague || "");
      const leagueName = (e?.strLeague || "").toLowerCase();
      const isHome = idHome === String(resolvedTeamId);
      const isAway = idAway === String(resolvedTeamId);
      const isTeamMatch = isHome || isAway;
      const knownDomestic = /(scottish|spfl|premiership|league cup|viaplay|premier sports|english|efl|championship)/i.test(leagueName);
      const knownUEFA = /(uefa|champions|europa|conference)/i.test(leagueName);
      const leagueOk = strictLeagueFiltering
        ? (leagueIds.includes(leagueId) || uefaLeagueIds.includes(leagueId) || knownDomestic || knownUEFA)
        : (!leagueId ||leagueIds.includes(leagueId) || uefaLeagueIds.includes(leagueId) || knownDomestic || knownUEFA);
      // Always keep clear away matches; apply league filter more leniently for away if metadata is weak
      const keep = isTeamMatch && (leagueOk || (isAway && (!leagueId && !leagueName)));
      return keep;
    });
    if (filteredEvents.length === 0 && !strictLeagueFiltering) {
      filteredEvents = events.filter(e => String(e?.idHomeTeam || "") === String(resolvedTeamId) || String(e?.idAwayTeam || "") === String(resolvedTeamId));
    }

    if (debug) {
      const total = filteredEvents.length;
      const h = filteredEvents.filter(e => String(e?.idHomeTeam||"") === String(resolvedTeamId)).length;
      const a = filteredEvents.filter(e => String(e?.idAwayTeam||"") === String(resolvedTeamId)).length;
      const sampleAway = filteredEvents.filter(e => String(e?.idAwayTeam||"") === String(resolvedTeamId)).slice(0,2).map(e => ({
        ev: e?.strEvent,
        idLeague: e?.idLeague,
        strLeague: e?.strLeague
      }));
      console.log(`[MyTeams:helper] Next-events (after filter): total=${total}, home=${h}, away=${a}`, sampleAway);
    }

    // Sort by date/time ascending
    filteredEvents.sort((a,b) => {
      const ta = Date.parse(a?.strTimestamp || `${a?.dateEvent || '9999-12-31'}T${(a?.strTime || '23:59')}:00`);
      const tb = Date.parse(b?.strTimestamp || `${b?.dateEvent || '9999-12-31'}T${(b?.strTime || '23:59')}:00`);
      return (isNaN(ta) ? Infinity : ta) - (isNaN(tb) ? Infinity : tb);
    });

    let collected = filteredEvents.map(e => toFixtureFromEvent(e, teamName));
    
    if (debug) {
      const awayFromNext = collected.filter(f => f.homeAway === 'A').length;
      console.log(`[MyTeams:helper] ✓ eventsnext.php returned ${collected.length} fixtures (${awayFromNext} away)`);
    }
    
    // If we don't have enough from "next", supplement from season lists
    if (collected.length < maxFixtures) {
      try {
        const seasonStr = season === "auto" ? resolveSeasonAuto() : (season || resolveSeasonAuto());
        const fallbackStr = fallbackSeason || resolveSeasonAuto();
        const more1 = await fetchSeason(seasonStr);
        if (Array.isArray(more1) && more1.length) {
          const awayFromSeason = more1.filter(f => f.homeAway === 'A').length;
          if (debug) console.log(`[MyTeams:helper] ✓ eventsseason.php (${seasonStr}) returned ${more1.length} fixtures (${awayFromSeason} away)`);
          collected.push(...more1);
        }
        if (collected.length < maxFixtures) {
          const more2 = await fetchSeason(fallbackStr);
          if (Array.isArray(more2) && more2.length) {
            const awayFromFallback = more2.filter(f => f.homeAway === 'A').length;
            if (debug) console.log(`[MyTeams:helper] ✓ eventsseason.php (${fallbackStr}) returned ${more2.length} fixtures (${awayFromFallback} away)`);
            collected.push(...more2);
          }
        }
      } catch (_) { /* ignore supplement errors */ }
      // Dedupe by composite key
      const seen = new Set();
      collected = collected.filter(f => {
        const key = `${f.date}|${f.timeText}|${f.opponent}|${f.homeAway}|${f.competition}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    collected.sort((a,b) => {
      const ta = Date.parse(`${a.date || '9999-12-31'}T${(a.timeText || '23:59')}:00`);
      const tb = Date.parse(`${b.date || '9999-12-31'}T${(b.timeText || '23:59')}:00`);
      return (isNaN(ta) ? Infinity : ta) - (isNaN(tb) ? Infinity : tb);
    });
    if (collected.length > 0) {
      const totalAway = collected.slice(0, maxFixtures).filter(f => f.homeAway === 'A').length;
      if (debug) console.log(`[MyTeams:helper] ✓ FINAL from eventsnext+eventsseason: ${collected.length} fixtures (${totalAway} away) - RETURNING`);
      return collected.slice(0, maxFixtures);
    }
  } catch (e) {
    console.warn("[MyTeams:helper] Next-events fetch failed:", e.message);
  }

  // Step 2: /eventsseason.php (auto season or fallback)
  const seasonStr = season === "auto" ? resolveSeasonAuto() : (season || resolveSeasonAuto());
  const fallbackStr = fallbackSeason || resolveSeasonAuto();

  // PERF-005: accepts optional idOverride so fetchSeasonAlt (alt-team-id path) can reuse this function
  async function fetchSeason(s, idOverride) {
    const id = idOverride !== undefined ? String(idOverride) : String(resolvedTeamId);
    const url = `${apiUrl}/eventsseason.php?id=${encodeURIComponent(id)}&s=${encodeURIComponent(s)}`;
    if (debug) console.log("[MyTeams:helper] API GET", url);
    const res = await apiFetchWithRetry(url, {}, requestTimeoutMs);
    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    const todayISO = new Date().toISOString().slice(0,10);

    if (debug) {
      const total = events.length;
      const h = events.filter(e => String(e?.idHomeTeam||"") === id).length;
      const a = events.filter(e => String(e?.idAwayTeam||"") === id).length;
      console.log(`[MyTeams:helper] Season-events(${s}): total=${total}, home=${h}, away=${a}`);
    }

    // Keep only matches for the resolved team and in desired leagues (if idLeague present)
    let desired = events.filter(e => {
      const idHome = String(e?.idHomeTeam || "");
      const idAway = String(e?.idAwayTeam || "");
      const leagueId = String(e?.idLeague || "");
      const leagueName = (e?.strLeague || "").toLowerCase();
      const isHome = idHome === id;
      const isAway = idAway === id;
      const isTeamMatch = isHome || isAway;
      const knownDomestic = /(scottish|spfl|premiership|league cup|viaplay|premier sports|english|efl|championship)/i.test(leagueName);
      const knownUEFA = /(uefa|champions|europa|conference)/i.test(leagueName);
      const leagueOk = strictLeagueFiltering
        ? (leagueIds.includes(leagueId) || uefaLeagueIds.includes(leagueId) || knownDomestic || knownUEFA)
        : (!leagueId ||leagueIds.includes(leagueId) || uefaLeagueIds.includes(leagueId) || knownDomestic || knownUEFA);
      const keep = isTeamMatch && (leagueOk || (isAway && (!leagueId && !leagueName)));
      return keep && (e?.dateEvent || "") >= todayISO;
    });
    if (desired.length === 0 && !strictLeagueFiltering) {
      desired = events.filter(e => {
        const idHome = String(e?.idHomeTeam || "");
        const idAway = String(e?.idAwayTeam || "");
        return (idHome === id || idAway === id) && (e?.dateEvent || "") >= todayISO;
      });
    }

    // Sort by date/time ascending
    desired.sort((a,b) => {
      const ta = Date.parse(a?.strTimestamp || `${a?.dateEvent || '9999-12-31'}T${(a?.strTime || '23:59')}:00`);
      const tb = Date.parse(b?.strTimestamp || `${b?.dateEvent || '9999-12-31'}T${(b?.strTime || '23:59')}:00`);
      return (isNaN(ta) ? Infinity : ta) - (isNaN(tb) ? Infinity : tb);
    });

    return desired.map(e => toFixtureFromEvent(e, teamName)).slice(0, maxFixtures);
  }

  try {
    const seasonFixtures = await fetchSeason(seasonStr);
    if (seasonFixtures.length > 0) {
      const awayCount = seasonFixtures.filter(f => f.homeAway === 'A').length;
      if (debug) console.log(`[MyTeams:helper] ✓ eventsseason.php (${seasonStr}) standalone returned ${seasonFixtures.length} fixtures (${awayCount} away) - RETURNING`);
      return seasonFixtures;
    }
  } catch (e) {
    console.warn(`[MyTeams:helper] Season (${seasonStr}) fetch failed:`, e.message);
  }

  try {
    const fbFixtures = await fetchSeason(fallbackStr);
    if (fbFixtures.length > 0) {
      const awayCount = fbFixtures.filter(f => f.homeAway === 'A').length;
      if (debug) console.log(`[MyTeams:helper] ✓ eventsseason.php (${fallbackStr}) fallback returned ${fbFixtures.length} fixtures (${awayCount} away) - RETURNING`);
      return fbFixtures;
    }
  } catch (e) {
    console.warn(`[MyTeams:helper] Fallback season (${fallbackStr}) fetch failed:`, e.message);
  }

  // Fallback: Search events by name pattern for season (TEAM_vs_* and *_vs_TEAM)
  if (teamName && useSearchEventsFallback) {
    try {
      const nameVariants = [teamName, `${teamName} FC`, `Glasgow ${teamName}`];
      const patterns = [];
      for (const n of nameVariants) {
        patterns.push(`${n}_vs_`);
        patterns.push(`_vs_${n}`);
      }
      let searchEvents = [];
      for (const pat of patterns) {
        const url = `${apiUrl}/searchevents.php?e=${encodeURIComponent(pat)}&s=${encodeURIComponent(seasonStr)}`;
        if (debug) console.log("[MyTeams:helper] API GET", url);
        const res = await apiFetchWithRetry(url, {}, requestTimeoutMs);
        const data = await res.json();
        const ev = Array.isArray(data?.event) ? data.event : [];
        searchEvents.push(...ev);
      }
      // Dedupe by idEvent (or fallback composite key)
      const seen = new Set();
      const merged = searchEvents.filter(e => {
        const id = String(e?.idEvent || `${e?.strEvent}-${e?.dateEvent}-${e?.strTime}`);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      const todayISO = new Date().toISOString().slice(0,10);
      if (debug) {
        const total = merged.length;
        const h = merged.filter(e => String(e?.idHomeTeam||"") === String(resolvedTeamId) || (e?.strHomeTeam||"").toLowerCase().includes(teamName.toLowerCase())).length;
        const a = merged.filter(e => String(e?.idAwayTeam||"") === String(resolvedTeamId) || (e?.strAwayTeam||"").toLowerCase().includes(teamName.toLowerCase())).length;
        console.log(`[MyTeams:helper] Search-events: total=${total}, home~=${h}, away~=${a}`);
      }
      let desired = merged.filter(e => {
        const home = (e?.strHomeTeam || "").toLowerCase();
        const away = (e?.strAwayTeam || "").toLowerCase();
        const t = teamName.toLowerCase();
        const involved = home.includes(t) || away.includes(t);
        const isAway = away.includes(t);
        const leagueId = String(e?.idLeague || "");
        const leagueName = (e?.strLeague || "").toLowerCase();
        const knownDomestic = /(scottish|spfl|premiership|league cup|viaplay|premier sports|english|efl|championship)/i.test(leagueName);
        const knownUEFA = /(uefa|champions|europa|conference)/i.test(leagueName);
        const keepLeague = strictLeagueFiltering
          ? (leagueIds.includes(leagueId) || uefaLeagueIds.includes(leagueId) || knownDomestic || knownUEFA)
          : (!leagueId ||leagueIds.includes(leagueId) || uefaLeagueIds.includes(leagueId) || knownDomestic || knownUEFA);
        return involved && (keepLeague || (isAway && (!leagueId && !leagueName))) && (e?.dateEvent || "") >= todayISO;
      });
      if (desired.length === 0 && !strictLeagueFiltering) {
        desired = merged.filter(e => {
          const involved = (e?.strHomeTeam || "").toLowerCase().includes(teamName.toLowerCase()) ||
                           (e?.strAwayTeam || "").toLowerCase().includes(teamName.toLowerCase());
          return involved && (e?.dateEvent || "") >= todayISO;
        });
      }
      desired.sort((a,b) => {
        const ta = Date.parse(a?.strTimestamp || `${a?.dateEvent || '9999-12-31'}T${(a?.strTime || '23:59')}:00`);
        const tb = Date.parse(b?.strTimestamp || `${b?.dateEvent || '9999-12-31'}T${(b?.strTime || '23:59')}:00`);
        return (isNaN(ta) ? Infinity : ta) - (isNaN(tb) ? Infinity : tb);
      });
      const fx = desired.map(e => toFixtureFromEvent(e, teamName)).slice(0, maxFixtures);
      if (fx.length > 0) {
        const awayCount = fx.filter(f => f.homeAway === 'A').length;
        if (debug) console.log(`[MyTeams:helper] ✓ searchevents.php returned ${fx.length} fixtures (${awayCount} away) - RETURNING`);
        return fx;
      }
    } catch (e) {
      console.warn("[MyTeams:helper] searchevents fallback failed:", e.message);
    }
  }

  // Last resort: re-resolve team ID by name and retry once (guards against wrong teamId in config)
  if (teamName) {
    try {
      const altId = await resolveTeamIdByName(apiUrl, teamName, requestTimeoutMs);
      if (altId && String(altId) !== String(resolvedTeamId)) {
        if (debug) console.log(`[MyTeams:helper] Retrying with altTeamId=${altId} (resolved by name)`);

        // Step A: /eventsnext.php for altId
        try {
          const nextUrl2 = `${apiUrl}/eventsnext.php?id=${encodeURIComponent(altId)}`;
          if (debug) console.log("[MyTeams:helper] API GET", nextUrl2);
          const res2 = await apiFetchWithRetry(nextUrl2, {}, requestTimeoutMs);
          const data2 = await res2.json();
          const events2 = Array.isArray(data2?.events) ? data2.events : [];
          let filtered2 = events2.filter(e => String(e?.idHomeTeam||"") === String(altId) || String(e?.idAwayTeam||"") === String(altId));
          filtered2.sort((a,b) => {
            const ta = Date.parse(a?.strTimestamp || `${a?.dateEvent || '9999-12-31'}T${(a?.strTime || '23:59')}:00`);
            const tb = Date.parse(b?.strTimestamp || `${b?.dateEvent || '9999-12-31'}T${(b?.strTime || '23:59')}:00`);
            return (isNaN(ta) ? Infinity : ta) - (isNaN(tb) ? Infinity : tb);
          });
          const fx2 = filtered2.map(e => toFixtureFromEvent(e, teamName)).slice(0, maxFixtures);
          if (fx2.length > 0) return fx2;
        } catch (e) {
          console.warn("[MyTeams:helper] Next-events altId fetch failed:", e.message);
        }

        // Step B: /eventsseason.php for altId — reuses fetchSeason with idOverride (PERF-005)
        try {
          const sfx = await fetchSeason(seasonStr, altId);
          if (sfx.length > 0) return sfx;
        } catch (e) {
          console.warn(`[MyTeams:helper] Season (alt, ${seasonStr}) fetch failed:`, e.message);
        }
        try {
          const sfx2 = await fetchSeason(fallbackStr, altId);
          if (sfx2.length > 0) return sfx2;
        } catch (e) {
          console.warn(`[MyTeams:helper] Fallback season (alt, ${fallbackStr}) fetch failed:`, e.message);
        }
      }
    } catch (e) {
      if (debug) console.warn("[MyTeams:helper] alt teamId resolution failed:", e.message);
    }
  }

  return [];
}

/* ---------------------------
 * Scrapers (secondary)
 * ---------------------------
 */

// SEC-002: Validate teamName contains only safe characters before embedding in URLs
function sanitizeTeamName(name) {
  if (typeof name !== "string" || !name.trim()) return null;
  // Allow letters (including Unicode/accented), digits, spaces, hyphens, apostrophes, dots, & only
  if (!/^[\p{L}\p{N}\s'\-\.&]+$/u.test(name.trim())) return null;
  return name.trim();
}

// Known clubs whose official site follows the <slug>fc.com pattern
const KNOWN_CFC_SLUGS = new Set([
  "celtic", "rangers", "chelsea", "arsenal", "liverpool", "everton",
  "newcastle", "barcelona", "ajax", "porto", "benfica"
]);

// Dynamic URL builder for scrapers - uses teamName and teamId from config
function buildScraperUrls(teamName, teamId) {
  const safe = sanitizeTeamName(teamName);
  if (!safe) {
    console.error(`[MyTeams:helper] SEC-002: teamName "${teamName}" contains unsafe characters — scraper URLs blocked`);
    return { fwp: null, sportsdb: null, bbc: null, livefootballontv: null, cfc: null };
  }
  const slug = safe.toLowerCase().replace(/\s+/g, "-");
  const safeId = String(teamId || "133647").replace(/[^0-9a-zA-Z\-_]/g, "");
  return {
    fwp: `https://www.footballwebpages.co.uk/${encodeURIComponent(slug)}/fixtures-results`,
    sportsdb: `https://www.thesportsdb.com/team/${encodeURIComponent(safeId)}-${encodeURIComponent(slug)}`,
    bbc: `https://www.bbc.co.uk/sport/football/teams/${encodeURIComponent(slug)}/scores-fixtures`,
    livefootballontv: `https://www.live-footballontv.com/${encodeURIComponent(slug)}-on-tv.html`,
    cfc: KNOWN_CFC_SLUGS.has(slug) ? `https://www.${slug}fc.com/fixtures` : null
  };
}

// Live-FootballOnTV HTML parser
function parseLiveFootball(html, teamName = "Celtic") {
  const $ = cheerio.load(html);
  const fixtures = [];
  const teamPattern = String(teamName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
  $(".match, .fixture, .upcoming .row, .w-row").each((_, el) => {
    let dateText = $(el).find(".date, .fixture-date, .match-date").first().text().trim();
    let timeText = $(el).find(".time, .kickoff, .ko").first().text().trim();
    const comp = $(el).find(".competition, .comp-name, .competition-name").first().text().trim();
    const tv = $(el).find(".channel, .tv, .broadcaster").first().text().trim();
    const allText = $(el).text().replace(/\s+/g, " ").trim();

    if (!dateText || !timeText) {
      const fb = extractDateTimeFallback(allText);
      if (!dateText) dateText = fb.dateText || dateText;
      if (!timeText) timeText = fb.timeText || timeText;
      // Repair malformed times like 25:45pm/45:45pm/55:45pm/75:45pm
      if (/^(?:25|45|55|75):45pm$/i.test(timeText)) {
        const lastDigit = timeText.charAt(1);
        timeText = `${lastDigit}:45pm`;
      }
      // Normalize 12h -> 24h
      const m12 = timeText.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
      if (m12) {
        let hh = parseInt(m12[1], 10);
        const mm = m12[2];
        const ap = m12[3].toLowerCase();
        if (ap === 'pm' && hh < 12) hh += 12;
        if (ap === 'am' && hh === 12) hh = 0;
        timeText = `${String(hh).padStart(2,'0')}:${mm}`;
      }
      const m12b = timeText.match(/^(\d{1,2})(am|pm)$/i);
      if (m12b) {
        let hh = parseInt(m12b[1], 10);
        const ap = m12b[2].toLowerCase();
        if (ap === 'pm' && hh < 12) hh += 12;
        if (ap === 'am' && hh === 12) hh = 0;
        timeText = `${String(hh).padStart(2,'0')}:00`;
      }
    }

    let opponent = null, homeAway = null;
    const vs1 = allText.match(new RegExp(`${teamPattern}\\s+v(?:s\\.)?\\s+([^|@(\\-]+)$`, 'i'));
    const vs2 = allText.match(new RegExp(`([^|@(\\-]+)\\s+v(?:s\\.)?\\s+${teamPattern}`, 'i'));
    if (vs1) { opponent = sanitizeOpponent(vs1[1]); homeAway = "H"; }
    else if (vs2) { opponent = sanitizeOpponent(vs2[1]); homeAway = "A"; }

    // Skip past results
    const isResult = /\b\d+\s*-\s*\d+\b/.test(allText) || /\bFT\b/i.test(allText) || /Full\s*Time/i.test(allText);

    if (!isResult && (opponent || dateText || timeText)) {
      // Force 17:45 for European away matches
      if ((!timeText || !/^[0-2]?\d:\d{2}$/.test(timeText)) && classifyCompetition(comp) === 'european' && homeAway === 'A') {
        timeText = '17:45';
      } else if (classifyCompetition(comp) === 'european' && homeAway === 'A' && /(am|pm)$/i.test(timeText)) {
        timeText = '17:45';
      }
      fixtures.push({
        date: null,
        dateText,
        timeText,
        opponent: opponent || "TBD",
        homeAway,
        competition: comp,
        competitionType: classifyCompetition(comp),
        tv
      });
    }
  });
  return fixtures;
}

// BBC HTML parser
function parseBBC(html, teamName = "Celtic") {
  const $ = cheerio.load(html);
  const fixtures = [];
  const teamPattern = String(teamName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
  $("[data-component='fixtures'] li, .sp-c-fixture").each((_, el) => {
    const timeEl = $(el).find("time").first();
    const datetimeAttr = (timeEl.attr("datetime") || "").trim();
    const dateTextRaw = timeEl.text().trim();
    let timeText = $(el).find(".sp-c-fixture__number--time, .qa-match-block__date").text().trim();
    const comp = $(el).find(".sp-c-fixture__block--competition, .gs-u-display-inline").first().text().trim();

    const home = $(el).find(".sp-c-fixture__team--home .sp-c-fixture__team-name, .sp-c-fixture__team--home .qa-full-team-name").text().trim();
    const away = $(el).find(".sp-c-fixture__team--away .sp-c-fixture__team-name, .sp-c-fixture__team--away .qa-full-team-name").text().trim();

    let opponent = null; let homeAway = null;
    if (new RegExp(`^${teamPattern}$`, 'i').test(home)) { opponent = away; homeAway = "H"; }
    else if (new RegExp(`^${teamPattern}$`, 'i').test(away)) { opponent = home; homeAway = "A"; }

    let iso = null;
    if (/^\d{4}-\d{2}-\d{2}/.test(datetimeAttr)) iso = datetimeAttr;

    if (opponent || datetimeAttr || dateTextRaw) {
      // Normalize time similar to FWP
      if (timeText) {
        // Repair glued tokens
        const norm = timeText.replace(/([A-Za-z])(\d)/g, '$1 $2').trim();
        if (norm !== timeText) timeText = norm;
        // 12h -> 24h
        const m12 = timeText.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
        if (m12) {
          let hh = parseInt(m12[1], 10);
          const mm = m12[2];
          const ap = m12[3].toLowerCase();
          if (ap === 'pm' && hh < 12) hh += 12;
          if (ap === 'am' && hh === 12) hh = 0;
          timeText = `${String(hh).padStart(2,'0')}:${mm}`;
        }
        const m12b = timeText.match(/^(\d{1,2})(am|pm)$/i);
        if (m12b) {
          let hh = parseInt(m12b[1], 10);
          const ap = m12b[2].toLowerCase();
          if (ap === 'pm' && hh < 12) hh += 12;
          if (ap === 'am' && hh === 12) hh = 0;
          timeText = `${String(hh).padStart(2,'0')}:00`;
        }
      }
      // Force 17:45 for European away
      const compType = classifyCompetition(comp);
      if ((!timeText || /(am|pm)$/i.test(timeText) || !/^\d{1,2}:\d{2}$/.test(timeText)) && compType === 'european' && homeAway === 'A') {
        timeText = '17:45';
      }

      // Skip past results — if BBC includes scores inline, filter them
      const allText = $(el).text().replace(/\s+/g, ' ').trim();
      const isResult = /\b\d+\s*-\s*\d+\b/.test(allText) || /\bFT\b/i.test(allText) || /Full\s*Time/i.test(allText);
      if (isResult) return;

      fixtures.push({
        date: iso,
        dateText: datetimeAttr || dateTextRaw,
        timeText,
        opponent: opponent || "TBD",
        homeAway,
        competition: comp,
        competitionType: compType,
        tv: ""
      });
    }
  });
  return fixtures;
}

// FootballWebPages HTML parser
function parseFWP(html, teamName = "Celtic", debug = false) {
  const $ = cheerio.load(html);
  const fixtures = [];
  let lastDateText = ""; // Track date across rows in case of headers
  const teamPattern = String(teamName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
  $(".fixture, .fixtures .match, table tr").each((i, el) => {
    let dateText = $(el).find(".date, .fixture-date, td.date, time").first().text().trim();
    if (dateText) lastDateText = dateText;
    else dateText = lastDateText;

    let timeText = $(el).find(".time, td.time").first().text().trim();
    const comp = $(el).find(".competition, td.competition").first().text().trim();

    // Use a space-preserving text extraction to prevent smashed tokens
    const allText = $(el).find("*").addBack().contents().filter((_,n) => n.nodeType===3).get().map(n => n.data).join(" ").replace(/\s+/g, " ").trim();
    if (!dateText || !timeText) {
      const fb = extractDateTimeFallback(allText);
      if (!dateText) dateText = fb.dateText || dateText;
      if (!timeText) timeText = fb.timeText || timeText;
      // Repair malformed times like 25:45pm/45:45pm/55:45pm/75:45pm
      if (/^(?:25|45|55|75):45pm$/i.test(timeText)) {
        const lastDigit = timeText.charAt(1); // 5 in 25:45pm → 5:45pm
        timeText = `${lastDigit}:45pm`;
      }
      // Normalize 12h to 24h for display when minutes exist
      const m12 = timeText.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
      if (m12) {
        let hh = parseInt(m12[1], 10);
        const mm = m12[2];
        const ap = m12[3].toLowerCase();
        if (ap === 'pm' && hh < 12) hh += 12;
        if (ap === 'am' && hh === 12) hh = 0;
        timeText = `${String(hh).padStart(2,'0')}:${mm}`;
      }
      // Normalize plain 8pm -> 20:00
      const m12b = timeText.match(/^(\d{1,2})(am|pm)$/i);
      if (m12b) {
        let hh = parseInt(m12b[1], 10);
        const ap = m12b[2].toLowerCase();
        if (ap === 'pm' && hh < 12) hh += 12;
        if (ap === 'am' && hh === 12) hh = 0;
        timeText = `${String(hh).padStart(2,'0')}:00`;
      }
    }

    // Extract teams from generic "A v B" pattern and infer H/A for configured team
    let opponent = null; let homeAway = null;
    const teamPair = allText.match(/([A-Za-z0-9 .&':\-]+)\s+v(?:s\.?)*\s+([A-Za-z0-9 .&':\-]+)/i);
    if (teamPair) {
      const t1 = teamPair[1].trim();
      const t2 = teamPair[2].trim();
      const teamRegex = new RegExp(teamPattern, 'i');
      if (teamRegex.test(t1) && !teamRegex.test(t2)) { opponent = sanitizeOpponent(t2); homeAway = "H"; }
      else if (teamRegex.test(t2) && !teamRegex.test(t1)) { opponent = sanitizeOpponent(t1); homeAway = "A"; }
    }
    // Fallback specific patterns without end-of-line constraint
    if (!opponent) {
      const vs1 = allText.match(new RegExp(`${teamPattern}\\s+v(?:s\\.)?\\s+([^|@\\-(]+)`, 'i'));
      const vs2 = allText.match(new RegExp(`([^|@\\-(]+)\\s+v(?:s\\.)?\\s+${teamPattern}`, 'i'));
      if (vs1) { opponent = sanitizeOpponent(vs1[1]); homeAway = "H"; }
      else if (vs2) { opponent = sanitizeOpponent(vs2[1]); homeAway = "A"; }
    }
    // Heuristic: compact H/A directly after date e.g. "Sat 21 FebH..." or "...A..."
    if (!homeAway && dateText) {
      const pos = allText.indexOf(dateText);
      if (pos >= 0) {
        const tail = allText.slice(pos + dateText.length).trim();
        const haCompact = tail.match(/^([HA])(?=[A-Z])/);
        if (haCompact) homeAway = haCompact[1];
      }
    }
    // Heuristic: use anchor texts for opponent if present
    if (!opponent) {
      const links = $(el).find('a').map((_, a) => $(a).text().replace(/\s+/g,' ').trim()).get();
      const teamRegex = new RegExp(teamPattern, 'i');
      const cand = (links || []).find(t => t && /[A-Za-z]/.test(t) && !teamRegex.test(t) && !/fixtures|results|table|news/i.test(t));
      if (cand) {
        opponent = sanitizeOpponent(cand);
        // Infer H/A by order of appearance in the row text
        const idxC = allText.toLowerCase().indexOf(teamName.toLowerCase());
        const idxO = allText.toLowerCase().indexOf(cand.toLowerCase());
        if (idxC >= 0 && idxO >= 0) homeAway = idxC < idxO ? 'H' : 'A';
      }
    }
    // Heuristic: if still empty, try tokens near configured team
    if (!opponent) {
      const mAfter = allText.match(new RegExp(`${teamPattern}[^A-Za-z0-9]+([^,|@\\-\\(]{2,40})`, 'i'));
      const mBefore = allText.match(new RegExp(`([^,|@\\-\\(]{2,40})[^A-Za-z0-9]+${teamPattern}`, 'i'));
      const teamRegex = new RegExp(teamPattern, 'i');
      if (mAfter && !teamRegex.test(mAfter[1])) { opponent = sanitizeOpponent(mAfter[1]); homeAway = 'H'; }
      else if (mBefore && !teamRegex.test(mBefore[1])) { opponent = sanitizeOpponent(mBefore[1]); homeAway = 'A'; }
    }

    // Skip past results by detecting scores or FT markers
    const isResult = /\b\d+\s*-\s*\d+\b/.test(allText) || /\bFT\b/i.test(allText) || /Full\s*Time/i.test(allText);

    if (!isResult && (opponent || dateText || timeText)) {
      // Force 17:45 for European away matches (UK local time)
      if ((!timeText || !/^[0-2]?\d:\d{2}$/.test(timeText)) && classifyCompetition(comp) === 'european' && homeAway === 'A') {
        timeText = '17:45';
      } else if (classifyCompetition(comp) === 'european' && homeAway === 'A' && /(am|pm)$/i.test(timeText)) {
        timeText = '17:45';
      }

      const item = {
        date: null,
        dateText,
        timeText,
        opponent: opponent || "TBD",
        homeAway,
        competition: comp,
        competitionType: classifyCompetition(comp),
        tv: ""
      };
      if (debug) {
        if (!opponent || !timeText || !homeAway) {
          console.log("[MyTeams:helper] FWP raw text", i, allText);
        }
        console.log("[MyTeams:helper] FWP row", i, JSON.stringify(item));
      }
      fixtures.push(item);
    }
  });
  return fixtures;
}

// TheSportsDB team page (site) parser
function parseSportsDB(html, teamName = "Celtic") {
  const $ = cheerio.load(html);
  const fixtures = [];
  const teamPattern = String(teamName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
  const teamRegex = new RegExp(teamPattern, 'i');
  $("*").each((_, el) => {
    const block = $(el).text().replace(/\s+/g, " ").trim();
    if (!teamRegex.test(block) || !/v(?:s\.)?/i.test(block)) return;

    let { dateText, timeText } = extractDateTimeFallback(block);
    // Normalize/repair time as per FWP
    if (/^(?:25|45|55|75):45pm$/i.test(timeText)) {
      const lastDigit = timeText.charAt(1);
      timeText = `${lastDigit}:45pm`;
    }
    const m12 = String(timeText||"").match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
    if (m12) {
      let hh = parseInt(m12[1], 10);
      const mm = m12[2];
      const ap = m12[3].toLowerCase();
      if (ap === 'pm' && hh < 12) hh += 12;
      if (ap === 'am' && hh === 12) hh = 0;
      timeText = `${String(hh).padStart(2,'0')}:${mm}`;
    }
    const m12b = String(timeText||"").match(/^(\d{1,2})(am|pm)$/i);
    if (m12b) {
      let hh = parseInt(m12b[1], 10);
      const ap = m12b[2].toLowerCase();
      if (ap === 'pm' && hh < 12) hh += 12;
      if (ap === 'am' && hh === 12) hh = 0;
      timeText = `${String(hh).padStart(2,'0')}:00`;
    }

    let opponent = null, homeAway = null;
    const vs1 = block.match(new RegExp(`${teamPattern}\\s+v(?:s\\.)?\\s+([^|@(\\-]+)$`, 'i'));
    const vs2 = block.match(new RegExp(`([^|@(\\-]+)\\s+v(?:s\\.)?\\s+${teamPattern}`, 'i'));
    if (vs1) { opponent = sanitizeOpponent(vs1[1]); homeAway = "H"; }
    else if (vs2) { opponent = sanitizeOpponent(vs2[1]); homeAway = "A"; }

    // Skip past results if block includes scores/FT
    const isResult = /\b\d+\s*-\s*\d+\b/.test(block) || /\bFT\b/i.test(block) || /Full\s*Time/i.test(block);
    if (!isResult && (opponent || dateText || timeText)) {
      // Force 17:45 for European away (cannot reliably detect competition from SportsDB site, so leave unless pattern present)
      let competition = "";
      const compMatch = block.match(/(Europa|UEFA|Conference|Champions League)/i);
      const compType = compMatch ? 'european' : 'domestic';
      if ((!timeText || /(am|pm)$/i.test(timeText) || !/^\d{1,2}:\d{2}$/.test(timeText)) && compType === 'european' && homeAway === 'A') {
        timeText = '17:45';
      }

      fixtures.push({
        date: null,
        dateText,
        timeText,
        opponent: opponent || "TBD",
        homeAway,
        competition,
        competitionType: compType,
        tv: ""
      });
    }
  });
  return fixtures.slice(0, 12);
}

// Team site generic parser (e.g., celticfc.com, rangersfc.com, etc.)
function parseCFC(html, teamName = "Celtic") {
  const $ = cheerio.load(html);
  const fixtures = [];
  const teamPattern = String(teamName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
  const teamRegex = new RegExp(teamPattern, 'i');
  $("*").each((_, el) => {
    const block = $(el).text().replace(/\s+/g, " ").trim();
    if (!teamRegex.test(block) || !/v(?:s\.)?/i.test(block)) return;

    let { dateText, timeText } = extractDateTimeFallback(block);
    // Normalize time as per FWP
    if (/^(?:25|45|55|75):45pm$/i.test(timeText)) {
      const lastDigit = timeText.charAt(1);
      timeText = `${lastDigit}:45pm`;
    }
    const m12 = String(timeText||"").match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
    if (m12) {
      let hh = parseInt(m12[1], 10);
      const mm = m12[2];
      const ap = m12[3].toLowerCase();
      if (ap === 'pm' && hh < 12) hh += 12;
      if (ap === 'am' && hh === 12) hh = 0;
      timeText = `${String(hh).padStart(2,'0')}:${mm}`;
    }
    const m12b = String(timeText||"").match(/^(\d{1,2})(am|pm)$/i);
    if (m12b) {
      let hh = parseInt(m12b[1], 10);
      const ap = m12b[2].toLowerCase();
      if (ap === 'pm' && hh < 12) hh += 12;
      if (ap === 'am' && hh === 12) hh = 0;
      timeText = `${String(hh).padStart(2,'0')}:00`;
    }

    let opponent = null, homeAway = null;

    const vs1 = block.match(new RegExp(`${teamPattern}\\s+v(?:s\\.)?\\s+([^|@(\\-]+)$`, 'i'));
    const vs2 = block.match(new RegExp(`([^|@(\\-]+)\\s+v(?:s\\.)?\\s+${teamPattern}`, 'i'));
    if (vs1) { opponent = sanitizeOpponent(vs1[1]); homeAway = "H"; }
    else if (vs2) { opponent = sanitizeOpponent(vs2[1]); homeAway = "A"; }

    let competition = "";
    const compMatch = block.match(/\b(UEFA [^|]+|Champions League|Europa Conference League|Europa League|Scottish [^|]+|SPFL [^|]+|Premiership|League Cup|Scottish Cup)\b/i);
    if (compMatch) competition = compMatch[1];
    const compType = classifyCompetition(competition);

    // Skip past results
    const isResult = /\b\d+\s*-\s*\d+\b/.test(block) || /\bFT\b/i.test(block) || /Full\s*Time/i.test(block);
    if (!isResult && (opponent || dateText || timeText)) {
      if ((!timeText || /(am|pm)$/i.test(timeText) || !/^\d{1,2}:\d{2}$/.test(timeText)) && compType === 'european' && homeAway === 'A') {
        timeText = '17:45';
      }
      fixtures.push({
        date: null,
        dateText,
        timeText,
        opponent: opponent || "TBD",
        homeAway,
        competition,
        competitionType: compType,
        tv: ""
      });
    }
  });
  return fixtures.slice(0, 12);
}

// Fetch + parse for a given scraper source
async function fetchAndParseScraper(sourceKey, teamName, teamId, timeoutMs, debug = false) {
  const src = String(sourceKey || "").toLowerCase().trim();
  const mapKey = (src === "lfotv" || src === "livefootballontv") ? "livefootballontv" : src;
  
  // Build dynamic URLs based on teamName and teamId
  const dynamicUrls = buildScraperUrls(teamName, teamId);
  const url = dynamicUrls[mapKey] || dynamicUrls.fwp;

  if (!url) throw new Error(`[MyTeams:helper] SEC-002: scraper URL for "${mapKey}" is blocked (unsafe teamName)`);

  const res = mapKey === "fwp"
    ? await fetchFWPWithCookieSupport(url, timeoutMs, debug)
    : await doFetch(url, {}, timeoutMs);
  const html = await res.text();

  switch (mapKey) {
    case "fwp": default: return parseFWP(html, teamName, debug);
    case "bbc": return parseBBC(html, teamName);
    case "cfc": return parseCFC(html, teamName);
    case "sportsdb": return parseSportsDB(html, teamName);
    case "livefootballontv": return parseLiveFootball(html, teamName);
  }
}

// Try secondary sources in order if enabled
async function tryScrapersInOrder(flags, teamName, teamId, timeoutMs, debug) {
  const order = [];
  // Prefer FWP first as requested
  if (flags.scrapeFWP) order.push("fwp");
  if (flags.scrapeSportsDB) order.push("sportsdb");
  if (flags.scrapeBBC) order.push("bbc");
  if (flags.scrapeLFOTV) order.push("livefootballontv");
  if (flags.scrapeCFC) order.push("cfc");

  for (const src of order) {
    try {
      const list = await fetchAndParseScraper(src, teamName, teamId, timeoutMs, debug);
      if (Array.isArray(list) && list.length) {
        if (debug) console.log("[MyTeams:helper] Scraper success:", src, `(${list.length})`);
        return { fixtures: list, source: src };
      }
      if (debug) console.log("[MyTeams:helper] Scraper empty:", src);
    } catch (e) {
      console.warn("[MyTeams:helper] Scraper failed:", src, e.message);
    }
  }
  return { fixtures: [], source: order[0] || "fwp" };
}

/* ---------------------------
 * NodeHelper lifecycle
 * ---------------------------
 */
module.exports = NodeHelper.create({
  start: function() {
    console.log("Starting node helper for: MMM-MyTeams-Fixtures");
    loadCacheFromDisk();
    
    // Configure shared request manager
    requestManager.updateConfig({
        minRequestInterval: 2000,
        minDomainInterval: 1000,
        maxRetries: 3,
        requestTimeout: 15000
    });
  },

  stop: function() {
    // PERF-004: clear the queue-processor interval when the helper is stopped
    requestManager.destroy();
  },

  async socketNotificationReceived(notification, payload) {
    if (notification === "CLEAR_FIXTURES_CACHE") {
      try {
        cache = { ts: 0, ttl: 0, source: null, key: null, data: null };
        try { if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE); } catch (_) {}
        this.sendSocketNotification("FIXTURES_DATA", { fixtures: [], fetchedAt: new Date().toISOString(), usedSource: "cache-cleared" });
      } catch (e) {
        this.sendSocketNotification("FIXTURES_ERROR", { message: e.message || "Cache clear failed" });
      }
      return;
    }

    if (notification !== "GET_FIXTURES") return;

    const {
      source,
      teamName,
      teamId,
      apiUrl,
      season,
      fallbackSeason,
     leagueIds = [],
      uefaLeagueIds = [],
      maxFixtures,
      cacheTTL = 300000,
      requestTimeoutMs = 15000,
      debug = false,
      fallbackChain = true,

      // new API fallback and filtering flags
      useSearchEventsFallback = true,
      strictLeagueFiltering = false,

      // scraper flags
      
      scrapeFWP = true,
      scrapeLFOTV = true,
      scrapeSportsDB = true,
      scrapeBBC = true,
      scrapeCFC = true
    } = payload || {};

    const normalizedSource = String(source || "api").toLowerCase().trim();

    // SEC-004: Validate apiUrl before use — must be https:// and target thesportsdb.com
    const ALLOWED_API_HOSTNAME = "www.thesportsdb.com";
    try {
      const parsedApiUrl = new URL(apiUrl);
      if (parsedApiUrl.protocol !== "https:" || parsedApiUrl.hostname !== ALLOWED_API_HOSTNAME) {
        this.sendSocketNotification("FIXTURES_ERROR", {
          message: `Invalid apiUrl: must be https://${ALLOWED_API_HOSTNAME}/...`
        });
        return;
      }
    } catch (urlErr) {
      this.sendSocketNotification("FIXTURES_ERROR", {
        message: `Invalid apiUrl: ${urlErr.message}`
      });
      return;
    }

    // Cache key to avoid cross-team leakage and respect filtering flags
    const teamKey = String((teamId && String(teamId).trim()) ? String(teamId).trim() : (teamName || "")).toLowerCase();
    const cacheKey = `${normalizedSource}|${teamKey}|${(leagueIds||[]).join(',')}|${(uefaLeagueIds||[]).join(',')}|${strictLeagueFiltering?'strict':'loose'}|${useSearchEventsFallback?'searchOn':'searchOff'}`;

    // Serve cache if valid and key matches
    if (cache.data && Array.isArray(cache.data) && cache.data.length > 0 && cache.key === cacheKey && (Date.now() - cache.ts) < (cache.ttl || cacheTTL)) {
      if (debug) console.log("[MyTeams:helper] Serving fixtures from cache:", cache.source);
      this.sendSocketNotification("FIXTURES_DATA", {
        fixtures: cache.data,
        fetchedAt: new Date(cache.ts).toISOString(),
        usedSource: cache.source || "cache"
      });
      return;
    }

    const sendSuccess = (fixtures, usedSource) => {
      cache.ts = Date.now();
      cache.ttl = cacheTTL;
      cache.source = usedSource;
      cache.key = cacheKey;
      cache.data = fixtures;
      saveCacheToDisk(cacheTTL);

      this.sendSocketNotification("FIXTURES_DATA", {
        fixtures,
        fetchedAt: new Date(cache.ts).toISOString(),
        usedSource
      });
    };

    const sendError = (message) => {
      this.sendSocketNotification("FIXTURES_ERROR", { message });
    };

    try {
      // Primary path: API
      if (normalizedSource === "api") {
        if (!fetchInitialized || !_fetchImpl) throw new Error("Fetch API not available");

        const fixtures = await getFixturesFromAPI({
          apiUrl,
          teamId,
          teamName,
          season,
          fallbackSeason,
          requestTimeoutMs,
          maxFixtures,
         leagueIds,
          uefaLeagueIds,
          useSearchEventsFallback,
          strictLeagueFiltering,
          debug
        });

        if (Array.isArray(fixtures) && fixtures.length > 0) {
          // If API returned no away fixtures, supplement with FWP scraper away fixtures
          const apiAway = fixtures.filter(f => f.homeAway === "A").length;
          if (apiAway === 0) {
            try {
              const { fixtures: fwpFx } = await tryScrapersInOrder(
                { scrapeFWP: true, scrapeSportsDB: false, scrapeBBC: true, scrapeLFOTV: true, scrapeCFC: false },
                teamName,
                teamId,
                requestTimeoutMs,
                debug
              );
              // Normalize FWP dates into ISO using season string so away items sort/display
              const seasonStr = season === "auto" ? resolveSeasonAuto() : (season || resolveSeasonAuto());
              const fwpAway = Array.isArray(fwpFx) ? fwpFx.filter(f => f.homeAway === "A").map(f => ({
                ...f,
                date: f.date || inferISOFromDateText(f.dateText, seasonStr)
              })) : [];
              if (debug) console.log(`[MyTeams:helper] Supplement with FWP: apiAway=${apiAway}, fwpAway=${fwpAway.length}`);
              if (fwpAway.length) {
                // Merge + dedupe
                const merged = [...fixtures, ...fwpAway];
                const seen = new Set();
                const deduped = merged.filter(f => {
                  const key = `${f.date}|${f.timeText}|${(f.opponent||"").toLowerCase()}|${f.homeAway}|${(f.competition||"").toLowerCase()}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
                deduped.sort((a,b) => {
                  const ta = Date.parse(`${a.date || '9999-12-31'}T${(a.timeText || '23:59')}:00`);
                  const tb = Date.parse(`${b.date || '9999-12-31'}T${(b.timeText || '23:59')}:00`);
                  return (isNaN(ta) ? Infinity : ta) - (isNaN(tb) ? Infinity : tb);
                });
                const limited = typeof maxFixtures === 'number' ? deduped.slice(0, maxFixtures) : deduped;
                if (debug) console.log(`[MyTeams:helper] Supplemented fixtures merged=${limited.length}`);
                sendSuccess(limited, "api+fwp");
                return;
              }
            } catch (e) {
              console.warn("[MyTeams:helper] FWP supplement failed:", e.message);
            }
          }

          // If API returned no European fixtures (common for knockout draws), supplement from BBC
          const apiEuro = fixtures.filter(f => (f.competitionType || '').toLowerCase() === 'european').length;
          if (apiEuro === 0) {
            try {
              const { fixtures: bbcFx } = await tryScrapersInOrder(
                { scrapeBBC: true, scrapeFWP: false, scrapeLFOTV: false, scrapeSportsDB: false, scrapeBBC: true, scrapeCFC: false },
                teamName,
                teamId,
                requestTimeoutMs,
                debug
              );
              const seasonStr = season === "auto" ? resolveSeasonAuto() : (season || resolveSeasonAuto());
              const bbcEuro = Array.isArray(bbcFx) ? bbcFx.filter(f => (f.competitionType || '').toLowerCase() === 'european').map(f => ({
                ...f,
                date: f.date || inferISOFromDateText(f.dateText, seasonStr)
              })) : [];
              if (bbcEuro.length) {
                const merged = [...fixtures, ...bbcEuro];
                const seen = new Set();
                const deduped = merged.filter(f => {
                  const key = `${f.date}|${f.timeText}|${(f.opponent||"").toLowerCase()}|${f.homeAway}|${(f.competition||"").toLowerCase()}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
                deduped.sort((a,b) => {
                  const ta = Date.parse(`${a.date || '9999-12-31'}T${(a.timeText || '23:59')}:00`);
                  const tb = Date.parse(`${b.date || '9999-12-31'}T${(b.timeText || '23:59')}:00`);
                  return (isNaN(ta) ? Infinity : ta) - (isNaN(tb) ? Infinity : tb);
                });
                const limited = typeof maxFixtures === 'number' ? deduped.slice(0, maxFixtures) : deduped;
                if (debug) console.log(`[MyTeams:helper] Supplemented European fixtures from BBC: ${bbcEuro.length}, merged=${limited.length}`);
                sendSuccess(limited, "api+bbc");
                return;
              }
            } catch (e) {
              console.warn("[MyTeams:helper] BBC supplement failed:", e.message);
            }
          }

          sendSuccess(fixtures, "api");
          return;
        }

        if (fallbackChain) {
          if (debug) console.log("[MyTeams:helper] API returned empty; trying scrapers (secondary)...");
          const { fixtures: sfx, source: ssrc } = await tryScrapersInOrder(
            { scrapeFWP, scrapeLFOTV, scrapeSportsDB,  scrapeBBC,  scrapeCFC },
            teamName,
            teamId,
            requestTimeoutMs,
            debug
          );
          if (Array.isArray(sfx) && sfx.length > 0) {
            sendSuccess(sfx, ssrc);
            return;
          }
        }

        sendError("No upcoming fixtures (API empty and scrapers disabled or empty).");
        return;
      }

      // Secondary path: scrapers only, in required order
      const { fixtures: sfx, source: ssrc } = await tryScrapersInOrder(
        {  scrapeFWP, scrapeLFOTV, scrapeSportsDB, scrapeBBC, scrapeCFC },
        teamName,
        teamId,
        requestTimeoutMs,
        debug
      );
      if (Array.isArray(sfx) && sfx.length > 0) {
        sendSuccess(sfx, ssrc);
        return;
      }

      sendError("No upcoming fixtures from scrapers (all empty/failed).");
    } catch (err) {
      console.error("[MyTeams:helper] Error:", err);
      sendError(err.message || "Unknown error");
    }
  }
});
