# Security Policy

## Supported Versions

The following versions of MMM-MyTeams-Fixtures are covered by security updates:

| Version | Supported | Status                                                    |
| ------- | --------- | --------------------------------------------------------- |
| 1.3.x   | ✅        | Active development (latest release and audit cycle)       |
| 1.2.x   | ✅        | Security fixes only (legacy package still available)      |
| < 1.2   | ❌        | No longer supported — upgrade to 1.3.x for current fixes  |

## Reporting a Vulnerability

**IMPORTANT**: **DO NOT** open a public GitHub issue for security vulnerabilities.

Security vulnerabilities should be reported privately to maintain responsible disclosure and protect users.

### How to Report

Please report security vulnerabilities by:

1. **Opening a private security advisory** on GitHub (preferred)
   - Go to the Security tab → Advisories → New draft security advisory
   - Provide detailed information about the vulnerability and how to reproduce it

2. **Emailing** the maintainers directly (if GitHub advisory is not available)
   - **Contact**: [gitgitaway](https://github.com/gitgitaway)
   - **Subject line**: "[SECURITY] MMM-MyTeams-Fixtures Vulnerability Report"

### What to Include

When reporting a vulnerability, please include:

- **Description**: Clear explanation of the vulnerability
- **Impact**: What an attacker could accomplish
- **Steps to Reproduce**: Detailed, repeatable steps
- **Affected Versions**: Which versions are impacted
- **Suggested Fix**: Optional recommendations or mitigation ideas
- **Proof of Concept**: Code, screenshots, or logs demonstrating the issue

### Response Timeline

- **Initial Response**: Within 48 hours of report
- **Status Update**: Within 7 days with assessment and mitigation plan
- **Critical Vulnerabilities**: Patched within 7 days when possible
- **Medium/Low Vulnerabilities**: Patched in the next scheduled release

## Security Update Process

When a security vulnerability is confirmed:

1. **Assessment**: Validate the report and quantify the impact
2. **Development**: Build and test the patch in a private branch
3. **Coordination**: Notify downstream modules (MMM-MyTeams suite) if affected
4. **Release**: Publish a GitHub Security Advisory and release notes
5. **Notification**: Alert users via:
   - GitHub Security Advisory
   - GitHub Release Notes
   - README/SECURITY.md banner for critical issues

## Security Best Practices for Users

### Installation Security

```bash
# Always verify package integrity
npm audit

# Fix known vulnerabilities
npm audit fix

# Keep this module up to date
npm update
```

### Configuration Security

- **Disable debug mode in production** by setting `debug: false` and `debugSensitiveData: false` in `config.js`
- **Lock `apiUrl` to TheSportsDB** when overriding the default; the helper rejects any value that is not `https://www.thesportsdb.com/...`
- **Restrict scraper sources** to the trusted hosts listed in the repo (TheSportsDB, FootballWebPages, LiveFootballOnTV, club-specific pages) and avoid enabling unused scrapers
- **Enable `strictLeagueFiltering`** whenever possible to avoid displaying fixtures from unexpected competitions
- **Limit network access** via firewall rules or proxy configuration to the necessary endpoints (TheSportsDB API, FootballWebPages, LiveFootballOnTV)

### Data Privacy

This module:

- ✅ **Does NOT** collect or transmit user data beyond public fixtures feed
- ✅ **Does NOT** set cookies, trackers, or analytics hooks
- ✅ **Does NOT** require authentication or personal API keys
- ✅ Operates entirely on public TheSportsDB/FootballWebPages data feeds
- ✅ Caches fixtures locally (`.cache/` directory) with permissions controlled by the host OS

## Known Security Measures

The module enforces the following protections:

- **Shared Request Manager** (`shared-request-manager.js`)
  - Coordinated queue with per-domain/backoff rate limiting
  - Deduplicated in-flight requests and configurable timeouts prevent hammering upstream APIs
- **URL & team sanitization**
  - `sanitizeTeamName()` rejects unsafe characters, `buildScraperUrls()` encodes all path segments, and `KNOWN_CFC_SLUGS` limits custom sitemap scrapers
  - `node_helper.js` enforces the trusted `https://www.thesportsdb.com/` prefix before any outbound request
- **DOM safety**
  - UI rendering uses `document.createElement`, `textContent`, and `createTextNode`; there are no `innerHTML` assignments, nullifying XSS via fetched data
  - Live score badges and countdown labels are text-only and never interpolate raw API strings
- **Debug logging controls**
  - Verbose logging is gated behind `debug: true`; production installs keep it disabled to avoid leaking fixture data
  - Scroll listeners and interval handlers swallow exceptions and write only minimal console warnings

## Security Audit Schedule

- **Automated audits**: Run `npm audit` each time dependencies are updated
- **Manual reviews**: Code reviews preceding every major release (e.g., 1.3.0 overhaul)
- **Dependency checks**: Quarterly review of `cheerio`, `node-fetch`, and transitive packages
- **Community testing**: Responsible disclosure encouraged; dual maintenance across the MyTeams modules keeps regressions visible

## Vulnerability Disclosure Policy

We follow **Coordinated Vulnerability Disclosure (CVD)**:

1. **Private disclosure** to maintainers first
2. **Patch development** in coordination with the reporter
3. **Public disclosure** only after the fix is available
4. **Credit** is given to the reporter in release notes unless anonymity is requested

## Security Hall of Fame

Security researchers who responsibly disclose vulnerabilities will be credited here:

*No vulnerabilities reported yet. Help us maintain security!*

## Scope

### In Scope

Security vulnerabilities in:

- Module code (`MMM-MyTeams-Fixtures.js`, `node_helper.js`)
- Shared HTTP queue (`shared-request-manager.js`)
- Configuration parsing, caching logic, and localisation files used to render the UI

### Out of Scope

- MagicMirror² core vulnerabilities (report to the MagicMirror project)
- Third-party website vulnerabilities (report to the originating site)
- Third-party module interactions beyond the MMM-MyTeams suite
- Physical access attacks (kiosk security is the user's responsibility)
- Social engineering attacks targeting module maintainers or users

## Contact

For security-related questions or concerns:

- **Security Issues**: Use GitHub Security Advisories (preferred)
- **General Security Questions**: Open a public GitHub Discussion
- **Security Documentation**: Refer to README.md and this SECURITY.md

## Version History

- **2026-03-21 (1.3.1)**: Repo-wide line-ending normalization (CRLF to LF) to ensure compatibility between Windows development and Raspberry Pi/Unix production environments.
- **2026-03-19 (1.3.0)**: Full security review (SEC-001 through SEC-004) plus DOM hardening, `apiUrl` validation, scroll log removal, and sanitized config inputs.
- **2026-03-18 (1.2.0)**: Added `shared-request-manager.js`, `node_helper` identity guard, and consolidated fetch handling through the queue.

---

**Last Updated**: March 21, 2026  
**Policy Version**: 1.2
