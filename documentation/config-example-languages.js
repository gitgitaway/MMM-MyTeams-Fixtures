/* MMM-MyTeams-Fixtures - Language Configuration Examples
 * 
 * Copy the relevant example below into your MagicMirror config.js file
 * and modify the teamName, teamId, and other settings as needed.
 */

// ============================================
// SCOTTISH GAELIC (Gàidhlig) - Example
// ============================================
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Celtic",
    teamId: "133647",
    language: "gd",        // Scottish Gaelic
    locale: "gd-GB",       // Scottish locale for date formatting
    maxFixtures: 10,
    showCompetition: true,
    defaultFilter: "all"
  }
},

// ============================================
// IRISH GAELIC (Gaeilge) - Example
// ============================================
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Celtic",
    teamId: "133647",
    language: "ga",        // Irish Gaelic
    locale: "ga-IE",       // Irish locale for date formatting
    maxFixtures: 10,
    showCompetition: true,
    defaultFilter: "all"
  }
},

// ============================================
// ENGLISH - Example
// ============================================
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Celtic",
    teamId: "133647",
    language: "en",        // English (default)
    locale: "en-GB",       // British English locale
    maxFixtures: 10,
    showCompetition: true,
    defaultFilter: "all"
  }
},

// ============================================
// SPANISH (Español) - Example
// ============================================
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Real Madrid",
    teamId: "133602",
    language: "es",        // Spanish
    locale: "es-ES",       // Spanish locale
    maxFixtures: 10,
    showCompetition: true,
    defaultFilter: "all"
  }
},

// ============================================
// FRENCH (Français) - Example
// ============================================
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Paris Saint-Germain",
    teamId: "133716",
    language: "fr",        // French
    locale: "fr-FR",       // French locale
    maxFixtures: 10,
    showCompetition: true,
    defaultFilter: "all"
  }
},

// ============================================
// GERMAN (Deutsch) - Example
// ============================================
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Bayern Munich",
    teamId: "133739",
    language: "de",        // German
    locale: "de-DE",       // German locale
    maxFixtures: 10,
    showCompetition: true,
    defaultFilter: "all"
  }
},

// ============================================
// ITALIAN (Italiano) - Example
// ============================================
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Juventus",
    teamId: "133676",
    language: "it",        // Italian
    locale: "it-IT",       // Italian locale
    maxFixtures: 10,
    showCompetition: true,
    defaultFilter: "all"
  }
},

// ============================================
// DUTCH (Nederlands) - Example
// ============================================
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Ajax",
    teamId: "133604",
    language: "nl",        // Dutch
    locale: "nl-NL",       // Dutch locale
    maxFixtures: 10,
    showCompetition: true,
    defaultFilter: "all"
  }
},

// ============================================
// PORTUGUESE (Português) - Example
// ============================================
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Benfica",
    teamId: "133714",
    language: "pt",        // Portuguese
    locale: "pt-PT",       // Portuguese locale
    maxFixtures: 10,
    showCompetition: true,
    defaultFilter: "all"
  }
},

// ============================================
// MULTIPLE INSTANCES - Different Languages
// ============================================
// You can run multiple instances with different languages
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_left",
  config: {
    teamName: "Celtic",
    teamId: "133647",
    language: "gd",        // Scottish Gaelic
    locale: "gd-GB",
    maxFixtures: 8
  }
},
{
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Rangers",
    teamId: "133602",
    language: "en",        // English
    locale: "en-GB",
    maxFixtures: 8
  }
}