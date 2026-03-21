# Config.js Update Guide

## ✅ Task 1: Add Universal Team Support Comment

Add this comment block above your MMM-MyTeams-Fixtures module configuration):

```javascript
// MMM-MyTeams-Fixtures v1.1.0 - Universal Team Support
// Configure for ANY football team by setting teamName, teamId, and leagueIds
// Examples: Celtic, Rangers, Manchester United, Liverpool, Arsenal, Barcelona, etc.
// See test-team-config.js for ready-to-use configurations
{
    module: "MMM-MyTeams-Fixtures",
    position: "bottom_right",
    config: {
        // ... your existing config
    }
}
```

---

## ✅ Task 2: Add Auto-Cycle Filter Options (NEW FEATURE!)

You currently have:
```javascript
autoCycleFilters: true,
autoCycleIntervalMs: 10000,
```

### Option A: Use Enhanced Defaults (Recommended)
Add these new options to cycle through **All → Home → Away** filters:

```javascript
autoCycleFilters: true,
autoCycleIntervalMs: 10000,

// Auto-cycle filter toggles (v1.1.0)
cycleAll: true,          // Include "All" filter in rotation
cycleHome: true,         // Include "Home" filter in rotation
cycleAway: true,         // Include "Away" filter in rotation
cycleDomestic: false,    // Include "Domestic" filter in rotation
cycleEuropean: false,    // Include "European" filter in rotation
```

### Option B: Previous Behavior (Home → Away only)
If you prefer the old behavior without "All" filter:

```javascript
autoCycleFilters: true,
autoCycleIntervalMs: 10000,

// Auto-cycle filter toggles (v1.1.0)
cycleAll: false,         // Exclude "All" filter
cycleHome: true,         // Include "Home" filter in rotation
cycleAway: true,         // Include "Away" filter in rotation
cycleDomestic: false,    // Exclude "Domestic" filter
cycleEuropean: false,    // Exclude "European" filter
```

### Option C: All Filters (Maximum Coverage)
Cycle through all 5 filter types:

```javascript
autoCycleFilters: true,
autoCycleIntervalMs: 10000,

// Auto-cycle filter toggles (v1.1.0)
cycleAll: true,          // Include "All" filter in rotation
cycleHome: true,         // Include "Home" filter in rotation
cycleAway: true,         // Include "Away" filter in rotation
cycleDomestic: true,     // Include "Domestic" filter in rotation
cycleEuropean: true,     // Include "European" filter in rotation
```

### Option D: Competition Focus (Domestic → European only)
Great for teams in multiple competitions:

```javascript
autoCycleFilters: true,
autoCycleIntervalMs: 10000,

// Auto-cycle filter toggles (v1.1.0)
cycleAll: false,         // Exclude "All" filter
cycleHome: false,        // Exclude "Home" filter
cycleAway: false,        // Exclude "Away" filter
cycleDomestic: true,     // Include "Domestic" filter in rotation
cycleEuropean: true,     // Include "European" filter in rotation
```

---

## Complete Example Configuration

Here's your full config section with the recommended settings:

```javascript
// MMM-MyTeams-Fixtures v1.1.0 - Universal Team Support
// Configure for ANY football team by setting teamName, teamId, and leagueIds
// Examples: Celtic, Rangers, Manchester United, Liverpool, Arsenal, Barcelona, etc.
// See test-team-config.js for ready-to-use configurations
{
    module: "MMM-MyTeams-Fixtures",
    position: "bottom_right",
    config: {
        // Primary source
        source: "api",                  // "api" | "livefootballontv" | "bbc" | "fwp" | "cfc" | "sportsdb"

        // Team/API
        teamName: "Celtic",
        teamId: "134647",                     // "133647" or add ypur teams sportdb teamID 0r Leave empty to auto-resolve by teamName
        apiUrl: "https://www.thesportsdb.com/api/v1/json/3",
        season: "auto",                 // "auto" or explicit like "2025-2026"
        fallbackSeason: "2025-2026",

        // UI
        updateInterval: 1 * 60 * 60 * 1000,  // Once an hour
        requestTimeoutMs: 20000,
        maxFixtures: 60,
        showCompetition: true,
        showCountdown: true,
        defaultFilter: "all",           // "all" | "domestic" | "european" | "home" | "away"
        debug: true,

        // Cache/Fallback
        cacheTTL: 0 * 60 * 1000,        // helper cache TTL set to 5 for normal and 0 to clear the cache
        fallbackChain: true,            // If API is empty, try scrapers in order

        // Scraper toggles (used if source !== "api" or when fallbackChain is true)
        scrapeFWP: true,              // this scraper confirmed as working
        scrapeSportsDB: false,
        scrapeLFOTV: false,
        scrapeBBC: false,
        scrapeCFC: false,

        // Search toggels & theSportsdb.com League Id`s 
        useSearchEventsFallback: true,
        strictLeagueFiltering: true,
        leagueIds: ["4330", "4364", "4363", "4888"], // replace these with your national codes e,g for England use ["4328", "4424", "4426], or for France use ["4334", "4430", "4432],
        uefaLeagueIds: ["4332", "4481", "5071"],

        // UI/Performance enhancements
        maxTableHeight: 350,               // px, used to cap the scroll container height
        countdownIntervalMs: 60000,        // base interval for countdown refresh
        largeListThreshold: 12,            // if fixtures exceed this, we throttle
        largeListCountdownMultiplier: 2,    // multiplier for interval when list is large

        // Auto-cycle filters (v1.1.0 - Enhanced with configurable toggles)
        autoCycleFilters: true,        // automatically rotate filter buttons
        autoCycleIntervalMs: 10000,    // time per filter when auto-cycling (ms)
        
        // Auto-cycle filter toggles (NEW in v1.1.0)
        cycleAll: true,          // Include "All" filter in rotation
        cycleHome: true,         // Include "Home" filter in rotation
        cycleAway: true,         // Include "Away" filter in rotation
        cycleDomestic: false,    // Include "Domestic" filter in rotation
        cycleEuropean: false,    // Include "European" filter in rotation

        // Theme overrides
        // ... rest of your config
    }
}
```

---

## What Happens If You Don't Add These Options?

**Good news!** The module will use the defaults automatically:
- `cycleAll: true`
- `cycleHome: true`
- `cycleAway: true`
- `cycleDomestic: false`
- `cycleEuropean: false`

So your auto-cycle will work with **All → Home → Away** rotation even without explicitly adding these options.

---

## How to Apply These Changes

1. Open your config.js file: `.\config\config.js`
2. Find the MMM-MyTeams-Fixtures section (around line 303)
3. Add the comment block above the module configuration
4. Add your chosen auto-cycle options after `autoCycleIntervalMs: 10000,`
5. Save the file
6. Restart MagicMirror: `pm2 restart MagicMirror` (or your restart method)

---

## Testing Your Configuration

After restarting MagicMirror:

1. **Watch the auto-cycle**: Filters should rotate every 10 seconds
2. **Check which filters appear**: Verify only enabled filters are in the rotation
3. **Verify order**: Should start with your `defaultFilter` if it's enabled
4. **Manual override**: Click any filter button to stop auto-cycling temporarily

---

## Need Help?

- See `README.md` for full documentation
- See `test-team-config.js` for team configuration examples
- See `CHANGELOG.md` for technical details of v1.1.0 changes

---

**Status**: ✅ Both tasks complete!
- Task 1: Comment text provided above
- Task 2: Auto-cycle filter toggles implemented and documented

**Your Action Required**: Copy the configurations above into your config.js file