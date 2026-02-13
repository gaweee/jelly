import JellyCardBase from "../jelly-base.js";
import { computeStatus } from "../utils/status-utils.js";

/**
 * Toggle Card - 1x1 compact toggle with optional image, name, and status
 * Supports any toggle-type entity (switch, light, fan, input_boolean)
 */
customElements.define(
  "jelly-toggle-card",
  class JellyToggleCard extends JellyCardBase {
    /** @returns {string} Card HTML tag name */
    static get cardTag() {
      return "jelly-toggle-card";
    }

    /** @returns {string[]} Preferred entity domains for this card */
    static get cardDomains() {
      return ["switch", "light", "fan", "input_boolean"];
    }

    /**
     * Returns editor schema for card configuration
     * @returns {Object} Schema and labels for ha-form
     */
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
          {
            name: "name",
            selector: { text: {} }
          },
          {
            name: "image",
            selector: {
              text: {
                type: "url"
              }
            }
          },
          {
            name: "icon",
            selector: { icon: {} }
          }
        ],
        labels: {
          entity: "Toggle Entity",
          name: "Display Name (optional)",
          image: "Image Path (e.g., /local/device.png - upload via Media)",
          icon: "Icon (optional, used when no image set)"
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
     * Called after HTML/CSS assets are loaded
     * Sets up DOM references and interaction handlers
     */
    afterLoad() {
      this.$card = this.qs(".card");
      this.$content = this.qs(".content");
      this.$image = this.qs(".image img");
      this.$imagePlaceholder = this.qs(".image-placeholder");
      this.$icon = this.qs(".entity-icon");
      this.$title = this.qs(".title");
      this.$status = this.qs(".status");

      this._unbind = this.bindInteractions(this.$content, {
        onTap: () => this._handleToggle()
      });
    }

    /**
     * Renders the card with current entity state
     * Updates display name, status, image/icon
     */
    render() {
      if (!this.hass || !this.config || !this.$card) return;

      const entity = this.stateObj();
      if (!entity) {
        this.$title.textContent = "Entity not found";
        this.$status.textContent = this.config.entity;
        this.$card.setAttribute("data-state", "unavailable");
        return;
      }

      const isOn = entity.state !== "off" && entity.state !== "unavailable";
      const name = this.config.name || entity.attributes.friendly_name || this.config.entity;
      const status = computeStatus(entity);

      this.$card.setAttribute("data-state", isOn ? "on" : "off");
      this.$title.textContent = name;
      this.$status.textContent = status;

      // Handle image (priority) or icon fallback
      if (this.config.image) {
        this.$image.src = this.config.image;
        this.$image.alt = name;
        this.$image.style.display = "block";
        this.$imagePlaceholder.style.display = "none";
      } else {
        this.$image.style.display = "none";
        this.$imagePlaceholder.style.display = "flex";

        // Use custom icon, entity icon, or domain default
        const icon = this.config.icon
          || entity.attributes.icon
          || this._domainIcon(entity.entity_id);
        this.$icon.setAttribute("icon", icon);
      }
    }

    /**
     * Returns a default icon based on entity domain
     * @param {string} entityId - Entity ID
     * @returns {string} MDI icon string
     * @private
     */
    _domainIcon(entityId) {
      const domain = entityId?.split(".")?.[0];
      const icons = {
        switch: "mdi:toggle-switch",
        light: "mdi:lightbulb",
        fan: "mdi:fan",
        input_boolean: "mdi:toggle-switch-outline"
      };
      return icons[domain] || "mdi:toggle-switch";
    }

    /**
     * Handles tap to toggle entity on/off
     * Uses optimistic UI updates for immediate feedback
     * @private
     */
    _handleToggle() {
      const entity = this.stateObj();
      if (!entity) return;

      if (entity.state === "unavailable" || entity.state === "unknown") {
        console.warn("Jelly: Entity unavailable", this.config.entity);
        return;
      }

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
        }
      });
    }

    disconnectedCallback() {
      this._unbind?.();
      super.disconnectedCallback();
    }
  }
);
