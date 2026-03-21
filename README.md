# MMM-MyTeams-Fixtures

A [MagicMirror²](https://magicmirror.builders/) module that displays upcoming football fixtures for **any team** from TheSportsDB API, with optional supplement from FootballWebPages for away fixtures.

[![Version](https://img.shields.io/badge/version-1.3.0-brightgreen)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![MagicMirror²](https://img.shields.io/badge/MagicMirror²-compatible-orange)](https://magicmirror.builders/)

---

## Screenshots

*Celtic · Liverpool · Bayern Munich · Roma*

| | |
|-|-|
| ![Celtic Fixtures](./screenshots/screenshotFixtures1.png) | ![Liverpool Fixtures](./screenshots/screenshotFixtures2.png) |
| ![Bayern Munich Fixtures](./screenshots/screenshotFixtures3.png) | ![Roma Fixtures](./screenshots/screenshotFixtures4.png) |

---

## Features

- **Works with any team** — Scottish, English, Spanish, European, or any club in TheSportsDB
- **Filter tabs** — All · Domestic · European · Home · Away (with live fixture counts)
- **Auto-cycle** — Automatically rotates through selected filter views on a timer
- **Multi-team** — Switch between multiple clubs without restarting (INN-003)
- **Live match display** — In-progress score shown with `🔴` badge (INN-002)
- **Next-match countdown** — `⏱ Xd Yh` badge in the header (INN-001)
- **Pre-match alerts** — MagicMirror notification N minutes before kick-off (INN-004)
- **Skeleton loader** — Shimmer placeholder while fetching data
- **Stale data warning** — Amber footer when cached data is older than 2× TTL
- **Fully accessible** — Keyboard navigable, ARIA labels, screen reader table captions
- **Internationalised** — 9 languages: en · de · es · fr · ga · gd · it · nl · pt
- **Themeable** — CSS custom property (`--mmf-accent-color`) for your team's brand colour
- **Dual caching** — In-memory + disk cache survives restarts
- **Rate-limited** — Shared Request Manager prevents API throttling

---

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/gitgitaway/MMM-MyTeams-Fixtures
cd MMM-MyTeams-Fixtures
npm install
```

---

## Update

```bash
cd ~/MagicMirror/modules/MMM-MyTeams-Fixtures
git pull
npm install
```

---

## Configuration

Add the module to `~/MagicMirror/config/config.js`:

### Minimal Example

```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "bottom_right",
  config: {
    teamName: "Liverpool",
    teamId: "133602",
    leagueIds: ["4328", "4424", "4426"]
  }
}
```

### Full Example (Celtic FC)

```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "bottom_right",
  config: {
    teamName: "Celtic",
    teamId: "133647",
    leagueIds: ["4330", "4364", "4363", "4888"],
    uefaLeagueIds: ["4480", "4481", "5071"],

    source: "api",
    season: "auto",
    fallbackSeason: "2025-2026",
    updateInterval: 10 * 60 * 1000,
    maxFixtures: 12,

    showCompetition: true,
    showCountdown: true,
    showFooter: true,
    defaultFilter: "all",

    autoCycleFilters: true,
    autoCycleIntervalMs: 20000,
    cycleAll: true,
    cycleHome: true,
    cycleAway: true,

    scrapeFWP: true,
    strictLeagueFiltering: true,

    accentColor: "#018749",
    locale: "en-GB",
    language: "en",
    debug: false
  }
}
```

### Finding Your Team ID

Visit [thesportsdb.com](https://www.thesportsdb.com/), search for your team, and read the ID from the URL:  
`https://www.thesportsdb.com/team/`**133647**`-Celtic`

See [documentation/FindingYourTeamID.md](documentation/FindingYourTeamID.md) for a full guide and common team/league ID tables.

---

## Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **`teamName`** | string | `"Celtic"` | Your team's name — used for display and scraper URL construction |
| **`teamId`** | string | `"133647"` | TheSportsDB team ID — find at thesportsdb.com |
| **`leagueIds`** | string[] | `["4330","4364","4363","4888"]` | Domestic league/cup IDs for your team *(defaults to Scottish)*  |
| `uefaLeagueIds` | string[] | `["4480","4481","5071"]` | UEFA competition IDs (CL, EL, UECL) |
| `source` | string | `"api"` | Primary source: `"api"` or scraper-only |
| `apiUrl` | string | `"https://www.thesportsdb.com/api/v1/json/3"` | API base URL — must remain thesportsdb.com |
| `season` | string | `"auto"` | Season string e.g. `"2025-2026"` or `"auto"` |
| `fallbackSeason` | string | `"2025-2026"` | Secondary season tried if primary returns empty |
| `updateInterval` | number | `600000` | Data refresh interval in ms (default: 10 min) |
| `requestTimeoutMs` | number | `15000` | Per-request timeout in ms |
| `maxFixtures` | number | `60` | Maximum number of fixtures to display |
| `cacheTTL` | number | `300000` | Cache lifetime in ms (default: 5 min) |
| `fallbackChain` | boolean | `true` | Try scrapers when API returns no data |
| `useSearchEventsFallback` | boolean | `true` | Try `/searchevents.php` patterns if standard endpoints return empty |
| `strictLeagueFiltering` | boolean | `true` | Enforce `leagueIds` whitelist; `false` = show all fixtures for the team |
| `scrapeFWP` | boolean | `true` | Enable FootballWebPages supplement for away fixtures |
| `scrapeBBC` | boolean | `false` | Enable BBC Sport scraper (full fallback) |
| `scrapeLFOTV` | boolean | `false` | Enable LiveFootballOnTV scraper (full fallback) |
| `scrapeCFC` | boolean | `false` | Enable team-official-site scraper (known clubs only) |
| `scrapeSportsDB` | boolean | `false` | Enable TheSportsDB HTML scraper (full fallback) |
| `showCompetition` | boolean | `true` | Show competition column in table |
| `showCountdown` | boolean | `true` | Show `⏱ Xd Yh` countdown badge to next fixture |
| `showFooter` | boolean | `true` | Show source/timestamp footer |
| `defaultFilter` | string | `"all"` | Active filter on load: `"all"` \| `"domestic"` \| `"european"` \| `"home"` \| `"away"` |
| `maxTableHeight` | number | `260` | Max height (px) of the scrollable fixture table |
| `countdownIntervalMs` | number | `60000` | How often countdown badge refreshes (ms) |
| `largeListThreshold` | number | `12` | Fixture count above which countdown refresh is throttled |
| `largeListCountdownMultiplier` | number | `2` | Multiplier applied to `countdownIntervalMs` when list exceeds threshold |
| `autoCycleFilters` | boolean | `false` | Auto-rotate through enabled filter views |
| `autoCycleIntervalMs` | number | `20000` | Display duration per filter during auto-cycle (min 5000 ms) |
| `cycleAll` | boolean | `true` | Include "All" in auto-cycle rotation |
| `cycleHome` | boolean | `true` | Include "Home" in auto-cycle rotation |
| `cycleAway` | boolean | `true` | Include "Away" in auto-cycle rotation |
| `cycleDomestic` | boolean | `false` | Include "Domestic" in auto-cycle rotation |
| `cycleEuropean` | boolean | `false` | Include "European" in auto-cycle rotation |
| `locale` | string | `"en-GB"` | Locale for date/time formatting (e.g. `"de-DE"`, `"fr-FR"`) |
| `language` | string | `"en"` | UI language code: `en` `de` `es` `fr` `ga` `gd` `it` `nl` `pt` |
| `accentColor` | string | `"#018749"` | Team accent colour — sets `--mmf-accent-color` CSS variable |
| `darkMode` | boolean\|null | `null` | `null` = auto, `true` = force dark, `false` = force light |
| `fontColorOverride` | string\|null | `null` | Force text colour, e.g. `"#FFFFFF"` |
| `opacityOverride` | number\|null | `null` | Force wrapper opacity `0.0`–`1.0` |
| `teams` | array\|null | `null` | Multi-team mode — array of `{ label, teamName, teamId, leagueIds, uefaLeagueIds }` objects |
| `enableAlerts` | boolean | `false` | Fire MagicMirror SHOW_ALERT notification before kick-off |
| `alertBeforeMinutes` | number | `30` | Minutes before kick-off to send the alert |
| `debug` | boolean | `false` | Verbose console logging for troubleshooting |

> **Bold** options are the ones most users need to change. Everything else can be left at its default.

---

## Documentation

Detailed guides are in the `documentation/` folder:

| Guide | Contents |
|-------|---------|
| [HowThisModuleWorks.md](documentation/HowThisModuleWorks.md) | Architecture, data flow, caching, filtering, socket API |
| [FindingYourTeamID.md](documentation/FindingYourTeamID.md) | TheSportsDB team and league ID lookup, common ID tables |
| [CustomisingTheDisplay.md](documentation/CustomisingTheDisplay.md) | CSS custom properties, theming, column options, `customOverrides.css` |
| [MultiTeamAndAlerts-Guide.md](documentation/MultiTeamAndAlerts-Guide.md) | Multi-team switcher setup, pre-match alert config |
| [LanguageAndTranslation-Guide.md](documentation/LanguageAndTranslation-Guide.md) | Supported languages, adding a new translation |
| [AccessibilityFeatures-Guide.md](documentation/AccessibilityFeatures-Guide.md) | ARIA implementation, keyboard navigation, screen reader support |
| [Troubleshooting.md](documentation/Troubleshooting.md) | Common issues, debug log reference, fixes |
| [SHARED_REQUEST_MANAGER.md](documentation/SHARED_REQUEST_MANAGER.md) | HTTP queue, rate limiting, retry logic internals |
| [football-teams-database.csv](data/football_teams_database.csv) | Quick way to find your teams Sports DB id codes |
---

## Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| MagicMirror² | ≥ 2.x | Runtime environment |
| Node.js | ≥ 18 | Native `fetch`; or Node 16 + `node-fetch@2` |
| cheerio | ^1.1.2 | HTML parsing for web scrapers |
| node-fetch | ^2.7.0 | HTTP fallback for Node < 18 |

Install:
```bash
cd ~/MagicMirror/modules/MMM-MyTeams-Fixtures && npm install
```

---

## Related Modules — The MyTeams Suite

This is module 3 in the MyTeams MagicMirror collection:

| Module | Description |
|--------|-------------|
| [MMM-MyTeams-Clock](https://github.com/gitgitaway/MMM-MyTeams-Clock) | Team-branded clock |
| [MMM-MyTeams-LeagueTable](https://github.com/gitgitaway/MMM-MyTeams-LeagueTable) | League standings table |
| **MMM-MyTeams-Fixtures** | Upcoming fixtures *(this module)* |
| [MMM-JukeBox](https://github.com/gitgitaway/MMM-JukeBox) | Audio player |

---

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

Please:
- Follow the existing code style
- Test with multiple teams and sources
- Update the relevant documentation file if adding new config options
- Add translation keys to all 9 locale files if adding new UI strings

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full history of changes.

**Current version: 1.3.0** — Full security, performance, accessibility and UX review cycle.

---

## Acknowledgments

- **@jclarke0000** — MMM-MyScoreboard served as early inspiration
- **[TheSportsDB](https://www.thesportsdb.com/)** — Free football data API
- **[FootballWebPages](https://www.footballwebpages.co.uk/)** — Away fixture supplement
- **MagicMirror² Community** — Guidance, feedback, and support

---

## License

[MIT](LICENSE) — © gitgitaway
