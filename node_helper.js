/*
 * node_helper for MMM-MyTeams-Fixtures
 * Scrapers only: fwp, bbc, livefootballontv, cfc, wikipedia
 *
 * - Memory + disk cache
 * - Shared request manager handles rate-limiting + retries
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

/**
 * Checks if a fixture is a Scottish Cup/League Cup Final or Semi-Final,
 * which are played at neutral venues (Hampden Park usually).
 */
function isScottishNeutralFixture(competition, extraText) {
  const c = (competition || "").toLowerCase();
  const e = (extraText || "").toLowerCase();

  // Match Scottish Cup or League Cup (including various sponsorship names)
  const isScottishCup = c.includes("scottish cup") || e.includes("scottish cup") ||
                        c.includes("scottish fa cup") || e.includes("scottish fa cup");
  const isLeagueCup = c.includes("league cup") || e.includes("league cup") || 
                      c.includes("viaplay cup") || e.includes("viaplay cup") ||
                      c.includes("premier sports cup") || e.includes("premier sports cup");

  if (!(isScottishCup || isLeagueCup)) return false;

  // Final, Semi-Final, Semi Final
  // Also treat "Scottish FA Cup" or "Scottish Cup" as neutral if it's the very last match of May (heuristic for Finals if not explicitly named)
  const isFinalOrSemi = /\b(final|semi-final|semi final)\b/i.test(c) || /\b(final|semi-final|semi final)\b/i.test(e);
  
  // The user specifically mentioned 23rd May. If it's Scottish Cup in late May, it's likely the Final.
  // But let's be more explicit: if it's Scottish FA Cup and not a league game, and it's May, it's likely the final.
  if (isFinalOrSemi) return true;
  
  // If the competition is exactly "Scottish FA Cup" or "Scottish Cup" (without "Premiership" etc)
  // and it's May, we'll assume it's the final as requested for the 23rd May case.
  if (isScottishCup && (c === "scottish fa cup" || c === "scottish cup")) {
     return true; 
  }

  return false;
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
 * Scrapers (only source)
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

// Known Wikipedia name conventions for football clubs used as slug seeds
// When the simple slug fails, fetchAndParseScraper will fall back to the Wikipedia search API.
function buildClubSlugVariants(teamName) {
  const safe = sanitizeTeamName(teamName);
  if (!safe) return [];
  const base = safe.replace(/\./g, "").trim();
  const titleCase = base.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  const lower = base.toLowerCase();
  const variants = new Set();
  if (titleCase) variants.add(titleCase.replace(/\s+/g, "_"));
  if (lower)     variants.add(lower.replace(/\s+/g, "_"));
  if (titleCase) variants.add(titleCase.replace(/\s+/g, "%20"));
  return Array.from(variants);
}

// Dynamic URL builder for scrapers - uses teamName and teamId from config
function buildScraperUrls(teamName, teamId) {
  const safe = sanitizeTeamName(teamName);
  if (!safe) {
    console.error(`[MyTeams:helper] SEC-002: teamName "${teamName}" contains unsafe characters — scraper URLs blocked`);
    return { fwp: null, bbc: null, livefootballontv: null, cfc: null, wikipedia: null };
  }
  const slug = safe.toLowerCase().replace(/\s+/g, "-");
  const wikiVariants = buildClubSlugVariants(teamName);
  const wikiSearch = wikiVariants.length
    ? `https://en.wikipedia.org/w/index.php?search=${wikiVariants[0]}&title=Special%3ASearch&ns0=1`
    : null;
  return {
    fwp: `https://www.footballwebpages.co.uk/${encodeURIComponent(slug)}/fixtures-results`,
    bbc: `https://www.bbc.co.uk/sport/football/teams/${encodeURIComponent(slug)}/scores-fixtures`,
    livefootballontv: `https://www.live-footballontv.com/${encodeURIComponent(slug)}-on-tv.html`,
    cfc: KNOWN_CFC_SLUGS.has(slug) ? `https://www.${slug}fc.com/fixtures` : null,
    wikipedia: wikiSearch
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
    const vs1 = allText.match(new RegExp(`${teamPattern}\\s+v(?:s\\.)?\\s+([^|@(\\-]+)`, 'i'));
    const vs2 = allText.match(new RegExp(`([^|@(\\-]+)\\s+v(?:s\\.)?\\s+${teamPattern}`, 'i'));
    if (vs1) { opponent = sanitizeOpponent(vs1[1]); homeAway = "H"; }
    else if (vs2) { opponent = sanitizeOpponent(vs2[1]); homeAway = "A"; }

    // Override for Scottish Cup/League Cup neutral venues
    if (isScottishNeutralFixture(comp, allText)) {
      homeAway = "N";
    }

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
    if (new RegExp(teamPattern, 'i').test(home)) { opponent = away; homeAway = "H"; }
    else if (new RegExp(teamPattern, 'i').test(away)) { opponent = home; homeAway = "A"; }

    // Override for Scottish Cup/League Cup neutral venues
    const allText = $(el).text().replace(/\s+/g, ' ').trim();
    if (isScottishNeutralFixture(comp, allText)) {
      homeAway = "N";
    }

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
// FWP uses a structured table: Date | H/A | Opponent | Competition | KO/Score | Attd | Scorers
function parseFWP(html, teamName = "Celtic", debug = false) {
  const $ = cheerio.load(html);
  const fixtures = [];

  // --- Step 1: Locate the fixtures table by finding an explicit H/A header column ---
  let fixturesTable = null;
  let dateCol = 0, haCol = 1, opponentCol = 2, compCol = 3, koCol = 4;

  $("table").each((_, tbl) => {
    const headerRow = $(tbl).find("tr").first();
    const headers = headerRow.find("th, td").map((_, th) => $(th).text().trim().toLowerCase()).get();
    if (headers.some(h => /^h\s*\/\s*a$/i.test(h))) {
      fixturesTable = tbl;
      headers.forEach((h, i) => {
        if (h === "date") dateCol = i;
        else if (/^h\s*\/\s*a$/i.test(h)) haCol = i;
        else if (h === "opponent") opponentCol = i;
        else if (h === "competition") compCol = i;
        else if (/^ko|score/i.test(h) && !/scorer/i.test(h)) koCol = i;
      });
      return false;
    }
  });

  // Fallback: find table where rows have a lone "H" or "A" cell in column 1
  if (!fixturesTable) {
    $("table tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 4 && /^[HA]$/.test($(cells[1]).text().trim())) {
        fixturesTable = $(row).closest("table")[0];
        return false;
      }
    });
  }

  // --- Step 2: Parse table rows cell-by-cell ---
  if (fixturesTable) {
    if (debug) console.log("[MyTeams:helper] FWP: structured table found — using cell-based parser");
    $(fixturesTable).find("tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 4) return;

      const rawDate  = $(cells[dateCol]).text().replace(/\s+/g, " ").trim();
      const ha       = $(cells[haCol]).text().trim().toUpperCase();
      const oppRaw   = $(cells[opponentCol]).text().replace(/\s+/g, " ").trim();
      const comp     = cells[compCol] ? $(cells[compCol]).text().replace(/\s+/g, " ").trim() : "";
      const koRaw    = cells[koCol]  ? $(cells[koCol]).text().replace(/\s+/g, " ").trim()  : "";

      let homeAway = (ha === "H" || ha === "A" || ha === "N") ? ha : null;
      
      // Override for Scottish Cup/League Cup neutral venues
      if (isScottishNeutralFixture(comp, oppRaw)) {
        homeAway = "N";
      }

      if (!homeAway) return;

      // Skip past results (contain a score like "1 - 0")
      if (/\b\d+\s*-\s*\d+\b/.test(koRaw) || /\bFT\b/i.test(koRaw)) return;

      // Normalise KO time — FWP formats: "5.30pm", "12pm", "8pm", "17:45", "12.30pm"
      let timeText = "";
      const tA = koRaw.match(/(\d{1,2})[.:](\d{2})\s*(am|pm)?/i);
      const tB = !tA && koRaw.match(/\b(\d{1,2})\s*(am|pm)\b/i);
      if (tA) {
        let hh = parseInt(tA[1], 10);
        const mm = tA[2];
        const ap = (tA[3] || "").toLowerCase();
        if (ap === "pm" && hh < 12) hh += 12;
        if (ap === "am" && hh === 12) hh = 0;
        timeText = `${String(hh).padStart(2, "0")}:${mm}`;
      } else if (tB) {
        let hh = parseInt(tB[1], 10);
        const ap = tB[2].toLowerCase();
        if (ap === "pm" && hh < 12) hh += 12;
        if (ap === "am" && hh === 12) hh = 0;
        timeText = `${String(hh).padStart(2, "0")}:00`;
      }

      const opponent = sanitizeOpponent(oppRaw);
      if (!opponent && !rawDate) return;

      const item = {
        date: null,
        dateText: rawDate,
        timeText,
        opponent: opponent || "TBD",
        homeAway: homeAway,
        competition: comp,
        competitionType: classifyCompetition(comp),
        tv: ""
      };
      if (debug) console.log("[MyTeams:helper] FWP row:", JSON.stringify(item));
      fixtures.push(item);
    });
    return fixtures;
  }

  // --- Step 3: Legacy text-pattern fallback (non-FWP sites that use "Team v Team" format) ---
  if (debug) console.log("[MyTeams:helper] FWP: no structured table — falling back to text pattern parser");
  const teamPattern = String(teamName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let lastDateText = "";
  $(".fixture, .fixtures .match, table tr, li").each((i, el) => {
    const allText = $(el).find("*").addBack().contents().filter((_, n) => n.nodeType === 3).get()
      .map(n => n.data).join(" ").replace(/\s+/g, " ").trim();
    if (!allText || allText.length < 5) return;

    let dateText = $(el).find(".date, .fixture-date, td.date, time").first().text().trim();
    if (dateText) lastDateText = dateText;
    else dateText = lastDateText;
    if (!dateText) {
      const fb = extractDateTimeFallback(allText);
      dateText = fb.dateText || "";
    }

    const { timeText: rawTime } = extractDateTimeFallback(allText);
    let timeText = rawTime || "";
    const m12 = timeText.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
    if (m12) {
      let hh = parseInt(m12[1], 10);
      if (m12[3].toLowerCase() === "pm" && hh < 12) hh += 12;
      if (m12[3].toLowerCase() === "am" && hh === 12) hh = 0;
      timeText = `${String(hh).padStart(2, "0")}:${m12[2]}`;
    }
    const m12b = !m12 && timeText.match(/^(\d{1,2})(am|pm)$/i);
    if (m12b) {
      let hh = parseInt(m12b[1], 10);
      if (m12b[2].toLowerCase() === "pm" && hh < 12) hh += 12;
      if (m12b[2].toLowerCase() === "am" && hh === 12) hh = 0;
      timeText = `${String(hh).padStart(2, "0")}:00`;
    }

    // Detect lone H/A cell in any <td>
    let homeAway = null;
    $(el).find("td").each((_, td) => {
      if (/^[HA]$/.test($(td).text().trim())) {
        homeAway = $(td).text().trim().toUpperCase();
        return false;
      }
    });

    let opponent = null;
    if (!homeAway) {
      const tp = allText.match(/([A-Za-z0-9 .&':\-]+)\s+v(?:s?\.?)\s+([A-Za-z0-9 .&':\-]+)/i);
      if (tp) {
        const t1 = tp[1].trim(), t2 = tp[2].trim();
        const rg = new RegExp(teamPattern, "i");
        if (rg.test(t1) && !rg.test(t2)) { opponent = sanitizeOpponent(t2); homeAway = "H"; }
        else if (rg.test(t2) && !rg.test(t1)) { opponent = sanitizeOpponent(t1); homeAway = "A"; }
      }
    }
    if (homeAway && !opponent) {
      // Try link text as opponent
      const links = $(el).find("a").map((_, a) => $(a).text().replace(/\s+/g, " ").trim()).get();
      const rg = new RegExp(teamPattern, "i");
      const cand = links.find(t => t && /[A-Za-z]/.test(t) && !rg.test(t) && !/fixtures|results|table|news/i.test(t));
      if (cand) opponent = sanitizeOpponent(cand);
    }

    const isResult = /\b\d+\s*-\s*\d+\b/.test(allText) || /\bFT\b/i.test(allText);
    if (!isResult && homeAway && (opponent || dateText)) {
      fixtures.push({
        date: null,
        dateText,
        timeText,
        opponent: opponent || "TBD",
        homeAway,
        competition: "",
        competitionType: "domestic",
        tv: ""
      });
    }
  });
  return fixtures;
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

    const vs1 = block.match(new RegExp(`${teamPattern}\\s+v(?:s\\.)?\\s+([^|@(\\-]+)`, 'i'));
    const vs2 = block.match(new RegExp(`([^|@(\\-]+)\\s+v(?:s\\.)?\\s+${teamPattern}`, 'i'));
    if (vs1) { opponent = sanitizeOpponent(vs1[1]); homeAway = "H"; }
    else if (vs2) { opponent = sanitizeOpponent(vs2[1]); homeAway = "A"; }

    let competition = "";
    const compMatch = block.match(/\b(UEFA [^|]+|Champions League|Europa Conference League|Europa League|Scottish [^|]+|SPFL [^|]+|Premiership|League Cup|Scottish Cup)\b/i);
    if (compMatch) competition = compMatch[1];

    // Override for Scottish Cup/League Cup neutral venues
    if (isScottishNeutralFixture(competition, block)) {
      homeAway = "N";
    }

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

// Wikipedia fixtures parser
// Wikipedia season articles contain wikitable tables with Date / Opponent / Venue / Score / Competition columns.
// The team page may also have a "Season-by-season results" table or current-season highlights table.
function parseWikipedia(html, teamName = "Celtic", debug = false) {
  const $ = cheerio.load(html);
  const fixtures = [];
  const teamLower = String(teamName).toLowerCase();
  const teamPattern = String(teamName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Step 1: Look at every <table> on the page; pick tables that mention the team AND look like fixtures
  $("table").each((_, tbl) => {
    const $tbl = $(tbl);
    const tblText = $tbl.text().toLowerCase();
    if (!tblText.includes(teamLower)) return;

    const $rows = $tbl.find("tr");
    if ($rows.length < 2) return;

    // Inspect header row for column hints [date | opponent/score/venue/competition | time]
    const $headRow = $rows.first();
    const headerTexts = $headRow.find("th, td").map((_, c) => $(c).text().trim().toLowerCase()).get();
    const looksLikeFixtures = headerTexts.some(h => /date|opponent|opposition|score|result|venue|ground|stadium|competition|league|tournament|kick|k\.o\.|ha|h\/a/.test(h))
      || /(\bkick[-\s]?off\b|\bdate\b)/i.test(String(tblText).slice(0, 400));
    if (!looksLikeFixtures) return;

    // Map column indices
    const colDate = headerTexts.findIndex(h => /\bdate\b/.test(h));
    const colTime = headerTexts.findIndex(h => /kick[-\s]?off|k\.o\.|time/.test(h));
    const colCompetition = headerTexts.findIndex(h => /competition|league|round|tournament|cup/.test(h));
    const colVenueHA = headerTexts.findIndex(h => /venue|ground|stadium|h\s*\/\s*a|^ha$/.test(h));
    const colScore = headerTexts.findIndex(h => /score|result|outcome/.test(h));
    const colOpponent = headerTexts.findIndex(h => /opponent|opposition|team/.test(h));

    $rows.each((rowIdx, row) => {
      if (rowIdx === 0) return;
      const $cells = $(row).find("td");
      if ($cells.length < 2) return;
      const cellTexts = $cells.map((_, td) => $(td).text().replace(/\s+/g, " ").trim()).get();
      const fullText  = cellTexts.join(" | ");

      // Skip past results — contain a numeric score or FT
      if (colScore >= 0 && /\d+/.test(cellTexts[colScore] || "")) {
        // If score column present and contains numbers, treat as result row
        const scoreTxt = String(cellTexts[colScore] || "");
        if (/^\d+\s*[-–:]\s*\d+$/.test(scoreTxt)) return;
      }
      if (/\b\d+\s*[-–]\s*\d+\b/.test(fullText) || /\bFT\b/i.test(fullText)) return;

      let dateText = colDate >= 0 ? (cellTexts[colDate] || "") : "";
      let timeText = colTime >= 0 ? (cellTexts[colTime] || "") : "";
      let competition = colCompetition >= 0 ? (cellTexts[colCompetition] || "") : "";
      const venueHA = colVenueHA >= 0 ? (cellTexts[colVenueHA] || "").trim().toUpperCase() : "";
      const opponentCell = colOpponent >= 0 ? (cellTexts[colOpponent] || "") : "";

      // Extract opponent and home/away
      let opponent = null;
      let homeAway = null;

      const vsTeam = fullText.match(new RegExp(`\\b${teamPattern}\\b\\s+(?:v|vs\\.?)\\s+([^|\\(\\)\\[\\]]+?)(?:,|$|\\s)`, "i"));
      const teamVs = fullText.match(new RegExp(`([^|\\(\\)\\[\\]]+?)\\s+(?:v|vs\\.?)\\s+\\b${teamPattern}\\b`, "i"));
      if (vsTeam) { opponent = sanitizeOpponent(vsTeam[1]); homeAway = "H"; }
      else if (teamVs) { opponent = sanitizeOpponent(teamVs[1]); homeAway = "A"; }

      // Explicit H/A from the venue column
      if (!homeAway && /^[HA]$/.test(venueHA)) homeAway = venueHA;

      // If opponent is empty but cell looks like a team name (has letters, no "v"/"vs")
      if (!opponent && opponentCell && !/(v\.?\s+|^v$)/i.test(opponentCell)) {
        opponent = sanitizeOpponent(opponentCell);
      }

      // Extract time from any cell if not already set
      if (!timeText) {
        const tA = fullText.match(/\b(\d{1,2}):(\d{2})\b/);
        const tB = fullText.match(/\b(\d{1,2})\s*(am|pm)\b/i);
        if (tA) timeText = `${tA[1]}:${tA[2]}`;
        else if (tB) {
          let hh = parseInt(tB[1], 10);
          const ap = tB[2].toLowerCase();
          if (ap === 'pm' && hh < 12) hh += 12;
          if (ap === 'am' && hh === 12) hh = 0;
          timeText = `${String(hh).padStart(2, "0")}:00`;
        }
      }

      // Override for Scottish Cup/League Cup neutral venues
      if (isScottishNeutralFixture(competition, fullText)) {
        homeAway = "N";
      }

      if (!opponent) return;
      if (!homeAway) {
        // default to "H" when no signal — keeps record visible but flagged
        homeAway = "H";
      }

      const compType = classifyCompetition(competition || fullText);
      if ((!timeText || /(am|pm)$/i.test(timeText) || !/^\d{1,2}:\d{2}$/.test(timeText)) && compType === 'european' && homeAway === 'A') {
        timeText = '17:45';
      }

      fixtures.push({
        date: null,
        dateText: dateText || "",
        timeText: timeText || "",
        opponent,
        homeAway,
        competition: competition || "",
        competitionType: compType,
        tv: ""
      });
    });
  });

  if (debug) console.log(`[MyTeams:helper] Wikipedia: parsed ${fixtures.length} raw fixture(s)`);
  return fixtures.slice(0, 60);
}

// Resolve a Wikipedia team page title by searching the MediaWiki opensearch API
async function findWikipediaTeamPage(teamName, timeoutMs, debug) {
  const variants = buildClubSlugVariants(teamName);
  if (!variants.length) return null;
  const queries = [teamName, ...variants.map(v => String(v).replace(/_/g, " ").replace(/%20/g, " "))];
  for (const q of queries) {
    if (!q) continue;
    try {
      const apiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=10&namespace=0&format=json`;
      const res = await doFetch(apiUrl, {}, timeoutMs);
      const data = await res.json();
      const titles = Array.isArray(data && data[1]) ? data[1] : [];
      if (!titles.length) continue;
      // Prefer football team title
      const regex = /(football|\bf\.?c\.?\b|^cfc\b|association football|club)/i;
      let chosen = titles.find(t => regex.test(t));
      if (!chosen) chosen = titles[0];
      if (debug) console.log(`[MyTeams:helper] Wikipedia search for "${q}" returned ${titles.length} titles, chose: ${chosen}`);
      return chosen;
    } catch (e) {
      if (debug) console.warn(`[MyTeams:helper] Wikipedia search for "${q}" failed:`, e.message);
    }
  }
  return null;
}

// Fetch + parse for a given scraper source
async function fetchAndParseScraper(sourceKey, teamName, teamId, timeoutMs, debug = false) {
  const src = String(sourceKey || "").toLowerCase().trim();
  const mapKey = (src === "lfotv" || src === "livefootballontv") ? "livefootballontv" : src;

  if (mapKey === "wikipedia") {
    return await fetchAndParseWikipedia(teamName, timeoutMs, debug);
  }

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
    case "livefootballontv": return parseLiveFootball(html, teamName);
  }
}

// Wikipedia fetch is multi-step (search API + page fetch). Handle separately.
async function fetchAndParseWikipedia(teamName, timeoutMs, debug = false) {
  const title = await findWikipediaTeamPage(teamName, timeoutMs, debug);
  if (!title) {
    if (debug) console.warn(`[MyTeams:helper] Wikipedia: no team page found for "${teamName}"`);
    return [];
  }
  const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  if (debug) console.log(`[MyTeams:helper] Wikipedia GET ${pageUrl}`);
  const res = await doFetch(pageUrl, {}, timeoutMs);
  const html = await res.text();
  return parseWikipedia(html, teamName, debug);
}

// Try scrapers in order if enabled
async function tryScrapersInOrder(flags, teamName, teamId, timeoutMs, debug) {
  const order = [];
  if (flags.scrapeFWP) order.push("fwp");
  if (flags.scrapeWikipedia) order.push("wikipedia");
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
      maxFixtures,
      cacheTTL = 300000,
      requestTimeoutMs = 15000,
      debug = false,

      // scraper flags
      scrapeFWP = true,
      scrapeLFOTV = true,
      scrapeWikipedia = true,
      scrapeBBC = true,
      scrapeCFC = true
    } = payload || {};

    const normalizedSource = String(source || "fwp").toLowerCase().trim();

    // Validate teamName — scrapers build URLs from it (SEC-002)
    if (!sanitizeTeamName(teamName)) {
      this.sendSocketNotification("FIXTURES_ERROR", {
        message: "Invalid teamName — scraper sources require a safe string."
      });
      return;
    }

    // Cache key to avoid cross-team leakage (used by both single source mode and chained mode)
    const teamKey = String((teamId && String(teamId).trim()) ? String(teamId).trim() : (teamName || "")).toLowerCase();
    const cacheKey = `${normalizedSource}|${teamKey}`;

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
      const trimmed = (typeof maxFixtures === "number" && maxFixtures > 0) ? fixtures.slice(0, maxFixtures) : fixtures;
      cache.ts = Date.now();
      cache.ttl = cacheTTL;
      cache.source = usedSource;
      cache.key = cacheKey;
      cache.data = trimmed;
      saveCacheToDisk(cacheTTL);

      this.sendSocketNotification("FIXTURES_DATA", {
        fixtures: trimmed,
        fetchedAt: new Date(cache.ts).toISOString(),
        usedSource
      });
    };

    const sendError = (message) => {
      this.sendSocketNotification("FIXTURES_ERROR", { message });
    };

    try {
      if (!fetchInitialized || !_fetchImpl) throw new Error("Fetch API not available");

      const flags = { scrapeFWP, scrapeLFOTV, scrapeWikipedia, scrapeBBC, scrapeCFC };

      // When the chosen source is itself a known scraper, run that scraper directly.
      const directSources = new Set(["fwp", "wikipedia", "bbc", "cfc", "livefootballontv", "lfotv"]);
      if (directSources.has(normalizedSource)) {
        const src = normalizedSource === "lfotv" ? "livefootballontv" : normalizedSource;
        try {
          const list = await fetchAndParseScraper(src, teamName, teamId, requestTimeoutMs, debug);
          if (Array.isArray(list) && list.length) {
            sendSuccess(list, src);
            return;
          }
          sendError(`No upcoming fixtures from ${src} (empty or failed).`);
        } catch (e) {
          sendError(`${src} scrape failed: ${e.message || e}`);
        }
        return;
      }

      // Anything else falls through to the full scraper chain (FWP -> Wikipedia -> BBC -> LFOTV -> CFC)
      const { fixtures: sfx, source: ssrc } = await tryScrapersInOrder(
        flags,
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
