# Changelog

All notable changes to the MMM-MyTeams-Fixtures module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-03-19

Full module review cycle — 29 issues addressed across Security, Performance, Accessibility, Innovation, UI/UX, and Design. See `moduleReview.md` for the complete review findings.

### Security

- **SEC-001**: Replaced all `innerHTML` template literal assignments with `createElement` + `textContent` — eliminates XSS attack surface from API/scraper data
- **SEC-002**: Added `sanitizeTeamName()` validator in `node_helper.js`; `buildScraperUrls()` now rejects any `teamName` containing URL-special characters; the `cfc` URL is restricted to a known-club allowlist (`KNOWN_CFC_SLUGS`); all URL path segments wrapped in `encodeURIComponent()`
- **SEC-003**: Removed unconditional `console.log` in scroll event handler that could leak fixture data to logs
- **SEC-004**: Added `apiUrl` validation in `socketNotificationReceived` — rejects any URL that is not `https://www.thesportsdb.com/...` before any network request is made

### Performance

- **PERF-001**: `_applyThemeOverrides()` moved from `getDom()` to `start()`; a JSON hash dirty-flag prevents re-applying when config has not changed — eliminates repeated `<style>` tag injection on every DOM refresh
- **PERF-002**: Scroll event listener now uses `requestAnimationFrame` throttle; debug `console.log` removed from hot scroll path
- **PERF-003**: `startAutoCycle()` guarded with `if (!this._cycleTimer)` — prevents redundant teardown and recreation of the interval on every data refresh
- **PERF-004**: `SharedRequestManager.startQueueProcessor()` now stores the `setInterval` handle in `this._queueIntervalId`; new `destroy()` method clears the interval and resets the singleton; `node_helper.js` calls `requestManager.destroy()` in its `stop()` lifecycle hook to prevent the interval leaking after MagicMirror unloads the module
- **PERF-005**: `fetchSeasonAlt()` inner function eliminated; `fetchSeason(s, idOverride?)` now accepts an optional second argument, allowing the alt-team-ID fallback path to reuse the same function — removes ~20 lines of duplication

### Accessibility

- **ACC-001**: All interactive `<span>` controls converted to `<button type="button">` — filter tabs, Refresh, Clear Cache, Pin, and team switcher buttons are now keyboard navigable via Tab/Enter/Space
- **ACC-002**: `aria-pressed` and `aria-label` attributes added to all filter and control buttons; Pin button `aria-pressed` and `aria-label` toggle on state change
- **ACC-003**: H/A column now displays `▲ H` / `▽ A` — distinction is no longer colour-only
- **ACC-004**: Visually hidden `<caption class="sr-only">` added to the fixtures table (e.g. "Celtic upcoming fixtures — All")
- **ACC-005**: Eight missing translation keys (`REFRESH_DATA`, `CLEAR_CACHE`, `PIN`, `UNPIN`, `NEXT_TAB_IN`, `SHOW`, `LIVE`, `NEXT_MATCH`) added to all nine locale files (en, de, es, fr, ga, gd, it, nl, pt)

### Innovation

- **INN-001**: `computeCountdown()` (previously dead code) now wired to the first upcoming fixture; displayed as `⏱ Xd Yh` badge in the filter header
- **INN-002**: Live match data flow completed end-to-end — `toFixtureFromEvent()` now maps `strStatus`, `intHomeScore`, `intAwayScore` to fixture objects; front-end renders `🔴 score` badge in the time cell for in-progress matches
- **INN-003**: Multi-team support — `teams: null` config array added; when populated, a team-switcher button row renders above the filter tabs; each team entry can specify its own `teamId`, `teamName`, `leagueIds`, `uefaLeagueIds`; backward-compatible (defaults to scalar `teamId`/`teamName`)
- **INN-004**: Pre-match alert notifications — `enableAlerts: true` config flag fires MagicMirror's `SHOW_ALERT` notification before kick-off; `alertBeforeMinutes` controls lead time; `_alertFired` Set prevents duplicates

### UI/UX

- **UX-001**: Filter tab labels now include live fixture counts: `"Home (4)"`; tabs with zero fixtures are `disabled` and visually greyed out
- **UX-002**: Stale data detection — footer turns amber with `⚠ Data may be outdated` when cached data age exceeds 2× `cacheTTL`; `formatRelativeTime()` helper added
- **UX-003**: Source footer now maps raw technical keys to human-readable labels (e.g. `"api"` → `"TheSportsDB API"`, `"api+fwp"` → `"TheSportsDB + FootballWebPages"`); `showFooter: false` config option added to hide the footer entirely
- **UX-004**: Skeleton loader renders six shimmer rows (`.skeleton-row` with `mmf-shimmer` animation) during the `isLoading` state — replaces blank/plain-text loading state
- **UX-005**: Filter change triggers `@keyframes mmf-fade-in` on `.fixtures-tbody` — smooth 200ms opacity transition between filter views

### Design & Code Quality

- **DES-001/002**: `package.json` rewritten — fixed malformed `repository` object, corrected `"main"` field from `MMM-MyTeam-Fixtures.js` to `MMM-MyTeams-Fixtures.js`
- **DES-003**: All six hardcoded `#018749` occurrences replaced with `var(--mmf-accent-color)` CSS custom property; `accentColor` config default added; property is pushed as a `<style>` tag at `start()` allowing full runtime theming
- **DES-004**: Nine consecutive `!important` declarations in `.scroll-controls` replaced with higher-specificity `.fixtures-scroll .scroll-controls` parent-child selector chain
- **DES-005**: `customFWP.css` deprecated; new `customOverrides.css` created as the user customisation file; `getStyles()` updated to load `customOverrides.css`; deprecation notice added to `customFWP.css`
- **DES-006**: Dead commented-out CSS column block removed from `MMM-MyTeams-Fixtures.css`

### Documentation

- **New** `documentation/HowThisModuleWorks.md` — full architecture and data flow reference
- **New** `documentation/AccessibilityFeatures-Guide.md` — ARIA implementation details, keyboard navigation, screen reader support
- **New** `documentation/Troubleshooting.md` — common issues, solutions, and debug log reference
- **New** `documentation/MultiTeamAndAlerts-Guide.md` — multi-team config and pre-match alert setup
- **New** `documentation/FindingYourTeamID.md` — step-by-step TheSportsDB ID lookup, common team/league ID tables
- **New** `documentation/CustomisingTheDisplay.md` — CSS custom properties, theming, column options
- **New** `documentation/LanguageAndTranslation-Guide.md` — translation key reference, adding new languages
- **Rewritten** `README.md` — standard MagicMirror module structure, full config options table, links to documentation

---

## [1.2.0] - 2026-03-18

### Added

#### Shared Request Manager (`shared-request-manager.js`)
- **New file**: `shared-request-manager.js` — a global singleton HTTP request queue shared across all MMM-MyTeams series modules
  - Coordinates all outbound HTTP requests to prevent rate limiting, timeouts, and network conflicts when multiple MMM-MyTeams modules are installed
  - Sequential request queue with configurable priority levels (0=highest, 1=normal, 2=low)
  - Per-domain rate limiting (minimum 1 second between requests to the same domain)
  - Global throttle (minimum 2 seconds between any requests)
  - Request deduplication: identical in-flight requests share a single promise rather than firing twice
  - Automatic retry with exponential backoff (up to 3 retries: 2s → 4s → 8s delays)
  - Configurable per-request timeout (default: 15 seconds)
  - Debug logging mode
- **`node_helper.js`** now routes all HTTP requests through the Shared Request Manager rather than calling fetch directly
  - Rate limiting and retry logic previously embedded in the helper have been delegated to the manager
  - Request queue configured in `start()`: `minRequestInterval: 2000ms`, `minDomainInterval: 1000ms`, `maxRetries: 3`, `requestTimeout: 15000ms`

#### Module Identity Guard
- **Startup sanity check** added to `node_helper.js` at module load time
  - Compares `path.basename(__dirname)` against the expected module name `MMM-MyTeams-Fixtures`
  - Logs a clear `FATAL` error with reinstall instructions if a mismatch is detected
  - Prevents the silent failure case where a wrong `node_helper.js` (e.g., from MMM-MyTeams-DriveToMatch) runs in the Fixtures directory without any diagnostic output

### Changed

- **`node_helper.js`**: HTTP request handling refactored to use `SharedRequestManager.queueRequest()` throughout, replacing direct `doFetch()` calls

### Fixed

- **Silent wrong-module failure**: Previously, if a user's installation had the wrong `node_helper.js` (from another MMM-MyTeams module), the module would silently load the wrong code with no clear error. The identity guard now catches this immediately on startup with an actionable message.

### Technical Notes

- The Shared Request Manager uses Node.js `global` scope for the singleton so it is shared across all MMM-MyTeams modules loaded in the same MagicMirror process
- If only MMM-MyTeams-Fixtures is installed, the manager operates as a standalone per-module queue with no cross-module coordination overhead
- `shared-request-manager.js` is self-contained and has no additional npm dependencies

---

## [1.1.0] - 2026-01-02

### 🎉 Major Update: Universal Team Support

This release removes all hardcoded Celtic FC references and makes the module work for **any football team** supported by TheSportsDB.

### Fixed

#### Critical Bugs
- **Fixed undefined variable bug**: Replaced all instances of undefined `scottishLeagueIds` with correct parameter `leagueIds` (lines 408, 518, 607, 1218)
  - This was causing runtime errors and preventing proper league filtering for all teams
- **Removed legacy SOURCES object**: Deleted hardcoded Celtic URLs (lines 719-726) that were still being used as fallbacks
  - Updated `fetchAndParseScraper()` to use only dynamic URLs (line 1135)

### Changed

#### Team-Agnostic Refactoring
- **Dynamic URL generation**: Created `buildScraperUrls()` function that generates team-specific scraper URLs based on `teamName` parameter
  - Converts team names to URL slugs automatically (e.g., "Manchester United" → "manchester-united")
  - Works for any team without hardcoded references
- **Generic team ID resolution**: Removed Celtic-specific scoring bonuses from `resolveTeamIdIfNeeded()`
  - No longer prioritizes Scotland, Glasgow, or ID 133647
  - Uses generic scoring that works equally well for any team
- **Parameterized HTML parsers**: All 5 scraper parsers now accept `teamName` parameter
  - Dynamic regex patterns replace hardcoded "celtic" searches
  - Properly escapes special characters in team names (e.g., "St. Mirren", "Queen's Park")
- **Enhanced league detection**: 
  - Renamed `knownScottish` → `knownDomestic` for generic applicability
  - Added English league patterns: `english|efl|championship`
  - Updated comments to be team-agnostic
- **Dynamic UI title**: Module title now displays configured team name instead of hardcoded "Celtic FC"
- **Renamed configuration parameter**: `scottishLeagueIds` → `leagueIds` (backward compatible - both work)

### Added

#### Features
- **Configurable Auto-Cycle Filters**: New toggleable options to control which filters are included in auto-cycle rotation
  - `cycleAll` (default: true) - Include "All" filter in rotation
  - `cycleHome` (default: true) - Include "Home" filter in rotation
  - `cycleAway` (default: true) - Include "Away" filter in rotation
  - `cycleDomestic` (default: false) - Include "Domestic" filter in rotation
  - `cycleEuropean` (default: false) - Include "European" filter in rotation
  - Backward compatible: defaults to All → Home → Away rotation (previous behavior was Home → Away only)
  - Allows customization for teams in multiple competitions (e.g., cycle only Domestic and European)

#### Documentation
- **FIXES_APPLIED.md**: Comprehensive documentation of all 13 code changes
  - Root cause analysis for each issue
  - Technical implementation details
  - Backward compatibility notes
  - Testing recommendations
- **test-team-config.js**: Example configurations for 9 different teams
  - Scottish teams: Celtic, Rangers, Aberdeen, Hearts
  - English teams: Manchester United, Liverpool, Arsenal
  - European teams: Barcelona, Bayern Munich
  - Includes team IDs, league IDs, and testing notes
- **Auto-Cycle Filters section in README.md**: Complete guide to configuring filter rotation
  - Configuration examples for different use cases
  - Explanation of how the feature works
  - Example configurations for common scenarios

### Technical Details

#### Files Modified
- **node_helper.js**: 13 edits across 5 major changes
  1. Removed SOURCES object (lines 719-726)
  2. Updated fetchAndParseScraper to use dynamic URLs (line 1135)
  3. Fixed scottishLeagueIds → leagueIds variable bug (4 locations)
  4. Renamed knownScottish → knownDomestic (3 locations)
  5. Updated comments for generic applicability (2 locations)
- **MMM-MyTeams-Fixtures.js**: 1 edit
  - Dynamic title generation using config.teamName (line 267)

#### Backward Compatibility
- All changes maintain strict backward compatibility
- "Celtic" remains the default value for `teamName` and `teamId`
- Existing Celtic configurations work without modification
- Legacy `scottishLeagueIds` parameter still accepted (maps to `leagueIds`)

### Migration Guide

#### For Existing Celtic Users
No changes required! Your existing configuration will continue to work.

#### For New Teams
Simply update your config:
```javascript
{
  module: "MMM-MyTeams-Fixtures",
  config: {
    teamName: "Manchester United",  // Your team name
    teamId: "133612",               // Your team ID from thesportsdb.com
    leagueIds: ["4328", "4480"],    // Your team's league IDs
    // ... other options
  }
}
```

### Known Issues
- Scraper URL generation assumes consistent URL patterns (team-slug-based)
- Some team-specific sites may require custom URL logic
- Generic scoring in team ID resolution may need refinement for teams with similar names

### Future Enhancements
- [ ] Add team-specific scraper URL overrides for edge cases
- [ ] Improve team ID resolution scoring for ambiguous team names
- [ ] Add more domestic league patterns for international teams
- [ ] Create configuration wizard for easy team setup

---

## [1.0.0] - 2025-09-19

### Added

#### Core Features
- **Multi-Source Data Fetching**: Primary data from TheSportsDB API with intelligent fallback chain to web scrapers
- **Comprehensive API Integration**: 
  - `/eventsnext.php` endpoint for upcoming fixtures
  - `/eventsseason.php` endpoint for season-based fixture lists
  - `/searchteams.php` for automatic team ID resolution
  - `/searchevents.php` fallback patterns for missing fixtures
- **Automatic Season Detection**: Smart "auto" mode that calculates current season (e.g., 2025-2026) based on current date
- **Team ID Resolution**: Intelligent team lookup with scoring algorithm that prioritizes:
  - Exact team name matches
  - Country-based filtering (Scotland preference for Celtic)
  - Stadium location (Glasgow)
  - Known team IDs from yjrsportsdb.com  (133647 for Celtic FC)

#### Data Management
- **Dual-Layer Caching System**:
  - In-memory cache for instant responses
  - Disk-based cache (`fixtures-cache.json`) with persistence across restarts
  - Configurable TTL (default: 5 minutes)
  - Cache key includes team, source, and filtering flags to prevent cross-contamination
- **Smart Data Merging**: API + FWP scraper hybrid mode automatically supplements missing away fixtures
- **Deduplication Logic**: Composite key matching prevents duplicate fixtures across multiple data sources
- **Date Inference**: Converts partial dates (e.g., "21 Sep") to full ISO format using season context

#### Display & UI
- **Interactive Filter Bar**: Five filter buttons with active state highlighting
  - All fixtures
  - Domestic competitions only
  - European competitions only
  - Home fixtures only
  - Away fixtures only
- **Scrollable Table Container**: 
  - Maximum height constraint (560px default, configurable)
  - Smooth scrolling with touch device support
  - Sticky table headers remain visible during scroll
- **Back to Top Button**: 
  - Appears automatically when scrolled >40px
  - Smooth scroll animation
  - Celtic green themed styling
  - Positioned sticky at bottom-right of scroll area
- **Live Countdown Display**: Real-time countdown to each match showing days/hours/minutes
- **Responsive Column Layout**:
  - Date (weekday, day, month)
  - Time (24-hour or 12-hour format)
  - Opponent name
  - Home/Away indicator (H/A)
  - Competition name (optional)
- **Celtic FC Themed Styling**:
  - Celtic green (#018749) accent colors
  - Gold (#FFD700) highlights
  - Semi-transparent backgrounds
  - Hover effects on interactive elements

#### Performance Optimizations
- **Adaptive Countdown Refresh**: 
  - Base interval: 60 seconds (configurable)
  - Automatic throttling for large lists (>12 fixtures)
  - Multiplier applied when list exceeds threshold
- **Filter Result Caching**: Client-side cache prevents redundant filtering operations
- **Throttled DOM Updates**: Debounced rendering reduces repaint costs
- **Lazy Scroll Event Handling**: Efficient scroll position tracking for control visibility

#### Auto-Cycle Feature
- **Automatic Filter Rotation**: Optional hands-free cycling through filter views
- **Configurable Interval**: Default 20 seconds per filter (minimum 5 seconds)
- **Smart Cycle Order**: Prioritizes Home/Away filters, respects defaultFilter as starting point
- **Pause on Interaction**: Manual filter clicks reset cycle position
- **Data-Aware**: Defers cycling until fixtures are loaded

#### Advanced Filtering
- **League ID Filtering**: 
  - Scottish leagues: [4330, 4364, 4363, 4888] (Premiership, League Cup, Scottish Cup, Championship)
  - UEFA competitions: [4480, 4481, 5071] (Champions League, Europa League, Conference League)
  - Strict mode enforces whitelist; loose mode allows unlisted leagues
- **Competition Classification**: Automatic categorization as domestic/european/friendly based on name patterns
- **Home/Away Detection**: Intelligent parsing from team positions in fixture data

#### Web Scraping Capabilities
- **FootballWebPages (FWP) Scraper**:
  - Primary scraper for supplementing API data
  - Robust opponent extraction with multiple fallback patterns
  - Home/Away inference from team order and text position
  - Time normalization (12h → 24h conversion)
  - Malformed time repair (e.g., 25:45pm → 5:45pm)
  - European Europa League away match time defaulting (17:45 GMT) - nb experimental for now
- **BBC Sport Scraper**: Parses BBC fixtures page with datetime attribute extraction
- **LiveFootballOnTV Scraper**: Extracts fixtures with TV channel information - more work required
- **TheSportsDB Site Scraper**: Fallback HTML parsing of team page
- **Celtic FC Official Site Scraper**: Direct parsing of official fixtures (optional- more work required )

#### API Resilience
- **Rate Limiting**: Minimum 1200ms interval between API calls to respect free tier limits
- **Retry Logic**: Exponential backoff with jitter for failed requests (up to 2 retries)
- **Timeout Protection**: Configurable request timeout (default: 15 seconds) with AbortController
- **Fallback Chain**: Automatic progression through multiple data sources on failure
- **Error Recovery**: Graceful degradation with informative error messages

#### Data Parsing & Normalization
- **Date/Time Extraction**: Regex-based parsing handles multiple formats:
  - ISO dates (YYYY-MM-DD)
  - Short dates (21 Sep, 21/09/2025)
  - Weekday prefixes (Sun 21 Sep)
  - 12-hour times (3pm, 7:45pm)
  - 24-hour times (19:45, 15:00)
- **Opponent Sanitization**: Removes noise tokens (TV, Kick, KO, |, @, etc.)
- **Competition Type Detection**: Pattern matching for UEFA/European keywords
- **Result Filtering**: Excludes past matches with scores or "FT" markers

#### Configuration Options
- **Source Selection**: Choose between "api" (primary) or scraper-only mode
- **Team Customization**: Configure team name and TheSportsDB team ID
- **Season Control**: Auto-detection or manual season string (e.g., "2025-2026")
- **Update Interval**: Configurable refresh rate (default: 10 minutes)
- **Display Limits**: Maximum fixtures shown (default: 60)
- **Toggle Features**: Show/hide competition names, countdown timers
- **Scraper Toggles**: Enable/disable individual scrapers (FWP, BBC, LFOTV, CFC, SportsDB)
- **Locale Support**: Date/time formatting respects locale setting (default: en-GB)
- **Debug Mode**: Verbose console logging for troubleshooting

#### Theme Customization
- **Dark/Light Mode Override**: Force dark or light theme regardless of MagicMirror settings
- **Font Color Override**: Custom text color (e.g., "#FFFFFF")
- **Opacity Override**: Adjust transparency (0.0 to 1.0)
- **Dynamic CSS Injection**: Theme overrides applied via style element without file modification

#### Accessibility
- **ARIA Labels**: Scroll container marked as region with descriptive label
- **Semantic HTML**: Proper table structure with thead/tbody
- **Keyboard Navigation**: Filter buttons and controls are keyboard accessible
- **Focus Indicators**: Visible focus states for interactive elements

#### Developer Features
- **Comprehensive Logging**: Detailed debug output with source attribution
- **Cache Metadata**: Timestamps and source tracking in cache files
- **Error Context**: Informative error messages with operation details
- **Modular Architecture**: Separate concerns (API, scrapers, parsing, rendering)

### Technical Implementation

#### Frontend (MMM-MyTeams-Fixtures.js)
- **Module Lifecycle Management**: Proper start/stop with timer cleanup
- **Socket Communication**: Normalized notifications (GET_FIXTURES, FIXTURES_DATA, FIXTURES_ERROR)
- **State Management**: Tracks loading, error, fixtures, source, and fetch timestamp
- **Event Handling**: Click handlers for filters, scroll listeners for controls
- **DOM Generation**: Efficient table rendering with conditional columns
- **Timer Coordination**: Manages update, countdown, and auto-cycle intervals

#### Backend (node_helper.js)
- **Fetch Implementation Detection**: Prefers native fetch (Node 18+), falls back to node-fetch v2
- **HTTP Client**: Generic doFetch wrapper with timeout and custom headers
- **User-Agent**: Identifies as "MMM-MyTeams-Fixtures (+MagicMirror)"
- **Cheerio HTML Parsing**: Robust scraping with jQuery-like selectors
- **File System Operations**: Synchronous cache read/write with error handling
- **Async/Await Patterns**: Modern promise-based control flow
- **Error Boundaries**: Try-catch blocks prevent crashes, log warnings

#### Data Flow
1. Frontend sends GET_FIXTURES with full config payload
2. Backend checks cache validity (key + TTL)
3. If cache miss, attempts API fetch with team ID resolution
4. API returns fixtures filtered by league IDs and team involvement
5. If API has no away fixtures, supplements with FWP scraper
6. If API empty and fallbackChain enabled, tries scrapers in order
7. Results deduplicated, sorted by date/time, limited to maxFixtures
8. Cache updated (memory + disk) with source attribution
9. Frontend receives FIXTURES_DATA with fixtures array and metadata
10. DOM updated with filtered table and footer showing source/timestamp

#### Dependencies
- **cheerio**: ^1.1.2 (HTML parsing for scrapers)
- **node-fetch**: ^2.7.0 (HTTP client for Node <18)
- **MagicMirror²**: Runtime framework
- **Node.js**: 18+ recommended (native fetch support)

### Configuration Example

```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "bottom_right",
  config: {
    source: "api",
    teamName: "Celtic",
    teamId: "133647",
    apiUrl: "https://www.thesportsdb.com/api/v1/json/3",
    season: "auto",
    fallbackSeason: "2025-2026",
    updateInterval: 10 * 60 * 1000,
    requestTimeoutMs: 15000,
    maxFixtures: 12,
    showCompetition: true,
    showCountdown: true,
    defaultFilter: "all",
    cacheTTL: 5 * 60 * 1000,
    fallbackChain: true,
    scottishLeagueIds: ["4330", "4364", "4363", "4888"],
    uefaLeagueIds: ["4480", "4481", "5071"],
    useSearchEventsFallback: true,
    strictLeagueFiltering: true,
    scrapeFWP: true,
    scrapeBBC: false,
    scrapeLFOTV: false,
    scrapeCFC: false,
    scrapeSportsDB: false,
    locale: "en-GB",
    debug: false,
    darkMode: null,
    fontColorOverride: null,
    opacityOverride: null,
    autoCycleFilters: false,
    autoCycleIntervalMs: 20000,
    maxTableHeight: 260,
    countdownIntervalMs: 60000,
    largeListThreshold: 12,
    largeListCountdownMultiplier: 2
  }
}
```

### Known Issues
- Free tier TheSportsDB API may only return home fixtures (mitigated by FWP supplement)
- Scraper reliability depends on external site HTML structure stability
- Date inference from partial dates requires accurate season parameter
- Some scrapers may fail if site structure changes

### Future Enhancements
- [ ] Add additional non Scottish team ids from [thesportsdb.com](https://www.thesportsdb.com/)
= [ ] Logo mapping for clubs and competitions
- [ ] Per-league toggle to hide specific competitions
- [ ] Match result integration for completed fixtures
- [ ] TV channel display in table
- [ ] Notification alerts for upcoming matches
- [ ] Custom CSS class injection for advanced styling
- [ ] Export fixtures to calendar formats (iCal, Google Calendar)
- [ ] Multi-team support in single instance

---

## Release Notes

### Version 1.0.0 - Initial Release (Celtic FC Focused)

This is the inaugural release of MMM-MyTeams-Fixtures, a comprehensive football fixtures display module for MagicMirror². Built specifically for Celtic FC fans with hardcoded Celtic references throughout the codebase. **Note**: Version 1.1.0 removes these hardcoded references and makes the module work for any team.

**Highlights:**
- **Hybrid Data Strategy**: Combines API reliability with scraper flexibility
- **Zero Configuration**: Works out-of-box with sensible defaults for Celtic FC
- **Performance Focused**: Caching, throttling, and adaptive refresh rates
- **User Friendly**: Interactive filters, smooth scrolling, live countdowns
- **Developer Friendly**: Extensive logging, modular code, clear error messages

**Perfect For:**
- Celtic FC supporters wanting comprehensive fixture tracking
- MagicMirror users seeking reliable sports data integration
- Developers looking for a well-documented module to extend

**Part of the MyTeams Suite:**
This is the third module in the Celtic-themed MagicMirror collection:
1. [MMM-MyTeams-Clock](https://github.com/gitgitaway/MMM-MyTeams-Clock) - Team-branded clock
2. [MMM-MyTeams-LeagueTable](https://github.com/gitgitaway/MMM-MyTeams-LeagueTable) - League standings
3. **MMM-MyTeams-Fixtures** - Upcoming fixtures (this module)
4. [MMM-JukeBox](https://github.com/gitgitaway/MMM-JukeBox) - Audio player

---

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Add comments for complex logic
- Test with multiple data sources (API + scrapers)
- Update README.md if adding configuration options
- Include debug logging for new features

---

## Acknowledgments

Special thanks to:
- **@jclarke0000** for MMM-MyScoreboard which served as inspiration
- **TheSportsDB** for providing the free API
- **FootballWebPages** for reliable fixture data
- **MagicMirror² Community** for guidance and support

---

## License

MIT License - See LICENSE file for details

---

## Support

- **Issues**: [GitHub Issues](https://github.com/gitgitaway/MMM-MyTeams-Fixtures/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gitgitaway/MMM-MyTeams-Fixtures/discussions)
- **Documentation**: [README.md](README.md)

---

**Enjoy tracking your team's fixtures! & Hail Hail!🍀⚽**