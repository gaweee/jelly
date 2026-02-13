import JellyCardBase from "../jelly-base.js";

/**
 * Generic Card — minimal reference card with title and toggle.
 * Serves as the canonical implementation of the Jelly height-sizing contract.
 */
customElements.define(
  "jelly-generic-card",
  class JellyGenericCard extends JellyCardBase {

    static minUnits = 1;

    static get cardTag() { return "jelly-generic-card"; }

    static get cardDomains() {
      return ["switch", "light", "fan", "input_boolean"];
    }

    static get editorSchema() {
      return {
        schema: [
          {
            name: "entity",
            selector: {
              entity: {
                domain: ["switch", "light", "fan", "input_boolean"]
              }
            }
          },
          { name: "name", selector: { text: {} } },
        ],
        labels: {
          entity: "Toggle Entity",
          name: "Display Name (optional)",
        }
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig(hass) {
      return JellyCardBase.getStubConfig.call(this, hass);
    }

    /**
     * No-op: HA grid rows are the sole height authority.
     * No --jelly-card-height, no min-height competition.
     */
    _applyCardDimensions() {}

    afterLoad() {
      this.$card = this.qs(".card");
      this.$title = this.qs(".title");
      this.$toggle = this.qs(".toggle");

      this.bindInteractions(this.$toggle, {
        onTap: () => this._handleToggle()
      });
    }

    render() {
      if (!this.hass || !this.config || !this.$card) return;

      const entity = this.stateObj();
      if (!entity) {
        this.$title.textContent = "Entity not found";
        this.$card.setAttribute("data-state", "unavailable");
        return;
      }

      const isOn = entity.state !== "off" && entity.state !== "unavailable";
      this.$card.setAttribute("data-state", isOn ? "on" : "off");
      this.$title.textContent =
        this.config.name || entity.attributes.friendly_name || this.config.entity;
    }

    _handleToggle() {
      const entity = this.stateObj();
      if (!entity || entity.state === "unavailable" || entity.state === "unknown") return;

      const desiredState = entity.state === "off" ? "on" : "off";

      this.optimisticToggle({
        desiredState,
        applyOptimistic: () => {
          this.$card.setAttribute("data-state", desiredState);
        },
        rollback: () => this.render(),
        confirm: (next) => {
          const nextIsOn = next?.state !== "off" && next?.state !== "unavailable";
          return nextIsOn === (desiredState === "on");
        }
      });
    }

    disconnectedCallback() {
      super.disconnectedCallback();
    }
  }
);
