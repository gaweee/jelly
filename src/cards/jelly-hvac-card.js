import JellyCardBase from "../jelly-base.js";

/**
 * HVAC Card - Beautiful temperature control with slider
 * Displays device name, status, current temperature, and an interactive slider
 */
customElements.define(
  "jelly-hvac-card",
  class JellyHvacCard extends JellyCardBase {
    // Temperature range constants
    static DEFAULT_MIN_TEMP = 16;
    static DEFAULT_MAX_TEMP = 30;
    
    /** @returns {string} Card HTML tag name */
    static get cardTag() {
      return "jelly-hvac-card";
    }

    /** @returns {string[]} Preferred entity domains for this card */
    static get cardDomains() {
      return ["climate"];
    }

    /**
     * Returns schema for card editor
     * @returns {Function} Function that takes config and returns {schema, labels}
     */
    static get editorSchema() {
      return (config) => {
        const schema = [
          {
            name: "entity",
            selector: { 
              entity: { 
                domain: ["climate"]
              } 
            }
          },
          {
            name: "name",
            selector: { text: {} }
          },
          {
            name: "min_temp",
            selector: { 
              number: {
                min: 10,
                max: 30,
                step: 0.5,
                mode: "box"
              }
            }
          },
          {
            name: "max_temp",
            selector: { 
              number: {
                min: 10,
                max: 35,
                step: 0.5,
                mode: "box"
              }
            }
          }
        ];

        const labels = {
          entity: "Climate Entity",
          name: "Display Name (optional)",
          min_temp: "Minimum Temperature",
          max_temp: "Maximum Temperature"
        };

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
     * Validates card configuration
     * @param {Object} config - Card configuration
     */
    validateConfig(config) {
      if (!config.entity?.startsWith('climate.')) {
        console.warn('Jelly HVAC Card: entity should be a climate entity');
      }
    }

    /**
     * Called after HTML/CSS assets are loaded
     * Sets up DOM references and interaction handlers
     */
    afterLoad() {
      this.$card = this.qs(".hvac-card");
      this.$name = this.qs(".device-name");
      this.$status = this.qs(".device-status");
      this.$tempValue = this.qs(".temp-value");
      this.$tempUnit = this.qs(".temp-unit");
      this.$sliderTrack = this.qs(".slider-track");
      this.$sliderFill = this.qs(".slider-fill");
      this.$sliderThumb = this.qs(".slider-thumb");
      this.$labelMin = this.qs(".slider-label-min");
      this.$labelMax = this.qs(".slider-label-max");

      // Initialize slider interaction
      this._initializeSlider();
    }

    /**
     * Initialize slider drag interaction
     * @private
     */
    _initializeSlider() {
      let isDragging = false;
      let startX = 0;
      let startTemp = 0;

      const handleStart = (e) => {
        const entity = this.stateObj();
        if (!entity || entity.state === 'off' || entity.state === 'unavailable') {
          return;
        }

        isDragging = true;
        startX = this._getPositionX(e);
        startTemp = this._getCurrentTemp();
        
        this.$sliderTrack.style.cursor = 'grabbing';
        
        e.preventDefault();
      };

      const handleMove = (e) => {
        if (!isDragging) return;

        const currentX = this._getPositionX(e);
        const rect = this.$sliderTrack.getBoundingClientRect();
        const deltaX = currentX - startX;
        const tempRange = this._getMaxTemp() - this._getMinTemp();
        const deltaTemp = (deltaX / rect.width) * tempRange;
        
        let newTemp = startTemp + deltaTemp;
        newTemp = Math.round(newTemp * 2) / 2; // Round to nearest 0.5
        newTemp = Math.max(this._getMinTemp(), Math.min(this._getMaxTemp(), newTemp));
        
        // Update UI immediately for smooth feedback
        this._updateSliderUI(newTemp);
        
        e.preventDefault();
      };

      const handleEnd = (e) => {
        if (!isDragging) return;
        
        isDragging = false;
        this.$sliderTrack.style.cursor = 'pointer';
        
        const currentX = this._getPositionX(e);
        const rect = this.$sliderTrack.getBoundingClientRect();
        const deltaX = currentX - startX;
        const tempRange = this._getMaxTemp() - this._getMinTemp();
        const deltaTemp = (deltaX / rect.width) * tempRange;
        
        let newTemp = startTemp + deltaTemp;
        newTemp = Math.round(newTemp * 2) / 2; // Round to nearest 0.5
        newTemp = Math.max(this._getMinTemp(), Math.min(this._getMaxTemp(), newTemp));
        
        // Set the temperature
        this._setTemperature(newTemp);
      };

      const handleCancel = () => {
        if (!isDragging) return;
        
        isDragging = false;
        this.$sliderTrack.style.cursor = 'pointer';
        
        // Revert to actual temperature
        this.render();
      };

      // Mouse events
      this.$sliderTrack.addEventListener('mousedown', handleStart);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      
      // Touch events
      this.$sliderTrack.addEventListener('touchstart', handleStart, { passive: false });
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      document.addEventListener('touchcancel', handleCancel);

      // Store cleanup function
      this._unbindSlider = () => {
        this.$sliderTrack.removeEventListener('mousedown', handleStart);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        this.$sliderTrack.removeEventListener('touchstart', handleStart);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
        document.removeEventListener('touchcancel', handleCancel);
      };
    }

    /**
     * Get X position from mouse or touch event
     * @private
     */
    _getPositionX(e) {
      return e.type.startsWith('touch') ? e.touches[0]?.clientX || e.changedTouches[0]?.clientX : e.clientX;
    }

    /**
     * Get minimum temperature
     * @private
     */
    _getMinTemp() {
      const entity = this.stateObj();
      return this.config.min_temp ?? entity?.attributes?.min_temp ?? JellyHvacCard.DEFAULT_MIN_TEMP;
    }

    /**
     * Get maximum temperature
     * @private
     */
    _getMaxTemp() {
      const entity = this.stateObj();
      return this.config.max_temp ?? entity?.attributes?.max_temp ?? JellyHvacCard.DEFAULT_MAX_TEMP;
    }

    /**
     * Get current target temperature
     * @private
     */
    _getCurrentTemp() {
      const entity = this.stateObj();
      return entity?.attributes?.temperature ?? this._getMinTemp();
    }

    /**
     * Update slider UI with given temperature
     * @private
     */
    _updateSliderUI(temp) {
      const minTemp = this._getMinTemp();
      const maxTemp = this._getMaxTemp();
      const percentage = ((temp - minTemp) / (maxTemp - minTemp)) * 100;
      
      this.$tempValue.textContent = temp.toFixed(1);
      this.$sliderFill.style.width = `${percentage}%`;
      this.$sliderThumb.style.left = `${percentage}%`;
    }

    /**
     * Set temperature via Home Assistant service
     * @private
     */
    _setTemperature(temp) {
      const entity = this.stateObj();
      if (!entity) return;

      this.callService('climate', 'set_temperature', {
        entity_id: this.config.entity,
        temperature: temp
      });
    }

    /**
     * Renders the card with current entity state
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

      const name = this.config.name || entity.attributes.friendly_name || this.config.entity;
      const state = entity.state;
      const temp = this._getCurrentTemp();
      const minTemp = this._getMinTemp();
      const maxTemp = this._getMaxTemp();

      // Update card state
      this.$card.setAttribute("data-state", state);
      
      // Update device info
      this.$name.textContent = name;
      this.$status.textContent = this._getStatusText(state);

      // Update temperature display
      const unit = entity.attributes.unit_of_measurement || '°C';
      this.$tempValue.textContent = temp.toFixed(1);
      this.$tempUnit.textContent = unit;

      // Update slider
      this._updateSliderUI(temp);
      
      // Update labels
      this.$labelMin.textContent = `${minTemp}°`;
      this.$labelMax.textContent = `${maxTemp}°`;
    }

    /**
     * Get human-readable status text
     * @private
     */
    _getStatusText(state) {
      const stateMap = {
        'heat': 'Heating',
        'cool': 'Cooling',
        'heat_cool': 'Auto',
        'auto': 'Auto',
        'dry': 'Dry',
        'fan_only': 'Fan',
        'off': 'Off',
        'unavailable': 'Unavailable'
      };
      return stateMap[state] || state;
    }

    disconnectedCallback() {
      this._unbindSlider?.();
      super.disconnectedCallback();
    }
  }
);
