# Bug Fix: Away Fixtures Not Showing (HTTP 403 from footballwebpages.co.uk)

**Date:** 21 March 2026  
**Version:** 1.3.1  
**Reported by:** Third-party user  
**Affected config option:** `scrapeFWP: true` (also triggered automatically when the API returns no away fixtures)

---

## 1. What Was the Bug?

A user with `scrapeFWP` enabled reported that their display was only showing **home matches**. Away fixtures were completely absent from the module output. The logs showed the following error repeating every refresh cycle:

```
[ERROR] [SharedRequestManager] ERROR: URL: https://www.footballwebpages.co.uk/liverpool/fixtures-results
[ERROR] [SharedRequestManager] ERROR: Error message: HTTP 403: Forbidden
[WARN]  [MyTeams:helper] Scraper failed: fwp HTTP 403: Forbidden
```

Even users who did **not** explicitly set `scrapeFWP: true` were affected — because the module automatically attempts to scrape Football Web Pages (FWP) to fill in away fixtures whenever the primary TheSportsDB API returns none.

---

## 2. What Caused It?

There were two separate causes working together to produce this result.

### Cause A — FWP's bot detection was blocking the request

`footballwebpages.co.uk` uses server-side bot detection. When a request arrives that does not look like it came from a real browser, the server returns **HTTP 403 Forbidden** instead of the page content.

The module was making a plain programmatic request — effectively walking up to the front door and announcing "I am a script". The server saw through it and slammed the door.

While previous work had added browser-like headers (`User-Agent`, `Sec-Fetch-*`, `Sec-CH-UA` etc.), those headers alone are not enough. Many modern sites also issue a **session cookie** on first visit and then check for that cookie on all subsequent page requests. Without it, the request is immediately flagged as non-human regardless of how convincing the headers look.

Node.js's built-in `fetch` does **not** handle cookies automatically — every request starts fresh with no cookie jar. So even though the headers looked like a browser, the absence of a session cookie was a dead giveaway.

### Cause B — No fallback when FWP was blocked

When FWP failed, the module simply gave up looking for away fixtures. There was no secondary source configured to take over. The result was that the user's display fell back to the API-only data, which happened to contain only home matches for their team at that point in the season.

---

## 3. What Was the Fix?

The fix addressed both causes independently so that either one alone is enough to get away fixtures on screen.

### Fix A — Two-step "cookie handshake" for FWP

A new function was written that mimics what a browser does naturally when you visit a website for the first time:

1. **Visit the homepage first.** Before fetching the fixtures page, the module now makes a quick background request to `https://www.footballwebpages.co.uk/`. This is invisible to the user — it takes under a second.
2. **Capture any cookies the site sets.** The server's `Set-Cookie` response headers are read and stored in memory.
3. **Use those cookies on the real request.** When the fixtures page is then fetched, the captured cookies are included in the `Cookie:` header, and the `Sec-Fetch-Site` header is set to `same-origin` — telling the server this request came from within the site, exactly as a browser navigation would.

If the pre-flight homepage request itself fails for any reason (network issue, timeout), the module logs a warning and continues anyway — it simply tries without cookies rather than giving up entirely.

### Fix B — BBC Sport and LiveFootballOnTV as automatic fallbacks

The scraper priority list for away-fixture supplementing was extended. Previously it only tried FWP. Now it tries **FWP first, then LiveFootballOnTV, then BBC Sport** in sequence. If FWP is blocked, one of the other two sources will step in and provide the away fixtures instead. The user sees correct output without needing to change any config.

Caution  - Fix B may lead to parsing errors and poor formating as the BBC/LFOTV custom.css may need further modification. If this does occure reset `{ scrapeFWP: true, scrapeLFOTV: false, scrapeBBC: false }` **node-helper.js Line 1406**

### Fix C — Stop wasting retries on 403 responses

The request manager's retry logic was updated to immediately abandon any request that gets a 403 or 401 response, rather than retrying it up to three times. Retrying a bot-detection block is pointless — the server is not going to change its mind. This makes the fallback to BBC/LFOTV happen faster when FWP is genuinely blocked/

---

## 4. Files and Lines Modified

### `node_helper.js`

| Lines | What Changed |
|-------|-------------|
| **108–124** | Added `FWP_BROWSER_HEADERS` as a named constant. Previously the full browser header set was written out twice (once inside `doFetch` and once would have been needed in the pre-flight). Extracting it to a constant means it is defined once and reused everywhere. |
| **127–166** | New function `fetchFWPWithCookieSupport(url, timeoutMs, debug)`. This is the two-step cookie handshake described in Fix A above. Step 1 (lines 132–155) makes the homepage pre-flight using `_fetchImpl` directly and reads `Set-Cookie` headers, with compatibility for both Node 18+ (`getSetCookie()`) and older Node (`get('set-cookie')`). Step 2 (lines 158–165) calls `doFetch` with the captured cookies and corrected `Sec-Fetch-Site` header. |
| **168–173** | `doFetch` simplified — the 14-line inline header block was removed and replaced with `{ ...FWP_BROWSER_HEADERS }` using the new shared constant. No behaviour change; purely a deduplication. |
| **1223–1225** | `fetchAndParseScraper()` updated to route FWP requests through `fetchFWPWithCookieSupport` instead of plain `doFetch`. All other scrapers (BBC, LFOTV, etc.) continue to use `doFetch` as before. |
| **1406** | The `tryScrapersInOrder` call inside the away-fixture supplement block was changed from `{ scrapeFWP: true, scrapeLFOTV: false, scrapeBBC: false }` to `{ scrapeFWP: true, scrapeLFOTV: true, scrapeBBC: true }`. This activates Fix B — BBC and LFOTV are now available as automatic fallbacks when FWP fails. |

### `shared-request-manager.js`

| Lines | What Changed |
|-------|-------------|
| **368–379** | `shouldRetry()` method updated. Two explicit `return false` guards were added at the top: one for HTTP 403 and one for HTTP 401. These responses mean the server is blocking the request on purpose — retrying will not help. A `return true` for HTTP 429 (rate limit) was also added, as rate-limited requests *should* be retried after the backoff delay. |

### `CHANGELOG.md`

| Lines | What Changed |
|-------|-------------|
| **10–18** | Version `[1.3.1]` entry updated to document all five bug fixes (BUG-001 through BUG-005) with plain-language descriptions. |

---

## Summary

| # | Problem | Solution |
|---|---------|----------|
| 1 | FWP blocks requests as bots because no session cookie is present | Pre-flight homepage request captures cookies; used on fixtures fetch |
| 2 | No fallback when FWP is blocked | BBC Sport and LFOTV added to the fallback chain |
| 3 | Retry logic wastes time on 403 responses | `shouldRetry()` now fast-fails on 403/401; retries 429 correctly |
