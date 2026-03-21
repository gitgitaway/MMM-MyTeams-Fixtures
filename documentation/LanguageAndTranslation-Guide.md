# Language & Translation Guide

**MMM-MyTeams-Fixtures** — Internationalisation reference

---

## Supported Languages

The module ships with nine translation files in the `translations/` folder:

| Language | Code | File | `locale` Value |
|----------|------|------|---------------|
| English | `en` | `translations/en.json` | `en-GB` |
| German | `de` | `translations/de.json` | `de-DE` |
| Spanish | `es` | `translations/es.json` | `es-ES` |
| French | `fr` | `translations/fr.json` | `fr-FR` |
| Irish Gaelic | `ga` | `translations/ga.json` | `ga-IE` |
| Scottish Gaelic | `gd` | `translations/gd.json` | `gd-GB` |
| Italian | `it` | `translations/it.json` | `it-IT` |
| Dutch | `nl` | `translations/nl.json` | `nl-NL` |
| Portuguese | `pt` | `translations/pt.json` | `pt-PT` |

---

## Setting Your Language

Add both `language` and `locale` to your config:

```javascript
config: {
  language: "fr",       // Controls UI labels (buttons, headers, messages)
  locale: "fr-FR"       // Controls date/time formatting (e.g. "lun. 21 jan.")
}
```

The two settings are independent:
- `language` selects the translation file (buttons, column headers, messages)
- `locale` is passed to JavaScript's `Intl.DateTimeFormat` for date display

---

## Translation Keys Reference

All translation keys used by the module:

| Key | English Value | Usage |
|-----|--------------|-------|
| `LOADING` | Loading fixtures… | Shown while data loads (legacy, now replaced by skeleton) |
| `NO_FIXTURES` | No upcoming fixtures | Shown when no data is available |
| `UPCOMING_FIXTURES` | upcoming fixtures | Used in filter button `aria-label` |
| `ALL` | All | "All" filter tab label |
| `DOMESTIC` | Domestic | "Domestic" filter tab label |
| `EUROPE` | Europe | "European" filter tab label |
| `HOME` | Home | "Home" filter tab label |
| `AWAY` | Away | "Away" filter tab label |
| `DATE` | Date | Table column header |
| `TIME` | Time | Table column header |
| `OPPONENT` | Opponent | Table column header |
| `COMPETITION` | Competition | Table column header |
| `H_A` | H/A | Table column header (Home/Away indicator) |
| `BACK_TO_TOP` | Back to top | Scroll-to-top button label |
| `SOURCE` | Source | Footer label prefix |
| `UNKNOWN` | unknown | Fallback for unknown source |
| `TBD` | TBD | Placeholder for unknown time/opponent |
| `REFRESH_DATA` | Refresh data | Refresh button `aria-label` |
| `CLEAR_CACHE` | Clear cache | Clear cache button `aria-label` |
| `PIN` | Pin (pause auto-cycling) | Pin button label when unpinned |
| `UNPIN` | Unpin (resume auto-cycling) | Pin button label when pinned |
| `NEXT_TAB_IN` | Next tab in | "Next tab in Xs" countdown prefix |
| `SHOW` | Show | Filter button `aria-label` prefix ("Show Home upcoming fixtures") |
| `LIVE` | LIVE | Live match badge text |
| `NEXT_MATCH` | Next match | Countdown badge prefix |

---

## Adding a New Language

1. Create a new JSON file in `translations/`, e.g. `translations/pl.json` for Polish

2. Copy the English file as a starting point:

```json
{
  "LOADING": "Ładowanie spotkań...",
  "NO_FIXTURES": "Brak nadchodzących spotkań",
  "UPCOMING_FIXTURES": "nadchodzące spotkania",
  "ALL": "Wszystkie",
  "DOMESTIC": "Krajowe",
  "EUROPE": "Europa",
  "HOME": "Dom",
  "AWAY": "Wyjazd",
  "DATE": "Data",
  "TIME": "Godzina",
  "OPPONENT": "Rywal",
  "COMPETITION": "Rozgrywki",
  "H_A": "D/W",
  "BACK_TO_TOP": "Wróć na górę",
  "SOURCE": "Źródło",
  "UNKNOWN": "nieznany",
  "TBD": "Do ustalenia",
  "REFRESH_DATA": "Odśwież dane",
  "CLEAR_CACHE": "Wyczyść pamięć",
  "PIN": "Przypnij (wstrzymaj cykl automatyczny)",
  "UNPIN": "Odepnij (wznów cykl automatyczny)",
  "NEXT_TAB_IN": "Następna zakładka za",
  "SHOW": "Pokaż",
  "LIVE": "NA ŻYWO",
  "NEXT_MATCH": "Następny mecz"
}
```

3. Register the new language in `MMM-MyTeams-Fixtures.js` inside `getTranslations()`:

```javascript
getTranslations() {
  return {
    en: "translations/en.json",
    de: "translations/de.json",
    // ... existing languages ...
    pl: "translations/pl.json"   // Add this line
  };
},
```

4. Set the language in your config:

```javascript
config: {
  language: "pl",
  locale: "pl-PL"
}
```

---

## Language Configuration Examples

See `config-example-languages.js` in the module root for ready-to-paste config snippets for all supported languages.

### English (default)
```javascript
{ language: "en", locale: "en-GB" }
```

### Spanish — for a Spanish club
```javascript
{
  teamName: "Real Madrid",
  teamId: "133736",
  language: "es",
  locale: "es-ES"
}
```

### French — for a French club
```javascript
{
  teamName: "Paris Saint-Germain",
  teamId: "133716",
  language: "fr",
  locale: "fr-FR"
}
```

### Scottish Gaelic — for the Celtic experience
```javascript
{
  teamName: "Celtic",
  teamId: "133647",
  language: "gd",
  locale: "gd-GB"
}
```

### Irish Gaelic
```javascript
{
  teamName: "Celtic",
  teamId: "133647",
  language: "ga",
  locale: "ga-IE"
}
```

---

## Date / Time Locale Formatting

The `locale` setting controls how dates are formatted in the Date column using `Intl.DateTimeFormat`. Examples:

| `locale` | Date displayed as |
|---------|-----------------|
| `en-GB` | `Mon 21 Jan` |
| `de-DE` | `Mo. 21. Jan.` |
| `fr-FR` | `lun. 21 janv.` |
| `es-ES` | `lun., 21 ene.` |
| `it-IT` | `lun 21 gen` |
| `nl-NL` | `ma 21 jan.` |
| `pt-PT` | `seg., 21 jan.` |

If your `locale` value is not recognized by the JavaScript runtime, the module falls back to `en-GB`.

---

## Multiple Instances in Different Languages

You can display fixtures for the same or different teams in different languages simultaneously:

```javascript
// Scottish Gaelic — top left
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_left",
  config: {
    teamName: "Celtic", teamId: "133647",
    language: "gd", locale: "gd-GB",
    maxFixtures: 6
  }
},

// English — top right
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Celtic", teamId: "133647",
    language: "en", locale: "en-GB",
    maxFixtures: 6
  }
}
```
