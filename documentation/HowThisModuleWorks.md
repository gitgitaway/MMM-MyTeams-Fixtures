# How This Module Works

**MMM-MyTeams-Fixtures** — Technical Architecture & Data Flow

---

## Overview

The module is split into two halves that communicate via MagicMirror's socket system:

| Part     | File | Runs in | What does it do         |
|----------|------|---------|-------------------------|
| **Front-end**   | `MMM-MyTeams-Fixtures.js` | Browser / Electron renderer | The front-end renders the UI and handles user interaction. |
| **Back-end**    | `node_helper.js` | Node.js server process |The back-end fetches, caches, and merges fixture data from multiple sources.  |


---

## Primary vs. Secondary Data Sources

The module uses a multi-tiered fetching strategy to ensure data availability even when the primary API is incomplete or offline.

### 1. Primary Source: TheSportsDB API
The module's main engine is **TheSportsDB JSON API**.
- **Approach**: **Structured Data Fetching**. It queries specific endpoints (`eventsnext.php`, `eventsseason.php`) to retrieve precise JSON objects.
- **Benefits**: High accuracy, includes specific metadata (IDs for teams and leagues), and is generally the fastest method.
- **potential Drawbacks**: changes to the scrapped web site may lead to Regex/parsing issues or out of place fixtures being displayed.
- **Config Requirements**:
    - **MUST Use**: `source: "api"` (default), `apiUrl`, `teamId` (or `teamName` for auto-resolution), `season`, `leagueIds`, `uefaLeagueIds`.
    - **MUST NOT Use**: Manually disabling all scrapers (if you want reliability).

### 2. Secondary Source: Scrapers
When the API lacks data (e.g., missing away fixtures or knockout draws), the module falls back to its **Scraper Chain**.
- **Approach**: **Unstructured Data Parsing (Web Scraping)**. It fetches HTML from sites like FootballWebPages, BBC, and LiveFootballOnTV, then parses the text to "guess" the fixture details.
- **Benefits**: Provides a critical safety net. Scrapers often have the most up-to-date broadcast times and cup fixtures before they hit the global databases.
- **Drawbacks**: Changes to the web site may lead to regex/Parsing issues or weird out of place fixtures being listed.
- **Config Requirements**:
    - **MUST Use**: `teamName` (used to build URLs), scraper flags (e.g., `scrapeFWP: true`).
    - **MUST NOT Use**: `apiUrl`, `teamId`, `season` (scrapers ignore these as they parse live web pages directly).

---

## Critical Fallback & Filtering Options

Understanding these three options is key to a stable setup:

### `fallbackChain: true`
This is the bridge between the API and the Scrapers.
- **Function**: If the API returns 0 fixtures, the module automatically restarts the fetch process using the Scrapers in the order of: **FWP → LFOTV → SportsDB → BBC → CFC**.
- **Importance**: Without this, if TheSportsDB is down or missing your team's next match, the module will simply show "No upcoming fixtures".

### `useSearchEventsFallback: true`
A specialized API-only fallback mechanism.
- **Function**: If the standard `eventsnext` and `eventsseason` calls return nothing, the module tries a keyword search (`searchevents.php`) for patterns like "TeamName_vs_" and "_vs_TeamName".
- **Importance**: Essential for teams where the primary ID might be inconsistent or for cup matches that haven't been correctly linked to a team's primary season schedule yet.

### `strictLeagueFiltering: true`
Controls how "noisy" your fixture list is.
- **Function**:
    - **`true`**: Only shows matches that belong to your `leagueIds` or `uefaLeagueIds` (plus known domestic/European patterns).
    - **`false`**: Shows *every* match found for your team, including friendlies, reserve matches, or irrelevant tournaments.
- **Importance**: Keeps the UI clean. **Note**: Scrapers are generally exempt from this to ensure they catch everything when the API fails.

---

## Summary of Configuration Usage

| Config Option | Used by API? | Used by Scrapers? | Notes |
| :--- | :---: | :---: | :--- |
| `source` | ✅ | ✅ | Set to `"api"` for primary or `"scraper"` to bypass API. |
| `apiUrl` | ✅ | ❌ | Points to the JSON endpoint. |
| `teamId` | ✅ | ⚠️ | Critical for API; used by `sportsdb` scraper only. |
| `teamName` | ✅ | ✅ | Used for search fallback in API; Primary key for Scrapers. |
| `season` / `fallbackSeason` | ✅ | ❌ | API uses these to find historical/future lists. |
| `leagueIds` / `uefaLeagueIds` | ✅ | ❌ | Used for filtering API results. |
| `scrape*` flags | ⚠️ | ✅ | API uses these only if `fallbackChain` is active. |

---

## Footer Messages — What to Expect

### The Two Scraper Mechanisms (and Why They Matter for the Footer)

The module has **two completely separate mechanisms** that invoke scrapers. Understanding the difference explains why the footer sometimes shows scraper sources even when you have disabled them in config.

| Mechanism | When It Runs | Respects Your Scraper Flags? |
|---|---|---|
| **Supplement** (lines 1401–1482 of `node_helper.js`) | `source:"api"`, API returns >0 fixtures, but **no away fixtures** (`apiAway===0`) or **no European fixtures** (`apiEuro===0`) | ❌ **No** — uses hardcoded flags |
| **Fallback Chain** (lines 1488–1501 of `node_helper.js`) | `source:"api"`, API returns **0 fixtures**, AND `fallbackChain: true` | ✅ **Yes** — uses your config flags |

The supplement logic **hardcodes** its own scraper flags and completely bypasses your config:

- **Missing away fixtures** → internally forces `{ scrapeFWP: true, scrapeLFOTV: true, scrapeBBC: true }` → footer shows `"api+fwp"`
- **Missing European fixtures** → internally forces `{ scrapeBBC: true }` → footer shows `"api+bbc"`

Your `scrapeFWP: false` (or any other scraper flag set to `false`) **only suppresses that scraper in the fallback chain** — it has no effect on the supplement step.

---

### Why `source:"api"` + All Scrapers `false` Still Shows `"TheSportsDB + FWP"`

If the supplement at line 1402 detected **zero away fixtures** from the API. It then hardcodes `scrapeFWP: true` internally and calls FWP regardless of your config. The result `"api+fwp"` is displayed as `"TheSportsDB + FWP"` in the footer. This is by design — the module always tries to give you a complete home + away fixture list.

---

### Footer Messages by Config Scenario

#### When `source:` is a scraper name (not `"api"`)

When `source` is set to anything other than `"api"` (e.g. `"fwp"`, `"bbc"`, `"livefootballontv"`, `"cfc"`, `"sportsdb"`), the module skips the API entirely and goes straight to the **Secondary path**. It calls `tryScrapersInOrder` using **your** boolean flags. If all scraper flags are `false`, the order array is empty and nothing runs.

| `source:` value | All scrapers `false` | Footer result |
|---|---|---|
| `"livefootballontv"` | all `false` | ❌ Error Banner: `"No upcoming fixtures from scrapers (all empty/failed)."` |
| `"bbc"` | all `false` | ❌ Error Banner |
| `"fwp"` | all `false` | ❌ Error Banner |
| `"cfc"` | all `false` | ❌ Error Banner |
| `"sportsdb"` | all `false` | ❌ Error Banner |

> The name you put in `source:` does **not** control which scraper runs — only whether the API path or the scraper path is entered. The boolean flags (`scrapeFWP`, `scrapeBBC`, etc.) control which scrapers actually execute.

#### When `source:"api"`, one scraper enabled, rest `false`

The supplement logic is **always hardcoded** — your user flags have no effect on it. The scraper flags only change what happens in the **fallback chain** (when the API returns 0 results).

`fallbackChain` defaults to `true` (line 1312 of `node_helper.js`).

| Enabled flag | API returns data (normal) | API returns 0 results + `fallbackChain: true` |
|---|---|---|
| `scrapeFWP: true` only | Same supplement behaviour as all-`false` | ✅ `"fwp"` |
| `scrapeSportsDB: true` only | Same | ✅ `"sportsdb"` |
| `scrapeLFOTV: true` only | Same | ✅ `"livefootballontv"` |
| `scrapeBBC: true` only | Same | ✅ `"bbc"` |
| `scrapeCFC: true` only | Same | ✅ `"cfc"` |

> ⚠️ **Typo warning**: The correct key is `scrapeFWP` (one `e`). If you write `scrappeFWP` (double `p`) in your config, the module does not find `scrapeFWP` in the payload and falls back to its **default value of `true`**. This means the typo causes the scraper to be **enabled** — the opposite of what you may intend if trying to disable it.

---

### Complete Footer Reference Table

| `source:` | Scraper flags | API has data | API returns 0 + `fallbackChain:true` |
|---|---|---|---|
| `"api"` | all `false` | `"api"`, `"api+fwp"`, or `"api+bbc"` (supplement decides) | Error Banner |
| `"api"` | `scrapeFWP: true` | same as above (supplement ignores flags) | `"fwp"` |
| `"api"` | `scrapeBBC: true` | same as above | `"bbc"` |
| `"api"` | `scrapeSportsDB: true` | same as above | `"sportsdb"` |
| `"api"` | `scrapeLFOTV: true` | same as above | `"livefootballontv"` |
| `"api"` | `scrapeCFC: true` | same as above | `"cfc"` |
| any scraper name | all `false` | N/A — API not called | Error Banner |
| any scraper name | matching flag `true` | N/A | scraper footer label |

---

## Data Flow (Step by Step)

```
User opens MagicMirror
        │
        ▼
front-end: start()
  ├─ sends "GET_FIXTURES" socket notification
  ├─ starts updateInterval timer (default 10 min)
  └─ shows skeleton loader

        │
        ▼
node_helper: socketNotificationReceived("GET_FIXTURES")
  ├─ SEC-004: validate apiUrl (must be https://www.thesportsdb.com)
  ├─ SEC-002: validate teamName (safe characters only)
  ├─ check in-memory + disk cache → serve if valid
  └─ proceed to fetch chain if cache miss

        │
        ▼
FETCH CHAIN (source = "api")
  Step 1: /eventsnext.php?id=<teamId>
    └─ Returns ≤15 upcoming events
    └─ Filter by teamId + leagueIds
    └─ If enough fixtures → supplement season data → return

  Step 2: /eventsseason.php?id=<teamId>&s=<season>
    └─ Full season list filtered to future dates
    └─ Try current season, then fallbackSeason

  Step 3: /searchevents.php (useSearchEventsFallback=true)
    └─ Pattern search: "TeamName_vs_" and "_vs_TeamName"
    └─ Useful when teamId is unknown or returns empty

  Step 4: Re-resolve teamId via /searchteams.php
    └─ Try season fetch with the alternative ID

  Step 5: FWP supplement (API returned no away fixtures)
    └─ Scrape FootballWebPages for away-only data
    └─ Merge + deduplicate against API results
    └─ Source shown as "api+fwp" in footer

  Step 6: Full scraper fallback chain (if all above fail)
    └─ FWP → LiveFootballOnTV → BBC → SportsDB site → CFC site
    └─ Each enabled by its scrape* config flag

        │
        ▼
node_helper: sendSocketNotification("FIXTURES_DATA", { fixtures, fetchedAt, usedSource })
  └─ Also writes to disk cache (fixtures-cache.json)

        │
        ▼
front-end: socketNotificationReceived("FIXTURES_DATA")
  ├─ stores fixtures + metadata
  ├─ INN-004: schedules pre-match alert if enableAlerts=true
  ├─ INN-001: computes countdown to first fixture
  ├─ calls updateDom() → getDom()
  └─ renders table with filter tabs
```

---

## Key Components

### Season Auto-Detection

When `season: "auto"`, the module calculates the current football season:
- **Before 30 June**: current season is `YYYY-1/YYYY` (e.g. 2024-2025)
- **After 1 July**: current season is `YYYY/YYYY+1` (e.g. 2025-2026)

The `fallbackSeason` config value is tried if the auto season returns empty.

### League Filtering

Two arrays control which competitions are fetched:

| Config | Default (Celtic) | Purpose |
|--------|-----------------|---------|
| `leagueIds` | `["4330","4364","4363","4888"]` | Scottish Domestic leagues & cups |
| `uefaLeagueIds` | `["4480","4481","5071"]` | UEFA Champions/Europa/Conference |

When `strictLeagueFiltering: true`, only events whose `idLeague` is in one of these arrays (or matches a known name pattern) are kept. 
When `false`, events for your team are kept regardless of league.

### Competition Classification

Each fixture is tagged as `domestic`, `european`, or `friendly` based on the competition name. This powers the filter tabs. Classification uses regex patterns:

- **European**: `uefa`, `champions`, `europa`, `conference`
- **Domestic**: `scottish`, `spfl`, `premiership`, `league cup`, `english`, `efl`, `championship`
- **Friendly**: `friendly`, `tour`, `pre-season`

### Caching System

Two layers of cache prevent unnecessary API calls:

1. **In-memory cache** (`cache` object in `node_helper.js`)
   - Fastest — no disk I/O
   - Lost when MagicMirror restarts

2. **Disk cache** (`fixtures-cache.json`)
   - Survives restarts
   - Loaded at `start()` by `loadCacheFromDisk()`
   - Saved after every successful fetch

Cache key includes: `source | teamKey | leagueIds | uefaLeagueIds | strictMode | searchFallback`  
This prevents one team's cache from being served to a different team's config.

Default TTL: **5 minutes** (`cacheTTL: 300000`).
Can be set to 0 in the config if you wish to clear cache on start up.

### Shared Request Manager

All HTTP calls in `node_helper.js` go through `shared-request-manager.js`, a singleton queue that:

- Prevents simultaneous requests (processes one at a time)
- Enforces a 2-second gap between all requests
- Enforces a 1-second gap between requests to the same domain
- Deduplicates identical in-flight requests
- Retries failed requests up to 3 times with exponential backoff (2s → 4s → 8s)

See [`SHARED_REQUEST_MANAGER.md`](./SHARED_REQUEST_MANAGER.md) for full detail.

---

## Front-End Architecture

### State Properties

| Property | Type | Purpose |
|----------|------|---------|
| `isLoading` | boolean | Shows skeleton loader |
| `errorMessage` | string\|null | Shows error banner |
| `fixtures` | array | Full unfiltered fixture list |
| `usedSource` | string | Displayed in footer |
| `fetchedAt` | string | ISO timestamp for stale detection |
| `_activeTeamIndex` | number | Active team in multi-team mode |
| `_isPinned` | boolean | Pauses auto-cycle |
| `_cycleTimer` | number\|null | auto-cycle setInterval handle |
| `_alertFired` | Set | Prevents duplicate alert notifications |

### Timer Management

| Timer | Purpose | Cleared on |
|-------|---------|-----------|
| `_updateTimer` | Periodic data refresh | `stop()` |
| `_countdownTimer` | Countdown badge refresh | `stop()` |
| `_cycleTimer` | Auto-cycle filter rotation | `stop()` + pin button |
| `_nextTabTimer` | "Next tab in Xs" display | Each cycle tick |
| `_alertTimer` | Pre-match alert scheduling | `stop()` + new data |

### getDom() Rendering Order

1. Skeleton loader (while `isLoading`)
2. Error banner (if `errorMessage`)
3. Empty message (if no fixtures)
4. Team switcher row (if `teams` array has 2+ entries)
5. Header row:
   - Left: countdown badge + filter tabs with counts
   - Right: Refresh / Clear Cache / Pin buttons
6. Scrollable table (`fixtures-scroll` div)
   - Sticky `<thead>` with column headers
   - `<tbody class="fixtures-tbody">` with one row per fixture
   - Live rows highlighted with `🔴` and score
7. Scroll controls (Back to Top + next-tab countdown)
8. Footer (`source-footer`) if `showFooter: true`

---

## Scraper Details

Scrapers are secondary sources used only when the API data return is insufficient or missing.

| Key | Site | When Used |
|-----|------|-----------|
| `fwp` | footballwebpages.co.uk | Supplement API (away fixtures) |
| `bbc` | bbc.co.uk/sport | Full fallback |
| `livefootballontv` | live-footballontv.com | Full fallback |
| `sportsdb` | thesportsdb.com (HTML) | Full fallback |
| `cfc` | `<slug>fc.com` | Full fallback (known clubs only) |

All scraper URLs are built from `teamName` using `buildScraperUrls()`. 
The `teamName` is validated by `sanitizeTeamName()` before any URL is constructed (SEC-002).

---

## Socket Notifications

| Direction | Notification | Payload |
|-----------|-------------|---------|
| Front → Back | `GET_FIXTURES` | Full config object |
| Front → Back | `CLEAR_FIXTURES_CACHE` | *(none)* |
| Back → Front | `FIXTURES_DATA` | `{ fixtures, fetchedAt, usedSource }` |
| Back → Front | `FIXTURES_ERROR` | `{ message }` |
| Front → MM² | `SHOW_ALERT` | `{ title, message, timer }` |

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| API returns empty | Falls through to scraper chain |
| All sources empty | Shows "No upcoming fixtures" message |
| Fetch throws | `FIXTURES_ERROR` → error banner displayed |
| Stale cache (>2× TTL) | Footer turns amber with `⚠ Data may be outdated` |
| Wrong `apiUrl` | Rejected immediately by SEC-004 validation |
| Unsafe `teamName` | Scraper URLs blocked by SEC-002 validation |

---

*For related documentation see:*
- [`Troubleshooting.md`](./Troubleshooting.md)
- [`SHARED_REQUEST_MANAGER.md`](./SHARED_REQUEST_MANAGER.md)
- [`MultiTeamAndAlerts-Guide.md`](./MultiTeamAndAlerts-Guide.md)
