import JellyCardBase from "../jelly-base.js";
import { computeStatus } from "../utils/status-utils.js";
import { executeShortcut } from "../utils/automation-utils.js";

/**
 * Device Card - Displays a device with image, toggle, status, and up to 4 action shortcuts
 * Supports responsive layouts and device-agnostic status computation
 */
customElements.define(
  "jelly-device-card",
  class JellyDeviceCard extends JellyCardBase {
    // Constants
    static MAX_SHORTCUTS = 4;

    /** @returns {string} Card HTML tag name */
    static get cardTag() {
      return "jelly-device-card";
    }

    /** @returns {string[]} Preferred entity domains for this card */
    static get cardDomains() {
      return ["fan", "light", "switch", "climate", "input_boolean"];
    }

    /**
     * Returns dynamic schema generator for card editor
     * Schema adapts based on config: parameter fields only show for scripts
     * @returns {Function} Function that takes config and returns {schema, labels}
     */
    static get editorSchema() {
      return (config) => {
        const schema = [
          {
            name: "entity",
            selector: { 
              entity: { 
                domain: ["light", "switch", "fan", "input_boolean", "climate"]
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
          }
        ];

        const labels = {
          entity: "Toggle Entity",
          name: "Display Name (optional)",
          image: "Image Path (e.g., /local/device.png - upload via Media)"
        };

        // Add fields for each shortcut
        for (let i = 1; i <= JellyDeviceCard.MAX_SHORTCUTS; i++) {
          const entityKey = `shortcut_${i}_automation`;
          const isScript = config[entityKey]?.startsWith('script.');

          schema.push({
            name: entityKey,
            selector: { 
              entity: { 
                domain: ["automation","script","scene","button"] 
              } 
            }
          });
          schema.push({
            name: `shortcut_${i}_name`,
            selector: { text: {} }
          });
          schema.push({
            name: `shortcut_${i}_icon`,
            selector: { icon: {} }
          });

          // Only add parameter field if selected entity is a script
          if (isScript) {
            schema.push({
              name: `shortcut_${i}_parameter`,
              selector: { text: {} }
            });
            labels[`shortcut_${i}_parameter`] = `Shortcut ${i} - Parameters (JSON: {"key": "value"} or {"speed": 75})`;
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

    /**
     * Called after HTML/CSS assets are loaded
     * Sets up DOM references and interaction handlers
     */
    afterLoad() {
      this.$card = this.qs(".device-card");
      this.$cardContent = this.qs(".card-content");
      this.$imageContainer = this.qs(".device-image-container");
      this.$image = this.qs(".device-image");
      this.$imagePlaceholder = this.qs(".device-image-placeholder");
      this.$name = this.qs(".device-name");
      this.$status = this.qs(".device-status");
      this.$shortcutsContainer = this.qs(".shortcuts");

      this._unbind = this.bindInteractions(this.$cardContent, {
        onTap: () => this._handleToggle()
      });
    }

    /**
     * Renders the card with current entity state
     * Updates display name, status, image, and shortcuts
     */
    render() {
      if (!this.hass || !this.config || !this.$card) return;

      const entity = this.stateObj();
      if (!entity) {
        this.$name.textContent = "Entity not found";
        this.$status.textContent = this.config.entity;
        this.$card.setAttribute("data-state", "unavailable");
        return;
      }

      const isOn = entity.state !== "off" && entity.state !== "unavailable";
      const name = this.config.name || entity.attributes.friendly_name || this.config.entity;
      const status = computeStatus(entity);

      this.$card.setAttribute("data-state", isOn ? "on" : "off");
      this.$name.textContent = name;
      this.$status.textContent = status;

      // Handle image
      if (this.config.image) {
        this.$image.src = this.config.image;
        this.$image.alt = name;
        this.$image.style.display = "block";
        this.$imagePlaceholder.style.display = "none";
      } else {
        this.$image.style.display = "none";
        this.$imagePlaceholder.style.display = "flex";
      }

      // Handle shortcuts
      this._renderShortcuts();
    }

    /**
     * Renders action shortcut buttons (automations, scripts, scenes, buttons)
     * Shortcuts are positioned in pure Z-pattern: top-left, top-right, bottom-left, bottom-right
     * @private
     */
    _renderShortcuts() {
      const shortcuts = [];
      
      for (let i = 1; i <= JellyDeviceCard.MAX_SHORTCUTS; i++) {
        const automation = this.config[`shortcut_${i}_automation`];
        const name = this.config[`shortcut_${i}_name`];
        const icon = this.config[`shortcut_${i}_icon`];
        const parameter = this.config[`shortcut_${i}_parameter`];
        
        if (automation) {
          shortcuts.push({ automation, name, icon, parameter, index: i });
        }
      }

      if (shortcuts.length > 0) {
        this.$shortcutsContainer.innerHTML = shortcuts.map((shortcut) => {
          const displayName = shortcut.name || 'Action';
          const displayIcon = shortcut.icon || 'mdi:gesture-tap';
          
          return `
            <button class="shortcut" data-index="${shortcut.index}">
              <ha-icon icon="${displayIcon}"></ha-icon>
              <span class="t-label">${displayName}</span>
            </button>
          `;
        }).join('');
        this.$shortcutsContainer.style.display = "grid";

        shortcuts.forEach((shortcut) => {
          const btn = this.qs(`.shortcut[data-index="${shortcut.index}"]`);
          if (btn) {
            // Prevent events from bubbling to parent toggle handler
            const stopBubbling = (e) => e.stopPropagation();
            btn.addEventListener("pointerdown", stopBubbling);
            btn.addEventListener("pointerup", stopBubbling);
            btn.addEventListener("click", (e) => {
              stopBubbling(e);
              this._executeShortcut(shortcut);
            });
          }
        });
      } else {
        this.$shortcutsContainer.style.display = "none";
      }
    }

    /**
     * Handles tap on card to toggle device on/off
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

    /**
     * Executes a shortcut action (automation, script, scene, or button)
     * Scripts support JSON parameters wrapped in 'variables' key
     * @param {Object} shortcut - Shortcut configuration with automation entity and optional parameters
     * @private
     */
    _executeShortcut(shortcut) {
      executeShortcut(this.hass, shortcut);
    }

    disconnectedCallback() {
      this._unbind?.();
      super.disconnectedCallback();
    }
  }
);
