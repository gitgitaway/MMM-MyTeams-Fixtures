# Debugging Guide

This document explains how to use the debugging features of the MMM-MyTeams-Fixtures module and provides a complete reference for every log message the module can produce.

---

## Enabling Debug Mode

To enable detailed logging for both the frontend and backend:

1. In your `config.js`, set `debug: true` inside the module's `config` object.
2. Restart MagicMirror.

```javascript
config: {
  teamName: "Celtic",
  teamId: "133647",
  debug: true   // <-- add this
}
```

---

## Where to Read Logs

### Backend logs (Node Helper)

Appear in the terminal / process manager where MagicMirror is running.

| Environment | How to view |
|---|---|
| Terminal (direct) | Output is printed to the active terminal window |
| `pm2` | Run `pm2 logs` |
| Windows Tray (cmd / PowerShell) | Click the tray icon to open the console window |

Look for prefixes: `[MyTeams:helper]` and `[SharedRequestManager]`

### Frontend logs (Browser)

Appear in the browser's developer console.

- Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Opt+I` (Mac) in the MagicMirror window.
- Select the **Console** tab.

Look for prefix: `[MyTeams]`

---

## Backend Log Reference — `node_helper.js`

### Fatal Errors — `console.error` (always shown, no `debug: true` required)

These indicate a configuration or environment problem that prevents the module from running.

| Log Message | Cause | Fix |
|---|---|---|
| `[MyTeams:helper] ERROR: No fetch implementation available. Install node-fetch@2 or use Node.js 18+` | Neither native `fetch` (Node 18+) nor `node-fetch` v2 was found | Run `npm install` inside the module directory, or upgrade to Node.js 18+ |
| `[MMM-MyTeams-Fixtures] FATAL: node_helper.js is running from the wrong directory! Expected: MMM-MyTeams-Fixtures Got: <actual>` | The module folder has been renamed or the wrong `node_helper.js` was installed | Re-clone the module from GitHub into a folder named exactly `MMM-MyTeams-Fixtures` |
| `[MyTeams:helper] SEC-002: teamName "<name>" contains unsafe characters — scraper URLs blocked` | The `teamName` config value contains characters that are not safe to include in a URL (e.g. `<`, `>`, `"`, `\`) | Use only letters, numbers, spaces, hyphens, apostrophes, and dots in `teamName` |
| `[MyTeams:helper] Error: <message>` | An unhandled exception occurred in the main fetch chain | Check the full stack trace that follows; usually a network or parsing error |
| `[SharedRequestManager] ERROR: No fetch implementation available. Install node-fetch@2 or use Node.js 18+` | Same as above — triggered by the Shared Request Manager at startup | Same fix as above |
| `[SharedRequestManager] ERROR: <message>` | A request processed by the Shared Request Manager threw a hard error | Check the message for the specific URL or operation that failed |

---

### Warnings — `console.warn` (always shown, no `debug: true` required)

These are recoverable issues. The module continues but the affected step was skipped or retried.

#### Cache Warnings

| Log Message | Cause | Fix |
|---|---|---|
| `[MyTeams:helper] Cache load failed: <message>` | `fixtures-cache.json` exists but could not be parsed or read at startup | Delete `fixtures-cache.json` from the module directory to clear a corrupt cache |
| `[MyTeams:helper] Cache save failed: <message>` | The disk cache could not be written after a successful fetch | Check disk space and file permissions on the module directory |

#### Network / HTTP Warnings

| Log Message | Cause | Fix |
|---|---|---|
| `[MyTeams:helper] FWP pre-flight failed (will retry without cookies): <message>` | The pre-flight HEAD request to FootballWebPages failed; the module will continue without cookies | Usually a temporary network issue — no action needed |
| `[MyTeams:helper] API retry <N>/<total> after <ms>ms due to: <message>` | An API request failed and the module is retrying with exponential backoff (up to 3 retries: 2s → 4s → 8s) | If seen repeatedly, check your internet connection or TheSportsDB status |

#### API Fetch Warnings

These appear when individual API endpoint calls fail. The module tries the next step in the chain automatically.

| Log Message | Cause |
|---|---|
| `[MyTeams:helper] Next-events fetch failed: <message>` | `/eventsnext.php` call threw an exception |
| `[MyTeams:helper] Season (<season>) fetch failed: <message>` | `/eventsseason.php` for the primary season failed |
| `[MyTeams:helper] Fallback season (<season>) fetch failed: <message>` | `/eventsseason.php` for `fallbackSeason` also failed |
| `[MyTeams:helper] searchevents fallback failed: <message>` | `/searchevents.php` keyword search failed (only attempted if `useSearchEventsFallback: true`) |
| `[MyTeams:helper] Next-events altId fetch failed: <message>` | `/eventsnext.php` with an alternative resolved team ID failed |
| `[MyTeams:helper] Season (alt, <season>) fetch failed: <message>` | Season fetch with the alternative team ID failed |
| `[MyTeams:helper] Fallback season (alt, <season>) fetch failed: <message>` | Fallback season fetch with the alternative team ID also failed |

If **all** of the above appear in sequence, the API has returned nothing and the module will proceed to the scraper fallback chain (if `fallbackChain: true`).

#### Scraper Warnings

| Log Message | Cause | Fix |
|---|---|---|
| `[MyTeams:helper] Scraper failed: <src> <message>` | A scraper (`fwp`, `bbc`, `livefootballontv`, `sportsdb`, `cfc`) threw an exception | Usually a site layout change or a temporary network issue |
| `[MyTeams:helper] FWP supplement failed: <message>` | The hardcoded away-fixture supplement call to FWP failed entirely | Temporary — the module continues with API-only data |
| `[MyTeams:helper] BBC supplement failed: <message>` | The hardcoded European-fixture supplement call to BBC failed | Temporary — the module continues with API-only data |

---

### Info Logs — always shown (no `debug: true` required)

These appear in the terminal on every MagicMirror start.

| Log Message | Meaning |
|---|---|
| `Starting node helper for: MMM-MyTeams-Fixtures` | Node helper has started |
| `[MyTeams:helper] ✓ Loaded <N> fixtures from disk cache` | A valid `fixtures-cache.json` was found and loaded at startup |
| `[MyTeams:helper] ✓ Wrote <N> fixtures to disk cache` | Fresh fixture data was saved to `fixtures-cache.json` |

---

### Debug Logs — only shown with `debug: true`

These are verbose trace messages that show the internal state of every fetch step.

#### Team Resolution

| Log Message | Meaning |
|---|---|
| `[MyTeams:helper] API: resolvedTeamId=<id>, teamName=<name>` | The team ID that will be used for all API calls (either from config or resolved via `/searchteams.php`) |
| `[MyTeams:helper] Team candidates: [...]` | Top 5 team matches scored during team ID resolution from `/searchteams.php` |
| `[MyTeams:helper] Retrying with altTeamId=<id> (resolved by name)` | A second team ID was resolved by name and is being tried because the first returned no fixtures |
| `[MyTeams:helper] alt teamId resolution failed: <message>` | The alternative team ID lookup via `/searchteams.php` failed |

#### API Fetch Trace

| Log Message | Meaning |
|---|---|
| `[MyTeams:helper] API GET <url>` | The exact URL being requested |
| `[MyTeams:helper] Next-events: total=<n>, home=<h>, away=<a>` | Raw counts from `/eventsnext.php` before any filtering |
| `[MyTeams:helper] Next-events (after filter): total=<n>, home=<h>, away=<a>` | Counts after league and team ID filtering |
| `[MyTeams:helper] ✓ eventsnext.php returned <N> fixtures (<X> away)` | Final result of the next-events call |
| `[MyTeams:helper] Season-events(<season>): total=<n>, home=<h>, away=<a>` | Raw counts from `/eventsseason.php` |
| `[MyTeams:helper] ✓ eventsseason.php (<season>) returned <N> fixtures (<X> away)` | Result of a season endpoint call |
| `[MyTeams:helper] ✓ FINAL from eventsnext+eventsseason: <N> fixtures (<X> away) - RETURNING` | Combined next + season result being returned to the front-end |
| `[MyTeams:helper] ✓ eventsseason.php (<season>) standalone returned <N> fixtures (<X> away) - RETURNING` | Season-only result (when next-events was empty) |
| `[MyTeams:helper] Search-events: total=<n>, home~=<h>, away~=<a>` | Raw counts from `/searchevents.php` keyword search |
| `[MyTeams:helper] ✓ searchevents.php returned <N> fixtures (<X> away) - RETURNING` | Result of the search-events fallback |

#### Cache

| Log Message | Meaning |
|---|---|
| `[MyTeams:helper] Serving fixtures from cache: <source>` | A valid in-memory cache hit — no network request was made |

#### Supplement & Fallback Chain

| Log Message | Meaning |
|---|---|
| `[MyTeams:helper] Supplement with FWP: apiAway=<n>, fwpAway=<n>` | Away supplement was triggered; shows how many away fixtures the API had (0) and how many FWP found |
| `[MyTeams:helper] Supplemented fixtures merged=<N>` | Total fixture count after API + FWP away supplement merge and deduplication |
| `[MyTeams:helper] Supplemented European fixtures from BBC: <N>, merged=<N>` | European supplement via BBC; shows BBC result count and final merged total |
| `[MyTeams:helper] API returned empty; trying scrapers (secondary)...` | API returned 0 fixtures; `fallbackChain: true` is active so scrapers will be tried |

#### FWP Scraper Parsing (very verbose)

| Log Message | Meaning |
|---|---|
| `[MyTeams:helper] FWP pre-flight status: <status>, cookies obtained: ...` | Result of the FWP cookie pre-flight request |
| `[MyTeams:helper] FWP raw text <i> <text>` | Raw cell text extracted from FWP table row `<i>` |
| `[MyTeams:helper] FWP row <i> <JSON>` | Parsed fixture object from FWP table row `<i>` |

#### Scraper Chain

| Log Message | Meaning |
|---|---|
| `[MyTeams:helper] Scraper success: <src> (<N>)` | Scraper `<src>` returned `<N>` fixtures and was accepted |
| `[MyTeams:helper] Scraper empty: <src>` | Scraper `<src>` returned an empty list; next scraper in chain will be tried |

---

## Frontend Log Reference — `MMM-MyTeams-Fixtures.js`

These appear in the **browser developer console**.

### Debug logs (only with `debug: true`)

| Log Message | Meaning |
|---|---|
| `[MyTeams] start() - Language: <lang>` | Module has started; confirms the active language |
| `[MyTeams] Data received: <N> source: <source>` | Fresh fixture data was received from the node helper |

### Warnings (always shown — no `debug: true` required)

These indicate a non-fatal UI error. The module will continue running.

| Log Message | Cause |
|---|---|
| `[MyTeams] Error: <errorMessage>` | A `FIXTURES_ERROR` notification was received from the node helper; message shows what failed |
| `[MyTeams] countdown refresh error: <e>` | An exception occurred inside the countdown badge refresh timer |
| `[MyTeams] auto-cycle tick error: <err>` | An exception occurred during an auto-cycle filter rotation tick |
| `[MyTeams] startAutoCycle failed: <error>` | The auto-cycle timer could not be started |
| `[MyTeams] team switch error: <e>` | An exception occurred when switching between teams in multi-team mode |
| `[MyTeams] filter click error: <err>` | An exception occurred when a filter tab was clicked |
| `[MyTeams] refresh click error: <e>` | An exception occurred when the Refresh button was clicked |
| `[MyTeams] clear cache click error: <e>` | An exception occurred when the Clear Cache button was clicked |
| `[MyTeams] pin click error: <e>` | An exception occurred when the Pin button was clicked |
| `[MyTeams-Fixtures] scroll listener error: <e>` | An exception occurred inside the table scroll event listener |
| `[MyTeams] next-tab countdown error: <e>` | An exception occurred updating the "Next tab in Xs" countdown display |

---

## SharedRequestManager Log Reference

The `SharedRequestManager` has its own internal debug flag (separate from the module's `debug: true`). Its logs use the prefix `[SharedRequestManager]`.

| Log Message | Level | Shown when |
|---|---|---|
| `[SharedRequestManager] ERROR: No fetch implementation available...` | Error | Always |
| `[SharedRequestManager] ERROR: <message>` | Error | Always (for any hard request failure) |
| `[SharedRequestManager] ✓ Shared Request Manager initialized` | Info | SRM debug enabled |
| `[SharedRequestManager] <throttle / retry / deduplication messages>` | Info | SRM debug enabled |

> The SRM's debug mode is controlled by the `debug` property of its internal config and is not directly linked to the module's `debug: true` config option.

---

## Common Log Sequences & What They Mean

### Healthy startup with cached data

```
Starting node helper for: MMM-MyTeams-Fixtures
[MyTeams:helper] ✓ Loaded 12 fixtures from disk cache
[MyTeams:helper] Serving fixtures from cache: api
```

### Healthy fresh fetch (API with away supplement)

```
[MyTeams:helper] API: resolvedTeamId=133647, teamName=Celtic
[MyTeams:helper] ✓ eventsnext.php returned 8 fixtures (0 away)
[MyTeams:helper] Supplement with FWP: apiAway=0, fwpAway=4
[MyTeams:helper] Supplemented fixtures merged=12
[MyTeams:helper] ✓ Wrote 12 fixtures to disk cache
```

*Footer will show: `TheSportsDB + FWP`*

### API completely empty → fallback chain

```
[MyTeams:helper] Next-events fetch failed: timeout
[MyTeams:helper] Season (2025-2026) fetch failed: timeout
[MyTeams:helper] API returned empty; trying scrapers (secondary)...
[MyTeams:helper] Scraper success: fwp (10)
[MyTeams:helper] ✓ Wrote 10 fixtures to disk cache
```

*Footer will show: `fwp`*

### All sources failed

```
[MyTeams:helper] Next-events fetch failed: ...
[MyTeams:helper] Season (2025-2026) fetch failed: ...
[MyTeams:helper] Scraper failed: fwp Network timeout
[MyTeams:helper] Scraper empty: bbc
[MyTeams:helper] Error: No upcoming fixtures (API empty and scrapers disabled or empty).
```

*Display will show: error banner*

---

## Contrast Warning (Frontend)

If `fontColorOverride` is set in your config, the module performs a basic luminance check when rendering. If your chosen colour may be hard to read against a dark background, a warning is logged to the browser console. This does not affect functionality.

---

*For related documentation see:*
- [`Troubleshooting.md`](./Troubleshooting.md)
- [`HowThisModuleWorks.md`](./HowThisModuleWorks.md)
- [`SHARED_REQUEST_MANAGER.md`](./SHARED_REQUEST_MANAGER.md)
