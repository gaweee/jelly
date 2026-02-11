import JellyCardBase from "../jelly-base.js";

customElements.define(
  "jelly-device-card",
  class JellyDeviceCard extends JellyCardBase {
    static get cardTag() {
      return "jelly-device-card";
    }

    static get cardDomains() {
      return ["fan", "light", "switch", "climate"];
    }

    static get editorSchema() {
      return {
        schema: [
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
          },
          {
            name: "shortcut_1",
            selector: { 
              entity: { 
                domain: ["input_button", "button", "script", "scene"] 
              } 
            }
          },
          {
            name: "shortcut_2",
            selector: { 
              entity: { 
                domain: ["input_button", "button", "script", "scene"] 
              } 
            }
          },
          {
            name: "shortcut_3",
            selector: { 
              entity: { 
                domain: ["input_button", "button", "script", "scene"] 
              } 
            }
          },
          {
            name: "shortcut_4",
            selector: { 
              entity: { 
                domain: ["input_button", "button", "script", "scene"] 
              } 
            }
          }
        ],
        labels: {
          entity: "Toggle Entity",
          name: "Display Name (optional)",
          image: "Image Path (e.g., /local/device.png - upload via Media)",
          shortcut_1: "Shortcut 1 (optional)",
          shortcut_2: "Shortcut 2 (optional)",
          shortcut_3: "Shortcut 3 (optional)",
          shortcut_4: "Shortcut 4 (optional)"
        }
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig(hass) {
      return JellyCardBase.getStubConfig.call(this, hass);
    }

    validateConfig(config) {
      // No validation needed - shortcuts are now simple entity IDs
    }

    afterLoad() {
      this.$card = this.qs(".device-card");
      this.$mainArea = this.qs(".main-area");
      this.$imageContainer = this.qs(".device-image-container");
      this.$image = this.qs(".device-image");
      this.$imagePlaceholder = this.qs(".device-image-placeholder");
      this.$name = this.qs(".device-name");
      this.$status = this.qs(".device-status");
      this.$shortcutsContainer = this.qs(".shortcuts");

      this._unbind = this.bindInteractions(this.$mainArea, {
        onTap: () => this._handleToggle()
      });
    }

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
      const status = this._computeStatus(entity);

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

    _renderShortcuts() {
      const shortcutKeys = ['shortcut_1', 'shortcut_2', 'shortcut_3', 'shortcut_4'];
      const shortcuts = shortcutKeys
        .map(key => this.config[key])
        .filter(entityId => entityId && entityId.trim());

      if (shortcuts.length > 0) {
        this.$shortcutsContainer.innerHTML = shortcuts.map((entityId, idx) => {
          const entity = this.hass.states[entityId];
          if (!entity) return '';
          
          const icon = entity.attributes.icon || this._getDefaultIcon(entityId);
          const label = entity.attributes.friendly_name || entityId.split('.')[1];
          
          return `
            <button class="shortcut" data-entity="${entityId}">
              <ha-icon icon="${icon}"></ha-icon>
              <span class="t-label">${label}</span>
            </button>
          `;
        }).join('');
        this.$shortcutsContainer.style.display = "flex";

        shortcuts.forEach((entityId) => {
          const btn = this.qs(`.shortcut[data-entity="${entityId}"]`);
          if (btn) {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              this._executeShortcut(entityId);
            });
          }
        });
      } else {
        this.$shortcutsContainer.style.display = "none";
      }
    }

    _getDefaultIcon(entityId) {
      const domain = entityId.split('.')[0];
      const iconMap = {
        'input_button': 'mdi:gesture-tap-button',
        'button': 'mdi:gesture-tap-button',
        'script': 'mdi:script-text',
        'scene': 'mdi:palette'
      };
      return iconMap[domain] || 'mdi:button-pointer';
    }

    _computeStatus(entity) {
      const state = entity.state;
      
      if (state === "unavailable") return "Unavailable";
      if (state === "off") return "Off";
      
      // For fans, show speed percentage
      if (entity.attributes.percentage) {
        return `On - ${entity.attributes.percentage}%`;
      }
      
      // For lights, show brightness
      if (entity.attributes.brightness) {
        const pct = Math.round((entity.attributes.brightness / 255) * 100);
        return `On - ${pct}%`;
      }
      
      // For climate, show current temp
      if (entity.attributes.current_temperature) {
        return `${entity.attributes.current_temperature}°`;
      }
      
      return "On";
    }

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

    _executeShortcut(entityId) {
      const entity = this.hass.states[entityId];
      if (!entity) {
        console.warn("Shortcut entity not found", entityId);
        return;
      }

      const [domain] = entityId.split(".");
      
      // Determine appropriate service based on domain
      let service;
      switch (domain) {
        case 'input_button':
        case 'button':
          service = 'press';
          break;
        case 'script':
          service = 'turn_on';
          break;
        case 'scene':
          service = 'turn_on';
          break;
        default:
          service = 'toggle';
      }

      this.callService(domain, service, { entity_id: entityId });
    }

    disconnectedCallback() {
      this._unbind?.();
      super.disconnectedCallback();
    }
  }
);
