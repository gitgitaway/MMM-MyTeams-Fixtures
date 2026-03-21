# Translation Reference - MMM-MyTeams-Fixtures

## Complete Translation Key Reference

This document provides a complete reference of all translation keys used in the module.

## Translation Keys

| Key | English | Usage |
|-----|---------|-------|
| `LOADING` | Loading fixtures... | Displayed while fetching fixture data |
| `NO_FIXTURES` | No upcoming fixtures | Shown when no fixtures are available |
| `UPCOMING_FIXTURES` | upcoming fixtures | Used in module title: "[Team] FC upcoming fixtures" |
| `ALL` | All | Filter button - show all fixtures |
| `DOMESTIC` | Domestic | Filter button - show domestic league fixtures |
| `EUROPE` | Europe | Filter button - show European competition fixtures |
| `HOME` | Home | Filter button - show home fixtures only |
| `AWAY` | Away | Filter button - show away fixtures only |
| `DATE` | Date | Table column header |
| `TIME` | Time | Table column header |
| `OPPONENT` | Opponent | Table column header |
| `COMPETITION` | Competition | Table column header |
| `H_A` | H/A | Table column header (Home/Away indicator) |
| `BACK_TO_TOP` | Back to top | Scroll control button |
| `SOURCE` | Source | Footer label for data source |
| `UNKNOWN` | unknown | Fallback when source is unavailable |

## Complete Translation Table

### Scottish Gaelic (gd)

| Key | Translation |
|-----|-------------|
| LOADING | A' luchdachadh geamannan... |
| NO_FIXTURES | Chan eil geamannan ri thighinn |
| UPCOMING_FIXTURES | geamannan ri thighinn |
| ALL | Uile |
| DOMESTIC | Dachaigheil |
| EUROPE | An Roinn-Eòrpa |
| HOME | Dachaigh |
| AWAY | Air falbh |
| DATE | Ceann-latha |
| TIME | Àm |
| OPPONENT | Nàmhaid |
| COMPETITION | Co-fharpais |
| H_A | D/F |
| BACK_TO_TOP | Air ais gu mullach |
| SOURCE | Stòr |
| UNKNOWN | neo-aithnichte |

### Irish Gaelic (ga)

| Key | Translation |
|-----|-------------|
| LOADING | Ag lódáil cluichí... |
| NO_FIXTURES | Níl aon chluichí le teacht |
| UPCOMING_FIXTURES | cluichí le teacht |
| ALL | Uile |
| DOMESTIC | Baile |
| EUROPE | An Eoraip |
| HOME | Baile |
| AWAY | Amuigh |
| DATE | Dáta |
| TIME | Am |
| OPPONENT | Céile comhraic |
| COMPETITION | Comórtas |
| H_A | B/A |
| BACK_TO_TOP | Ar ais go barr |
| SOURCE | Foinse |
| UNKNOWN | anaithnid |

### English (en)

| Key | Translation |
|-----|-------------|
| LOADING | Loading fixtures... |
| NO_FIXTURES | No upcoming fixtures |
| UPCOMING_FIXTURES | upcoming fixtures |
| ALL | All |
| DOMESTIC | Domestic |
| EUROPE | Europe |
| HOME | Home |
| AWAY | Away |
| DATE | Date |
| TIME | Time |
| OPPONENT | Opponent |
| COMPETITION | Competition |
| H_A | H/A |
| BACK_TO_TOP | Back to top |
| SOURCE | Source |
| UNKNOWN | unknown |

### Spanish (es)

| Key | Translation |
|-----|-------------|
| LOADING | Cargando partidos... |
| NO_FIXTURES | No hay próximos partidos |
| UPCOMING_FIXTURES | próximos partidos |
| ALL | Todos |
| DOMESTIC | Nacional |
| EUROPE | Europa |
| HOME | Local |
| AWAY | Visitante |
| DATE | Fecha |
| TIME | Hora |
| OPPONENT | Oponente |
| COMPETITION | Competición |
| H_A | L/V |
| BACK_TO_TOP | Volver arriba |
| SOURCE | Fuente |
| UNKNOWN | desconocido |

### French (fr)

| Key | Translation |
|-----|-------------|
| LOADING | Chargement des matchs... |
| NO_FIXTURES | Aucun match à venir |
| UPCOMING_FIXTURES | matchs à venir |
| ALL | Tous |
| DOMESTIC | National |
| EUROPE | Europe |
| HOME | Domicile |
| AWAY | Extérieur |
| DATE | Date |
| TIME | Heure |
| OPPONENT | Adversaire |
| COMPETITION | Compétition |
| H_A | D/E |
| BACK_TO_TOP | Retour en haut |
| SOURCE | Source |
| UNKNOWN | inconnu |

### German (de)

| Key | Translation |
|-----|-------------|
| LOADING | Spiele werden geladen... |
| NO_FIXTURES | Keine bevorstehenden Spiele |
| UPCOMING_FIXTURES | bevorstehende Spiele |
| ALL | Alle |
| DOMESTIC | National |
| EUROPE | Europa |
| HOME | Heim |
| AWAY | Auswärts |
| DATE | Datum |
| TIME | Zeit |
| OPPONENT | Gegner |
| COMPETITION | Wettbewerb |
| H_A | H/A |
| BACK_TO_TOP | Zurück nach oben |
| SOURCE | Quelle |
| UNKNOWN | unbekannt |

### Italian (it)

| Key | Translation |
|-----|-------------|
| LOADING | Caricamento partite... |
| NO_FIXTURES | Nessuna partita in programma |
| UPCOMING_FIXTURES | partite in programma |
| ALL | Tutte |
| DOMESTIC | Nazionale |
| EUROPE | Europa |
| HOME | Casa |
| AWAY | Trasferta |
| DATE | Data |
| TIME | Ora |
| OPPONENT | Avversario |
| COMPETITION | Competizione |
| H_A | C/T |
| BACK_TO_TOP | Torna su |
| SOURCE | Fonte |
| UNKNOWN | sconosciuto |

### Dutch (nl)

| Key | Translation |
|-----|-------------|
| LOADING | Wedstrijden laden... |
| NO_FIXTURES | Geen aankomende wedstrijden |
| UPCOMING_FIXTURES | aankomende wedstrijden |
| ALL | Alle |
| DOMESTIC | Nationaal |
| EUROPE | Europa |
| HOME | Thuis |
| AWAY | Uit |
| DATE | Datum |
| TIME | Tijd |
| OPPONENT | Tegenstander |
| COMPETITION | Competitie |
| H_A | T/U |
| BACK_TO_TOP | Terug naar boven |
| SOURCE | Bron |
| UNKNOWN | onbekend |

### Portuguese (pt)

| Key | Translation |
|-----|-------------|
| LOADING | Carregando jogos... |
| NO_FIXTURES | Nenhum jogo próximo |
| UPCOMING_FIXTURES | jogos próximos |
| ALL | Todos |
| DOMESTIC | Nacional |
| EUROPE | Europa |
| HOME | Casa |
| AWAY | Fora |
| DATE | Data |
| TIME | Hora |
| OPPONENT | Adversário |
| COMPETITION | Competição |
| H_A | C/F |
| BACK_TO_TOP | Voltar ao topo |
| SOURCE | Fonte |
| UNKNOWN | desconhecido |

## Usage in Code

### Basic Translation
```javascript
this.translate("LOADING")  // Returns translated string
```

### With Fallback
The `translate()` method automatically falls back to English if:
1. The requested language doesn't exist
2. The translation key doesn't exist in the selected language

### Example
```javascript
// If language is "gd" (Scottish Gaelic)
this.translate("LOADING")  // Returns: "A' luchdachadh geamannan..."

// If language is "en" (English)
this.translate("LOADING")  // Returns: "Loading fixtures..."

// If language is invalid or key missing
this.translate("LOADING")  // Returns: "Loading fixtures..." (English fallback)
```

## Adding New Translations

To add a new language or modify existing translations:

1. Open `MMM-MyTeams-Fixtures.js`
2. Locate the `translations` object (around line 72)
3. Add or modify the language dictionary:

```javascript
translations: {
  // ... existing languages ...
  
  // Add new language
  xx: {  // Replace 'xx' with your language code
    "LOADING": "Your translation",
    "NO_FIXTURES": "Your translation",
    "UPCOMING_FIXTURES": "your translation",
    "ALL": "Your translation",
    "DOMESTIC": "Your translation",
    "EUROPE": "Your translation",
    "HOME": "Your translation",
    "AWAY": "Your translation",
    "DATE": "Your translation",
    "TIME": "Your translation",
    "OPPONENT": "Your translation",
    "COMPETITION": "Your translation",
    "H_A": "Your translation",
    "BACK_TO_TOP": "Your translation",
    "SOURCE": "Your translation",
    "UNKNOWN": "your translation"
  }
}
```

4. Update the supported languages list in `start()` method (around line 285):
```javascript
const supportedLangs = ["gd", "ga", "en", "es", "fr", "de", "it", "nl", "pt", "xx"];
```

## Translation Guidelines

### Capitalization
- **Title Case**: Used for buttons, headers, and labels (e.g., "All", "Home", "Away")
- **Sentence case**: Used for messages and descriptions (e.g., "Loading fixtures...", "upcoming fixtures")
- **lowercase**: Used for inline text that follows other text (e.g., "unknown" in "Source: unknown")

### Punctuation
- Loading messages end with ellipsis (...) to indicate ongoing action
- Status messages may end with period or no punctuation depending on language convention
- Keep punctuation consistent with the language's standard practices

### Abbreviations
- H/A (Home/Away) should be abbreviated appropriately for each language
- Keep abbreviations short (2-3 characters) to fit in table columns

### Context
- "Home" and "Away" refer to match location (home stadium vs away stadium)
- "Domestic" refers to national league competitions
- "Europe" refers to European competitions (Champions League, Europa League, etc.)
- "Opponent" is the opposing team in a match