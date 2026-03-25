/* MMM-MyTeams-Fixtures (front-end)
 * - Uses normalized socket notifications:
 *   send:    "GET_FIXTURES"
 *   receive: "FIXTURES_DATA" | "FIXTURES_ERROR"
 */

Module.register("MMM-MyTeams-Fixtures", {
  // ─────────────────────────────────────────
  // Defaults
  // ─────────────────────────────────────────
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

    cacheTTL: 0 * 60 * 1000,
    fallbackChain: true,

    leagueIds: ["4330", "4364", "4363", "4888"],
    uefaLeagueIds: ["4480", "4481", "5071"],

    useSearchEventsFallback: true,
    strictLeagueFiltering: true,

    scrapeFWP: false,

    maxTableHeight: 260,
    countdownIntervalMs: 60000,
    largeListThreshold: 12,
    largeListCountdownMultiplier: 2,

    autoCycleFilters: false,
    autoCycleIntervalMs: 20000,

    cycleAll: true,
    cycleHome: true,
    cycleAway: true,
    cycleDomestic: false,
    cycleEuropean: false,

    locale: "en-GB",
    language: "en",

    // Theme overrides
    darkMode: null,
    fontColorOverride: null,
    opacityOverride: null,
    accentColor: "#018749",       // DES-003: team primary colour → --mmf-accent-color

    // UX-003: footer visibility
    showFooter: true,

    // INN-003: multi-team support  (null = use scalar teamId/teamName above)
    teams: null,

    // INN-004: pre-match alert notification
    enableAlerts: false,
    alertBeforeMinutes: 30
  },

  // ─────────────────────────────────────────
  // Translation System
  // ─────────────────────────────────────────
  getTranslations() {
    return {
      en: "translations/en.json",
      gd: "translations/gd.json",
      ga: "translations/ga.json",
      es: "translations/es.json",
      fr: "translations/fr.json",
      de: "translations/de.json",
      it: "translations/it.json",
      nl: "translations/nl.json",
      pt: "translations/pt.json"
    };
  },

  // ─────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────
  start() {
    this.isLoading = true;
    this.errorMessage = null;
    this.fixtures = [];
    this.usedSource = null;
    this.fetchedAt = null;

    this._updateTimer      = null;
    this._countdownTimer   = null;
    this._cycleTimer       = null;
    this._nextTabTimer     = null;
    this._nextTabEtaSec    = null;
    this._isPinned         = false;

    this._cachedListsByFilter  = new Map();
    this._autoCycleInterval    = Math.max(5000, Number(this.config.autoCycleIntervalMs || 20000));
    this._autoCycleIndex       = -1;
    this._filtersOrder         = ["all", "domestic", "european", "home", "away"];
    this._cycleFilterKeys      = this._buildCycleFilterKeys();

    // INN-003: multi-team state
    this._activeTeamIndex = 0;

    // PERF-001: dirty-flag so theme overrides are only rewritten when config changes
    this._themeConfigHash = null;

    // INN-004: alert deduplication
    this._alertFired = new Set();
    this._alertTimer = null;

    this.getFixtures();
    this.scheduleUpdate();
    this.startCountdown();
    this.startAutoCycle();

    // PERF-001: apply theme once at start, not on every getDom()
    this._applyThemeOverrides();

    if (this.config.debug) console.log("[MyTeams] start() - Language:", this.config.language);
  },

  stop() {
    if (this._updateTimer)    clearInterval(this._updateTimer);
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    if (this._cycleTimer)     clearInterval(this._cycleTimer);
    if (this._nextTabTimer)   clearInterval(this._nextTabTimer);
    if (this._alertTimer)     clearTimeout(this._alertTimer);
  },

  // ─────────────────────────────────────────
  // Schedules
  // ─────────────────────────────────────────
  scheduleUpdate() {
    if (this._updateTimer) clearInterval(this._updateTimer);
    const every = Math.max(60 * 1000, Number(this.config.updateInterval || 600000));
    this._updateTimer = setInterval(() => this.getFixtures(), every);
  },

  startCountdown() {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    const base     = Math.max(15000, Number(this.config.countdownIntervalMs || 60000));
    const isLarge  = (this.fixtures?.length || 0) >= Number(this.config.largeListThreshold || 12);
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

  startAutoCycle() {
    try {
      if (!this.config.autoCycleFilters || this._isPinned) {
        if (this._cycleTimer) {
          clearInterval(this._cycleTimer);
          this._cycleTimer = null;
        }
        this._stopNextTabCountdown();
        return;
      }

      if (this._cycleTimer) clearInterval(this._cycleTimer);

      if (!Array.isArray(this._filtersOrder) || this._filtersOrder.length === 0) {
        this._filtersOrder = ["all", "domestic", "european", "home", "away"];
      }
      this._cycleFilterKeys = this._buildCycleFilterKeys();
      if (!Array.isArray(this._cycleFilterKeys) || this._cycleFilterKeys.length === 0) {
        this._stopNextTabCountdown();
        return;
      }

      this._autoCycleInterval = Math.max(5000, Number(this.config.autoCycleIntervalMs || 20000));
      this._startNextTabCountdown(this._autoCycleInterval);

      this._cycleTimer = setInterval(() => {
        try {
          if (this.isLoading || !Array.isArray(this.fixtures) || this.fixtures.length === 0) return;
          this._autoCycleInterval = Math.max(5000, Number(this.config.autoCycleIntervalMs || 20000));
          const nextFilterKey = this._getNextFilterKey();
          this.setActiveFilter(nextFilterKey);
          this._startNextTabCountdown(this._autoCycleInterval);
          this.updateDom(200);
        } catch (err) {
          console.warn("[MyTeams] auto-cycle tick error:", err);
        }
      }, this._autoCycleInterval);
    } catch (error) {
      console.warn("[MyTeams] startAutoCycle failed:", error);
    }
  },

  // ─────────────────────────────────────────
  // Styles  — DES-005: renamed to customOverrides.css
  // ─────────────────────────────────────────
  getStyles() {
    return [
      this.file("MMM-MyTeams-Fixtures.css"),
      this.file("customOverrides.css")
    ];
  },

  // ─────────────────────────────────────────
  // INN-003: Multi-team helper
  // ─────────────────────────────────────────
  _getActiveTeamConfig() {
    if (Array.isArray(this.config.teams) && this.config.teams.length > 0) {
      const t = this.config.teams[Math.min(this._activeTeamIndex, this.config.teams.length - 1)];
      return {
        teamId:      t.teamId      || this.config.teamId,
        teamName:    t.teamName    || this.config.teamName,
        accentColor: t.accentColor || this.config.accentColor,
        label:       t.label       || t.teamName || this.config.teamName
      };
    }
    return {
      teamId:      this.config.teamId,
      teamName:    this.config.teamName,
      accentColor: this.config.accentColor,
      label:       this.config.teamName
    };
  },

  // ─────────────────────────────────────────
  // Socket comms
  // ─────────────────────────────────────────
  getFixtures() {
    this.isLoading = true;
    this.errorMessage = null;
    this._cachedListsByFilter.clear();
    this._autoCycleInterval   = Math.max(5000, Number(this.config.autoCycleIntervalMs || 20000));
    this._cycleFilterKeys     = this._buildCycleFilterKeys();
    this._resetAutoCycleIndexToFilter(this.config.defaultFilter || "all");
    this.updateDom(200);

    const activeTeam = this._getActiveTeamConfig();

    const payload = {
      source:        this.config.source,
      teamName:      activeTeam.teamName,
      teamId:        activeTeam.teamId,
      apiUrl:        this.config.apiUrl,
      season:        this.config.season,
      fallbackSeason: this.config.fallbackSeason,
      leagueIds:     this.config.leagueIds,
      uefaLeagueIds: this.config.uefaLeagueIds,
      maxFixtures:   this.config.maxFixtures,
      requestTimeoutMs: this.config.requestTimeoutMs,
      cacheTTL:      this.config.cacheTTL,
      fallbackChain: this.config.fallbackChain,
      debug:         !!this.config.debug,
      scrapeFWP:     this.config.scrapeFWP,
      useSearchEventsFallback: this.config.useSearchEventsFallback,
      strictLeagueFiltering:   this.config.strictLeagueFiltering
    };

    this.sendSocketNotification("GET_FIXTURES", payload);
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "FIXTURES_DATA") {
      this.fixtures   = Array.isArray(payload?.fixtures) ? payload.fixtures.slice(0, this.config.maxFixtures) : [];
      this.usedSource = payload?.usedSource || null;
      this.fetchedAt  = payload?.fetchedAt  || null;
      this.isLoading  = false;
      this.errorMessage = null;
      this._cachedListsByFilter.clear();
      this._cycleFilterKeys = this._buildCycleFilterKeys();
      this._resetAutoCycleIndexToFilter(this.config.defaultFilter || "all");
      if (this.config.debug) console.log("[MyTeams] Data received:", this.fixtures.length, "source:", this.usedSource);

      // PERF-003: only (re)start cycle if it is not already running
      if (!this._cycleTimer) this.startAutoCycle();

      // INN-004: schedule pre-match alert for the next fixture
      this._scheduleAlert();

      this.updateDom(200);
      return;
    }

    if (notification === "FIXTURES_ERROR") {
      this.fixtures   = [];
      this.usedSource = null;
      this.fetchedAt  = null;
      this.isLoading  = false;
      this.errorMessage = payload?.message || "Unknown error";
      console.warn("[MyTeams] Error:", this.errorMessage);
      this.updateDom(200);
    }
  },

  // ─────────────────────────────────────────
  // INN-004: Pre-match alert
  // ─────────────────────────────────────────
  _scheduleAlert() {
    if (!this.config.enableAlerts) return;
    if (!Array.isArray(this.fixtures) || this.fixtures.length === 0) return;
    if (this._alertTimer) clearTimeout(this._alertTimer);

    const alertMinutes = Number(this.config.alertBeforeMinutes || 30);
    const now = Date.now();

    for (const f of this.fixtures) {
      if (!f.date) continue;
      try {
        const matchTime = this.toDateTime(f.date, f.timeText).getTime();
        const alertAt   = matchTime - alertMinutes * 60 * 1000;
        const delay     = alertAt - now;
        if (delay < 0 || delay > 24 * 60 * 60 * 1000) continue;

        const alertKey = `${f.date}|${f.timeText}|${f.opponent}`;
        if (this._alertFired.has(alertKey)) continue;

        this._alertTimer = setTimeout(() => {
          if (!this._alertFired.has(alertKey)) {
            this._alertFired.add(alertKey);
            const team = this._getActiveTeamConfig().teamName;
            this.sendNotification("SHOW_ALERT", {
              title:   `⚽ ${team}`,
              message: `${f.opponent} — ${this.translate("NEXT_MATCH") || "Next match"} in ${alertMinutes} min`,
              timer:   15000
            });
          }
        }, delay);
        break;
      } catch (_) {}
    }
  },

  // ─────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────
  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "myteams-fixtures";

    // UX-004: Skeleton loader while data is being fetched
    if (this.isLoading) {
      const skel = document.createElement("div");
      skel.className = "fixtures-skeleton";
      for (let i = 0; i < 6; i++) {
        const row = document.createElement("div");
        row.className = "skeleton-row";
        skel.appendChild(row);
      }
      wrapper.appendChild(skel);
      return wrapper;
    }

    if (this.errorMessage) {
      const errDiv = document.createElement("div");
      errDiv.className = "error";
      errDiv.textContent = `⚠ ${this.errorMessage}`;
      wrapper.appendChild(errDiv);
      return wrapper;
    }

    if (!this.fixtures || this.fixtures.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "empty";
      emptyDiv.textContent = this.translate("NO_FIXTURES");
      wrapper.appendChild(emptyDiv);
      return wrapper;
    }

    const filtered = this.getCachedFilteredList(this.config.defaultFilter, this.fixtures);
    this._refreshActiveButton(wrapper, this.config.defaultFilter);

    // INN-003: Team switcher row (only shown when teams array has 2+ entries)
    if (Array.isArray(this.config.teams) && this.config.teams.length > 1) {
      const teamSwitcher = document.createElement("div");
      teamSwitcher.className = "team-switcher xsmall";
      this.config.teams.forEach((t, idx) => {
        const tb = document.createElement("button");
        tb.type = "button";
        tb.className = `team-btn${idx === this._activeTeamIndex ? " active" : ""}`;
        tb.textContent = t.label || t.teamName;
        tb.setAttribute("aria-pressed", String(idx === this._activeTeamIndex));
        tb.addEventListener("click", () => {
          try {
            this._activeTeamIndex = idx;
            this._alertFired.clear();
            this.getFixtures();
          } catch (e) { console.warn("[MyTeams] team switch error:", e); }
        });
        teamSwitcher.appendChild(tb);
      });
      wrapper.appendChild(teamSwitcher);
    }

    // Header
    const header = document.createElement("div");
    header.className = "fixtures-header row xsmall";

    const leftTabs     = document.createElement("div");
    leftTabs.className = "tabs-left";

    const rightControls     = document.createElement("div");
    rightControls.className = "controls-right";

    // INN-001: Next-match countdown badge on first fixture
    if (this.config.showCountdown && this.fixtures.length > 0) {
      const firstF  = this.fixtures[0];
      const cdText  = this.computeCountdown(firstF.date, firstF.timeText);
      const badge   = document.createElement("span");
      if (cdText === "Live/Passed" && firstF.status === "In Progress") {
        badge.className = "next-match-badge live xsmall";
        const score = (firstF.homeScore != null && firstF.awayScore != null)
          ? ` ${firstF.homeScore}–${firstF.awayScore}` : "";
        badge.textContent = `🔴 ${this.translate("LIVE") || "LIVE"}${score}`;
        leftTabs.appendChild(badge);
      } else if (cdText && cdText !== "Live/Passed") {
        badge.className = "next-match-badge xsmall";
        badge.textContent = `⏱ ${cdText}`;
        leftTabs.appendChild(badge);
      }
    }

    // Filter tabs — ACC-001: buttons; ACC-002: aria-pressed + aria-label; UX-001: counts
    const filters = [
      { key: "all",      label: this.translate("ALL") },
      { key: "domestic", label: this.translate("DOMESTIC") },
      { key: "european", label: this.translate("EUROPE") },
      { key: "home",     label: this.translate("HOME") },
      { key: "away",     label: this.translate("AWAY") }
    ];
    this._filtersOrder = filters.map(f => f.key);

    filters.forEach(flt => {
      const count    = this.getCachedFilteredList(flt.key, this.fixtures).length;
      const isActive = this.config.defaultFilter === flt.key;

      const btn = document.createElement("button");
      btn.type  = "button";
      btn.className = `filter-btn${isActive ? " active" : ""}${count === 0 ? " empty-filter" : ""}`;
      btn.dataset.filterKey = flt.key;
      btn.setAttribute("aria-pressed", String(isActive));
      btn.setAttribute("aria-label",
        `${this.translate("SHOW") || "Show"} ${flt.label} ${this.translate("UPCOMING_FIXTURES")}`);
      btn.textContent = count > 0 ? `${flt.label} (${count})` : flt.label;
      if (count === 0) btn.disabled = true;

      btn.addEventListener("click", () => {
        try {
          this.setActiveFilter(flt.key);
          this._cycleFilterKeys = this._buildCycleFilterKeys();
          this._resetAutoCycleIndexToFilter(flt.key);
          this.startAutoCycle();
          this.updateDom(200);
        } catch (err) {
          console.warn("[MyTeams] filter click error:", err);
        }
      });
      leftTabs.appendChild(btn);
    });

    // Control icons — ACC-001: buttons instead of spans
    const refreshBtn  = document.createElement("button");
    refreshBtn.type   = "button";
    refreshBtn.className = "refresh-btn fas fa-sync-alt small dimmed";
    refreshBtn.title  = this.translate("REFRESH_DATA");
    refreshBtn.setAttribute("aria-label", this.translate("REFRESH_DATA"));
    refreshBtn.addEventListener("click", () => {
      try {
        this.getFixtures();
        refreshBtn.classList.add("fa-spin");
        setTimeout(() => refreshBtn.classList.remove("fa-spin"), 2000);
      } catch (e) { console.warn("[MyTeams] refresh click error:", e); }
    });

    const clearBtn  = document.createElement("button");
    clearBtn.type   = "button";
    clearBtn.className = "clear-cache-btn fas fa-trash-alt small dimmed";
    clearBtn.title  = this.translate("CLEAR_CACHE");
    clearBtn.setAttribute("aria-label", this.translate("CLEAR_CACHE"));
    clearBtn.addEventListener("click", () => {
      try {
        this.sendSocketNotification("CLEAR_FIXTURES_CACHE", {});
        clearBtn.classList.add("fa-spin");
        setTimeout(() => clearBtn.classList.remove("fa-spin"), 1500);
      } catch (e) { console.warn("[MyTeams] clear cache click error:", e); }
    });

    const pinBtn  = document.createElement("button");
    pinBtn.type   = "button";
    pinBtn.className = `pin-btn fas fa-thumbtack small dimmed${this._isPinned ? " active" : ""}`;
    pinBtn.setAttribute("aria-pressed", String(!!this._isPinned));
    const pinLabel = this._isPinned ? this.translate("UNPIN") : this.translate("PIN");
    pinBtn.title = pinLabel;
    pinBtn.setAttribute("aria-label", pinLabel);
    pinBtn.addEventListener("click", () => {
      try {
        this._isPinned = !this._isPinned;
        pinBtn.classList.toggle("active", this._isPinned);
        pinBtn.setAttribute("aria-pressed", String(this._isPinned));
        const lbl = this._isPinned ? this.translate("UNPIN") : this.translate("PIN");
        pinBtn.title = lbl;
        pinBtn.setAttribute("aria-label", lbl);
        if (this._isPinned) {
          if (this._cycleTimer) clearInterval(this._cycleTimer);
          this._cycleTimer = null;
          this._stopNextTabCountdown();
        } else {
          this.startAutoCycle();
        }
        this.updateDom(100);
      } catch (e) { console.warn("[MyTeams] pin click error:", e); }
    });

    const cycleCountdown = document.createElement("span");
    cycleCountdown.className = "cycle-countdown xsmall dimmed";
    cycleCountdown.style.marginLeft = "8px";
    const etaText = (this._nextTabEtaSec != null)
      ? `${this._nextTabEtaSec}s`
      : ((Math.max(5, Number(this.config.autoCycleIntervalMs || 20000) / 1000) | 0) + "s");
    cycleCountdown.textContent = `${this.translate("NEXT_TAB_IN") || "Next tab in"} ${etaText}`;

    rightControls.appendChild(refreshBtn);
    rightControls.appendChild(clearBtn);
    rightControls.appendChild(pinBtn);
    rightControls.appendChild(cycleCountdown);

    header.appendChild(leftTabs);
    header.appendChild(rightControls);
    wrapper.appendChild(header);

    // Scroll container
    const scroll = document.createElement("div");
    scroll.className = "fixtures-scroll";
    scroll.style.maxHeight = `${Number(this.config.maxTableHeight || 560)}px`;
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", this.translate("UPCOMING_FIXTURES"));

    const table = document.createElement("table");
    table.className = "fixtures-table small";

    // ACC-004: Visually hidden caption for screen readers
    const caption = document.createElement("caption");
    caption.className = "sr-only";
    caption.textContent = `${this._getActiveTeamConfig().teamName} ${this.translate("UPCOMING_FIXTURES")}`;
    table.appendChild(caption);

    // Table header — SEC-001: textContent only, no innerHTML
    const thead  = document.createElement("thead");
    const hRow   = document.createElement("tr");
    const thDefs = [
      { cls: "col-date", key: "DATE" },
      { cls: "col-time", key: "TIME" },
      { cls: "col-opp",  key: "OPPONENT" },
      { cls: "col-ha",   key: "H_A" }
    ];
    if (this.config.showCompetition) thDefs.push({ cls: "col-comp", key: "COMPETITION" });
    thDefs.forEach(({ cls, key }) => {
      const th = document.createElement("th");
      th.className = cls;
      th.textContent = this.translate(key);
      hRow.appendChild(th);
    });
    thead.appendChild(hRow);
    table.appendChild(thead);

    // Table body — UX-005: tbody class for CSS fade animation targeting
    const tbody = document.createElement("tbody");
    tbody.className = "fixtures-tbody";

    filtered.forEach(f => {
      const tr      = document.createElement("tr");
      const isHome  = f.homeAway === "H";
      const isAway  = f.homeAway === "A";
      tr.className  = isHome ? "home" : (isAway ? "away" : "");
      // INN-002: highlight live matches
      if (f.status === "In Progress") tr.classList.add("live-match");

      // SEC-001: All user data via textContent — never innerHTML
      const tdDate = document.createElement("td");
      tdDate.className  = "col-date";
      tdDate.textContent = this.formatDateDisplay(f.date, f.dateText);

      const tdTime = document.createElement("td");
      tdTime.className = "col-time";
      // INN-002: show live score when available
      if (f.status === "In Progress" && f.homeScore != null && f.awayScore != null) {
        const pip = document.createElement("span");
        pip.className    = "live-pip";
        pip.textContent  = "🔴 ";
        tdTime.appendChild(pip);
        tdTime.appendChild(document.createTextNode(`${f.homeScore}–${f.awayScore}`));
      } else {
        tdTime.textContent = f.timeText || "";
      }

      const tdOpp = document.createElement("td");
      tdOpp.className   = "col-opp";
      tdOpp.textContent = f.opponent || this.translate("TBD");

      // ACC-003: Unicode prefix avoids colour-only differentiation for H/A
      const tdHa = document.createElement("td");
      tdHa.className = "col-ha";
      if (isHome)      tdHa.textContent = "▲ H";
      else if (isAway) tdHa.textContent = "▽ A";
      else             tdHa.textContent = f.homeAway || "";

      tr.appendChild(tdDate);
      tr.appendChild(tdTime);
      tr.appendChild(tdOpp);
      tr.appendChild(tdHa);

      if (this.config.showCompetition) {
        const tdComp = document.createElement("td");
        tdComp.className   = "col-comp";
        tdComp.textContent = f.competition || "";
        tr.appendChild(tdComp);
      }

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);

    // Back-to-top — ACC-001: already a button; preserved from original
    const controls = document.createElement("div");
    controls.className = "scroll-controls";

    const backToTopBtn = document.createElement("button");
    backToTopBtn.type  = "button";
    backToTopBtn.className = "btn-back-to-top";
    const backLabel = this.translate("BACK_TO_TOP");
    backToTopBtn.title = backLabel;
    backToTopBtn.setAttribute("aria-label", backLabel);
    backToTopBtn.textContent = backLabel;
    backToTopBtn.addEventListener("click", () => {
      try {
        if (typeof scroll.scrollTo === "function") {
          scroll.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          scroll.scrollTop = 0;
        }
      } catch (e) { scroll.scrollTop = 0; }
    });

    controls.appendChild(backToTopBtn);
    scroll.appendChild(controls);

    // PERF-002: rAF-throttled scroll listener — SEC-003: debug logs removed
    let _scrollRaf = null;
    const toggleControls = () => {
      try {
        controls.classList.toggle("visible", (scroll.scrollTop || 0) > 40);
      } catch (e) {
        console.warn("[MyTeams-Fixtures] scroll listener error:", e);
      }
    };
    setTimeout(() => {
      scroll.addEventListener("scroll", () => {
        if (_scrollRaf) return;
        _scrollRaf = requestAnimationFrame(() => { toggleControls(); _scrollRaf = null; });
      }, { passive: true });
      toggleControls();
    }, 100);

    wrapper.appendChild(scroll);

    // Footer — UX-002 stale indicator + UX-003 friendly labels
    if (this.config.showFooter !== false) {
      const footer = document.createElement("div");
      footer.className = "source-footer xsmall center";

      const sourceLabels = {
        api:              "TheSportsDB",
        "api+fwp":        "TheSportsDB + FWP",
        "api+bbc":        "TheSportsDB + BBC Sport",
        fwp:              "Football Web Pages",
        bbc:              "BBC Sport",
        cfc:              "Club Site",
        sportsdb:         "SportsDB Site",
        livefootballontv: "LiveFootballOnTV",
        cache:            "Cached",
        "cache-cleared":  "Cache Cleared"
      };
      const friendlySource = sourceLabels[this.usedSource || ""] || (this.usedSource || this.translate("UNKNOWN"));

      let timeLabel = "";
      let isStale   = false;
      if (this.fetchedAt) {
        const ageMs    = Date.now() - new Date(this.fetchedAt).getTime();
        const cacheTTL = Number(this.config.cacheTTL || 300000);
        isStale   = ageMs > cacheTTL * 1.5;
        timeLabel = ` • ${this.formatRelativeTime(ageMs)}`;
      }

      footer.textContent = `${this.translate("SOURCE")}: ${friendlySource}${timeLabel}`;
      if (isStale) {
        footer.classList.add("stale");
        footer.textContent += " ⚠";
      }
      wrapper.appendChild(footer);
    }

    return wrapper;
  },

  // ─────────────────────────────────────────
  // Next-tab countdown helpers
  // ─────────────────────────────────────────
  _startNextTabCountdown(ms) {
    try {
      if (this._isPinned) return;
      if (this._nextTabTimer) clearInterval(this._nextTabTimer);
      const total = Math.max(1000, Number(ms || this._autoCycleInterval || 20000));
      this._nextTabEtaSec = Math.max(1, Math.round(total / 1000));
      this._nextTabTimer  = setInterval(() => {
        if (this._isPinned) { this._stopNextTabCountdown(); return; }
        if (typeof this._nextTabEtaSec === "number" && this._nextTabEtaSec > 0) {
          this._nextTabEtaSec -= 1;
          const root = this.hidden ? null : document;
          if (root) {
            const el = root.querySelector?.(".myteams-fixtures .cycle-countdown");
            if (el) {
              const lbl = this.translate?.("NEXT_TAB_IN") || "Next tab in";
              el.textContent = `${lbl} ${this._nextTabEtaSec}s`;
            } else {
              this.updateDom(0);
            }
          }
        }
      }, 1000);
    } catch (e) {
      console.warn("[MyTeams] next-tab countdown error:", e);
    }
  },

  _stopNextTabCountdown() {
    if (this._nextTabTimer) clearInterval(this._nextTabTimer);
    this._nextTabTimer  = null;
    this._nextTabEtaSec = null;
  },

  // ─────────────────────────────────────────
  // Auto-cycle helpers
  // ─────────────────────────────────────────
  setActiveFilter(filterKey) {
    const normalized = (filterKey || "all").toLowerCase();
    if (this.config.defaultFilter === normalized) return;
    this.config.defaultFilter = normalized;
  },

  _resetAutoCycleIndexToFilter(filterKey) {
    if (!Array.isArray(this._cycleFilterKeys) || this._cycleFilterKeys.length === 0) {
      this._cycleFilterKeys = this._buildCycleFilterKeys();
    }
    const idx = this._cycleFilterKeys.indexOf((filterKey || "all").toLowerCase());
    this._autoCycleIndex = idx >= 0 ? idx : this._cycleFilterKeys.indexOf("home");
    if (this._autoCycleIndex < 0) this._autoCycleIndex = 0;
  },

  _getNextFilterKey() {
    if (!Array.isArray(this._cycleFilterKeys) || this._cycleFilterKeys.length === 0) {
      this._cycleFilterKeys = this._buildCycleFilterKeys();
    }
    if (!Array.isArray(this._cycleFilterKeys) || this._cycleFilterKeys.length === 0) {
      return this.config.defaultFilter || "all";
    }
    if (typeof this._autoCycleIndex !== "number" || this._autoCycleIndex < 0) {
      this._autoCycleIndex = this._cycleFilterKeys.indexOf((this.config.defaultFilter || "home").toLowerCase());
      if (this._autoCycleIndex < 0) this._autoCycleIndex = 0;
    }
    this._autoCycleIndex = (this._autoCycleIndex + 1) % this._cycleFilterKeys.length;
    return this._cycleFilterKeys[this._autoCycleIndex];
  },

  _refreshActiveButton(wrapper, activeKey) {
    const normalized = (activeKey || "all").toLowerCase();
    wrapper.querySelectorAll(".filter-btn").forEach(btn => {
      const key = btn.dataset?.filterKey || btn.textContent.toLowerCase();
      if (btn.dataset) btn.dataset.filterKey = key;
      const isActive = key === normalized;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive)); // ACC-002
    });
  },

  getCachedFilteredList(filterKey, fixtures) {
    const normalized = (filterKey || "all").toLowerCase();
    const sourceList = Array.isArray(fixtures) ? fixtures : [];
    const cacheKey   = normalized + "::" + (this.fetchedAt || "");
    if (this._cachedListsByFilter.has(cacheKey)) return this._cachedListsByFilter.get(cacheKey);
    const computed = this.applyClientFilter(sourceList, normalized);
    this._cachedListsByFilter.set(cacheKey, computed);
    return computed;
  },

  _buildCycleFilterKeys() {
    const allowed = [];
    if (this.config.cycleAll)      allowed.push("all");
    if (this.config.cycleDomestic) allowed.push("domestic");
    if (this.config.cycleEuropean) allowed.push("european");
    if (this.config.cycleHome)     allowed.push("home");
    if (this.config.cycleAway)     allowed.push("away");
    if (allowed.length === 0) return ["home", "away"];
    const def = (this.config.defaultFilter || "").toLowerCase();
    if (allowed.includes(def)) {
      return [def, ...allowed.filter(k => k !== def)];
    }
    return allowed.slice();
  },

  // ─────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────
  formatDateDisplay(dateISO, dateTextFallback) {
    if (dateISO && /^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      try {
        const d = new Date(dateISO + "T00:00:00");
        return d.toLocaleDateString(this.config.locale || "en-GB", {
          weekday: "short",
          day:     "2-digit",
          month:   "short"
        });
      } catch (e) { /* ignore */ }
    }
    return dateTextFallback || "";
  },

  computeCountdown(dateISO, timeText) {
    if (!dateISO) return "";
    try {
      const dt     = this.toDateTime(dateISO, timeText);
      const diffMs = dt.getTime() - Date.now();
      if (diffMs <= 0) return "Live/Passed";
      const mins    = Math.floor(diffMs / 60000);
      const days    = Math.floor(mins / (60 * 24));
      const hours   = Math.floor((mins % (60 * 24)) / 60);
      const remMins = mins % 60;
      if (days  > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${remMins}m`;
      return `${remMins}m`;
    } catch (e) { return ""; }
  },

  toDateTime(dateISO, timeText) {
    if (!timeText) return new Date(`${dateISO}T00:00:00`);
    const t = String(timeText).trim().toLowerCase();
    const m = t.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
    if (!m) return new Date(`${dateISO}T00:00:00`);
    let hh       = parseInt(m[1], 10);
    const mm     = m[2];
    const ampm   = m[3];
    if (ampm === "pm" && hh < 12) hh += 12;
    if (ampm === "am" && hh === 12) hh = 0;
    return new Date(`${dateISO}T${String(hh).padStart(2, "0")}:${mm}:00`);
  },

  applyClientFilter(fixtures, filter) {
    const list = Array.isArray(fixtures) ? fixtures : [];
    switch ((filter || "all").toLowerCase()) {
      case "home":     return list.filter(f => f.homeAway === "H");
      case "away":     return list.filter(f => f.homeAway === "A");
      case "european": return list.filter(f => (f.competitionType || "").toLowerCase() === "european");
      case "domestic": return list.filter(f => (f.competitionType || "").toLowerCase() === "domestic");
      case "all":
      default:         return list;
    }
  },

  // UX-002: Human-readable relative time
  formatRelativeTime(ageMs) {
    const secs = Math.floor(ageMs / 1000);
    if (secs < 60)   return "Updated just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60)   return `Updated ${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)  return `Updated ${hours}h ago`;
    return `Updated ${Math.floor(hours / 24)}d ago`;
  },

  // ─────────────────────────────────────────
  // Theme Overrides  — PERF-001: dirty-flag; DES-003: accentColor
  // ─────────────────────────────────────────
  _applyThemeOverrides() {
    const newHash = JSON.stringify({
      dm: this.config.darkMode,
      fc: this.config.fontColorOverride,
      op: this.config.opacityOverride,
      ac: this.config.accentColor
    });
    if (newHash === this._themeConfigHash) return;
    this._themeConfigHash = newHash;

    const styleId = "mmm-myteams-fixtures-theme-override";
    let styleEl   = document.getElementById(styleId);

    const hasOverrides =
      this.config.darkMode !== null ||
      this.config.fontColorOverride !== null ||
      this.config.opacityOverride  !== null ||
      this.config.accentColor;

    if (!hasOverrides) {
      if (styleEl) styleEl.remove();
      return;
    }

    if (!styleEl) {
      styleEl    = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    let css = "";

    // DES-003: push accent colour as a CSS custom property
    if (this.config.accentColor) {
      css += `.myteams-fixtures { --mmf-accent-color: ${this.config.accentColor}; }\n`;
    }

    if (this.config.darkMode === true) {
      css += `.myteams-fixtures { background-color: #111 !important; color: #fff !important; }\n`;
    } else if (this.config.darkMode === false) {
      css += `.myteams-fixtures { background-color: #f5f5f5 !important; color: #000 !important; }\n`;
    }

    if (this.config.fontColorOverride) {
      css += `.myteams-fixtures * { color: ${this.config.fontColorOverride} !important; }\n`;
    }

    if (this.config.opacityOverride != null) {
      const opacity = parseFloat(this.config.opacityOverride);
      if (!isNaN(opacity)) {
        css += `.myteams-fixtures * { opacity: ${opacity} !important; }\n`;
      }
    }

    styleEl.textContent = css;
  }
});
