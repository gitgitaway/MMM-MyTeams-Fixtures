/* MMM-MyTeams-Fixtures (front-end)
 * - Uses normalized socket notifications:
 *   send:    "GET_FIXTURES"
 *   receive: "FIXTURES_DATA" | "FIXTURES_ERROR"
 */

Module.register("MMM-MyTeams-Fixtures", {
  // -----------------------------
  // Defaults
  // -----------------------------
  defaults: {
    source: "api",
    teamName: "Celtic",
    teamId: "133647",
    apiUrl: "https://www.thesportsdb.com/api/v1/json/3",
    season: "auto",
    fallbackSeason: "2025-2026",

    updateInterval: 10 * 60 * 1000,
    requestTimeoutMs: 15000,
    maxFixtures: 60,
    showCompetition: true,
    showCountdown: true,
    defaultFilter: "all",
    debug: false,

    cacheTTL: 5 * 60 * 1000,
    fallbackChain: true,

    // Optional filtering helpers
    scottishLeagueIds: ["4330", "4364", "4363", "4888"],
    uefaLeagueIds: ["4480", "4481", "5071"],

    // New flags
    useSearchEventsFallback: true,   // try searchevents patterns if primary endpoints are empty
    strictLeagueFiltering: true,     // only keep events whose idLeague is in the lists above

    // Scraper toggles (used by helper if needed)
    scrapeFWP: true,
   /* scrapeSportsDB: true,
    scrapeBBC: true,
    scrapeLFOTV: true,
    scrapeCFC: true, */

    // UI/Performance enhancements
    maxTableHeight: 260,            // px, used to cap the scroll container height
    countdownIntervalMs: 60000,     // base interval for countdown refresh
    largeListThreshold: 12,         // if fixtures exceed this, we throttle
    largeListCountdownMultiplier: 2,// multiplier for interval when list is large

    locale: "en-GB"
  },

  // -----------------------------
  // Lifecycle
  // -----------------------------
  start() {
    this.isLoading = true;
    this.errorMessage = null;
    this.fixtures = [];
    this.usedSource = null;
    this.fetchedAt = null;

    this._updateTimer = null;
    this._countdownTimer = null;

    this.getFixtures();
    this.scheduleUpdate();
    this.startCountdown();
    if (this.config.debug) console.log("[MyTeams] start()");
  },

  stop() {
    if (this._updateTimer) clearInterval(this._updateTimer);
    if (this._countdownTimer) clearInterval(this._countdownTimer);
  },

  // -----------------------------
  // Schedules
  // -----------------------------
  scheduleUpdate() {
    if (this._updateTimer) clearInterval(this._updateTimer);
    const every = Math.max(60 * 1000, Number(this.config.updateInterval || 600000));
    this._updateTimer = setInterval(() => this.getFixtures(), every);
  },

  startCountdown() {
    // Clear any existing timer
    if (this._countdownTimer) clearInterval(this._countdownTimer);

    // Determine interval based on list size to reduce repaint cost on very long tables
    const base = Math.max(15000, Number(this.config.countdownIntervalMs || 60000));
    const isLarge = (this.fixtures?.length || 0) >= Number(this.config.largeListThreshold || 12);
    const interval = isLarge ? base * Number(this.config.largeListCountdownMultiplier || 2) : base;

    this._countdownTimer = setInterval(() => {
      try {
        if (!this.isLoading && this.fixtures.length && this.config.showCountdown) {
          this.updateDom(0);
        }
      } catch (e) {
        console.warn("[MyTeams] countdown refresh error:", e);
      }
    }, interval);
  },

  // -----------------------------
  // Styles
  // -----------------------------
  getStyles() {
    return [
      this.file("MMM-MyTeams-Fixtures.css"),
      this.file("customFWP.css") // optional user overrides
    ];
  },

  // -----------------------------
  // Socket comms
  // -----------------------------
  getFixtures() {
    this.isLoading = true;
    this.errorMessage = null;
    this.updateDom(200);

    const payload = {
      source: this.config.source,
      teamName: this.config.teamName,
      teamId: this.config.teamId,
      apiUrl: this.config.apiUrl,
      season: this.config.season,
      fallbackSeason: this.config.fallbackSeason,
      scottishLeagueIds: this.config.scottishLeagueIds,
      uefaLeagueIds: this.config.uefaLeagueIds,

      maxFixtures: this.config.maxFixtures,
      requestTimeoutMs: this.config.requestTimeoutMs,
      cacheTTL: this.config.cacheTTL,
      fallbackChain: this.config.fallbackChain,
      debug: !!this.config.debug,

      scrapeFWP: this.config.scrapeFWP,
    /*  scrapeSportsDB: this.config.scrapeSportsDB,     
      scrapeBBC: this.config.scrapeBBC,
      scrapeLFOTV: this.config.scrapeLFOTV,
      scrapeCFC: this.config.scrapeCFC, */

      useSearchEventsFallback: this.config.useSearchEventsFallback,
      strictLeagueFiltering: this.config.strictLeagueFiltering
    };

    this.sendSocketNotification("GET_FIXTURES", payload);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "FIXTURES_DATA") {
      this.fixtures = Array.isArray(payload?.fixtures) ? payload.fixtures.slice(0, this.config.maxFixtures) : [];
      this.usedSource = payload?.usedSource || null;
      this.fetchedAt = payload?.fetchedAt || null;
      this.isLoading = false;
      this.errorMessage = null;
      if (this.config.debug) console.log("[MyTeams] Data received:", this.fixtures.length, "source:", this.usedSource);
      this.updateDom(200);
      return;
    }

    if (notification === "FIXTURES_ERROR") {
      this.fixtures = [];
      this.usedSource = null;
      this.fetchedAt = null;
      this.isLoading = false;
      this.errorMessage = payload?.message || "Unknown error";
      console.warn("[MyTeams] Error:", this.errorMessage);
      this.updateDom(200);
    }
  },

  // -----------------------------
  // Rendering
  // -----------------------------
  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "myteams-fixtures";

    if (this.isLoading) {
      wrapper.innerHTML = `<div class="loading">Loading fixtures...</div>`;
      return wrapper;
    }
    if (this.errorMessage) {
      wrapper.innerHTML = `<div class="error">⚠ ${this.errorMessage}</div>`;
      return wrapper;
    }
    if (!this.fixtures || this.fixtures.length === 0) {
      wrapper.innerHTML = `<div class="empty">No upcoming fixtures</div>`;
      return wrapper;
    }

    const filtered = this.applyClientFilter(this.fixtures, this.config.defaultFilter);

    // Header title
    const title = document.createElement("div");
    title.className = "fixtures-title small";
    title.textContent = "Celtic FC upcoming fixtures";
    wrapper.appendChild(title);

    // Filter bar
    const filterBar = document.createElement("div");
    filterBar.className = "filter-bar xsmall";
    const filters = [
      { key: "all", label: "All" },
      { key: "domestic", label: "Domestic" },
      { key: "european", label: "Europe" },
      { key: "home", label: "Home" },
      { key: "away", label: "Away" }
    ];
    filters.forEach(flt => {
      const btn = document.createElement("span");
      btn.className = `filter-btn ${this.config.defaultFilter === flt.key ? 'active' : ''}`;
      btn.textContent = flt.label;
      btn.onclick = () => { this.config.defaultFilter = flt.key; this.updateDom(200); };
      filterBar.appendChild(btn);
    });
    wrapper.appendChild(filterBar);

    // Create a scrollable container to cap table height while allowing scroll
    const scroll = document.createElement("div");
    scroll.className = "fixtures-scroll";
    scroll.style.maxHeight = `${Number(this.config.maxTableHeight || 560)}px`; // allow config override
    scroll.setAttribute("role", "region"); // accessibility landmark
    scroll.setAttribute("aria-label", "Fixtures list");

    const table = document.createElement("table");
    table.className = "fixtures-table small";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th class="col-date">Date</th>
        <th class="col-time">Time</th>
        <th class="col-opp">Opponent</th>
        <th class="col-ha">H/A</th>
        ${this.config.showCompetition ? '<th class="col-comp">Competition</th>' : ''}
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    filtered.forEach(f => {
      const tr = document.createElement("tr");
      tr.className = (f.homeAway === "H" ? "home" : (f.homeAway === "A" ? "away" : ""));

      const dateText = this.formatDateDisplay(f.date, f.dateText);
      const timeText = f.timeText || "";
      const opponent = f.opponent || "TBD";
      const ha = f.homeAway || "";
      const comp = f.competition || "";

      tr.innerHTML = `
        <td class="col-date">${dateText}</td>
        <td class="col-time">${timeText}</td>
        <td class="col-opp">${opponent}</td>
        <td class="col-ha">${ha}</td>
        ${this.config.showCompetition ? `<td class="col-comp">${comp}</td>` : ""}
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Append table into the scroll container
    scroll.appendChild(table);

    // Add Back to Top control inside the scroll container
    const controls = document.createElement("div");
    controls.className = "scroll-controls"; // visibility toggled via CSS class

    const backToTopBtn = document.createElement("button");
    backToTopBtn.type = "button";
    backToTopBtn.className = "btn-back-to-top";
    backToTopBtn.title = "Back to top";
    backToTopBtn.setAttribute("aria-label", "Back to top");
    backToTopBtn.textContent = "Back to top";
    backToTopBtn.onclick = () => {
      try {
        // Smooth scroll if available, fallback to instant
        if (typeof scroll.scrollTo === "function") {
          scroll.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          scroll.scrollTop = 0;
        }
      } catch (e) {
        console.warn("[MyTeams] back-to-top error:", e);
        scroll.scrollTop = 0;
      }
    };

    controls.appendChild(backToTopBtn);
    scroll.appendChild(controls);

    // Toggle control visibility based on scroll position
    const toggleControls = () => {
      try {
        const show = (scroll.scrollTop || 0) > 40;
        if (show) controls.classList.add("visible");
        else controls.classList.remove("visible");
      } catch (e) {
        // Non-fatal; keep controls visible as fallback
        controls.classList.add("visible");
      }
    };
    scroll.addEventListener("scroll", toggleControls);
    // Run once to set initial state after insertion
    setTimeout(toggleControls, 0);

    // Finally, append the scroll container to the wrapper
    wrapper.appendChild(scroll);

    const footer = document.createElement("div");
    footer.className = "source-footer xsmall center";
    const src = this.usedSource ? `Source: ${this.usedSource}` : "Source: unknown";
    const at = this.fetchedAt ? ` • ${new Date(this.fetchedAt).toLocaleString()}` : "";
    footer.textContent = `${src}${at}`;
    wrapper.appendChild(footer);

    return wrapper;
  },

  // -----------------------------
  // Helpers
  // -----------------------------
  formatDateDisplay(dateISO, dateTextFallback) {
    if (dateISO && /^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      try {
        const d = new Date(dateISO + "T00:00:00");
        return d.toLocaleDateString(this.config.locale || "en-GB", {
          weekday: "short",
          day: "2-digit",
          month: "short"
        });
      } catch (e) {
        // ignore
      }
    }
    return dateTextFallback || "";
  },

  computeCountdown(dateISO, timeText) {
    if (!dateISO) return "";
    try {
      const dt = this.toDateTime(dateISO, timeText);
      const diffMs = dt.getTime() - Date.now();
      if (diffMs <= 0) return "Live/Passed";
      const mins = Math.floor(diffMs / 60000);
      const days = Math.floor(mins / (60 * 24));
      const hours = Math.floor((mins % (60 * 24)) / 60);
      const remMins = mins % 60;
      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${remMins}m`;
      return `${remMins}m`;
    } catch (e) {
      return "";
    }
  },

  toDateTime(dateISO, timeText) {
    if (!timeText) return new Date(`${dateISO}T00:00:00`);
    const t = String(timeText).trim().toLowerCase();
    const m = t.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
    if (!m) return new Date(`${dateISO}T00:00:00`);
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const ampm = m[3];
    if (ampm === "pm" && hh < 12) hh += 12;
    if (ampm === "am" && hh === 12) hh = 0;
    return new Date(`${dateISO}T${String(hh).padStart(2, "0")}:${mm}:00`);
  },

  applyClientFilter(fixtures, filter) {
    const list = Array.isArray(fixtures) ? fixtures : [];
    switch ((filter || "all").toLowerCase()) {
      case "home": return list.filter(f => f.homeAway === "H");
      case "away": return list.filter(f => f.homeAway === "A");
      case "european": return list.filter(f => (f.competitionType || "").toLowerCase() === "european");
      case "domestic": return list.filter(f => (f.competitionType || "").toLowerCase() === "domestic");
      case "all":
      default: return list;
    }
  }
});
