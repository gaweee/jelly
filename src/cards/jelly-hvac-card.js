import JellyCardBase from "../jelly-base.js";

/**
 * HVAC Card - Beautiful temperature control with slider
 * Displays device name, status, current temperature, and an interactive slider
 */
customElements.define(
  "jelly-hvac-card",
  class JellyHvacCard extends JellyCardBase {
    // Temperature range constants
    static DEFAULT_MIN_TEMP = 18;
    static DEFAULT_MAX_TEMP = 35;
    static TEMP_STEP = 0.5;
    static PIXELS_PER_DEGREE = 40; // Space between each degree marker
    
    // Scrollable bar width multiplier (bar width = viewport width * WIDTH_MULTIPLIER)
    static WIDTH_MULTIPLIER = 3;
    // Min temp position: center of first panel = 1/(2*WIDTH_MULTIPLIER)
    // Max temp position: center of last panel = (WIDTH_MULTIPLIER*2-1)/(2*WIDTH_MULTIPLIER)
    
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
      this.$pickerContainer = this.qs(".picker-line-container");
      this.$pickerLine = this.qs(".picker-line");
      this.$gradientBar = this.qs(".picker-gradient-bar");
      this.$pickerKnob = this.qs(".picker-knob");

      // Initialize temperature picker
      this._initializePicker();
    }

    /**
     * Initialize scrollable temperature picker
     * @private
     */
    _initializePicker() {
      let isScrolling = false;
      let scrollTimeout = null;
      let lastScrollLeft = 0;
      let isDragging = false;
      let startX = 0;
      let scrollStart = 0;

      const handleScroll = () => {
        if (!isScrolling) {
          isScrolling = true;
        }

        // Clear existing timeout
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }

        // Update temperature display in real-time
        const temp = this._getTempFromScroll();
        this.$tempValue.textContent = temp.toFixed(1);

        // Set timeout to detect end of scroll
        scrollTimeout = setTimeout(() => {
          isScrolling = false;
          
          // Only set temperature if it changed
          const scrollLeft = this.$pickerContainer.scrollLeft;
          if (Math.abs(scrollLeft - lastScrollLeft) > 2) {
            lastScrollLeft = scrollLeft;
            this._setTemperature(temp);
          }
        }, 150);
      };

      // Mouse/touch drag to scroll
      const handleDragStart = (e) => {
        isDragging = true;
        startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
        scrollStart = this.$pickerContainer.scrollLeft;
        this.$pickerContainer.style.cursor = 'grabbing';
      };

      const handleDragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX;
        const deltaX = startX - x;
        this.$pickerContainer.scrollLeft = scrollStart + deltaX;
      };

      const handleDragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        this.$pickerContainer.style.cursor = 'grab';
      };

      // Listen to scroll events
      this.$pickerContainer.addEventListener('scroll', handleScroll, { passive: true });
      
      // Mouse events
      this.$pickerContainer.addEventListener('mousedown', handleDragStart);
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      
      // Touch events
      this.$pickerContainer.addEventListener('touchstart', handleDragStart, { passive: true });
      this.$pickerContainer.addEventListener('touchmove', handleDragMove, { passive: false });
      this.$pickerContainer.addEventListener('touchend', handleDragEnd);

      // Store cleanup function
      this._unbindPicker = () => {
        this.$pickerContainer.removeEventListener('scroll', handleScroll);
        this.$pickerContainer.removeEventListener('mousedown', handleDragStart);
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        this.$pickerContainer.removeEventListener('touchstart', handleDragStart);
        this.$pickerContainer.removeEventListener('touchmove', handleDragMove);
        this.$pickerContainer.removeEventListener('touchend', handleDragEnd);
        if (scrollTimeout) clearTimeout(scrollTimeout);
      };
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
     * Calculate temperature from current scroll position
     * @private
     */
    _getTempFromScroll() {
      const scrollLeft = this.$pickerContainer.scrollLeft;
      const containerWidth = this.$pickerContainer.clientWidth;
      const centerOffset = scrollLeft + (containerWidth / 2);
      
      // Use formula-based positioning
      const minTemp = this._getMinTemp();
      const maxTemp = this._getMaxTemp();
      const W = JellyHvacCard.WIDTH_MULTIPLIER;
      const minPos = this._minPosition || (this._barWidth * (1 / (2 * W)));
      const maxPos = this._maxPosition || (this._barWidth * ((W * 2 - 1) / (2 * W)));
      
      // Linear interpolation between min and max positions
      const ratio = (centerOffset - minPos) / (maxPos - minPos);
      const temp = minTemp + (ratio * (maxTemp - minTemp));
      
      // Round to step
      const rounded = Math.round(temp / JellyHvacCard.TEMP_STEP) * JellyHvacCard.TEMP_STEP;
      return Math.max(minTemp, Math.min(maxTemp, rounded));
    }

    /**
     * Scroll to position for given temperature
     * @private
     */
    _scrollToTemp(temp) {
      const minTemp = this._getMinTemp();
      const maxTemp = this._getMaxTemp();
      const containerWidth = this.$pickerContainer.clientWidth;
      
      // Use formula-based positioning
      const W = JellyHvacCard.WIDTH_MULTIPLIER;
      const minPos = this._minPosition || (this._barWidth * (1 / (2 * W)));
      const maxPos = this._maxPosition || (this._barWidth * ((W * 2 - 1) / (2 * W)));
      
      // Linear interpolation to find position
      const ratio = (temp - minTemp) / (maxTemp - minTemp);
      const tempPosition = minPos + (ratio * (maxPos - minPos));
      
      // Center that position in viewport
      const scrollLeft = tempPosition - (containerWidth / 2);
      
      this.$pickerContainer.scrollLeft = scrollLeft;
    }

    /**
     * Generate temperature markers along the line
     * @private
     */
    _generateMarkers() {
      const minTemp = this._getMinTemp();
      const maxTemp = this._getMaxTemp();
      const tempRange = maxTemp - minTemp;
      
      // Ensure container has dimensions
      const containerWidth = this.$pickerContainer.clientWidth || 300;
      
      // Bar width based on multiplier constant
      const barWidth = containerWidth * JellyHvacCard.WIDTH_MULTIPLIER;
      
      this.$pickerLine.style.width = `${barWidth}px`;
      this.$gradientBar.style.width = `${barWidth}px`;
      
      // Clear existing markers
      const existingMarkers = this.$pickerLine.querySelectorAll('.temp-marker');
      existingMarkers.forEach(marker => marker.remove());
      
      // Calculate min/max positions using formula
      // Min: center of first panel = 1/(2*WIDTH_MULTIPLIER) of bar width
      // Max: center of last panel = (WIDTH_MULTIPLIER*2-1)/(2*WIDTH_MULTIPLIER) of bar width
      const W = JellyHvacCard.WIDTH_MULTIPLIER;
      const minPosition = barWidth * (1 / (2 * W));
      const maxPosition = barWidth * ((W * 2 - 1) / (2 * W));
      const effectiveWidth = maxPosition - minPosition;
      
      // Generate markers for each temperature value (every 0.5 degree)
      for (let temp = minTemp; temp <= maxTemp; temp += JellyHvacCard.TEMP_STEP) {
        // Major ticks at every 2 degrees
        const isMajor = temp % 2 === 0;
        const isEndpoint = temp === minTemp || temp === maxTemp;
        
        // Calculate position
        const ratio = (temp - minTemp) / tempRange;
        const position = minPosition + (ratio * effectiveWidth);
        
        const marker = document.createElement('div');
        marker.className = `temp-marker ${isMajor ? 'major' : 'minor'} ${isEndpoint ? 'endpoint' : ''}`;
        marker.style.left = `${position}px`;
        
        const tick = document.createElement('div');
        tick.className = 'temp-marker-tick';
        marker.appendChild(tick);
        
        // Only show labels for major ticks (every 2 degrees)
        if (isMajor) {
          const label = document.createElement('div');
          label.className = 'temp-marker-label';
          label.textContent = `${temp}°`;
          marker.appendChild(label);
        }
        
        this.$pickerLine.appendChild(marker);
      }
      
      // Store dimensions for scroll calculations
      this._barWidth = barWidth;
      this._minPosition = minPosition;
      this._maxPosition = maxPosition;
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

      // Update card state
      this.$card.setAttribute("data-state", state);
      
      // Update device info
      this.$name.textContent = name;
      this.$status.textContent = this._getStatusText(state);

      // Update temperature display
      const unit = entity.attributes.unit_of_measurement || '°C';
      this.$tempValue.textContent = temp.toFixed(1);
      this.$tempUnit.textContent = unit;

      // Generate markers if not already done or if range changed
      if (!this._markersGenerated || this._lastMinTemp !== this._getMinTemp() || this._lastMaxTemp !== this._getMaxTemp()) {
        this._generateMarkers();
        this._markersGenerated = true;
        this._lastMinTemp = this._getMinTemp();
        this._lastMaxTemp = this._getMaxTemp();
      }
      
      // Scroll to current temperature
      this._scrollToTemp(temp);
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
      this._unbindPicker?.();
      super.disconnectedCallback();
    }
  }
);
