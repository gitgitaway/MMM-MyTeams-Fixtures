# How This Module Works

**MMM-MyTeams-Fixtures** — Technical Architecture & Data Flow

---

## Overview

The module is split into two halves that communicate via MagicMirror's socket system:

| Part | File | Runs in |
|------|------|---------|
| **Front-end** | `MMM-MyTeams-Fixtures.js` | Browser / Electron renderer |
| **Back-end** | `node_helper.js` | Node.js server process |

The front-end renders the UI and handles user interaction. The back-end fetches, caches, and merges fixture data from multiple sources.

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
| `leagueIds` | `["4330","4364","4363","4888"]` | Domestic leagues & cups |
| `uefaLeagueIds` | `["4480","4481","5071"]` | UEFA Champions/Europa/Conference |

When `strictLeagueFiltering: true`, only events whose `idLeague` is in one of these arrays (or matches a known name pattern) are kept. When `false`, events for your team are kept regardless of league.

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

Scrapers are secondary sources used only when the API is insufficient.

| Key | Site | When Used |
|-----|------|-----------|
| `fwp` | footballwebpages.co.uk | Supplement API (away fixtures) |
| `bbc` | bbc.co.uk/sport | Full fallback |
| `livefootballontv` | live-footballontv.com | Full fallback |
| `sportsdb` | thesportsdb.com (HTML) | Full fallback |
| `cfc` | `<slug>fc.com` | Full fallback (known clubs only) |

All scraper URLs are built from `teamName` using `buildScraperUrls()`. The `teamName` is validated by `sanitizeTeamName()` before any URL is constructed (SEC-002).

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
