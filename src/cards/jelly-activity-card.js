import JellyCardBase from "../jelly-base.js";

/**
 * Activity Card — scrollable timeline of recent smart home events.
 * Designed to work with auto-entities which feeds sorted entities.
 *
 * auto-entities config example:
 *   type: custom:auto-entities
 *   card:
 *     type: custom:jelly-activity-card
 *     title: Recent Activity
 *     max_items: 45
 *     max_hours: 24
 *   filter:
 *     include:
 *       - domain: light
 *   sort:
 *     method: last_changed
 *     reverse: true
 */
customElements.define(
  "jelly-activity-card",
  class JellyActivityCard extends JellyCardBase {

    static minUnits = 4;

    static get cardTag() { return "jelly-activity-card"; }

    static get cardDomains() { return []; }

    static get editorSchema() {
      return {
        schema: [
          { name: "name", selector: { text: {} } },
        ],
        labels: {
          name: "Card Title (optional)",
        }
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig() {
      return { type: "custom:jelly-activity-card" };
    }

    // ─── Domain → icon map ──────────────────────────────
    static DOMAIN_ICONS = {
      light: "mdi:lightbulb",
      switch: "mdi:toggle-switch",
      fan: "mdi:fan",
      climate: "mdi:thermostat",
      cover: "mdi:blinds",
      lock: "mdi:lock",
      alarm_control_panel: "mdi:shield-home",
      binary_sensor: "mdi:motion-sensor",
      sensor: "mdi:chart-line",
      camera: "mdi:cctv",
      media_player: "mdi:speaker",
      vacuum: "mdi:robot-vacuum",
      automation: "mdi:robot",
      script: "mdi:script-text",
      scene: "mdi:palette",
      input_boolean: "mdi:toggle-switch-outline",
      input_number: "mdi:numeric",
      input_select: "mdi:form-dropdown",
      water_heater: "mdi:water-boiler",
      humidifier: "mdi:air-humidifier",
      remote: "mdi:remote",
      button: "mdi:gesture-tap-button",
      number: "mdi:numeric",
      select: "mdi:form-dropdown",
      person: "mdi:account",
      device_tracker: "mdi:crosshairs-gps",
      weather: "mdi:weather-partly-cloudy",
      update: "mdi:package-up",
      valve: "mdi:valve",
    };

    // Domains whose non-off state means "on" (green accent)
    static ON_DOMAINS = new Set([
      "light", "switch", "fan", "input_boolean", "media_player",
      "vacuum", "humidifier", "remote",
    ]);

    // Domains whose state changes are "settings" (blue accent)
    static SETTING_DOMAINS = new Set([
      "climate", "cover", "alarm_control_panel", "input_number",
      "number", "input_select", "select", "water_heater", "valve",
    ]);

    // Time bucket thresholds in minutes
    static TIME_BUCKETS = [
      { max: 10,    label: "Last 10 mins" },
      { max: 60,    label: "Last hour" },
      { max: 240,   label: "Last 4 hours" },
      { max: 1440,  label: "Last 24 hours" },
      { max: Infinity, label: "Yesterday & older" },
    ];

    /**
     * No entity required — load assets without entity validation.
     * auto-entities calls setConfig with { entities: [...] }.
     */
    async setConfig(config) {
      this.config = { ...config };
      await this._ensureAssets();
      this._applyCardDimensions();
      this.render?.();
    }

    afterLoad() {
      this.$title = this.qs(".title");
      this.$list = this.qs(".activity-list");
    }

    render() {
      if (!this.$title || !this.$list) return;
      const hass = this._hass;
      if (!hass) return;

      this.$title.textContent = this.config?.name || this.config?.title || "Recent Activity";

      // Gather entities from auto-entities or config
      const entityConfigs = this.config?.entities || [];
      const now = Date.now();
      const maxItems = this.config?.max_items || 100;
      const maxHoursMs = (this.config?.max_hours || Infinity) * 3600_000;

      // Build items: resolve state, compute time data, filter
      const items = [];
      for (const ec of entityConfigs) {
        const entityId = typeof ec === "string" ? ec : ec?.entity;
        if (!entityId) continue;
        const stateObj = hass.states[entityId];
        if (!stateObj) continue;

        const changed = new Date(stateObj.last_changed);
        const agoMs = now - changed.getTime();

        // max_hours filter
        if (agoMs > maxHoursMs) continue;

        items.push({ entityId, stateObj, changed, agoMs });
        if (items.length >= maxItems) break;
      }

      // Sort by last_changed descending (auto-entities usually pre-sorts, but be safe)
      items.sort((a, b) => b.changed - a.changed);

      // Build HTML
      const fragments = [];
      let currentBucket = -1;

      for (let i = 0; i < items.length; i++) {
        const { entityId, stateObj, changed, agoMs } = items[i];
        const agoMins = agoMs / 60_000;

        // Time separator
        const bucket = JellyActivityCard.TIME_BUCKETS.findIndex(b => agoMins <= b.max);
        if (bucket !== currentBucket) {
          currentBucket = bucket;
          const label = JellyActivityCard.TIME_BUCKETS[bucket]?.label || "Older";
          fragments.push(
            `<div class="time-separator">` +
            `<span class="sep-label">${label}</span>` +
            `<div class="sep-line"></div></div>`
          );
        }

        const domain = entityId.split(".")[0];
        const attrs = stateObj.attributes || {};
        const state = stateObj.state;
        const name = attrs.friendly_name || entityId;
        const icon = attrs.icon || JellyActivityCard.DOMAIN_ICONS[domain] || "mdi:help-circle";

        // State classification
        let dataState = "";
        if (JellyActivityCard.ON_DOMAINS.has(domain) && state !== "off" && state !== "unavailable" && state !== "idle" && state !== "standby") {
          dataState = "on";
        } else if (JellyActivityCard.SETTING_DOMAINS.has(domain) && state !== "unavailable") {
          dataState = "setting";
        }

        // Timestamp text
        const tsText = JellyActivityCard._formatTimestamp(changed);
        const agoText = JellyActivityCard._formatAgo(agoMs);

        // Message — friendly name + state description
        const message = JellyActivityCard._buildMessage(name, state, domain, attrs);

        // Duration — time between last_updated and last_changed
        const updatedAt = new Date(stateObj.last_updated);
        const durationMs = Math.abs(updatedAt - changed);
        const durationText = JellyActivityCard._formatDuration(durationMs);

        const stateAttr = dataState ? ` data-state="${dataState}"` : "";

        // Track row index for first/last class
        const rowIndex = fragments.filter(f => f.includes("activity-row")).length;

        fragments.push(
          `<div class="activity-row"${stateAttr}>` +
          `<div class="timeline-rail"></div>` +
          `<div class="activity-icon"><ha-icon icon="${icon}"></ha-icon></div>` +
          `<div class="activity-body">` +
          `<span class="timestamp">${tsText} | ${agoText}</span>` +
          `<span class="message">${message}</span>` +
          `</div>` +
          `<span class="duration">${durationText}</span>` +
          `</div>`
        );
      }

      if (fragments.length === 0) {
        this.$list.innerHTML = `<div class="time-separator"><span class="sep-label">No recent activity</span><div class="sep-line"></div></div>`;
        return;
      }

      this.$list.innerHTML = fragments.join("");

      // Apply first/last rail-cap classes
      const rows = this.$list.querySelectorAll(".activity-row");
      if (rows.length > 0) {
        rows[0].classList.add("first-row");
        rows[rows.length - 1].classList.add("last-row");
      }
    }

    // ─── Formatting helpers ─────────────────────────────

    static _formatTimestamp(date) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const d = date.getDate();
      const mon = months[date.getMonth()];
      const h = date.getHours();
      const m = date.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      const mPad = String(m).padStart(2, "0");
      return `${d} ${mon}, ${h12}:${mPad} ${ampm}`;
    }

    static _formatAgo(ms) {
      const secs = ms / 1000;
      if (secs < 60) return `${Math.round(secs)}s ago`;
      const mins = secs / 60;
      if (mins < 60) return `${Math.round(mins)}m ago`;
      const hours = mins / 60;
      if (hours < 24) return `${hours.toFixed(1)}h ago`;
      const days = hours / 24;
      return `${Math.round(days)}d ago`;
    }

    static _formatDuration(ms) {
      const secs = ms / 1000;
      if (secs < 60) return `Took ${secs.toFixed(1)}s`;
      const mins = secs / 60;
      if (mins < 60) return `Took ${mins.toFixed(1)}m`;
      const hours = mins / 60;
      return `Took ${hours.toFixed(1)}h`;
    }

    static _buildMessage(name, state, domain, attrs) {
      // Human-readable state descriptions
      const stateMap = {
        on: "is on",
        off: "turned off",
        unavailable: "is unavailable",
        unknown: "state unknown",
        home: "is home",
        not_home: "is away",
        locked: "locked",
        unlocked: "unlocked",
        open: "opened",
        closed: "closed",
        opening: "is opening",
        closing: "is closing",
        idle: "is idle",
        cleaning: "is cleaning",
        docked: "is docked",
        returning: "is returning",
        paused: "is paused",
        playing: "is playing",
        standby: "is on standby",
        armed_home: "armed (home)",
        armed_away: "armed (away)",
        armed_night: "armed (night)",
        disarmed: "disarmed",
        triggered: "triggered",
        heat: "heating",
        cool: "cooling",
        heat_cool: "auto heat/cool",
        auto: "auto mode",
        dry: "drying",
        fan_only: "fan mode",
      };

      let verb = stateMap[state] || state;

      // Enrich with attributes
      if (domain === "climate" && attrs.current_temperature !== undefined) {
        verb += ` · ${attrs.current_temperature}°`;
        if (attrs.temperature !== undefined) verb += ` → ${attrs.temperature}°`;
      } else if (domain === "light" && attrs.brightness !== undefined && state === "on") {
        const pct = Math.round((attrs.brightness / 255) * 100);
        verb += ` · ${pct}%`;
      } else if (domain === "cover" && attrs.current_position !== undefined) {
        verb += ` · ${attrs.current_position}%`;
      } else if (domain === "fan" && attrs.percentage !== undefined && state === "on") {
        verb += ` · ${attrs.percentage}%`;
      } else if (domain === "media_player" && attrs.media_title) {
        verb += ` · ${attrs.media_title}`;
      }

      // Escape HTML
      const escaped = (name + " " + verb).replace(/&/g, "&amp;").replace(/</g, "&lt;");
      return escaped;
    }
  }
);
