# Troubleshooting Guide

**MMM-MyTeams-Fixtures** — Common issues and how to fix them

---

## Quick Diagnostics Checklist

Before diving into specific issues, enable debug mode and check the MagicMirror logs:

```javascript
config: {
  debug: true
}
```

Then restart MagicMirror and watch the console output. All module log lines are prefixed `[MyTeams]` (front-end) or `[MyTeams:helper]` (back-end).

To view logs:
```bash
# If running PM2
pm2 logs MagicMirror

# If running directly
npm start
# Logs appear in the terminal window
```

---

## Issue: No Fixtures Displayed

### Symptom
The module shows "No upcoming fixtures" or stays on the skeleton loader indefinitely.

### Causes & Fixes

**1. Wrong `teamId`**

The most common cause. Check your team ID:
- Visit [thesportsdb.com](https://www.thesportsdb.com/) and search for your team
- The ID is in the URL: `/team/133647-Celtic` → ID is `133647`
- Cross-reference with `football_teams_database.csv` in the module root

See [`FindingYourTeamID.md`](./FindingYourTeamID.md) for a step-by-step guide.

**2. Wrong `leagueIds`**

If `strictLeagueFiltering: true` (default), only fixtures in the specified leagues appear. If your league IDs are wrong, nothing passes the filter.

Fix — temporarily set `strictLeagueFiltering: false` to see if fixtures appear:
```javascript
strictLeagueFiltering: false
```
If fixtures appear, your `leagueIds` are wrong. Look up the correct IDs on TheSportsDB.

**3. Off-Season / Pre-Season**

During summer, the current season may have ended and the next season not yet loaded into the API.

Fix — set `season` manually:
```javascript
season: "2025-2026",
fallbackSeason: "2026-2027"
```

**4. API Rate Limit**

If you have multiple MMM-MyTeams modules, the Shared Request Manager normally prevents this. But if you are hitting the TheSportsDB free tier limit:
- Wait a few minutes and reload
- Check debug logs for `429` responses
- Consider increasing `updateInterval` to 30 minutes

**5. Node.js / Fetch Not Available**

Check the terminal for:
```
ERROR: No fetch implementation available. Install node-fetch@2 or use Node.js 18+
```

Fix:
```bash
cd ~/MagicMirror/modules/MMM-MyTeams-Fixtures
npm install
```

---

## Issue: Only Home Fixtures Showing

### Symptom
All "Away" tab fixtures are missing. The "Away" filter tab is disabled or empty.

### Cause
TheSportsDB's free API tier often returns only home fixtures from `/eventsnext.php`. This is a known limitation.

### Fix
Enable the FWP scraper supplement (it is on by default):
```javascript
scrapeFWP: true
```

With `scrapeFWP: true`, the module automatically fetches away fixtures from FootballWebPages and merges them with the API data. The footer will show `Source: api+fwp` when this is active.

If the away fixtures still do not appear:
1. Enable debug mode and look for `[MyTeams:helper] Supplement with FWP:` log lines
2. Check that `teamName` matches the slug used on footballwebpages.co.uk  
   (e.g. `"Manchester United"` → `manchester-united`)
3. Try visiting `https://www.footballwebpages.co.uk/<your-slug>/fixtures-results` in a browser to confirm the page exists

---

## Issue: Wrong Team's Fixtures Showing

### Symptom
The module shows fixtures but they are for the wrong team (e.g. Rangers instead of Celtic).

### Cause
The `teamName` is ambiguous and team ID resolution picked the wrong match, or you have an old cached result.

### Fix

1. **Clear the cache** — use the ✕ button in the module header, or delete `fixtures-cache.json`:
   ```bash
   rm ~/MagicMirror/modules/MMM-MyTeams-Fixtures/fixtures-cache.json
   ```

2. **Provide an explicit `teamId`**:
   ```javascript
   teamId: "133647"   // Always specify; never rely on name resolution alone
   ```

3. If you are providing both `teamId` and `teamName`, the `teamId` takes precedence for API lookups. The `teamName` is only used for display and scraper URL construction.

---

## Issue: Module Not Loading / Blank Screen

### Symptom
The module position is blank. No content appears, no error message.

### Causes & Fixes

**1. Directory Name Mismatch**

The module folder **must** be named `MMM-MyTeams-Fixtures` (exact case). Check:
```bash
ls ~/MagicMirror/modules/ | grep MyTeams
```
If the folder name is different, rename it.

**2. Config File Syntax Error**

A syntax error in `config.js` prevents MagicMirror from loading. Check:
```bash
node -e "require('./config/config.js')"
```
Any JSON/JS syntax error will be shown.

**3. Wrong `node_helper.js`**

If you have multiple MMM-MyTeams modules, a `node_helper.js` from another module may have ended up in this folder. Check the terminal for:
```
FATAL: node_helper.js is running from the wrong directory!
```
If you see this, re-clone or re-copy the correct files.

**4. Missing Dependencies**

Run:
```bash
cd ~/MagicMirror/modules/MMM-MyTeams-Fixtures
npm install
```

---

## Issue: Fixtures Are Outdated / Stale

### Symptom
The footer shows amber text `⚠ Data may be outdated` or fixtures are clearly old.

### Cause
The module could not reach the API during the last refresh cycle, so it is serving cached data that is older than 2× the `cacheTTL`.

### Fix

1. Check your internet connection on the MagicMirror device
2. Click the **↺ Refresh** button to force an immediate re-fetch
3. If the problem persists, check debug logs for network errors
4. Consider increasing `cacheTTL` to tolerate longer offline periods:
   ```javascript
   cacheTTL: 30 * 60 * 1000   // 30 minutes
   ```

---

## Issue: Stale Data After Config Change

### Symptom
After changing `teamId` or `teamName`, the old team's fixtures still appear.

### Fix
Clear the cache — the cache key includes team identity, but an in-memory cache from the previous run may still be held. Restart MagicMirror **and** delete `fixtures-cache.json`:

```bash
rm ~/MagicMirror/modules/MMM-MyTeams-Fixtures/fixtures-cache.json
```

---

## Issue: Invalid `apiUrl` Error

### Symptom
The module shows an error like `Invalid apiUrl: must be https://www.thesportsdb.com/...`

### Cause
The `apiUrl` config value has been changed to point to a non-TheSportsDB URL. For security reasons (SEC-004), the module only allows requests to `https://www.thesportsdb.com`.

### Fix
Reset `apiUrl` to the default, or remove it from your config entirely:
```javascript
// Remove the apiUrl line, or set:
apiUrl: "https://www.thesportsdb.com/api/v1/json/3"
```

---

## Issue: Countdown Not Updating

### Symptom
The countdown badge (e.g. `⏱ 2d 3h`) is stuck and does not decrease.

### Cause
The countdown timer interval may not have started, or it was stopped by an error.

### Fix
1. Restart MagicMirror
2. If the issue persists, check that `showCountdown: true` is set in config
3. Check that `countdownIntervalMs` is not set to an extremely large value

---

## Issue: Filter Auto-Cycle Not Working

### Symptom
`autoCycleFilters: true` is set but the filter does not rotate.

### Causes & Fixes

- The **Pin button** (📌) pauses the cycle. Click it again to unpause.
- All cycle flags (`cycleAll`, `cycleHome`, `cycleAway`, `cycleDomestic`, `cycleEuropean`) may be `false`. At least one must be `true`.
- The active filter tab may have no fixtures — the cycle skips empty tabs.
- `autoCycleIntervalMs` must be at least `5000` (5 seconds). Lower values are clamped.

---

## Issue: Translations Not Working

### Symptom
Buttons and labels show translation key strings like `REFRESH_DATA` instead of translated text.

### Fix
1. Check that `language` is set to a supported code: `en`, `de`, `es`, `fr`, `ga`, `gd`, `it`, `nl`, `pt`
2. Verify the translation file exists: `translations/<code>.json`
3. Restart MagicMirror after changing the `language` config

See [`LanguageAndTranslation-Guide.md`](./LanguageAndTranslation-Guide.md) for adding new languages.

---

## Issue: Pre-Match Alerts Not Firing

### Symptom
`enableAlerts: true` is set but no notification appears before kick-off.

### Causes & Fixes

- The `alertBeforeMinutes` window may have already passed — the alert is scheduled when fixture data is received. If data was fetched after the alert time, it will not fire.
- MagicMirror's alert module must be enabled in `config.js`. Check that `alert` is in your modules list.
- The `_alertFired` set prevents duplicate alerts per session. If you restart MagicMirror it will reschedule.

---

## Debug Log Reference

Key log lines to look for (with `debug: true`):

| Log line | Meaning |
|----------|---------|
| `✓ Loaded N fixtures from disk cache` | Disk cache loaded on startup |
| `Serving fixtures from cache: <source>` | Cache hit — no API call made |
| `API GET https://...` | API request being made |
| `Next-events: total=N, home=H, away=A` | Raw API response counts |
| `✓ eventsnext.php returned N fixtures` | After filtering |
| `Supplement with FWP: apiAway=0, fwpAway=N` | FWP merge happening |
| `✓ FINAL from eventsnext+eventsseason: N fixtures` | Final result before sending |
| `SEC-002: teamName ... contains unsafe characters` | teamName failed validation |
| `SEC-004: Invalid apiUrl` | apiUrl failed validation |

---

## Still Stuck?

1. Raise an issue at [GitHub Issues](https://github.com/gitgitaway/MMM-MyTeams-Fixtures/issues)
2. Include: your config (redact any private values), the relevant debug log output, and your Node.js version (`node --version`)
