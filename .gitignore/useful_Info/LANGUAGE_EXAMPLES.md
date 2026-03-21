# MMM-MyTeams-Fixtures - Language Support Examples

## Overview
The module now includes integrated language translation support for 9 languages. No external translation files needed - all translations are built directly into the module code.

## Supported Languages

| Language | Code | Example Configuration |
|----------|------|----------------------|
| 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish Gaelic | `gd` | `language: "gd"` |
| 🇮🇪 Irish Gaelic | `ga` | `language: "ga"` |
| 🇬🇧 English | `en` | `language: "en"` |
| 🇪🇸 Spanish | `es` | `language: "es"` |
| 🇫🇷 French | `fr` | `language: "fr"` |
| 🇩🇪 German | `de` | `language: "de"` |
| 🇮🇹 Italian | `it` | `language: "it"` |
| 🇳🇱 Dutch | `nl` | `language: "nl"` |
| 🇵🇹 Portuguese | `pt` | `language: "pt"` |

## Configuration Examples

### Scottish Gaelic (Gàidhlig)
```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Celtic",
    teamId: "133647",
    language: "gd",  // Scottish Gaelic
    locale: "gd-GB"
  }
}
```

### Irish Gaelic (Gaeilge)
```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Celtic",
    teamId: "133647",
    language: "ga",  // Irish Gaelic
    locale: "ga-IE"
  }
}
```

### English
```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Celtic",
    teamId: "133647",
    language: "en",  // English (default)
    locale: "en-GB"
  }
}
```

### Spanish (Español)
```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Real Madrid",
    teamId: "133602",
    language: "es",  // Spanish
    locale: "es-ES"
  }
}
```

### French (Français)
```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Paris Saint-Germain",
    teamId: "133716",
    language: "fr",  // French
    locale: "fr-FR"
  }
}
```

### German (Deutsch)
```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Bayern Munich",
    teamId: "133739",
    language: "de",  // German
    locale: "de-DE"
  }
}
```

### Italian (Italiano)
```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Juventus",
    teamId: "133676",
    language: "it",  // Italian
    locale: "it-IT"
  }
}
```

### Dutch (Nederlands)
```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Ajax",
    teamId: "133604",
    language: "nl",  // Dutch
    locale: "nl-NL"
  }
}
```

### Portuguese (Português)
```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Benfica",
    teamId: "133714",
    language: "pt",  // Portuguese
    locale: "pt-PT"
  }
}
```

## Translated UI Elements

The following interface elements are translated:

### Status Messages
- **Loading fixtures...** - Displayed while fetching data
- **No upcoming fixtures** - Shown when no fixtures are available

### Title
- **[Team] FC upcoming fixtures** - Main module title

### Filter Buttons
- **All** - Show all fixtures
- **Domestic** - Show domestic league fixtures only
- **Europe** - Show European competition fixtures only
- **Home** - Show home fixtures only
- **Away** - Show away fixtures only

### Table Headers
- **Date** - Match date column
- **Time** - Match time column
- **Opponent** - Opponent team column
- **H/A** - Home/Away indicator column
- **Competition** - Competition name column

### Controls
- **Back to top** - Scroll to top button

### Footer
- **Source** - Data source label
- **unknown** - Fallback when source is unavailable

## Translation Examples by Language

### Scottish Gaelic (Gàidhlig)
- Loading: "A' luchdachadh geamannan..."
- No fixtures: "Chan eil geamannan ri thighinn"
- All: "Uile"
- Home: "Dachaigh"
- Away: "Air falbh"

### Irish Gaelic (Gaeilge)
- Loading: "Ag lódáil cluichí..."
- No fixtures: "Níl aon chluichí le teacht"
- All: "Uile"
- Home: "Baile"
- Away: "Amuigh"

### Spanish (Español)
- Loading: "Cargando partidos..."
- No fixtures: "No hay próximos partidos"
- All: "Todos"
- Home: "Local"
- Away: "Visitante"

### French (Français)
- Loading: "Chargement des matchs..."
- No fixtures: "Aucun match à venir"
- All: "Tous"
- Home: "Domicile"
- Away: "Extérieur"

### German (Deutsch)
- Loading: "Spiele werden geladen..."
- No fixtures: "Keine bevorstehenden Spiele"
- All: "Alle"
- Home: "Heim"
- Away: "Auswärts"

## Features

### Automatic Fallback
- If an unsupported language code is provided, the module automatically falls back to English
- If a translation key is missing in the selected language, it falls back to the English translation
- Robust error handling ensures the module continues to function even if translation errors occur

### Debug Mode
Enable debug mode to see which language is being used:
```javascript
config: {
  language: "gd",
  debug: true  // Logs: "[MyTeams] start() - Language: gd"
}
```

### Validation
The module validates the language configuration on startup and warns if an unsupported language is detected:
```
[MyTeams] Unsupported language "xx", falling back to "en"
```

## Implementation Details

### Translation Architecture
- **Integrated Dictionary**: All translations are stored directly in the module's `translations` object
- **Helper Method**: The `translate(key)` method handles all translation lookups with automatic fallback
- **No External Dependencies**: No need for separate translation files or external translation libraries
- **Performance**: Translations are loaded once at module initialization for optimal performance

### Adding Custom Translations
To add or modify translations, edit the `translations` object in `MMM-MyTeams-Fixtures.js`:

```javascript
translations: {
  en: {
    "LOADING": "Loading fixtures...",
    "ALL": "All",
    // ... more translations
  },
  // Add your language here
  xx: {
    "LOADING": "Your translation...",
    "ALL": "Your translation...",
    // ... more translations
  }
}
```

## Notes

1. **Language vs Locale**: 
   - `language` controls UI text translations
   - `locale` controls date/time formatting (e.g., "en-GB", "fr-FR")

2. **Team Names**: Team names are not translated as they are proper nouns fetched from the API

3. **Competition Names**: Competition names come from the API and are not translated

4. **Date Formatting**: Dates are formatted according to the `locale` setting, independent of the `language` setting

## Support

For issues or questions about language support:
1. Check that your language code is in the supported list
2. Enable debug mode to verify the language is being loaded correctly
3. Check browser console for any translation errors
4. Verify your config.js syntax is correct