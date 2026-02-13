import JellyCardBase from "../jelly-base.js";
import { executeShortcut } from "../utils/automation-utils.js";

/**
 * Knob Card — circular arc knob control with spokes, pointer, +/- buttons,
 * optional shortcuts, toggle, prefix icon, and suffix unit.
 * Knob arc from test.html; card chrome matches HVAC + Device cards.
 */
customElements.define(
  "jelly-knob-card",
  class JellyKnobCard extends JellyCardBase {

    // ─── Constants ───────────────────────────────────────────────
    static DEFAULT_MIN = 16;
    static DEFAULT_MAX = 32;
    static DEFAULT_STEP = 0.5;
    static MAX_SHORTCUTS = 4;
    static minUnits = 4;

    // Knob geometry (SVG viewBox 260×260)
    static ARC_START = 220;           // degrees — bottom-left
    static ARC_END   = 140 + 360;    // degrees — bottom-right (clockwise)
    static ARC_RADIUS = 100;          // spoke mid-radius
    static SVG_CENTER = 130;
    static SPOKE_COUNT = 40;
    static OUTER_PAD = 18;            // gap from spokes to outer arc

    /** @returns {string} */
    static get cardTag() { return "jelly-knob-card"; }

    /** @returns {string[]} Preferred entity domains */
    static get cardDomains() {
      return ["climate", "number", "input_number", "fan", "light"];
    }

    // ─── Editor Schema ──────────────────────────────────────────

    static get editorSchema() {
      return (config) => {
        const schema = [
          { name: "entity", selector: { entity: { domain: ["climate", "number", "input_number", "fan", "light"] } } },
          { name: "name", selector: { text: {} } },
          { name: "icon", selector: { icon: {} } },
          { name: "unit", selector: { text: {} } },
          { name: "min", selector: { number: { min: -100, max: 500, step: 0.5, mode: "box" } } },
          { name: "max", selector: { number: { min: -100, max: 500, step: 0.5, mode: "box" } } },
          { name: "step", selector: { number: { min: 0.1, max: 50, step: 0.1, mode: "box" } } },
          { name: "script", selector: { entity: { domain: ["script"] } } },
        ];

        const labels = {
          entity: "Entity",
          name: "Display Name (optional)",
          icon: "Prefix Icon (optional)",
          unit: "Unit (e.g. °C, %, lux)",
          min: "Minimum Value",
          max: "Maximum Value",
          step: "Step Increment",
          script: "Script to call on change (optional, receives value + unit)",
        };

        for (let i = 1; i <= JellyKnobCard.MAX_SHORTCUTS; i++) {
          const entityKey = `shortcut_${i}_automation`;
          const isScript = config?.[entityKey]?.startsWith("script.");

          schema.push(
            { name: entityKey, selector: { entity: { domain: ["automation", "script", "scene", "button"] } } },
            { name: `shortcut_${i}_name`, selector: { text: {} } },
            { name: `shortcut_${i}_icon`, selector: { icon: {} } },
          );

          if (isScript) {
            schema.push({ name: `shortcut_${i}_parameter`, selector: { text: {} } });
            labels[`shortcut_${i}_parameter`] = `Shortcut ${i} - Parameters (JSON)`;
          }

          labels[entityKey] = `Shortcut ${i} - Entity`;
          labels[`shortcut_${i}_name`] = `Shortcut ${i} - Name`;
          labels[`shortcut_${i}_icon`] = `Shortcut ${i} - Icon`;
        }

        return { schema, labels };
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig(hass) {
      return JellyCardBase.getStubConfig.call(this, hass);
    }

    // ─── Config Validation ──────────────────────────────────────

    validateConfig(config) {
      if (!config.entity) {
        console.warn("Jelly Knob Card: entity is required");
      }
    }

    // ─── Lifecycle ──────────────────────────────────────────────

    afterLoad() {
      this.$card       = this.qs(".knob-card");
      this.$name       = this.qs(".device-name");
      this.$status     = this.qs(".device-status");
      this.$value      = this.qs(".knob-value");
      this.$unit       = this.qs(".knob-unit");
      this.$icon       = this.qs(".prefix-icon");
      this.$toggle     = this.qs(".toggle-indicator");
      this.$svg        = this.qs(".knob-svg");
      this.$spokes     = this.qs(".knob-spokes");
      this.$outerArc   = this.qs(".knob-outer-arc");
      this.$pointer    = this.qs(".knob-pointer");
      this.$minLabel   = this.qs(".knob-min");
      this.$maxLabel   = this.qs(".knob-max");
      this.$decr       = this.qs(".knob-decr");
      this.$incr       = this.qs(".knob-incr");
      this.$shortcuts  = this.qs(".shortcuts");

      this._currentValue = null;
      this._initKnob();

      // Toggle tap
      if (this.$toggle) {
        this.bindInteractions(this.$toggle, {
          onTap: () => this._handleToggle()
        });
      }
    }

    // ─── Knob Interaction ───────────────────────────────────────

    _initKnob() {
      let dragging = false;

      const onDown = (e) => {
        dragging = true;
        this.$svg.setPointerCapture(e.pointerId);
      };

      const onMove = (e) => {
        if (!dragging) return;
        const rect = this.$svg.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const x = e.clientX - rect.left - cx;
        const y = e.clientY - rect.top - cy;
        let angle = Math.atan2(y, x) * 180 / Math.PI + 90;
        if (angle < 0) angle += 360;

        const { ARC_START, ARC_END } = JellyKnobCard;
        let normAngle = angle < ARC_START ? angle + 360 : angle;
        if (normAngle < ARC_START || normAngle > ARC_END) return;

        const temp = this._angleToValue(angle);
        this._setValueOptimistic(temp);
      };

      const onUp = (e) => {
        if (!dragging) return;
        dragging = false;
        try { this.$svg.releasePointerCapture(e.pointerId); } catch {}
        // Commit value to HA
        if (this._currentValue != null) {
          this._sendValue(this._currentValue);
        }
      };

      this.$svg.addEventListener("pointerdown", onDown);
      this.$svg.addEventListener("pointermove", onMove);
      this.$svg.addEventListener("pointerup", onUp);
      this.$svg.addEventListener("pointercancel", onUp);

      // +/- buttons
      const flash = (btn) => {
        btn.classList.add("flash");
        setTimeout(() => btn.classList.remove("flash"), 120);
      };

      this.$decr.addEventListener("click", (e) => {
        e.stopPropagation();
        flash(this.$decr);
        const step = this._getStep();
        const min = this._getMin();
        const next = Math.max(min, (this._currentValue ?? min) - step);
        this._setValueOptimistic(next);
        this._sendValue(next);
      });

      this.$incr.addEventListener("click", (e) => {
        e.stopPropagation();
        flash(this.$incr);
        const step = this._getStep();
        const max = this._getMax();
        const next = Math.min(max, (this._currentValue ?? max) + step);
        this._setValueOptimistic(next);
        this._sendValue(next);
      });

      this._unbindKnob = () => {
        this.$svg.removeEventListener("pointerdown", onDown);
        this.$svg.removeEventListener("pointermove", onMove);
        this.$svg.removeEventListener("pointerup", onUp);
        this.$svg.removeEventListener("pointercancel", onUp);
      };
    }

    // ─── Value Helpers ──────────────────────────────────────────

    _getMin() {
      if (this.config.min != null) return Number(this.config.min);
      const entity = this.stateObj();
      return entity?.attributes?.min_temp ?? entity?.attributes?.min ?? JellyKnobCard.DEFAULT_MIN;
    }

    _getMax() {
      if (this.config.max != null) return Number(this.config.max);
      const entity = this.stateObj();
      return entity?.attributes?.max_temp ?? entity?.attributes?.max ?? JellyKnobCard.DEFAULT_MAX;
    }

    _getStep() {
      if (this.config.step != null) return Number(this.config.step);
      const entity = this.stateObj();
      return entity?.attributes?.step ?? JellyKnobCard.DEFAULT_STEP;
    }

    _getCurrentValue() {
      const entity = this.stateObj();
      if (!entity) return this._getMin();

      // Climate: temperature attribute
      if (entity.attributes.temperature != null) {
        return Number(entity.attributes.temperature);
      }

      // Number / input_number / fan / light: state itself
      const val = Number(entity.state);
      return isNaN(val) ? this._getMin() : val;
    }

    _getUnit() {
      if (this.config.unit != null) return this.config.unit;
      const entity = this.stateObj();
      return entity?.attributes?.unit_of_measurement || "";
    }

    // ─── Knob Angle Math ────────────────────────────────────────

    _valueToAngle(val) {
      const { ARC_START, ARC_END } = JellyKnobCard;
      const sweep = ARC_END - ARC_START;
      const min = this._getMin();
      const max = this._getMax();
      return (ARC_START + ((val - min) / (max - min)) * sweep) % 360;
    }

    _angleToValue(angle) {
      const { ARC_START, ARC_END } = JellyKnobCard;
      const sweep = ARC_END - ARC_START;
      const min = this._getMin();
      const max = this._getMax();
      const step = this._getStep();
      let normAngle = angle < ARC_START ? angle + 360 : angle;
      let raw = (normAngle - ARC_START) / sweep * (max - min) + min;
      raw = Math.round(raw / step) * step;
      return Math.max(min, Math.min(max, raw));
    }

    _polarToXY(angle, radius) {
      const { SVG_CENTER } = JellyKnobCard;
      const rad = (angle - 90) * Math.PI / 180;
      return [SVG_CENTER + radius * Math.cos(rad), SVG_CENTER + radius * Math.sin(rad)];
    }

    // ─── Draw Knob ──────────────────────────────────────────────

    _drawKnob(value) {
      const { ARC_START, ARC_END, ARC_RADIUS, SVG_CENTER, SPOKE_COUNT, OUTER_PAD } = JellyKnobCard;
      const sweep = ARC_END - ARC_START;
      const outerRadius = ARC_RADIUS + OUTER_PAD;

      // Outer arc
      const [ox0, oy0] = this._polarToXY(ARC_START, outerRadius);
      const [ox1, oy1] = this._polarToXY(ARC_END, outerRadius);
      const largeArc = sweep > 180 ? 1 : 0;
      this.$outerArc.setAttribute("d", `M${ox0},${oy0} A${outerRadius},${outerRadius} 0 ${largeArc} 1 ${ox1},${oy1}`);

      // Spokes
      const tempAngle = this._valueToAngle(value);
      let endAngle = tempAngle < ARC_START ? tempAngle + 360 : tempAngle;
      this.$spokes.innerHTML = "";

      for (let i = 0; i < SPOKE_COUNT; i++) {
        const frac = i / (SPOKE_COUNT - 1);
        const angle = (ARC_START + frac * sweep) % 360;
        const drawAngle = angle < ARC_START ? angle + 360 : angle;
        if (drawAngle > endAngle) break;

        // Pulse: spokes near pointer extend inward
        const distFromPointer = Math.abs(drawAngle - endAngle);
        const pulseExtra = Math.max(0, 10 - distFromPointer * 0.5) * 1.2;
        const innerR = ARC_RADIUS - 3 - pulseExtra;

        const [x0, y0] = this._polarToXY(angle, innerR);
        const [x1, y1] = this._polarToXY(angle, ARC_RADIUS + 8);
        const spoke = document.createElementNS("http://www.w3.org/2000/svg", "line");
        spoke.setAttribute("x1", x0);
        spoke.setAttribute("y1", y0);
        spoke.setAttribute("x2", x1);
        spoke.setAttribute("y2", y1);
        spoke.setAttribute("stroke-width", "3");
        this.$spokes.appendChild(spoke);
      }

      // Pointer — small triangle, 3:2 base:height, facing inward
      const pointerRad = (tempAngle - 90) * Math.PI / 180;
      const pointerHeight = 8;
      const halfBase = 6;
      const tipR = outerRadius - 2;
      const baseR = outerRadius - 2 + pointerHeight;
      const tipX = SVG_CENTER + tipR * Math.cos(pointerRad);
      const tipY = SVG_CENTER + tipR * Math.sin(pointerRad);
      const perpRad = pointerRad + Math.PI / 2;
      const bx1 = SVG_CENTER + baseR * Math.cos(pointerRad) + halfBase * Math.cos(perpRad);
      const by1 = SVG_CENTER + baseR * Math.sin(pointerRad) + halfBase * Math.sin(perpRad);
      const bx2 = SVG_CENTER + baseR * Math.cos(pointerRad) - halfBase * Math.cos(perpRad);
      const by2 = SVG_CENTER + baseR * Math.sin(pointerRad) - halfBase * Math.sin(perpRad);
      this.$pointer.setAttribute("points", `${tipX},${tipY} ${bx1},${by1} ${bx2},${by2}`);

      // Min/max labels
      const min = this._getMin();
      const max = this._getMax();
      const unit = this._getUnit();
      this.$minLabel.textContent = `${min}${unit}`;
      this.$maxLabel.textContent = `${max}${unit}`;

      // Center value readout
      const step = this._getStep();
      const decimals = step < 1 ? 1 : 0;
      if (this.$value) this.$value.textContent = value.toFixed(decimals);
      if (this.$unit) this.$unit.textContent = unit;
    }

    // ─── Optimistic Value Update ────────────────────────────────

    _setValueOptimistic(val) {
      const step = this._getStep();
      this._currentValue = Math.round(val / step) * step;
      this._drawKnob(this._currentValue);
    }

    _sendValue(val) {
      const entity = this.stateObj();
      if (!entity) return;

      const domain = this.config.entity.split(".")[0];
      const unit = this._getUnit();

      // If a script is configured, call it with value + unit
      if (this.config.script) {
        this.callService("script", "turn_on", {
          entity_id: this.config.script,
          variables: { value: val, unit },
        });
        return;
      }

      // Otherwise use domain-specific services
      if (domain === "climate") {
        this.callService("climate", "set_temperature", {
          entity_id: this.config.entity,
          temperature: val,
        });
      } else if (domain === "number" || domain === "input_number") {
        this.callService(domain, "set_value", {
          entity_id: this.config.entity,
          value: val,
        });
      } else if (domain === "fan") {
        this.callService("fan", "set_percentage", {
          entity_id: this.config.entity,
          percentage: val,
        });
      } else if (domain === "light") {
        this.callService("light", "turn_on", {
          entity_id: this.config.entity,
          brightness_pct: val,
        });
      }
    }

    // ─── Render ─────────────────────────────────────────────────

    render() {
      if (!this.hass || !this.config || !this.$card) return;

      const entity = this.stateObj();
      if (!entity) {
        this.$name.textContent = "Entity not found";
        this.$status.textContent = this.config.entity;
        this.$card.setAttribute("data-state", "unavailable");
        return;
      }

      const domain = this.config.entity.split(".")[0];
      const state = entity.state;
      const isOn = state !== "off" && state !== "unavailable";
      const name = this.config.name || entity.attributes.friendly_name || this.config.entity;
      const value = this._getCurrentValue();

      // State
      if (domain === "climate") {
        this.$card.setAttribute("data-state", state);
      } else {
        this.$card.setAttribute("data-state", isOn ? "on" : "off");
      }

      // Icon
      const icon = this.config.icon || entity.attributes.icon || null;
      this.$card.setAttribute("data-has-icon", icon ? "true" : "false");
      if (icon && this.$icon) {
        this.$icon.setAttribute("icon", icon);
      }

      // Name + status inside knob
      this.$name.textContent = name;
      this.$status.textContent = this._getStatusText(state, domain);

      // Knob
      this._currentValue = value;
      this._drawKnob(value);

      // Shortcuts
      this._renderShortcuts();

      // Card height: 5 units if shortcuts, 4 otherwise
      this._applyDynamicHeight();
    }

    _getStatusText(state, domain) {
      if (domain === "climate") {
        const map = { heat: "Heating", cool: "Cooling", auto: "Auto", heat_cool: "Auto", dry: "Dry", fan_only: "Fan", off: "Off", unavailable: "Unavailable" };
        return map[state] || state;
      }
      return state === "off" ? "Off" : state === "unavailable" ? "Unavailable" : "On";
    }

    // ─── Dynamic Height ─────────────────────────────────────────

    _applyDynamicHeight() {
      const hasShortcuts = this._hasShortcuts();
      const units = hasShortcuts ? 5 : 4;
      const height = JellyCardBase.unitsToPx(units);
      const host = this.shadowRoot?.host || this;
      host.style.setProperty("--jelly-card-height", `${height}px`);
      host.style.setProperty("--jelly-card-units", String(units));
    }

    _hasShortcuts() {
      for (let i = 1; i <= JellyKnobCard.MAX_SHORTCUTS; i++) {
        if (this.config[`shortcut_${i}_automation`]) return true;
      }
      return false;
    }

    getLayoutOptions() {
      const rows = this._hasShortcuts() ? 5 : 4;
      return { grid_columns: 4, grid_min_columns: 2, grid_rows: rows, grid_min_rows: 4 };
    }

    getCardSize() {
      return this._hasShortcuts() ? 5 : 4;
    }

    // ─── Shortcuts ───────────────────────────────────────────────

    _renderShortcuts() {
      const shortcuts = [];
      for (let i = 1; i <= JellyKnobCard.MAX_SHORTCUTS; i++) {
        const automation = this.config[`shortcut_${i}_automation`];
        const name = this.config[`shortcut_${i}_name`];
        const icon = this.config[`shortcut_${i}_icon`];
        const parameter = this.config[`shortcut_${i}_parameter`];
        if (automation) shortcuts.push({ automation, name, icon, parameter, index: i });
      }

      if (shortcuts.length > 0) {
        this.$shortcuts.innerHTML = shortcuts.map((s) => {
          const displayName = s.name || "Action";
          const displayIcon = s.icon || "mdi:gesture-tap";
          return `
            <button class="shortcut" data-index="${s.index}">
              <ha-icon icon="${displayIcon}"></ha-icon>
              <span class="t-label">${displayName}</span>
            </button>
          `;
        }).join("");
        this.$shortcuts.style.display = "grid";

        shortcuts.forEach((s) => {
          const btn = this.qs(`.shortcut[data-index="${s.index}"]`);
          if (btn) {
            const stop = (e) => e.stopPropagation();
            btn.addEventListener("pointerdown", stop);
            btn.addEventListener("pointerup", stop);
            btn.addEventListener("click", (e) => {
              stop(e);
              executeShortcut(this.hass, s);
            });
          }
        });
      } else {
        this.$shortcuts.style.display = "none";
      }
    }

    // ─── Toggle ──────────────────────────────────────────────────

    _handleToggle() {
      const entity = this.stateObj();
      if (!entity) return;
      if (entity.state === "unavailable" || entity.state === "unknown") return;

      const domain = this.config.entity.split(".")[0];

      if (domain === "climate") {
        const isOff = entity.state === "off";
        const svc = isOff ? "turn_on" : "turn_off";
        this.callService("climate", svc, { entity_id: this.config.entity });

        this.optimisticToggle({
          sendToggle: false,
          desiredState: isOff ? "auto" : "off",
          applyOptimistic: () => {
            this.$card.setAttribute("data-state", isOff ? "auto" : "off");
            this.$status.textContent = isOff ? "Auto" : "Off";
          },
          rollback: () => this.render(),
          confirm: (next) => isOff ? next?.state !== "off" : next?.state === "off",
        });
      } else {
        const desiredState = entity.state === "off" ? "on" : "off";
        this.optimisticToggle({
          desiredState,
          applyOptimistic: () => {
            this.$card.setAttribute("data-state", desiredState);
            this.$status.textContent = desiredState === "on" ? "On" : "Off";
          },
          rollback: () => this.render(),
          confirm: (next) => {
            const nextIsOn = next?.state !== "off" && next?.state !== "unavailable";
            return nextIsOn === (desiredState === "on");
          },
        });
      }
    }

    // ─── Cleanup ─────────────────────────────────────────────────

    disconnectedCallback() {
      this._unbindKnob?.();
      super.disconnectedCallback();
    }
  }
);
