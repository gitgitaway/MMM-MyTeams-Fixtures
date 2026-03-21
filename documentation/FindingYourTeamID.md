# Finding Your Team ID and League IDs

**MMM-MyTeams-Fixtures** — Team configuration lookup guide

---

## Why You Need a Team ID

The module uses TheSportsDB API to fetch fixtures. This API identifies teams and leagues by **numeric IDs**, not just names. Providing both `teamId` and `teamName` gives the most reliable results:

- `teamId` drives all API lookups (most reliable)
- `teamName` drives scraper URL generation and display

If you only provide `teamName`, the module will attempt to resolve the team ID automatically via `/searchteams.php` — but this can produce wrong results for teams with common names (e.g. searching "United" could match multiple clubs).

---

## Method 1 — TheSportsDB Website (Recommended)

1. Go to **[https://www.thesportsdb.com/](https://www.thesportsdb.com/)**
2. Use the search bar to find your team
3. Click on your team's page
4. Look at the URL — the number is your team ID:

```
https://www.thesportsdb.com/team/133647-Celtic
                                   ↑
                               teamId = "133647"
```

5. On the team page, click on a league/competition to find its ID:

```
https://www.thesportsdb.com/league/4330-Scottish-Premiership
                                   ↑
                               leagueId = "4330"
```

---

## Method 2 — TheSportsDB API (Programmatic)

Look up a team by name directly using the API in your browser:

```
https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Celtic
```

The response includes `idTeam` for each match. Choose the correct one from the results.

To look up a league by name:

```
https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?c=Scotland&s=Soccer
```

---

## Method 3 — Local CSV Database

The module ships with `football_teams_database.csv` in the root directory. This file contains thousands of clubs with their IDs and can be searched offline.

Open it in Excel, Google Sheets, or any text editor and search for your team name. The columns include:

| Column | Description |
|--------|-------------|
| `idTeam` | Use this as your `teamId` |
| `strTeam` | Official team name |
| `strLeague` | Primary league |
| `strCountry` | Country |

> **Tip**: Press **Ctrl+F** in your text editor and search for your club name.

---

## Common Team IDs

| Club | `teamId` | Country |
|------|---------|---------|
| Celtic | `133647` | Scotland |
| Rangers | `133604` | Scotland |
| Aberdeen | `133629` | Scotland |
| Hearts | `133631` | Scotland |
| Hibernian | `133632` | Scotland |
| Motherwell | `133637` | Scotland |
| St Mirren | `133644` | Scotland |
| Dundee United | `133628` | Scotland |
| Liverpool | `133602` | England |
| Arsenal | `133613` | England |
| Manchester United | `133612` | England |
| Manchester City | `133615` | England |
| Chelsea | `133610` | England |
| Tottenham Hotspur | `133616` | England |
| Barcelona | `133739` | Spain |
| Real Madrid | `133736` | Spain |
| Bayern Munich | `133693` | Germany |
| Juventus | `133676` | Italy |
| Paris Saint-Germain | `133716` | France |
| Ajax | `133692` | Netherlands |
| Benfica | `133714` | Portugal |
| Porto | `133715` | Portugal |
| Scotland (national) | `133728` | International |

---

## Common League IDs

### Scottish Football

| League | `leagueId` |
|--------|-----------|
| Scottish Premiership | `4330` |
| Scottish Championship | `4888` |
| Scottish Cup | `4364` |
| Scottish League Cup (Viaplay/Premier Sports) | `4363` |

### English Football

| League | `leagueId` |
|--------|-----------|
| Premier League | `4328` |
| FA Cup | `4424` |
| League Cup (EFL Cup / Carabao Cup) | `4426` |
| Championship | `4329` |

### Spanish Football

| League | `leagueId` |
|--------|-----------|
| La Liga | `4335` |
| Copa del Rey | `4397` |

### German Football

| League | `leagueId` |
|--------|-----------|
| Bundesliga | `4331` |
| DFB Pokal | `4398` |

### Italian Football

| League | `leagueId` |
|--------|-----------|
| Serie A | `4332` |
| Coppa Italia | `4399` |

### French Football

| League | `leagueId` |
|--------|-----------|
| Ligue 1 | `4334` |
| Coupe de France | `4400` |

### Netherlands

| League | `leagueId` |
|--------|-----------|
| Eredivisie | `4337` |

### Portuguese Football

| League | `leagueId` |
|--------|-----------|
| Primeira Liga | `4344` |

### UEFA Competitions

| Competition | `leagueId` |
|-------------|-----------|
| UEFA Champions League | `4480` |
| UEFA Europa League | `4481` |
| UEFA Conference League | `5071` |

### International

| Competition | `leagueId` |
|-------------|-----------|
| UEFA Nations League | `4731` |
| FIFA World Cup | `4350` |
| European Championship | `4356` |

---

## Example Config — Liverpool

```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "bottom_right",
  config: {
    teamName: "Liverpool",
    teamId: "133602",
    leagueIds: ["4328", "4424", "4426"],   // PL + FA Cup + League Cup
    uefaLeagueIds: ["4480", "4481", "5071"],
    strictLeagueFiltering: true
  }
}
```

## Example Config — Barcelona

```javascript
{
  module: "MMM-MyTeams-Fixtures",
  position: "bottom_right",
  config: {
    teamName: "Barcelona",
    teamId: "133739",
    leagueIds: ["4335", "4397"],           // La Liga + Copa del Rey
    uefaLeagueIds: ["4480", "4481", "5071"],
    locale: "es-ES",
    language: "es"
  }
}
```

---

## If Your Team Is Not in the List

The included CSV contains the TheSportsDB's complete team database (over 10,000 clubs). If your team is not there, it may not yet be in TheSportsDB's database. You can:

1. [Register a free account](https://www.thesportsdb.com/forum/board.php?id=1) on TheSportsDB and add your team
2. Use the `strictLeagueFiltering: false` option to allow all fixtures regardless of league

---

*See also: [`Troubleshooting.md`](./Troubleshooting.md) — No Fixtures Displayed section*
