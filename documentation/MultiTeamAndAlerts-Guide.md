# Multi-Team Support & Pre-Match Alerts

**MMM-MyTeams-Fixtures** — Advanced display features guide

---

## Multi-Team Support (INN-003)

The module can display fixtures for **multiple teams** and let you switch between them using an on-screen team switcher row. This is useful if you want to track more than one club — for example, a Celtic supporter who also follows the Scotland national team.

### How It Works

When you provide a `teams` array in config, the module renders a row of team buttons above the filter tabs. Clicking a button fetches and displays that team's fixtures. Only one team is shown at a time.

If `teams` is `null` (the default), the module behaves exactly as before using the scalar `teamId`/`teamName` config values — fully backward compatible.

### Configuration

```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "bottom_right",
  config: {
    // Multi-team array — each entry is a full team config
    teams: [
      {
        label: "Celtic",          // Display label for the switcher button
        teamName: "Celtic",
        teamId: "133647",
        leagueIds: ["4330", "4364", "4363", "4888"],
        uefaLeagueIds: ["4480", "4481", "5071"]
      },
      {
        label: "Scotland 🏴󠁧󠁢󠁳󠁣󠁴󠁿",
        teamName: "Scotland",
        teamId: "133728",
        leagueIds: ["4731"],        // UEFA Nations League domestic
        uefaLeagueIds: ["4731"]
      },
      {
        label: "Liverpool",
        teamName: "Liverpool",
        teamId: "133602",
        leagueIds: ["4328", "4424", "4426"],
        uefaLeagueIds: ["4480", "4481", "5071"]
      }
    ],

    // These scalar values are used when teams is null (single-team mode)
    // They are also the fallback if a teams entry omits them
    teamName: "Celtic",
    teamId: "133647",

    // All other options apply globally to all teams
    source: "api",
    maxFixtures: 12,
    showCompetition: true,
    autoCycleFilters: true,
    autoCycleIntervalMs: 20000
  }
}
```

### Supported Per-Team Properties

Each entry in the `teams` array can override these properties:

| Property | Description |
|----------|-------------|
| `label` | Button text shown in the switcher (falls back to `teamName`) |
| `teamName` | Team name used for API lookups and scraper URLs |
| `teamId` | TheSportsDB team ID |
| `leagueIds` | Domestic league/cup IDs for this team |
| `uefaLeagueIds` | UEFA competition IDs for this team |

All other config options (`source`, `maxFixtures`, `accentColor`, etc.) are shared across all teams.

### Visual Appearance

The team switcher appears as a horizontal row of buttons at the top of the module, above the filter tabs. The active team button is highlighted with the accent colour. On small displays, the buttons wrap to multiple lines automatically.

### Alert Deduplication in Multi-Team Mode

Pre-match alerts (`enableAlerts: true`) are tracked per-team. Switching teams clears the alert history for the new team, so you will receive alerts for upcoming matches of the newly selected team.

---

## Pre-Match Alert Notifications (INN-004)

The module can send a MagicMirror notification before kick-off, which triggers the built-in alert overlay on your mirror.

### Requirements

1. The `alert` module must be active in your `config.js` modules list:
   ```javascript
   { module: "alert" }
   ```
   *(This is included in the default MagicMirror config.)*

2. `enableAlerts: true` must be set in this module's config.

### Configuration

```javascript
config: {
  enableAlerts: true,           // Enable pre-match alerts
  alertBeforeMinutes: 30        // How many minutes before kick-off to fire the alert
}
```

### What the Alert Shows

The alert notification displays:

- **Title**: The team name (e.g. "Celtic")
- **Message**: `"vs <Opponent> kicks off in 30 minutes — <Competition>"`

The alert uses MagicMirror's `SHOW_ALERT` notification with a 10-second display timer. It will also sound if you have a notification sound configured in MagicMirror.

### Alert Scheduling

Alerts are scheduled when fixture data is received. The module:

1. Looks at the first (soonest) upcoming fixture
2. Calculates: `kickoff time − alertBeforeMinutes`
3. Sets a `setTimeout` to fire at that calculated time
4. Tracks the fixture in `_alertFired` to prevent duplicates

If MagicMirror is restarted after the alert time has already passed, the alert will **not** fire retroactively.

### Alert Deduplication

Each alert is keyed by `date|time|opponent`. Once fired, the key is added to the `_alertFired` Set. This prevents repeated alerts if data refreshes while the same match is still upcoming.

### Example Alert Config (with multi-team)

```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "bottom_right",
  config: {
    teams: [
      { label: "Celtic", teamName: "Celtic", teamId: "133647",
        leagueIds: ["4330", "4364", "4363", "4888"],
        uefaLeagueIds: ["4480", "4481", "5071"] }
    ],
    enableAlerts: true,
    alertBeforeMinutes: 60,     // Alert 1 hour before kick-off
    updateInterval: 5 * 60 * 1000
  }
}
```

---

## Auto-Cycle Filters

The module can automatically rotate through fixture filters on a timer, useful for hands-free display on your mirror.

### Configuration

```javascript
config: {
  autoCycleFilters: true,           // Enable rotation
  autoCycleIntervalMs: 20000,       // 20 seconds per filter

  // Choose which filters rotate:
  cycleAll: true,
  cycleHome: true,
  cycleAway: true,
  cycleDomestic: false,
  cycleEuropean: false
}
```

### Pin Button

The **📌 Pin** button in the header pauses auto-cycling. Click again (now showing 📌 active state) to resume. The `aria-pressed` attribute reflects the current pin state for screen readers.

The "Next tab in Xs" countdown shown in the scroll area resets when you interact with a filter tab manually.

### Cycle Rules

- Empty filters (zero fixtures) are **skipped** automatically
- If all cycle flags are `false`, cycling stops after one revolution
- The cycle starts from `defaultFilter` if that filter is included in the cycle set
- `autoCycleIntervalMs` is clamped to a minimum of 5000 ms
