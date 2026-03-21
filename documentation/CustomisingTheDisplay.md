# Customising the Display

**MMM-MyTeams-Fixtures** — Theming, layout, and visual customisation guide

---

## Overview

The module uses **CSS custom properties** (variables) for all colours. You can change the entire look of the module by overriding a handful of variables — no editing of the core stylesheet required.

All customisation goes into **`customOverrides.css`** in the module root. This file is loaded after the main stylesheet so any rule here wins automatically.

---

## CSS Custom Properties

These variables are defined on `.myteams-fixtures` and cascade to all child elements:

| Variable | Default | Controls |
|----------|---------|---------|
| `--mmf-accent-color` | `#018749` (Celtic green) | Active filter tab, countdown badge, table header border, live badge |
| `--mmf-border-color` | `#555555` | Table cell borders |
| `--mmf-table-header-bg` | `rgba(0,0,0,0.6)` | `<thead>` background |
| `--mmf-filter-active-bg` | `rgba(1,135,73,0.4)` | Active filter tab background |
| `--mmf-scroll-bg` | `rgba(0,0,0,0.3)` | Scrollable area background |

### Changing the Accent Colour

The accent colour is your team's primary brand colour. Set it in `customOverrides.css`:

```css
/* Manchester United — Red */
.myteams-fixtures { --mmf-accent-color: #da020e; }

/* Liverpool — Red */
.myteams-fixtures { --mmf-accent-color: #c8102e; }

/* Arsenal — Red */
.myteams-fixtures { --mmf-accent-color: #ef0107; }

/* Chelsea — Blue */
.myteams-fixtures { --mmf-accent-color: #034694; }

/* Barcelona — Blaugrana */
.myteams-fixtures { --mmf-accent-color: #a50044; }

/* Bayern Munich — Red */
.myteams-fixtures { --mmf-accent-color: #dc052d; }
```

You can also set `accentColor` in `config.js` — this is applied as a CSS custom property via a `<style>` tag at module start, so both methods work:

```javascript
config: {
  accentColor: "#da020e"    // Applied as --mmf-accent-color
}
```

> **Tip**: The CSS override in `customOverrides.css` takes precedence over the `accentColor` config value because it is applied later in the cascade.

---

## `customOverrides.css` — Full Reference

The file is pre-populated with useful starter rules. Here are all the customisable areas:

```css
/* ─── Accent colour ─────────────────────────────────── */
.myteams-fixtures { --mmf-accent-color: #018749; }

/* ─── Wrapper spacing ───────────────────────────────── */
.myteams-fixtures { margin-top: 4px; }

/* ─── Filter bar ────────────────────────────────────── */
.myteams-fixtures .filter-btn {
  background: rgba(255,255,255,0.06);
}

/* ─── Table alignment ───────────────────────────────── */
.myteams-fixtures .fixtures-table thead th { text-align: left; }
.myteams-fixtures .fixtures-table tbody td { text-align: left; }

/* ─── Column widths ─────────────────────────────────── */
.myteams-fixtures .col-date  { width: 76px; }
.myteams-fixtures .col-time  { width: 44px; }
.myteams-fixtures .col-opp   { min-width: 120px; }
.myteams-fixtures .col-ha    { width: 36px; }
.myteams-fixtures .col-comp  { min-width: 120px; }

/* ─── Font sizes ────────────────────────────────────── */
.small  { font-size: 12px; }
.xsmall { font-size: 10px; }

/* ─── Footer ────────────────────────────────────────── */
.myteams-fixtures .source-footer { text-align: center; }
```

---

## Config-Level Theme Options

These options in `config.js` apply theme changes via injected `<style>` tags:

| Option | Type | Default | Effect |
|--------|------|---------|--------|
| `accentColor` | string | `"#018749"` | Sets `--mmf-accent-color` CSS variable |
| `darkMode` | boolean\|null | `null` | `true` = dark background, `false` = light, `null` = auto |
| `fontColorOverride` | string\|null | `null` | Forces text colour (e.g. `"#FFFFFF"`) |
| `opacityOverride` | number\|null | `null` | Forces wrapper opacity (e.g. `0.9`) |

### Example — Light Theme / Day Mode

```javascript
config: {
  accentColor: "#005c29",
  darkMode: false,
  fontColorOverride: "#111111",
  opacityOverride: 1.0
}
```

---

## Table Height and Scrolling

The fixture table scrolls vertically when there are more rows than fit in `maxTableHeight`:

```javascript
config: {
  maxTableHeight: 320    // pixels — increase for taller displays
}
```

The scroll container has a **Back to Top** button that appears after scrolling 40px down. This is part of the `.scroll-controls` area.

---

## Hiding Columns

### Hide the Competition Column

```javascript
config: {
  showCompetition: false
}
```

### Hide the Footer

```javascript
config: {
  showFooter: false
}
```

### Hide the Countdown Badge

```javascript
config: {
  showCountdown: false
}
```

---

## Module Width

By default the module is capped at `550px`. Override in `customOverrides.css`:

```css
/* Wider — for large displays */
.myteams-fixtures { max-width: 700px; }

/* Full width — let MagicMirror control the width */
.myteams-fixtures { max-width: none; }
```

---

## Live Match Row Styling

When a match is in progress (`status: "In Progress"`), the table row receives the `.live-row` class and the time cell shows `🔴 score`. You can style this differently:

```css
/* Custom live row highlight */
.myteams-fixtures .fixtures-tbody tr.live-row {
  background: rgba(255, 50, 50, 0.15);
  outline: 1px solid rgba(255, 80, 80, 0.5);
}
```

---

## Skeleton Loader

While data is loading, a shimmer animation of six placeholder rows is displayed. You can adjust the shimmer colours:

```css
.myteams-fixtures .skeleton-row {
  background: linear-gradient(90deg,
    rgba(255,255,255,0.03) 25%,
    rgba(255,255,255,0.08) 50%,
    rgba(255,255,255,0.03) 75%);
}
```

---

## Stale Data Indicator

When cached data is older than 2× `cacheTTL`, the footer turns amber:

```css
/* Change stale colour */
.myteams-fixtures .source-footer.stale {
  color: #ffcc00;   /* Bright yellow instead of amber */
}
```

---

## Multiple Instances with Different Themes

You can run two instances side-by-side, each with a different accent colour, by giving them a unique `header` (which adds a data attribute you can target in CSS):

```javascript
// Instance 1 — Celtic
{
  module: "MMM-MyTeams-Fixtures",
  header: "Celtic Fixtures",
  position: "bottom_left",
  config: { teamId: "133647", accentColor: "#018749" }
},

// Instance 2 — Liverpool
{
  module: "MMM-MyTeams-Fixtures",
  header: "Liverpool Fixtures",
  position: "bottom_right",
  config: { teamId: "133602", accentColor: "#c8102e" }
}
```

---

## Screenshots Reference

| Screenshot | Theme |
|-----------|-------|
| `screenshotFixtures1.png` | Celtic — default green |
| `screenshotFixtures2.png` | Liverpool — red |
| `screenshotFixtures3.png` | Bayern Munich — dark red |
| `screenshotFixtures4.png` | Roma — dark yellow |

*See the `screenshots/` folder.*
