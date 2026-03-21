# MMM-MyTeams-Fixtures — Module Review

**Version Reviewed:** 1.2.0  
**Review Date:** March 2026  
**Files Reviewed:** `MMM-MyTeams-Fixtures.js`, `node_helper.js`, `MMM-MyTeams-Fixtures.css`, `shared-request-manager.js`, `package.json`, `translations/en.json`

---

## Priority Key

| Priority | Label       | Description                                                |
|----------|-------------|------------------------------------------------------------|
| P1       | Critical    | Must fix — functional breakage, security vulnerability or data corruption |
| P2       | High        | Should fix — significant user-facing impact                |
| P3       | Medium      | Recommended — quality, maintainability, or UX improvement  |
| P4       | Low         | Nice to have — polish, future-proofing                     |

---

## 1. Security

### SEC-001 — XSS via `innerHTML` with Unescaped User-Supplied Data

**Priority:** P1 — Critical  
**ID:** `SEC-001`

**Finding:**  
In `getDom()` (lines 440–446 of `MMM-MyTeams-Fixtures.js`), table row content is rendered via `tr.innerHTML` using template literals that embed raw API/scraper values:

```js
tr.innerHTML = `
  <td class="col-date">${dateText}</td>
  <td class="col-time">${timeText}</td>
  <td class="col-opp">${opponent}</td>
  <td class="col-ha">${ha}</td>
  ${this.config.showCompetition ? `<td class="col-comp">${comp}</td>` : ""}
`;
```

All five values (`dateText`, `timeText`, `opponent`, `ha`, `comp`) originate from external API responses or web-scraper HTML. A compromised or spoofed API response, or a scraped page with malicious content, could inject arbitrary HTML/script into the MagicMirror DOM.

The `thead.innerHTML` block (lines 418–426) has the same pattern, though the values there come from `this.translate()` which is controlled.

**Justification:**  
MagicMirror² runs in an Electron/browser context with access to the local file system and Node.js IPC. Successful XSS in this environment is effectively remote code execution on the host machine.

**Recommended Implementation:**
1. Create a helper function `sanitizeText(str)` using `document.createTextNode()` and extracting `.textContent`, or by replacing `<`, `>`, `&`, `"` with HTML entities.
2. Replace all `tr.innerHTML = \`...\`` patterns with `document.createElement` + `textContent` assignments for each `<td>`.
3. Apply the same fix to the `thead.innerHTML` block as a defence-in-depth measure.

```js
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

---

### SEC-002 — Unconstrained Scraper URL Construction

**Priority:** P2 — High  
**ID:** `SEC-002`

**Finding:**  
`buildScraperUrls()` (node_helper.js line 719) constructs target URLs using the raw `teamName` config value:

```js
const slug = String(teamName || "celtic").toLowerCase().replace(/\s+/g, '-');
return {
  fwp: `https://www.footballwebpages.co.uk/${slug}/fixtures-results`,
  cfc: `https://www.${slug}fc.com/fixtures`
```

The `cfc` URL especially is vulnerable: a `teamName` value of `attacker.example.com/path?x=` would produce `https://www.attacker.example.com/path?x=fc.com/fixtures`, directing the server to fetch arbitrary external content.

**Justification:**  
Any third party who can influence the config (shared-device scenario, or a future config-file injection) could use this to exfiltrate internal host data or establish C2 communication from inside the network.

**Recommended Implementation:**
1. Add an allowed-characters allowlist for `teamName` before slugification: permit only `[a-zA-Z0-9 '\-]`.
2. Validate the final constructed URL against a domain allowlist before passing to `doFetch`.
3. Expose a `scraperDomainAllowlist` config property for power users.

---

### SEC-003 — Production Debug `console.log` Statements Leak Internal State

**Priority:** P2 — High  
**ID:** `SEC-003`

**Finding:**  
Two `console.log` calls in the DOM-rendering path fire unconditionally regardless of `config.debug`:

```js
// MMM-MyTeams-Fixtures.js line 488
console.log("[MyTeams-Fixtures] ScrollTop:", scrollTop, "IsScrolled:", isScrolled, "Has .visible:", controls.classList.contains("visible"));

// MMM-MyTeams-Fixtures.js line 508
console.log("[MyTeams-Fixtures] Attaching scroll listener. ScrollTop:", scroll.scrollTop);
```

These emit internal scroll state on every render cycle in a visible browser console, disclosing structural information about the module.

**Justification:**  
Leftover debug instrumentation in production paths is a security hygiene issue and creates console noise that masks genuine warnings. It also indicates the code was not reviewed before shipping.

**Recommended Implementation:**
1. Wrap both `console.log` calls in `if (this.config.debug)` guards.
2. Adopt a single logging helper: `this._log(msg)` that checks `this.config.debug` internally, used consistently throughout the front-end.

---

### SEC-004 — `apiUrl` Not Validated Before Use

**Priority:** P3 — Medium  
**ID:** `SEC-004`

**Finding:**  
The `apiUrl` config value is passed directly to URL-building functions in `node_helper.js` without validation. A crafted value like `file:///etc/passwd` or an internal network address would be accepted.

**Justification:**  
While this requires local config file access, it is a server-side request forgery (SSRF) vector relevant on shared or managed deployments.

**Recommended Implementation:**
1. In `node_helper.js`, parse `apiUrl` with `new URL()` at the start of `socketNotificationReceived` and assert `protocol === 'https:'`.
2. Optionally enforce it matches a known base domain (e.g., `thesportsdb.com`).

---

## 2. Performance

### PERF-001 — `_applyThemeOverrides()` Rebuilds a `<style>` Element on Every `getDom()` Call

**Priority:** P2 — High  
**ID:** `PERF-001`

**Finding:**  
`_applyThemeOverrides()` is called as the very first statement of every `getDom()` invocation. It queries `document.getElementById`, conditionally removes and recreates a `<style>` tag, and sets its `textContent`. This is pure overhead when the theme config has not changed since the last call.

**Justification:**  
`getDom()` is invoked by the countdown timer (every 60 s by default, or every 30 s on large lists), every auto-cycle tick, every filter click, and every socket notification. On a Raspberry Pi running MagicMirror, unnecessary DOM writes cause measurable jank.

**Recommended Implementation:**
1. Move theme-override application to `start()` and a dedicated `notificationReceived("ALL_MODULES_STARTED")` handler.
2. Add a `_themeApplied` flag; only reapply if config values change.
3. Alternatively, generate theme CSS once from `getStyles()` via a dynamically generated CSS file written by the node_helper at startup.

---

### PERF-002 — Scroll Event Listener Has No Throttle

**Priority:** P3 — Medium  
**ID:** `PERF-002`

**Finding:**  
The scroll listener on the `.fixtures-scroll` container (lines 484–512) fires synchronously on every scroll event with no throttle or debounce. Each fire includes `classList.contains`, `classList.add/remove`, and two `console.log` calls.

**Justification:**  
Scroll events on a touch display can fire at 60+ Hz. Without throttling, this creates unnecessary work on the Raspberry Pi GPU compositor.

**Recommended Implementation:**
1. Add a `requestAnimationFrame`-based throttle:
```js
let _scrollRaf = null;
scroll.addEventListener("scroll", () => {
  if (_scrollRaf) return;
  _scrollRaf = requestAnimationFrame(() => {
    toggleControls();
    _scrollRaf = null;
  });
}, { passive: true });
```

---

### PERF-003 — Duplicate `startAutoCycle()` Initialisation

**Priority:** P3 — Medium  
**ID:** `PERF-003`

**Finding:**  
`startAutoCycle()` is called from `start()` (line 115) and again inside `socketNotificationReceived` when `FIXTURES_DATA` is received (line 263). The second call clears and recreates the `setInterval` every time new data arrives, even if the configuration has not changed.

**Justification:**  
Each recreation resets the cycle countdown, causing the timer to restart from 0 after every background refresh (every 10 minutes by default), interrupting the auto-cycle mid-rotation unexpectedly.

**Recommended Implementation:**
1. Only call `startAutoCycle()` from `socketNotificationReceived` if the cycle is not already running (i.e., `!this._cycleTimer`).
2. After data refresh, call `_resetAutoCycleIndexToFilter` only, without tearing down and recreating the timer.

---

### PERF-004 — `SharedRequestManager` Queue Processor `setInterval` Is Never Cleared

**Priority:** P3 — Medium  
**ID:** `PERF-004`

**Finding:**  
`startQueueProcessor()` in `shared-request-manager.js` (line 190) creates a `setInterval` but stores no reference to it, making it impossible to cancel:

```js
startQueueProcessor() {
  setInterval(() => {
    if (!this.processing && this.queue.length > 0) {
      this.processNextRequest();
    }
  }, this.config.queueCheckInterval);
}
```

**Justification:**  
MagicMirror hot-reloads modules during development. An orphaned `setInterval` from a previous module instance continues running, creating ghost queue processors that can cause duplicate requests and unpredictable timing.

**Recommended Implementation:**
1. Store the interval reference: `this._queueInterval = setInterval(...)`.
2. Expose a `destroy()` method on `SharedRequestManager` that clears `this._queueInterval`.
3. Call `requestManager.destroy()` from the node_helper's `stop()` lifecycle method.

---

### PERF-005 — `fetchSeason` Function Defined After Its Call Site via Hoisting Dependency

**Priority:** P4 — Low  
**ID:** `PERF-005`

**Finding:**  
`fetchSeason` is called at line 460 (inside the first `try` block of `getFixturesFromAPI`) but is declared as a `function` statement at line 502 (after the close of that `try` block). While JavaScript hoists named function declarations within the enclosing function scope, this creates a confusing reading order and makes the code fragile if the declaration is ever converted to a `const` arrow function.

**Recommended Implementation:**
1. Move the `fetchSeason` declaration to the top of `getFixturesFromAPI`, before the first `try` block.
2. The duplicate inner `fetchSeasonAlt` at line 672 (which is structurally identical to `fetchSeason`) should be deduplicated into a single parameterised function `fetchSeasonForId(s, id)`.

---

## 3. Accessibility

### ACC-001 — Interactive Controls Are Non-Focusable `<span>` Elements

**Priority:** P1 — Critical  
**ID:** `ACC-001`

**Finding:**  
All five interactive controls — five filter tabs, the refresh button, the clear-cache button, the pin button, and the back-to-top button — are either `<span>` elements (filter tabs, refresh, clear-cache) or `<button>` (back-to-top only). Spans are not in the tab order, cannot receive keyboard focus by default, and do not fire `click` on `Enter`/`Space`.

The `pinBtn` has `role="button"` added but is missing `tabindex="0"` and keyboard event handlers, making the ARIA role misleading — it appears interactive in the accessibility tree but cannot be activated by keyboard.

**Justification:**  
MagicMirror installations are increasingly used with touchscreen inputs, gyroscope controllers, and remote-presentation keyboards. Keyboard-inaccessible controls break those use cases entirely and violate WCAG 2.1 SC 2.1.1 (Keyboard).

**Recommended Implementation:**
1. Replace all interactive `<span>` controls with `<button type="button">` elements.
2. Remove custom `onclick`/`addEventListener("click")` assignments and use the `<button>` native click handling.
3. The `<button>` elements inherit `:focus-visible` styles from the MagicMirror base stylesheet; add explicit focus styles in the module CSS if they are absent.

---

### ACC-002 — Filter Buttons Have No Accessible Label Describing Their Action

**Priority:** P2 — High  
**ID:** `ACC-002`

**Finding:**  
Filter tab buttons have only a visible text label (e.g., "Home") with no `aria-label` or `title` that explains the action ("Show Home fixtures"). The `aria-pressed` state is not set on filter buttons to convey which filter is active.

**Recommended Implementation:**
1. Add `aria-pressed` (`"true"` / `"false"`) to each filter button, updated when `setActiveFilter()` is called.
2. Add `aria-label` to each button: e.g., `aria-label="Show Home fixtures"`.

---

### ACC-003 — Home/Away Differentiation Relies on Colour Alone

**Priority:** P2 — High  
**ID:** `ACC-003`

**Finding:**  
Home rows set `col-ha` text to white (`#ffffff`) and away rows to Celtic green (`#018749`). No other visual or textual cue differentiates the two states. Users with colour blindness (8% of males) cannot distinguish home from away.

**Justification:**  
WCAG 2.1 SC 1.4.1 (Use of Color) requires that colour is not the only means of conveying information.

**Recommended Implementation:**
1. Prefix the `H/A` cell text with a Unicode indicator: `🏠 H` / `✈ A`, or use CSS `::before` pseudo-element with `content: "▲"` / `content: "▼"` for home/away respectively.
2. Alternatively, add a CSS `font-style: italic` on away rows as a secondary differentiator.

---

### ACC-004 — Fixtures Table Has No Accessible Name

**Priority:** P3 — Medium  
**ID:** `ACC-004`

**Finding:**  
The `<table>` element has class `fixtures-table` but no `<caption>` element and no `aria-label` or `aria-labelledby` attribute. Screen reader users will hear "table" with no context.

**Recommended Implementation:**
1. Add a visually hidden `<caption>` using the existing translation:
```js
const caption = document.createElement("caption");
caption.className = "sr-only";
caption.textContent = `${this.config.teamName} ${this.translate("UPCOMING_FIXTURES")}`;
table.appendChild(caption);
```
2. Add `.sr-only` to the CSS: `position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0);`.

---

### ACC-005 — Missing Translation Keys for Control Button Titles

**Priority:** P3 — Medium  
**ID:** `ACC-005`

**Finding:**  
`refreshBtn.title` and `clearBtn.title` use inline fallback strings:
```js
refreshBtn.title = this.translate("REFRESH_DATA") || "Refresh Data";
clearBtn.title = this.translate("CLEAR_CACHE") || "Clear Cache";
```
`REFRESH_DATA` and `CLEAR_CACHE` are absent from all nine translation files (`en.json`, `de.json`, etc.), so `this.translate()` will always return the key string `"REFRESH_DATA"` rather than the fallback, resulting in untranslated tooltip text.

Also absent from all translation files: `UNPIN`, `PIN`, `Next_Tab_In`.

**Recommended Implementation:**
1. Add all missing keys to every translation file.
2. Enforce consistent key naming — use `ALL_CAPS_UNDERSCORE` convention throughout; `Next_Tab_In` should be `NEXT_TAB_IN`.

---

## 4. Innovation

### INN-001 — Next Match Countdown Badge

**Priority:** P3 — Medium  
**ID:** `INN-001`

**Finding:**  
`computeCountdown()` exists in the front-end code (line 664) but is **never called** — it is dead code. The countdown feature is entirely unused despite the infrastructure being present.

**Justification:**  
A "next match in X days / X hours" badge prominently displayed on the module header would be the single most useful piece of information for a fan-facing display.

**Recommended Implementation:**
1. Call `computeCountdown()` on the first fixture in the filtered list and render the result as a highlighted badge in the module header area.
2. Use the existing `_countdownTimer` to refresh it; no new timer is needed.
3. Style with a contrasting pill/badge: `border-radius: 12px; padding: 2px 8px; background: rgba(1,135,73,0.5);`.

---

### INN-002 — Live Match Indicator

**Priority:** P3 — Medium  
**ID:** `INN-002`

**Finding:**  
TheSportsDB API returns `strStatus` and `intHomeScore`/`intAwayScore` fields on events. These are extracted into the raw event object but discarded by `toFixtureFromEvent()` (line 335). There is no live match state on the displayed fixture.

**Recommended Implementation:**
1. Pass `status`, `homeScore`, and `awayScore` fields through `toFixtureFromEvent()`.
2. In `getDom()`, detect fixtures where `status === "Match Finished"` or `status === "In Progress"` and render a 🔴 live pill or the current score inline.
3. Reduce `updateInterval` to 2 minutes automatically when a match is live (use `scheduleUpdate()` with a dynamic interval).

---

### INN-003 — Multi-Team Support

**Priority:** P4 — Low  
**ID:** `INN-003`

**Finding:**  
The module is documented as team-agnostic but the config accepts only a single `teamId` / `teamName`. A supporter following two clubs (e.g., their national team + club side) must run two module instances.

**Recommended Implementation:**
1. Accept `teams: [{ teamId, teamName, label }]` as an alternative to the scalar `teamId`/`teamName`.
2. Render a team-switcher row above the filter tabs when multiple teams are configured.
3. Maintain separate fixture lists per team in `_cachedListsByFilter` keyed by team.

---

### INN-004 — Notification Integration for Imminent Kick-off

**Priority:** P4 — Low  
**ID:** `INN-004`

**Finding:**  
MagicMirror has a built-in `alert` module and a `sendNotification` API. The module currently never fires any cross-module notification. A pop-up alert 30 minutes before kick-off would significantly improve the "smart mirror" value proposition.

**Recommended Implementation:**
1. In `startCountdown()`, after computing the next fixture's countdown, check if it falls within a configurable `alertBeforeMinutes` window (default `30`).
2. Call `this.sendNotification("SHOW_ALERT", { title: "Kick-off soon", message: "Celtic vs Rangers in 30 min", timer: 10000 })`.
3. Guard with a `_alertFired` flag to prevent repeated alerts on every timer tick.

---

## 5. UI/UX Experience

### UX-001 — Filter Tabs Do Not Show Fixture Counts

**Priority:** P2 — High  
**ID:** `UX-001`

**Finding:**  
Filter tabs render labels only (e.g., "Home", "Away") with no indication of how many fixtures are in each category. A user must click "European" to discover there are no European fixtures — and the display goes blank with no feedback.

**Recommended Implementation:**
1. After data loads, call `applyClientFilter()` for each filter and append counts to each tab label: `Home (4)`.
2. Disable and visually grey-out tabs with a zero count (add `disabled` attribute on converted `<button>` elements — see ACC-001).
3. Cache the per-filter counts in `_cachedListsByFilter` alongside the list (no extra computation needed).

---

### UX-002 — No Visual Indicator for Stale or Cached Data

**Priority:** P2 — High  
**ID:** `UX-002`

**Finding:**  
The source footer shows a raw ISO timestamp (`Source: api • 3/19/2026, 07:14:23 AM`) but gives no indication of whether the data is fresh, cached, or stale relative to the configured `cacheTTL`. A user looking at data from 4 hours ago has no way to know.

**Recommended Implementation:**
1. Compute `age = Date.now() - this.fetchedAt` in `getDom()`.
2. If `age > cacheTTL * 1.5`, add a `⚠ Stale` indicator and change the footer text colour to amber.
3. Replace the raw ISO timestamp with a human-readable relative time: "Updated 5 min ago".

---

### UX-003 — Source Footer Exposes Technical Jargon to End Users

**Priority:** P3 — Medium  
**ID:** `UX-003`

**Finding:**  
The footer shows `Source: api` (or `Source: fwp`). "fwp" means nothing to a typical user. The exact fetch time is similarly low-value for a display that refreshes automatically.

**Recommended Implementation:**
1. Map source keys to user-friendly labels via a config object:
```js
const sourceLabels = { api: "TheSportsDB", fwp: "Football Web Pages", bbc: "BBC Sport", cache: "Cached" };
```
2. Only display the last-updated time if data is older than `cacheTTL`.
3. Make the footer entirely optional via a `showFooter: true` config flag.

---

### UX-004 — No Loading Skeleton During Initial Data Fetch

**Priority:** P3 — Medium  
**ID:** `UX-004`

**Finding:**  
During loading, the module renders only `<div class="loading">Loading fixtures...</div>`. On a Raspberry Pi with a cold start, this can persist for 5–15 seconds leaving a blank text area.

**Recommended Implementation:**
1. Render 5–6 skeleton rows (placeholder `<tr>` elements with CSS animated shimmer) while `isLoading` is true.
2. Reuse stale cached data visually (from `fixtures-cache.json`) during the reload, adding a subtle "Refreshing..." badge overlay.

---

### UX-005 — Auto-Cycle Provides No Smooth Transition Between Filters

**Priority:** P4 — Low  
**ID:** `UX-005`

**Finding:**  
When the auto-cycle advances to the next filter, `updateDom(200)` is called which causes MagicMirror to fade the entire module out and back in over 200ms. This is a jarring full-module flash rather than a content-level transition.

**Recommended Implementation:**
1. Instead of replacing the entire DOM, animate only the `<tbody>` rows — fade the current rows out, swap, then fade new rows in using CSS `@keyframes`.
2. If full `updateDom()` must be used, increase `animationSpeed` to 600ms and use `updateDom(0)` then CSS transitions on the table body.

---

## 6. Design & Aesthetics

### DES-001 — `package.json` Is Malformed (Invalid JSON)

**Priority:** P1 — Critical  
**ID:** `DES-001`

**Finding:**  
`package.json` (lines 22–28) has a structural JSON error: the `repository` object is opened but never closed before `dependencies` begins. The file also uses a tab after `"url":` followed immediately by `"dependencies"` at the same nesting level, making the JSON syntactically invalid:

```json
"repository": {
  "type": "git",
  "url": "https://github.com/gitgitaway/MMM-MyTeams-Fixtures.git",
"dependencies": {           ← missing closing } for repository
```

This means `npm install` will fail with a JSON parse error on a clean clone.

**Recommended Implementation:**
```json
"repository": {
  "type": "git",
  "url": "https://github.com/gitgitaway/MMM-MyTeams-Fixtures.git"
},
"dependencies": {
  "cheerio": "^1.1.2",
  "node-fetch": "^2.7.0"
}
```

---

### DES-002 — `package.json` `main` Field References a Non-Existent File

**Priority:** P1 — Critical  
**ID:** `DES-002`

**Finding:**  
`"main": "MMM-MyTeam-Fixtures.js"` is missing the `s` in `MyTeams`. The actual file is `MMM-MyTeams-Fixtures.js`. This does not affect MagicMirror module loading (which uses its own resolution), but it misleads tooling, IDEs, and any programmatic consumers of the package manifest.

**Recommended Implementation:**
Change to `"main": "MMM-MyTeams-Fixtures.js"`.

---

### DES-003 — Team-Specific Colour (`#018749`) Hardcoded in Shared CSS

**Priority:** P2 — High  
**ID:** `DES-003`

**Finding:**  
Celtic FC's primary green (`#018749`) appears **6 times** in `MMM-MyTeams-Fixtures.css` (filter active state, refresh-btn spin state, back-to-top button background, home/away ha cell colour). The module README and `package.json` keywords both advertise it as team-agnostic (supporting Rangers, Manchester United, Liverpool, Arsenal, Barcelona), yet its default CSS is visually Celtic-specific.

**Justification:**  
Every non-Celtic user must override the CSS manually. This contradicts the team-agnostic positioning and creates a poor first-run experience.

**Recommended Implementation:**
1. Replace hardcoded hex values with CSS custom properties defined on `.myteams-fixtures`:
```css
.myteams-fixtures {
  --mmf-accent-color: #018749;    /* Team primary colour */
  --mmf-text-color: #ffffff;
  --mmf-border-color: #555555;
  --mmf-table-bg: rgba(0,0,0,0.6);
}
```
2. Expose `accentColor` as a config option in the JavaScript defaults, and use `_applyThemeOverrides()` to write `--mmf-accent-color: ${this.config.accentColor}` to the style element (once, not per render — see PERF-001).
3. Default `accentColor` to `"#018749"` for backward compatibility.

---

### DES-004 — Pervasive Use of `!important` in CSS

**Priority:** P3 — Medium  
**ID:** `DES-004`

**Finding:**  
The `.scroll-controls` block (lines 108–125 of `MMM-MyTeams-Fixtures.css`) uses `!important` on every single property — 9 declarations. This pattern is used to override MagicMirror base styles, but it makes the module's own CSS impossible to override from `customFWP.css` without using even higher-specificity selectors or further `!important` escalation.

**Recommended Implementation:**
1. Increase specificity instead of using `!important`:
```css
.myteams-fixtures .fixtures-scroll .scroll-controls {
  position: sticky;
  bottom: 0;
  /* ... */
}
```
2. Reserve `!important` only for theme override injection (in `_applyThemeOverrides()`) where it is deliberately needed to beat user-defined styles.

---

### DES-005 — `customFWP.css` Always Loaded Regardless of Whether FWP Scraper Is Active

**Priority:** P4 — Low  
**ID:** `DES-005`

**Finding:**  
`getStyles()` unconditionally loads `customFWP.css`:
```js
getStyles() {
  return [
    this.file("MMM-MyTeams-Fixtures.css"),
    this.file("customFWP.css")
  ];
}
```
The name `customFWP.css` implies it is for Football Web Pages scraper overrides, yet it is loaded for all users including those using the API source exclusively.

**Recommended Implementation:**
1. Rename to `customOverrides.css` to clarify its role as a user-customisation file.
2. Keep loading it unconditionally (it is a legitimate user override hook) but rename it and document its purpose clearly in `README.md`.

---

### DES-006 — Inconsistent Column Width Definitions (Dead CSS)

**Priority:** P4 — Low  
**ID:** `DES-006`

**Finding:**  
Lines 198–206 of `MMM-MyTeams-Fixtures.css` contain a commented-out column-width block labelled "These styles are overridden by the ones above — keeping for reference". This dead CSS creates confusion about which values are canonical.

**Recommended Implementation:**
1. Delete the commented block entirely. Git history preserves the old values if needed.
2. Add a brief comment above the active column definitions explaining the `table-layout: fixed` requirement.

---

## Summary Table

| ID       | Area          | Priority | Title                                                          |
|----------|---------------|----------|----------------------------------------------------------------|
| SEC-001  | Security      | P1       | XSS via innerHTML with unescaped API data                      |
| SEC-002  | Security      | P2       | Unconstrained scraper URL construction                         |
| SEC-003  | Security      | P2       | Production debug console.log leaks internal state              |
| SEC-004  | Security      | P3       | apiUrl not validated before use                                |
| PERF-001 | Performance   | P2       | _applyThemeOverrides rebuilds style element on every getDom    |
| PERF-002 | Performance   | P3       | Scroll event listener has no throttle                          |
| PERF-003 | Performance   | P3       | Duplicate startAutoCycle initialisation on data refresh        |
| PERF-004 | Performance   | P3       | SharedRequestManager queue setInterval never cleared           |
| PERF-005 | Performance   | P4       | fetchSeason defined after call site (hoisting dependency)      |
| ACC-001  | Accessibility | P1       | Interactive controls are non-focusable span elements           |
| ACC-002  | Accessibility | P2       | Filter buttons have no aria-pressed or descriptive label       |
| ACC-003  | Accessibility | P2       | Home/Away differentiation relies on colour alone               |
| ACC-004  | Accessibility | P3       | Fixtures table has no accessible name                          |
| ACC-005  | Accessibility | P3       | Missing translation keys for control button titles             |
| INN-001  | Innovation    | P3       | Next-match countdown badge (dead computeCountdown code)        |
| INN-002  | Innovation    | P3       | Live match score indicator                                     |
| INN-003  | Innovation    | P4       | Multi-team support                                             |
| INN-004  | Innovation    | P4       | Kick-off alert notification integration                        |
| UX-001   | UI/UX         | P2       | Filter tabs show no fixture counts                             |
| UX-002   | UI/UX         | P2       | No visual indicator for stale or cached data                   |
| UX-003   | UI/UX         | P3       | Source footer exposes technical jargon to end users            |
| UX-004   | UI/UX         | P3       | No loading skeleton during initial data fetch                  |
| UX-005   | UI/UX         | P4       | Auto-cycle filter change has no smooth transition              |
| DES-001  | Design        | P1       | package.json is malformed — invalid JSON breaks npm install    |
| DES-002  | Design        | P1       | package.json main field references a non-existent file         |
| DES-003  | Design        | P2       | Team-specific colour (#018749) hardcoded in team-agnostic CSS  |
| DES-004  | Design        | P3       | Pervasive use of !important in CSS                             |
| DES-005  | Design        | P4       | customFWP.css always loaded regardless of source config        |
| DES-006  | Design        | P4       | Dead commented-out CSS column-width block                      |

---

## Recommended Implementation Strategy

### Phase 1 — Critical Fixes (P1) — Immediate

Address before next public release. These items involve functional breakage or security vulnerabilities.

| ID      | Action                                                                                                     | Effort   |
|---------|------------------------------------------------------------------------------------------------------------|----------|
| DES-001 | Fix malformed `package.json` — close the `repository` object and verify with `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` | 5 min    |
| DES-002 | Fix `"main"` field typo in `package.json` to `"MMM-MyTeams-Fixtures.js"`                                  | 1 min    |
| SEC-001 | Replace all `innerHTML` template literals in `getDom()` with `textContent` assignments on individual `<td>` elements; add `esc()` helper | 1–2 hrs  |
| ACC-001 | Convert all interactive `<span>` controls to `<button type="button">` elements; update CSS selectors accordingly | 1–2 hrs  |

### Phase 2 — High Priority (P2) — Next Sprint

Address within the next development cycle. Items improve security, user experience, or accessibility meaningfully.

| ID      | Action                                                                                                      | Effort   |
|---------|-------------------------------------------------------------------------------------------------------------|----------|
| SEC-002 | Add `teamName` allowlist validation and scraper URL domain assertion                                         | 1 hr     |
| SEC-003 | Wrap the two unconditional `console.log` calls in `if (this.config.debug)` guards                           | 10 min   |
| PERF-001| Move `_applyThemeOverrides()` to `start()` + dirty-flag guard; remove from `getDom()`                       | 30 min   |
| ACC-002 | Add `aria-pressed` state management and `aria-label` to all filter buttons                                   | 30 min   |
| ACC-003 | Add secondary visual indicator (Unicode prefix or CSS `::before` content) for H/A column                    | 20 min   |
| UX-001  | Add per-filter fixture counts to tab labels; disable zero-count tabs                                         | 1 hr     |
| UX-002  | Add stale-data detection and human-readable "Updated X min ago" footer                                       | 1 hr     |
| DES-003 | Introduce `--mmf-accent-color` CSS custom property; expose `accentColor` config option                       | 1–2 hrs  |

### Phase 3 — Recommended (P3) — Upcoming Milestone

Quality improvements that enhance maintainability, user trust, and UX polish.

| ID      | Action                                                                             | Effort   |
|---------|------------------------------------------------------------------------------------|----------|
| SEC-004 | Validate `apiUrl` protocol and domain in node_helper                               | 30 min   |
| PERF-002| Add `requestAnimationFrame` throttle to scroll event listener                      | 15 min   |
| PERF-003| Guard `startAutoCycle()` in `socketNotificationReceived` against duplicate init     | 15 min   |
| PERF-004| Store `setInterval` reference in `SharedRequestManager`; add `destroy()` method    | 20 min   |
| ACC-004 | Add visually hidden `<caption>` to fixtures table                                  | 15 min   |
| ACC-005 | Add all missing translation keys (`REFRESH_DATA`, `CLEAR_CACHE`, `PIN`, `UNPIN`, `NEXT_TAB_IN`) to all 9 translation files | 30 min   |
| INN-001 | Wire `computeCountdown()` to the first fixture; render as header badge             | 1 hr     |
| INN-002 | Pass `status`/`score` fields through `toFixtureFromEvent()`; render live indicator | 2–3 hrs  |
| UX-003  | Add `sourceLabels` map; make footer optional via `showFooter` config flag          | 30 min   |
| UX-004  | Render skeleton rows during `isLoading` state                                      | 1 hr     |
| DES-004 | Increase CSS specificity on `.scroll-controls`; remove `!important` cascade        | 30 min   |

### Phase 4 — Polish (P4) — Backlog

Lower-urgency improvements for a future major version.

| ID      | Action                                                                             | Effort   |
|---------|------------------------------------------------------------------------------------|----------|
| PERF-005| Relocate and deduplicate `fetchSeason` / `fetchSeasonAlt` in node_helper           | 30 min   |
| INN-003 | Design and implement multi-team support with team-switcher UI                      | 3–5 days |
| INN-004 | Implement pre-match `SHOW_ALERT` notification via MagicMirror alert module         | 2 hrs    |
| UX-005  | Replace full `updateDom()` cycle change with targeted `<tbody>` CSS fade animation | 2 hrs    |
| DES-005 | Rename `customFWP.css` → `customOverrides.css`; update `getStyles()` and README    | 10 min   |
| DES-006 | Delete dead commented-out column-width CSS block                                   | 5 min    |
