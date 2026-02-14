import JellyCardBase from "../jelly-base.js";

/**
 * Activity Card — scrollable timeline of recent smart home events.
 * Minimal JS scaffold; HTML/CSS carry the visual design.
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

    /**
     * No entity required — load assets without entity validation.
     */
    async setConfig(config) {
      this.config = { ...config };
      await this._ensureAssets();
      this._applyCardDimensions();
      this.render?.();
    }

    afterLoad() {
      this.$title = this.qs(".title");
    }

    render() {
      if (!this.$title) return;
      this.$title.textContent = this.config?.name || "Recent Activity";
    }
  }
);
