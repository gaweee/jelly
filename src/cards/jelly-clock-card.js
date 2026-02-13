import JellyCardBase from "../jelly-base.js";

/**
 * Clock Card — time, date, day of week, and optional subtitle.
 * No entity required — purely client-side clock.
 * Follows generic card sizing contract: HA grid owns height.
 */

const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

customElements.define(
  "jelly-clock-card",
  class JellyClockCard extends JellyCardBase {

    static minUnits = 1;

    static get cardTag() {
      return "jelly-clock-card";
    }

    static get cardDomains() {
      return null;
    }

    static get editorSchema() {
      return {
        schema: [
          { name: "show_time", selector: { boolean: {} } },
          { name: "invert", selector: { boolean: {} } },
          {
            name: "text_entity",
            selector: { entity: { domain: ["input_text"] } }
          }
        ],
        labels: {
          show_time: "Show Time",
          invert: "Invert Colors",
          text_entity: "Subtitle Text Entity (input_text helper)"
        }
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig() {
      return { type: "custom:jelly-clock-card", show_time: true };
    }

    getLayoutOptions() {
      return {
        grid_columns: 4,
        grid_min_columns: 2,
        grid_rows: 3,
        grid_min_rows: 1,
      };
    }

    /** Override: entity is NOT required for this card. */
    async setConfig(config) {
      this.config = { show_time: true, ...config };
      await this._ensureAssets();
      this.render?.();
    }

    /** No-op: HA grid rows are the sole height authority. */
    _applyCardDimensions() {}

    afterLoad() {
      this.$card = this.qs(".card");
      this.$time = this.qs(".time");
      this.$date = this.qs(".date");
      this.$day = this.qs(".day");
      this.$subtitle = this.qs(".subtitle");
      this._startClock();
    }

    _startClock() {
      if (this._clockInterval) return;
      this._clockInterval = setInterval(() => this.render?.(), 1000);
    }

    render() {
      if (!this.$card) return;

      // Invert utility class
      this.$card.classList.toggle("invert", !!this.config?.invert);

      const now = new Date();

      // Time
      if (this.config?.show_time !== false) {
        const h = String(now.getHours()).padStart(2, "0");
        const m = String(now.getMinutes()).padStart(2, "0");
        this.$time.textContent = `${h}:${m}`;
        this.$time.classList.remove("hidden");
      } else {
        this.$time.classList.add("hidden");
      }

      // Date
      const dateStr = `${now.getDate()} ${MONTHS[now.getMonth()]}`;
      this.$date.textContent = dateStr;

      // Day
      this.$day.textContent = DAYS_FULL[now.getDay()];

      // Subtitle
      const textEntity = this.config?.text_entity;
      const subtitleText = textEntity && this._hass?.states?.[textEntity]
        ? this._hass.states[textEntity].state || ""
        : "";
      this.$subtitle.textContent = subtitleText;
    }

    disconnectedCallback() {
      if (this._clockInterval) {
        clearInterval(this._clockInterval);
        this._clockInterval = null;
      }
      super.disconnectedCallback();
    }
  }
);
