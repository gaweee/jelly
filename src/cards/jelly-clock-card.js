import JellyCardBase from "../jelly-base.js";

/**
 * Clock Card — 1×1 tile showing current time, date, day of week,
 * and a subtitle line. Primary-colored background.
 * No entity required — purely client-side clock.
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
      return null; // no entity needed
    }

    static get editorSchema() {
      return {
        schema: [
          {
            name: "show_time",
            selector: { boolean: {} }
          },
          {
            name: "invert",
            selector: { boolean: {} }
          },
          {
            name: "text_entity",
            selector: {
              entity: { domain: ["input_text"] }
            }
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
      return {
        type: "custom:jelly-clock-card",
        show_time: true
      };
    }

    getLayoutOptions() {
      return {
        grid_columns: 4,
        grid_min_columns: 2,
        grid_rows: 3,
        grid_min_rows: 1,
      };
    }

    /**
     * Override: entity is NOT required for this card.
     */
    async setConfig(config) {
      this.config = { show_time: true, ...config };
      await this._ensureAssets();
      this.render?.();
    }

    /** Clock card relies on HA grid sizing, not fixed card-height. */
    _applyCardDimensions() {
      // no-op — prevents base class from setting --jelly-card-height
    }

    afterLoad() {
      this.$card = this.qs(".clock-card");
      this.$time = this.qs(".clock-time");
      this.$date = this.qs(".clock-date");
      this.$day = this.qs(".clock-day");
      this.$subtitle = this.qs(".clock-subtitle");
      this.$icon = this.qs(".clock-icon");
      this._startClock();
    }

    _startClock() {
      if (this._clockInterval) return;
      this._clockInterval = setInterval(() => this.render?.(), 1000);
    }

    render() {
      if (!this.$card) return;

      // Invert colors
      this.$card.setAttribute("data-invert", this.config?.invert ? "true" : "false");

      const now = new Date();

      // Time
      const showTime = this.config?.show_time !== false;
      if (showTime) {
        const h = String(now.getHours()).padStart(2, "0");
        const m = String(now.getMinutes()).padStart(2, "0");
        this.$time.textContent = `${h}:${m}`;
        this.$time.classList.remove("hidden");
      } else {
        this.$time.classList.add("hidden");
      }

      // Date — e.g. "Thu, 13 Feb"
      const dayName = DAYS_FULL[now.getDay()];
      const dayNum = now.getDate();
      const month = MONTHS[now.getMonth()];
      this.$date.textContent = `${dayNum} ${month}`;

      // Day of week
      this.$day.textContent = dayName;

      // Subtitle from input_text entity
      const textEntity = this.config?.text_entity;
      if (textEntity && this._hass?.states?.[textEntity]) {
        this.$subtitle.textContent = this._hass.states[textEntity].state || "";
        this.$subtitle.style.display = "";
      } else if (textEntity) {
        this.$subtitle.textContent = "";
        this.$subtitle.style.display = "none";
      } else {
        this.$subtitle.textContent = "";
        this.$subtitle.style.display = "none";
      }
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
