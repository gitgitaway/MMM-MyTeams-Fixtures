# Accessibility Features Guide

**MMM-MyTeams-Fixtures** — Accessibility implementation reference

---

## Overview

This module follows WCAG 2.1 AA guidelines where applicable in a MagicMirror² Electron context. All interactive controls are keyboard accessible, screen-reader-friendly, and do not rely on colour alone to convey information.

---

## Interactive Controls

All interactive elements use native `<button type="button">` elements rather than non-semantic `<span>` or `<div>` tags. This means they:

- Receive keyboard focus via **Tab**
- Are activated by **Enter** or **Space**
- Are announced correctly by screen readers
- Respect the OS focus indicator

### Filter Tabs

```html
<button type="button"
        class="filter-btn active"
        data-filter-key="home"
        aria-pressed="true"
        aria-label="Show Home upcoming fixtures">
  Home (4)
</button>
```

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `aria-pressed` | `"true"` / `"false"` | Announces selected state to screen readers |
| `aria-label` | `"Show <filter> upcoming fixtures"` | Provides context beyond the button text |
| `disabled` | present when count = 0 | Prevents interaction with empty filters |
| Text content | `"Home (4)"` | Shows fixture count inline |

Tabs with zero matching fixtures are both `disabled` and styled with reduced opacity (`.empty-filter` class).

### Control Buttons (Refresh / Clear Cache / Pin)

```html
<button type="button" class="refresh-btn" aria-label="Refresh data">↺</button>
<button type="button" class="clear-cache-btn" aria-label="Clear cache">✕</button>
<button type="button" class="pin-btn" aria-pressed="false" aria-label="Pin (pause auto-cycling)">📌</button>
```

The Pin button's `aria-pressed` and `aria-label` toggle between pinned/unpinned states when clicked, so the current state is always announced.

### Team Switcher (Multi-Team Mode)

```html
<button type="button"
        class="team-btn active"
        aria-pressed="true">
  Celtic
</button>
```

---

## Table Accessibility

### Caption (Visually Hidden)

A `<caption>` element is rendered inside the fixtures table with the team name and filter description. It is visually hidden using the `.sr-only` utility class but read aloud by screen readers:

```html
<caption class="sr-only">Celtic upcoming fixtures — All</caption>
```

### Semantic Structure

The table uses standard `<thead>` / `<tbody>` / `<th>` / `<td>` elements:

```html
<table class="fixtures-table">
  <caption class="sr-only">…</caption>
  <thead>
    <tr>
      <th scope="col">Date</th>
      <th scope="col">Time</th>
      <th scope="col">Opponent</th>
      <th scope="col">▲H/▽A</th>      <!-- ACC-003: unicode prefix -->
      <th scope="col">Competition</th>
    </tr>
  </thead>
  <tbody class="fixtures-tbody">…</tbody>
</table>
```

The `scope="col"` attribute on each `<th>` explicitly associates headers with their columns for screen readers.

### Home / Away Column (ACC-003)

The H/A column uses Unicode arrow prefixes alongside the letter so that the distinction is **not colour-only**:

| Value | Displayed as | Meaning |
|-------|-------------|---------|
| `H` | `▲ H` | Home fixture |
| `A` | `▽ A` | Away fixture |

---

## Screen-Reader-Only Utility Class

The `.sr-only` CSS class hides content visually while keeping it in the accessibility tree:

```css
.myteams-fixtures .sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

This is used for:
- The table `<caption>` element
- Any future labels that should be spoken but not seen

---

## Live Region Notifications

The module uses MagicMirror's built-in `SHOW_ALERT` notification system for pre-match alerts (when `enableAlerts: true`). These surface as MagicMirror overlay notifications which are handled by the host application.

---

## Keyboard Navigation Summary

| Key | Action |
|-----|--------|
| **Tab** | Move focus to next interactive element |
| **Shift+Tab** | Move focus to previous interactive element |
| **Enter** / **Space** | Activate focused button |
| *(No arrow keys needed)* | Filter tabs are individual buttons, not a `role="tablist"` |

---

## Colour & Contrast

The module uses CSS custom properties for all colour values, making them easy to override:

| Variable | Default | Usage |
|----------|---------|-------|
| `--mmf-accent-color` | `#018749` | Active tab, borders, badge backgrounds |
| `--mmf-border-color` | `#555555` | Table borders |
| `--mmf-filter-active-bg` | `rgba(1,135,73,0.4)` | Active filter tab background |

To improve contrast for your display, override the accent colour in `customOverrides.css`:

```css
.myteams-fixtures {
  --mmf-accent-color: #00aa55;   /* Brighter green for better contrast */
}
```

> **Note**: MagicMirror² typically displays on a black background, so white text on the default dark backgrounds provides high contrast. If you use a light-coloured mirror background, increase contrast via `fontColorOverride` and `accentColor` in config.

---

## Reduced Motion

The skeleton loader shimmer and fade-in animations respect the user's operating system motion preference via CSS media query:

```css
@media (prefers-reduced-motion: reduce) {
  .skeleton-row { animation: none; }
  .fixtures-tbody { animation: none; }
}
```

---

## Translation & Localisation

All user-visible strings use the MagicMirror translation system. Nine languages are included out of the box:

| Code | Language |
|------|---------|
| `en` | English (default) |
| `de` | German |
| `es` | Spanish |
| `fr` | French |
| `ga` | Irish Gaelic |
| `gd` | Scottish Gaelic |
| `it` | Italian |
| `nl` | Dutch |
| `pt` | Portuguese |

Set your language in config:

```javascript
config: {
  language: "fr",
  locale: "fr-FR"
}
```

See [`LanguageAndTranslation-Guide.md`](./LanguageAndTranslation-Guide.md) for adding a new language.

---

## ARIA Summary Checklist

| Feature | Status | Implementation |
|---------|--------|---------------|
| Filter buttons keyboard accessible | ✅ | `<button type="button">` |
| Filter state announced | ✅ | `aria-pressed` |
| Filter purpose described | ✅ | `aria-label` |
| Table semantically structured | ✅ | `<thead>/<tbody>/<th scope="col">` |
| Table described to screen readers | ✅ | `<caption class="sr-only">` |
| H/A not colour-only | ✅ | Unicode `▲`/`▽` prefix |
| Disabled empty filters | ✅ | `disabled` attribute |
| Live badge announced | ✅ | `🔴 LIVE` text content |
| Control buttons labelled | ✅ | `aria-label` on icon-only buttons |
| Pin state announced | ✅ | `aria-pressed` toggled |
| Reduced motion supported | ✅ | `prefers-reduced-motion` media query |
