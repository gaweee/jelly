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
      // Return dynamic schema generator function
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
        for (let i = 1; i <= 4; i++) {
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

    validateConfig(config) {
      // No validation needed
    }

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
      const shortcuts = [];
      
      for (let i = 1; i <= 4; i++) {
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
            // Stop pointer events from bubbling to prevent parent tap handler
            btn.addEventListener("pointerdown", (e) => {
              e.stopPropagation();
            });
            btn.addEventListener("pointerup", (e) => {
              e.stopPropagation();
            });
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              this._executeShortcut(shortcut);
            });
          }
        });
      } else {
        this.$shortcutsContainer.style.display = "none";
      }
    }

    _computeStatus(entity) {
      const state = entity.state;
      const attrs = entity.attributes;
      
      // Critical states
      if (state === "unavailable") return "Unavailable";
      if (state === "unknown") return "Unknown";
      
      const statusParts = [];
      
      // Base state (capitalized)
      const baseState = state.charAt(0).toUpperCase() + state.slice(1);
      statusParts.push(baseState);
      
      // Only add details if device is active (not off/idle/standby)
      if (state !== "off" && state !== "idle" && state !== "standby") {
        // Intensity/Level indicators (brightness, speed, volume, position)
        if (attrs.brightness !== undefined) {
          const pct = Math.round((attrs.brightness / 255) * 100);
          statusParts.push(`${pct}%`);
        } else if (attrs.percentage !== undefined) {
          statusParts.push(`${attrs.percentage}%`);
        } else if (attrs.volume_level !== undefined) {
          const vol = Math.round(attrs.volume_level * 100);
          statusParts.push(`Vol ${vol}%`);
        } else if (attrs.current_position !== undefined) {
          statusParts.push(`${attrs.current_position}%`);
        }
        
        // Mode information
        if (attrs.hvac_mode && attrs.hvac_mode !== "off") {
          statusParts.push(attrs.hvac_mode);
        } else if (attrs.preset_mode) {
          statusParts.push(attrs.preset_mode);
        } else if (attrs.fan_mode) {
          statusParts.push(attrs.fan_mode);
        } else if (attrs.swing_mode && attrs.swing_mode !== "off") {
          statusParts.push(attrs.swing_mode);
        }
        
        // Media info
        if (attrs.media_title) {
          statusParts.push(attrs.media_title);
        } else if (attrs.media_artist) {
          statusParts.push(attrs.media_artist);
        }
        
        // Color/Effect for lights
        if (attrs.effect && attrs.effect !== "none") {
          statusParts.push(attrs.effect);
        } else if (attrs.color_mode === "color_temp" && attrs.color_temp) {
          statusParts.push(`${attrs.color_temp}K`);
        }
      }
      
      // Temperature (show even when off for climate devices)
      if (attrs.current_temperature !== undefined) {
        statusParts.push(`${attrs.current_temperature}°`);
      } else if (attrs.temperature !== undefined && state !== "off") {
        statusParts.push(`→${attrs.temperature}°`);
      }
      
      // Humidity (useful context)
      if (attrs.current_humidity !== undefined) {
        statusParts.push(`${attrs.current_humidity}%RH`);
      }
      
      // Battery level (if low)
      if (attrs.battery_level !== undefined && attrs.battery_level < 20) {
        statusParts.push(`🔋${attrs.battery_level}%`);
      }
      
      // Join with separator, limit to reasonable length
      let status = statusParts.join(" · ");
      
      // Fallback for simple on/off devices
      if (status === "On" || status === "Off") {
        return status;
      }
      
      // Trim if too long
      return status.length > 40 ? status.substring(0, 37) + "..." : status;
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

    _executeShortcut(shortcut) {
      const entity = this.hass.states[shortcut.automation];
      if (!entity) {
        console.warn("Entity not found", shortcut.automation);
        return;
      }

      const [domain] = shortcut.automation.split(".");
      let service, serviceData;

      switch (domain) {
        case "button":
          service = "press";
          serviceData = { entity_id: shortcut.automation };
          break;

        case "scene":
          service = "turn_on";
          serviceData = { entity_id: shortcut.automation };
          break;

        case "automation":
          service = "trigger";
          serviceData = { entity_id: shortcut.automation };
          break;

        case "script":
          service = "turn_on";
          serviceData = { entity_id: shortcut.automation };
          
          // Parse parameters for scripts - must be wrapped in 'variables' key
          if (shortcut.parameter && shortcut.parameter.trim()) {
            try {
              const paramData = JSON.parse(shortcut.parameter);
              // Scripts expect parameters under 'variables' key
              serviceData.variables = paramData;
            } catch (e) {
              // Show user-friendly error notification
              const errorMsg = `Invalid JSON in shortcut parameters. Use format: {"key": "value"} or {"percentage": 75}. Error: ${e.message}`;
              console.error("Jelly:", errorMsg);
              
              // Try to show a notification if available
              if (this.hass?.callService) {
                this.hass.callService("persistent_notification", "create", {
                  title: "Jelly Card - Invalid Parameters",
                  message: errorMsg,
                  notification_id: "jelly_param_error"
                });
              }
              
              // Don't execute the script with invalid parameters
              return;
            }
          }
          break;

        default:
          console.warn("Unsupported domain for shortcut", domain);
          return;
      }

      this.callService(domain, service, serviceData);
    }

    disconnectedCallback() {
      this._unbind?.();
      super.disconnectedCallback();
    }
  }
);
