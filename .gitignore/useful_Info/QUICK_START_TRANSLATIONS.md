# Quick Start: Multi-Language Support 🌍

Your MMM-MyTeams-Fixtures module now supports **9 languages** out of the box!

---

## ⚡ Quick Setup (30 seconds)

### Step 1: Choose Your Language

Pick your language code from the table below:

| Language | Code |
|----------|------|
| 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish Gaelic | `gd` |
| 🇮🇪 Irish Gaelic | `ga` |
| 🇬🇧 English | `en` |
| 🇪🇸 Spanish | `es` |
| 🇫🇷 French | `fr` |
| 🇩🇪 German | `de` |
| 🇮🇹 Italian | `it` |
| 🇳🇱 Dutch | `nl` |
| 🇵🇹 Portuguese | `pt` |

### Step 2: Update Your Config

Open your MagicMirror `config.js` and add the `language` parameter:

```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Celtic",
    teamId: "133647",
    language: "gd",  // 👈 Add this line
    locale: "gd-GB"  // Optional: for date formatting
  }
}
```

### Step 3: Restart MagicMirror

```bash
pm2 restart mm
```

**That's it!** Your module is now displaying in your chosen language. 🎉

---

## 📋 Copy-Paste Examples

### Scottish Gaelic (Gàidhlig)
```javascript
config: {
  teamName: "Celtic",
  teamId: "133647",
  language: "gd",
  locale: "gd-GB"
}
```

### Irish Gaelic (Gaeilge)
```javascript
config: {
  teamName: "Celtic",
  teamId: "133647",
  language: "ga",
  locale: "ga-IE"
}
```

### English
```javascript
config: {
  teamName: "Celtic",
  teamId: "133647",
  language: "en",
  locale: "en-GB"
}
```

### Spanish (Español)
```javascript
config: {
  teamName: "Real Madrid",
  teamId: "133602",
  language: "es",
  locale: "es-ES"
}
```

### French (Français)
```javascript
config: {
  teamName: "Paris Saint-Germain",
  teamId: "133716",
  language: "fr",
  locale: "fr-FR"
}
```

### German (Deutsch)
```javascript
config: {
  teamName: "Bayern Munich",
  teamId: "133739",
  language: "de",
  locale: "de-DE"
}
```

### Italian (Italiano)
```javascript
config: {
  teamName: "Juventus",
  teamId: "133676",
  language: "it",
  locale: "it-IT"
}
```

### Dutch (Nederlands)
```javascript
config: {
  teamName: "Ajax",
  teamId: "133604",
  language: "nl",
  locale: "nl-NL"
}
```

### Portuguese (Português)
```javascript
config: {
  teamName: "Benfica",
  teamId: "133714",
  language: "pt",
  locale: "pt-PT"
}
```

---

## 🔍 What Gets Translated?

### ✅ Translated (UI Elements)
- Loading messages
- Empty state messages
- Filter button labels (All, Home, Away, etc.)
- Table column headers (Date, Time, Opponent, etc.)
- Back to top button
- Footer labels

### ❌ NOT Translated (Proper Nouns)
- Team names (e.g., "Celtic", "Rangers")
- Competition names (e.g., "Scottish Premiership")
- Opponent names
- TV station names

---

## 🎯 Common Questions

### Q: Do I need to install anything?
**A:** No! Translations are built directly into the module code.

### Q: What if I don't specify a language?
**A:** It defaults to English (`en`).

### Q: What if I use an invalid language code?
**A:** The module automatically falls back to English and shows a console warning.

### Q: Can I use multiple languages for different teams?
**A:** Yes! Just create multiple module instances with different `language` settings:

```javascript
// Scottish Gaelic for Celtic
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_left",
  config: {
    teamName: "Celtic",
    language: "gd"
  }
},
// English for Rangers
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Rangers",
    language: "en"
  }
}
```

### Q: What's the difference between `language` and `locale`?
**A:** 
- `language` controls **UI text** (buttons, labels, messages)
- `locale` controls **date/time formatting** (e.g., "15/01/2025" vs "01/15/2025")

### Q: How do I test if it's working?
**A:** 
1. Set `debug: true` in your config
2. Check the browser console (F12) for: `[MyTeams] start() - Language: gd`
3. Look at the module UI - all labels should be in your chosen language

---

## 🐛 Troubleshooting

### Problem: Language not changing
**Solution:**
1. Check your config syntax: `language: "gd"` (with quotes)
2. Restart MagicMirror: `pm2 restart mm`
3. Clear browser cache: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

### Problem: Some text still in English
**Solution:** This is normal! Team names, competition names, and opponent names are proper nouns and should NOT be translated.

### Problem: Want to see debug info
**Solution:** Add `debug: true` to your config:
```javascript
config: {
  language: "gd",
  debug: true  // Shows language loading in console
}
```

---

## 📚 More Information

- **Full translation reference**: See `TRANSLATION_REFERENCE.md`
- **Visual examples**: See `TRANSLATION_EXAMPLES.md`
- **Technical details**: See `LANGUAGE_IMPLEMENTATION_SUMMARY.md`
- **Config examples**: See `config-example-languages.js`

---

## ✨ Features

- ✅ **Zero dependencies** - No external files needed
- ✅ **Instant switching** - Just change config and restart
- ✅ **Automatic fallback** - Never breaks if language is missing
- ✅ **9 languages** - More coming soon!
- ✅ **17 translation keys** - All UI elements covered
- ✅ **Lightweight** - Only ~2KB for all translations

---

## 🎉 You're All Set!

Your module now speaks 9 languages. Enjoy! 🌍

**Need help?** Check the documentation files or enable `debug: true` to see what's happening.

---

**Last Updated**: January 2025  
**Version**: 1.2.0  
**Status**: ✅ Production Ready