import JellyCardBase from "../jelly-base.js";

customElements.define(
  "jelly-light-button",
  class JellyLightButton extends JellyCardBase {
    static get cardTag() {
      return "jelly-light-button";
    }

    static get cardDomains() {
      return ["light", "switch", "input_boolean", "fan"]; // toggle-ish
    }

    // Per-widget editor fields (ha-form selector format)
    static get editorSchema() {
      return {
        schema: [
          { name: "entity", selector: { entity: { domain: this.cardDomains } } },
          { name: "name",   selector: { text: {} } },
        ],
        labels: {
          entity: "Entity",
          name:   "Display name (optional)",
        },
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig(hass) {
      return JellyCardBase.getStubConfig.call(this, hass);
    }

    afterLoad() {
      this.$btn = this.qs(".btn");
      this.$label = this.qs(".label");
      this.$state = this.qs(".state");
      this.$debug = this.qs(".debug");

      this._unbind = this.bindInteractions(this.$btn, {
        onTap: () => this._handleToggle("tap"),
        onDoubleTap: () => this._handleToggle("double"),
        onHold: () => this._handleHold(),
        onSwipe: (dir) => this._handleSwipe(dir)
      });
    }

    render() {
      if (!this.hass || !this.config || !this.$btn) return;

      const stateObj = this.stateObj();

      this.$btn.classList.remove("on", "off", "unavailable");

      if (!stateObj) {
        this.$label.textContent = "Entity not found";
        this.$state.textContent = "missing";
        this.$btn.classList.add("unavailable");
        return;
      }

      const state = stateObj.state;
      const name =
        this.config.name || stateObj.attributes.friendly_name || this.config.entity;

      this.$label.textContent = name;
      this.$state.textContent = state;

      if (state === "on") {
        this.$btn.classList.add("on");
      } else if (state === "off") {
        this.$btn.classList.add("off");
      } else {
        this.$btn.classList.add("unavailable");
      }
    }

    _handleToggle(kind = "tap") {
      const stateObj = this.stateObj();
      if (!stateObj) {
        console.warn("Jelly: No state for", this.config.entity);
        return;
      }

      if (stateObj.state === "unavailable" || stateObj.state === "unknown") {
        console.warn("Jelly: Entity unavailable", this.config.entity);
        return;
      }

      const desiredState = stateObj.state === "on" ? "off" : "on";

      this.optimisticToggle({
        desiredState,
        applyOptimistic: () => {
          this.$btn.classList.toggle("on", desiredState === "on");
          this.$btn.classList.toggle("off", desiredState === "off");
          this.$state.textContent = desiredState;
        },
        rollback: () => this.render(),
        confirm: (next) => next?.state === desiredState
      });

      this.setDebugText(`toggle via ${kind}`);
    }

    _handleHold() {
      this.setAnimState("hold");
      this.setDebugText("hold");
      setTimeout(() => this.setAnimState(null), 400);
    }

    _handleSwipe(dir) {
      this.setDebugText(`swipe ${dir}`);
      this.setAnimState(`swipe-${dir}`);
      setTimeout(() => this.setAnimState(null), 300);
    }

    disconnectedCallback() {
      this._unbind?.();
      super.disconnectedCallback();
    }
  }
);
