/**
 * Test Configuration Examples for MMM-MyTeams-Fixtures
 * 
 * Use these configurations to verify the module works with different teams.
 * Copy the desired config to your MagicMirror config.js file.
 */

// ============================================
// SCOTTISH PREMIERSHIP TEAMS
// ============================================

// Celtic FC (Original - should still work)
const celticConfig = {
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Celtic",
    teamId: "133647",
    leagueIds: ["4330", "4364", "4363", "4888"],  // Scottish Premiership, Scottish Cup, League Cup, etc.
    uefaLeagueIds: ["4480", "4481", "5071"],      // Champions League, Europa League, Conference League
    debug: true
  }
};

// Rangers FC
const rangersConfig = {
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Rangers",
    teamId: "133626",
    leagueIds: ["4330", "4364", "4363", "4888"],
    uefaLeagueIds: ["4480", "4481", "5071"],
    debug: true
  }
};

// Aberdeen FC
const aberdeenConfig = {
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Aberdeen",
    teamId: "133602",
    leagueIds: ["4330", "4364", "4363"],
    uefaLeagueIds: ["4480", "4481", "5071"],
    debug: true
  }
};

// Hearts FC
const heartsConfig = {
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Hearts",
    teamId: "133597",
    leagueIds: ["4330", "4364", "4363"],
    uefaLeagueIds: ["4480", "4481", "5071"],
    debug: true
  }
};

// ============================================
// ENGLISH PREMIER LEAGUE TEAMS
// ============================================

// Manchester United
const manchesterUnitedConfig = {
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Manchester United",
    teamId: "133613",
    leagueIds: ["4328", "4429", "4423"],  // Premier League, FA Cup, League Cup
    uefaLeagueIds: ["4480", "4481", "5071"],
    debug: true
  }
};

// Liverpool FC
const liverpoolConfig = {
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Liverpool",
    teamId: "133602",
    leagueIds: ["4328", "4429", "4423"],
    uefaLeagueIds: ["4480", "4481", "5071"],
    debug: true
  }
};

// Arsenal FC
const arsenalConfig = {
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Arsenal",
    teamId: "133604",
    leagueIds: ["4328", "4429", "4423"],
    uefaLeagueIds: ["4480", "4481", "5071"],
    debug: true
  }
};

// ============================================
// OTHER EUROPEAN TEAMS
// ============================================

// Barcelona
const barcelonaConfig = {
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Barcelona",
    teamId: "133604",
    leagueIds: ["4335", "4480"],  // La Liga, Champions League
    uefaLeagueIds: ["4480", "4481", "5071"],
    debug: true
  }
};

// Bayern Munich
const bayernConfig = {
  module: "MMM-MyTeams-Fixtures",
  position: "top_right",
  config: {
    teamName: "Bayern Munich",
    teamId: "133536",
    leagueIds: ["4331"],  // Bundesliga
    uefaLeagueIds: ["4480", "4481", "5071"],
    debug: true
  }
};

// ============================================
// TESTING NOTES
// ============================================

/**
 * To test a configuration:
 * 
 * 1. Copy one of the configs above to your config/config.js file
 * 2. Restart MagicMirror
 * 3. Check the console for debug output (if debug: true)
 * 4. Verify that BOTH home and away fixtures are displayed
 * 
 * Expected behavior:
 * - Module should fetch fixtures from TheSportsDB API
 * - If API fails, it should fall back to scrapers (FWP, BBC, etc.)
 * - Both home (H) and away (A) matches should be shown
 * - Team name should appear in the title
 * 
 * Common issues to check:
 * - If only home matches appear, check the leagueIds are correct
 * - If no fixtures appear, verify the teamId is correct
 * - If scrapers fail, the team name slug might not match the website URL format
 * 
 * Finding Team IDs:
 * Visit: https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=TEAM_NAME
 * Replace TEAM_NAME with your team (e.g., "Rangers", "Arsenal")
 * Look for "idTeam" in the JSON response
 * 
 * Finding League IDs:
 * Visit: https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?c=COUNTRY
 * Replace COUNTRY with country name (e.g., "Scotland", "England")
 * Look for "idLeague" in the JSON response
 */

// Export for reference (not used in MagicMirror config)
module.exports = {
  celticConfig,
  rangersConfig,
  aberdeenConfig,
  heartsConfig,
  manchesterUnitedConfig,
  liverpoolConfig,
  arsenalConfig,
  barcelonaConfig,
  bayernConfig
};