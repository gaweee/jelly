import JellyCardBase from "../jelly-base.js";

/**
 * Activity Card — scrollable timeline of recent smart home events.
 * Subscribes to HA WebSocket events and stores an in-memory + localStorage log.
 *
 * Config:
 *   title / name        — card heading (default "Recent Activity")
 *   max_items            — cap on stored events (default 200)
 *   max_hours            — drop events older than N hours
 *   refresh_interval     — seconds between "ago" text refreshes (default 30, 0 = off)
 *   domains              — array of domains to track (default: light, switch, lock, cover, climate, fan, automation, scene)
 *   time_buckets         — array of { title, seconds } for separator overrides
 */

const STORAGE_KEY = "jelly-activity-log";

const DEFAULT_DOMAINS = ["light", "switch", "lock", "cover", "climate", "fan", "automation", "scene"];

const DEFAULT_BUCKETS = [
  { title: "Last 10 mins",      seconds: 600 },
  { title: "Last hour",         seconds: 3600 },
  { title: "Last 4 hours",      seconds: 14400 },
  { title: "Last 24 hours",     seconds: 86400 },
  { title: "Yesterday & older", seconds: Infinity },
];

const DOMAIN_ICONS = {
  light: "mdi:lightbulb", switch: "mdi:toggle-switch", fan: "mdi:fan",
  climate: "mdi:thermostat", cover: "mdi:blinds", lock: "mdi:lock",
  alarm_control_panel: "mdi:shield-home", binary_sensor: "mdi:motion-sensor",
  sensor: "mdi:chart-line", camera: "mdi:cctv", media_player: "mdi:speaker",
  vacuum: "mdi:robot-vacuum", automation: "mdi:robot", script: "mdi:script-text",
  scene: "mdi:palette", input_boolean: "mdi:toggle-switch-outline",
  input_number: "mdi:numeric", input_select: "mdi:form-dropdown",
  water_heater: "mdi:water-boiler", humidifier: "mdi:air-humidifier",
  remote: "mdi:remote", button: "mdi:gesture-tap-button", number: "mdi:numeric",
  select: "mdi:form-dropdown", person: "mdi:account", device_tracker: "mdi:crosshairs-gps",
  weather: "mdi:weather-partly-cloudy", update: "mdi:package-up", valve: "mdi:valve",
};

const ON_DOMAINS = new Set([
  "light", "switch", "fan", "input_boolean", "media_player",
  "vacuum", "humidifier", "remote",
]);

const SETTING_DOMAINS = new Set([
  "climate", "cover", "alarm_control_panel", "input_number",
  "number", "input_select", "select", "water_heater", "valve",
]);

const STATE_LABELS = {
  on: "on", off: "off", unavailable: "unavailable", unknown: "unknown",
  home: "home", not_home: "away", locked: "locked", unlocked: "unlocked",
  open: "open", closed: "closed", opening: "opening", closing: "closing",
  idle: "idle", cleaning: "cleaning", docked: "docked", returning: "returning",
  paused: "paused", playing: "playing", standby: "standby",
  armed_home: "armed (home)", armed_away: "armed (away)", armed_night: "armed (night)",
  disarmed: "disarmed", triggered: "triggered",
  heat: "heating", cool: "cooling", heat_cool: "auto heat/cool",
  auto: "auto", dry: "drying", fan_only: "fan mode",
};

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ─── Formatting helpers (pure) ──────────────────────

function fmtTimestamp(d) {
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours(), h12 = h % 12 || 12, ap = h >= 12 ? "PM" : "AM";
  return `${d.getDate()} ${M[d.getMonth()]}, ${h12}:${String(d.getMinutes()).padStart(2,"0")} ${ap}`;
}

function fmtAgo(ms) {
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s)}s ago`;
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ─── Diff helpers — extract what changed ────────────

function diffState(oldS, newS) {
  if (!oldS || oldS.state === newS.state) return null;
  return { param: "state", from: oldS.state, to: newS.state };
}

function diffAttrs(oldS, newS, domain) {
  // Returns first meaningful attribute change as { param, from, to }
  const keys = {
    climate:      ["temperature", "hvac_mode", "fan_mode", "preset_mode"],
    light:        ["brightness", "color_temp"],
    fan:          ["percentage"],
    cover:        ["current_position"],
    media_player: ["media_title", "volume_level"],
    input_number: ["state"], number: ["state"],
    input_select: ["state"], select: ["state"],
  };
  const check = keys[domain];
  if (!check || !oldS) return null;
  const oA = oldS.attributes || {}, nA = newS.attributes || {};
  for (const k of check) {
    const ov = k === "state" ? oldS.state : oA[k];
    const nv = k === "state" ? newS.state : nA[k];
    if (ov !== undefined && nv !== undefined && ov !== nv) {
      // Humanise brightness to %
      let label = k, from = ov, to = nv;
      if (k === "brightness") { label = "brightness"; from = Math.round(ov/255*100)+"%"; to = Math.round(nv/255*100)+"%"; }
      else if (k === "temperature") { label = "temp"; from = ov+"°"; to = nv+"°"; }
      else if (k === "current_position") { label = "position"; from = ov+"%"; to = nv+"%"; }
      else if (k === "percentage") { label = "power"; from = ov+"%"; to = nv+"%"; }
      else if (k === "volume_level") { label = "volume"; from = Math.round(ov*100)+"%"; to = Math.round(nv*100)+"%"; }
      return { param: label, from, to };
    }
  }
  return null;
}

// ─── Card ───────────────────────────────────────────

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
          {
            name: "domains",
            selector: {
              select: {
                multiple: true,
                custom_value: true,
                options: [
                  { value: "light",       label: "Lights" },
                  { value: "switch",      label: "Switches" },
                  { value: "climate",     label: "Climate" },
                  { value: "cover",       label: "Covers" },
                  { value: "fan",         label: "Fans" },
                  { value: "lock",        label: "Locks" },
                  { value: "automation",  label: "Automations" },
                  { value: "scene",       label: "Scenes" },
                  { value: "media_player", label: "Media Players" },
                  { value: "vacuum",      label: "Vacuums" },
                  { value: "alarm_control_panel", label: "Alarms" },
                  { value: "input_boolean", label: "Input Booleans" },
                ],
                mode: "list",
              }
            }
          },
          { name: "max_items", selector: { number: { min: 0, max: 1000, step: 10, mode: "box" } } },
          { name: "max_hours", selector: { number: { min: 1, max: 168, step: 1, mode: "box" } } },
          {
            name: "refresh_interval",
            selector: {
              select: {
                options: [
                  { value: "0",   label: "Off" },
                  { value: "10",  label: "10 seconds" },
                  { value: "30",  label: "30 seconds" },
                  { value: "60",  label: "1 minute" },
                  { value: "300", label: "5 minutes" },
                ],
                mode: "dropdown",
              }
            }
          },
        ],
        labels: {
          name: "Card Title",
          domains: "Tracked Domains",
          max_items: "Max Entries (0 = unlimited)",
          max_hours: "Max Age (hours)",
          refresh_interval: "Refresh Interval",
        },
      };
    }
    static async getConfigElement() { return await JellyCardBase.getConfigElement.call(this); }
    static getStubConfig() {
      return {
        type: "custom:jelly-activity-card",
        domains: [...DEFAULT_DOMAINS],
        max_items: 0,
        max_hours: 48,
        refresh_interval: "30",
      };
    }

    // ─── Lifecycle ──────────────────────────────────────

    async setConfig(config) {
      this.config = { ...config };
      this._domains = new Set(config.domains || DEFAULT_DOMAINS);
      this._buckets = this._resolveBuckets(config.time_buckets);
      const maxItems = Number(config.max_items) || 0;
      this._maxItems = maxItems > 0 ? maxItems : Infinity;
      this._maxHoursMs = (Number(config.max_hours) || 48) * 3_600_000;
      this._events = this._loadStorage();
      this._startedAt = this._events.length ? null : Date.now();
      await this._ensureAssets();
      this._applyCardDimensions();
      this._startRefresh(Number(config.refresh_interval) || 30);
      this.render?.();
    }

    set hass(hass) {
      const first = !this._hass;
      super.hass = hass;
      if (first && hass) this._subscribe(hass);
    }

    disconnectedCallback() {
      this._stopRefresh();
      this._unsubscribe();
      super.disconnectedCallback();
    }

    afterLoad() {
      this.$title = this.qs(".title");
      this.$list = this.qs(".activity-list");
    }

    // ─── WebSocket subscription ─────────────────────────

    _subscribe(hass) {
      if (this._unsub) return;
      try {
        this._unsub = hass.connection.subscribeEvents(
          e => this._handleEvent(e), "state_changed"
        );
      } catch (_) { /* connection not ready yet — hass setter will retry */ }
    }

    _unsubscribe() {
      if (this._unsub) {
        // subscribeEvents returns a promise that resolves to an unsubscribe fn
        Promise.resolve(this._unsub).then(fn => fn?.());
        this._unsub = null;
      }
    }

    _handleEvent(evt) {
      const d = evt.data;
      if (!d?.entity_id) return;
      const domain = d.entity_id.split(".")[0];
      if (!this._domains.has(domain)) return;

      const newS = d.new_state;
      const oldS = d.old_state;
      if (!newS) return; // entity removed

      const name = newS.attributes?.friendly_name || d.entity_id;
      const icon = newS.attributes?.icon || DOMAIN_ICONS[domain] || "mdi:help-circle";
      const state = newS.state;
      const ts = Date.now();

      // Classify row icon state
      let iconState = "";
      if (ON_DOMAINS.has(domain) && !["off","unavailable","idle","standby"].includes(state)) iconState = "on";
      else if (SETTING_DOMAINS.has(domain) && state !== "unavailable") iconState = "setting";

      // Build message parts
      // msgAccent: "on" for toggle on/off, "setting" for parameter changes
      const stateD = diffState(oldS, newS);
      const attrD  = diffAttrs(oldS, newS, domain);
      const verb   = STATE_LABELS[state] || state;

      // Domains that just "activate" — no meaningful from/to diff
      const ACTIVATE_DOMAINS = new Set(["scene", "automation", "script", "button"]);

      let msg;
      if (ACTIVATE_DOMAINS.has(domain)) {
        msg = { name, verb: "activated", accent: "on" };
      } else if (attrD) {
        msg = { name, verb, param: attrD.param, from: attrD.from, to: attrD.to, accent: "setting" };
      } else if (stateD && (stateD.to === "on" || stateD.to === "off")) {
        msg = { name, verb, toggle: stateD.to, accent: "on" };
      } else if (stateD) {
        msg = { name, verb, param: "state", from: STATE_LABELS[stateD.from] || stateD.from, to: STATE_LABELS[stateD.to] || stateD.to, accent: "setting" };
      } else {
        msg = { name, verb, accent: iconState || "" };
      }

      this._events.unshift({ ts, entityId: d.entity_id, icon, domain, state, iconState, msg });
      this._trim();
      this._saveStorage();
      this._startedAt = null; // we have events now
      this.render?.();
    }

    // ─── Storage ────────────────────────────────────────

    _loadStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch { return []; }
    }

    _saveStorage() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._events)); } catch {}
    }

    _trim() {
      const now = Date.now();
      if (this._maxHoursMs < Infinity) {
        this._events = this._events.filter(e => now - e.ts <= this._maxHoursMs);
      }
      if (this._maxItems < Infinity && this._events.length > this._maxItems) {
        this._events.length = this._maxItems;
      }
    }

    // ─── Refresh timer ──────────────────────────────────

    _startRefresh(interval) {
      this._stopRefresh();
      const ms = ((interval ?? 30) || 0) * 1000;
      if (ms > 0) this._refreshTimer = setInterval(() => this.render?.(), ms);
    }

    _stopRefresh() {
      if (this._refreshTimer) { clearInterval(this._refreshTimer); this._refreshTimer = null; }
    }

    // ─── Buckets ────────────────────────────────────────

    _resolveBuckets(custom) {
      if (!Array.isArray(custom) || !custom.length) return DEFAULT_BUCKETS;
      const b = custom.map(x => ({ title: x.title || "Other", seconds: x.seconds ?? Infinity }));
      if (b[b.length - 1].seconds !== Infinity) b.push({ title: "Older", seconds: Infinity });
      return b;
    }

    // ─── Render ─────────────────────────────────────────

    render() {
      if (!this.$title || !this.$list) return;
      this.$title.textContent = this.config?.name || this.config?.title || "Recent Activity";

      const now = Date.now();
      this._trim(); // prune stale before render

      if (!this._events.length) {
        const since = this._startedAt ? fmtTimestamp(new Date(this._startedAt)) : "now";
        this.$list.innerHTML =
          `<div class="time-separator"><span class="sep-label">Listening since ${since}</span>` +
          `<div class="sep-line"></div></div>` +
          `<div class="empty-hint">Events will appear here as they happen</div>`;
        return;
      }

      const html = [];
      let curBucket = -1;

      for (const ev of this._events) {
        const agoS = (now - ev.ts) / 1000;

        // Bucket separator
        const bi = this._buckets.findIndex(b => agoS <= b.seconds);
        if (bi !== curBucket) {
          curBucket = bi;
          html.push(`<div class="time-separator"><span class="sep-label">${esc(this._buckets[bi]?.title || "Older")}</span><div class="sep-line"></div></div>`);
        }

        const m = ev.msg;
        const iconDs = ev.iconState ? ` data-state="${ev.iconState}"` : "";
        const ds = m.accent ? ` data-state="${m.accent}"` : "";

        // Build message HTML
        // - entity name: <strong> wrapped
        // - toggle on/off: "turned on/off" with .val accent=on
        // - attr diffs: "param from › to" with .param + .val accent=setting
        // - plain: "entity verb"
        let msgHtml;
        if (m.toggle) {
          msgHtml = `<strong class="entity-name">${esc(m.name)}</strong> turned <span class="val"${ds}>${esc(m.toggle)}</span>`;
        } else if (m.param && m.from !== undefined) {
          msgHtml = `<strong class="entity-name">${esc(m.name)}</strong> <span class="param"${ds}>${esc(m.param)}</span> <span class="val"${ds}>${esc(m.from)} › ${esc(m.to)}</span>`;
        } else {
          msgHtml = `<strong class="entity-name">${esc(m.name)}</strong> ${esc(m.verb)}`;
        }

        html.push(
          `<div class="activity-row"${iconDs}>` +
            `<div class="timeline-rail"></div>` +
            `<div class="activity-icon"><ha-icon icon="${ev.icon}"></ha-icon></div>` +
            `<div class="activity-body">` +
              `<span class="timestamp">${fmtTimestamp(new Date(ev.ts))} | ${fmtAgo(now - ev.ts)}</span>` +
              `<span class="message">${msgHtml}</span>` +
            `</div>` +
          `</div>`
        );
      }

      this.$list.innerHTML = html.join("");

      // Rail caps
      const rows = this.$list.querySelectorAll(".activity-row");
      if (rows.length) {
        rows[0].classList.add("first-row");
        rows[rows.length - 1].classList.add("last-row");
      }
    }
  }
);
