# Translation Files

This folder contains translation files for the MMM-MyTeams-Fixtures module.

## Supported Languages

| Language | Code | Example |
|----------|------|---------|
| :scotland: Scottish Gaelic | `gd` | `language: "gd"` |
| :ireland: Irish Gaelic | `ga` | `language: "ga"` |
| 🇬🇧 English | `en` | `language: "en"` |
| 🇪🇸 Spanish | `es` | `language: "es"` |
| 🇫🇷 French | `fr` | `language: "fr"` |
| 🇩🇪 German | `de` | `language: "de"` |
| 🇮🇹 Italian | `it` | `language: "it"` |
| 🇳🇱 Dutch | `nl` | `language: "nl"` |
| 🇵🇹 Portuguese | `pt` | `language: "pt"` |


## File Structure

Each language has its own JSON file named with the ISO 639-1 language code (e.g., `en.json`, `gd.json`).

### Translation Keys

All translation files must contain the following keys:

| Key | Description | Example (English) |
|-----|-------------|-------------------|
| `LOADING` | Loading message | "Loading fixtures..." |
| `NO_FIXTURES` | Empty state message | "No upcoming fixtures" |
| `UPCOMING_FIXTURES` | Title suffix | "upcoming fixtures" |
| `ALL` | Filter button: All fixtures | "All" |
| `DOMESTIC` | Filter button: Domestic competitions | "Domestic" |
| `EUROPE` | Filter button: European competitions | "Europe" |
| `HOME` | Filter button: Home fixtures | "Home" |
| `AWAY` | Filter button: Away fixtures | "Away" |
| `DATE` | Table header: Date column | "Date" |
| `TIME` | Table header: Time column | "Time" |
| `OPPONENT` | Table header: Opponent column | "Opponent" |
| `COMPETITION` | Table header: Competition column | "Competition" |
| `H_A` | Table header: Home/Away indicator | "H/A" |
| `BACK_TO_TOP` | Back to top button text | "Back to top" |
| `SOURCE` | Footer label for data source | "Source" |
| `UNKNOWN` | Unknown/missing value placeholder | "unknown" |
| `TBD` | To Be Determined placeholder | "TBD" |

## Contributing Translations

### Adding a New Language

1. **Create a new JSON file** named with the ISO 639-1 language code (e.g., `cy.json` for Welsh)
2. **Copy the structure** from `en.json`
3. **Translate all 17 keys** to your language
4. **Update the module** by adding your language to the `getTranslations()` method in `MMM-MyTeams-Fixtures.js`:

```javascript
getTranslations() {
  return {
    en: "translations/en.json",
    // ... existing languages ...
    cy: "translations/cy.json"  // Add your new language here
  };
}
```

5. **Test your translation** by setting `language: "cy"` in your config
6. **Submit a pull request** with your new translation file

### Improving Existing Translations

If you find errors or have suggestions for improving existing translations:

1. Edit the appropriate `.json` file
2. Ensure all keys remain unchanged (only translate the values)
3. Test your changes
4. Submit a pull request with a description of your improvements

## Translation Guidelines

### General Rules

- **Keep it concise**: UI labels should be short and clear
- **Match the tone**: Maintain consistency with other translations
- **Test thoroughly**: Verify your translations display correctly in the UI
- **Preserve formatting**: Don't add extra spaces or punctuation unless necessary

### Specific Guidelines

- **UPCOMING_FIXTURES**: Should be lowercase (used in title like "Celtic FC upcoming fixtures")
- **H_A**: Should be abbreviated (e.g., "H/A", "D/F", "C/T") to fit in narrow column
- **UNKNOWN**: Should be lowercase (used inline in text)
- **TBD**: Can be abbreviated or spelled out depending on language conventions

### What NOT to Translate

The following are **NOT** translated (they come from the API):

- Team names (e.g., "Celtic", "Rangers")
- Competition names (e.g., "Scottish Premiership", "UEFA Champions League")
- Opponent names
- TV station names
- Dates and times (formatted using the `locale` config parameter)

## File Format

Each translation file must be valid JSON:

```json
{
  "LOADING": "Your translation here...",
  "NO_FIXTURES": "Your translation here...",
  "UPCOMING_FIXTURES": "your translation here",
  "ALL": "Your translation",
  "DOMESTIC": "Your translation",
  "EUROPE": "Your translation",
  "HOME": "Your translation",
  "AWAY": "Your translation",
  "DATE": "Your translation",
  "TIME": "Your translation",
  "OPPONENT": "Your translation",
  "COMPETITION": "Your translation",
  "H_A": "H/A",
  "BACK_TO_TOP": "Your translation",
  "SOURCE": "Your translation",
  "UNKNOWN": "your translation",
  "TBD": "Your translation"
}
```

### JSON Validation

- Use double quotes for keys and values
- No trailing commas
- Escape special characters: `\"`, `\\`, `\n`, etc.
- Validate your JSON using a tool like [JSONLint](https://jsonlint.com/)

## Testing Your Translations

1. **Add to config.js**:
```javascript
{
  module: "MMM-MyTeams-Fixtures",
  config: {
    language: "gd",  // Your language code
    debug: true      // Enable debug logging
  }
}
```

2. **Restart MagicMirror**:
```bash
pm2 restart mm
```

3. **Check the console** for any translation loading errors

4. **Verify the UI** displays your translations correctly

## Language Codes Reference

Common ISO 639-1 language codes:

- `ar` - Arabic
- `ca` - Catalan
- `cy` - Welsh
- `da` - Danish
- `de` - German
- `el` - Greek
- `en` - English
- `es` - Spanish
- `fi` - Finnish
- `fr` - French
- `ga` - Irish
- `gd` - Scottish Gaelic
- `he` - Hebrew
- `it` - Italian
- `ja` - Japanese
- `ko` - Korean
- `nl` - Dutch
- `no` - Norwegian
- `pl` - Polish
- `pt` - Portuguese
- `ru` - Russian
- `sv` - Swedish
- `tr` - Turkish
- `zh` - Chinese

## Questions?

If you have questions about contributing translations, please:

1. Check the [main README](../README.md) for general module information
2. Review existing translation files for examples
3. Open an issue on GitHub for clarification

Thank you for helping make MMM-MyTeams-Fixtures accessible to more users! 🌍