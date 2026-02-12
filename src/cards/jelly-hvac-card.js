import JellyCardBase from "../jelly-base.js";

/**
 * HVAC Card — temperature control with scrollable rail, SVG notch overlay,
 * and HA mdi icon. Visual language follows the Jelly rail prototype (test.html).
 */
customElements.define(
  "jelly-hvac-card",
  class JellyHvacCard extends JellyCardBase {
    // Temperature range constants
    static DEFAULT_MIN_TEMP = 18;
    static DEFAULT_MAX_TEMP = 35;
    static TEMP_STEP = 0.5;

    // Rail width = container width × WIDTH_MULTIPLIER
    static WIDTH_MULTIPLIER = 3;

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
            name: "icon",
            selector: { icon: {} }
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
          icon: "Icon (optional)",
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
      if (!config.entity?.startsWith("climate.")) {
        console.warn("Jelly HVAC Card: entity should be a climate entity");
      }
    }

    // ─── Lifecycle ───────────────────────────────────────────────

    /**
     * Called after HTML/CSS assets are loaded.
     * Sets up DOM references and interaction handlers.
     */
    afterLoad() {
      this.$card = this.qs(".hvac-card");
      this.$name = this.qs(".device-name");
      this.$status = this.qs(".device-status");
      this.$tempValue = this.qs(".temp-value");
      this.$tempUnit = this.qs(".temp-unit");
      this.$icon = this.qs(".mdi-icon");
      this.$scroller = this.qs(".rail-scroller");
      this.$railContainer = this.qs(".rail-container");
      this.$thumb = this.qs(".thumb");
      this.$toggle = this.qs(".toggle-indicator");
      this.$overlayFill = this.qs(".overlay-fill");

      this._initializeRail();

      // Toggle tap
      if (this.$toggle) {
        this.bindInteractions(this.$toggle, {
          onTap: () => this._handleToggle()
        });
      }
    }

    // ─── Rail Interactions ───────────────────────────────────────

    /**
     * Wire pointer-based drag on the thumb and the rail scroller,
     * mirroring the test.html interaction model.
     * @private
     */
    _initializeRail() {
      let thumbDragging = false;
      let railDragging = false;
      let lastX = 0;
      let railLastX = 0;
      let scrollTimeout = null;

      // ── live temperature readout on scroll ──
      const handleScroll = () => {
        const temp = this._getTempFromScroll();
        if (this.$tempValue) {
          this.$tempValue.textContent = temp.toFixed(1);
        }
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this._setTemperature(temp);
        }, 150);
      };

      // ── thumb drag (opposite-direction scroll) ──
      const onThumbDown = (e) => {
        thumbDragging = true;
        lastX = e.clientX;
        this.$thumb.setPointerCapture(e.pointerId);
        e.preventDefault();
      };

      const onThumbMove = (e) => {
        if (!thumbDragging) return;
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        this.$scroller.scrollLeft -= dx;
        e.preventDefault();
      };

      const onThumbEnd = (e) => {
        if (!thumbDragging) return;
        thumbDragging = false;
        try { this.$thumb.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        e.preventDefault();
      };

      // ── rail drag ──
      const onRailDown = (e) => {
        if (e.target.closest(".thumb")) return;
        railDragging = true;
        railLastX = e.clientX;
        this.$scroller.setPointerCapture(e.pointerId);
        e.preventDefault();
      };

      const onRailMove = (e) => {
        if (!railDragging) return;
        const dx = e.clientX - railLastX;
        railLastX = e.clientX;
        this.$scroller.scrollLeft -= dx;
        e.preventDefault();
      };

      const onRailEnd = (e) => {
        if (!railDragging) return;
        railDragging = false;
        try { this.$scroller.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      };

      // ── prevent text selection while dragging ──
      const preventSelect = (e) => {
        if (thumbDragging || railDragging) e.preventDefault();
      };

      // bind
      this.$scroller.addEventListener("scroll", handleScroll, { passive: true });

      this.$thumb.addEventListener("pointerdown", onThumbDown);
      this.$thumb.addEventListener("pointermove", onThumbMove);
      this.$thumb.addEventListener("pointerup", onThumbEnd);
      this.$thumb.addEventListener("pointercancel", onThumbEnd);

      this.$scroller.addEventListener("pointerdown", onRailDown);
      this.$scroller.addEventListener("pointermove", onRailMove);
      this.$scroller.addEventListener("pointerup", onRailEnd);
      this.$scroller.addEventListener("pointercancel", onRailEnd);

      document.addEventListener("selectstart", preventSelect);

      // cleanup reference
      this._unbindRail = () => {
        this.$scroller.removeEventListener("scroll", handleScroll);
        this.$thumb.removeEventListener("pointerdown", onThumbDown);
        this.$thumb.removeEventListener("pointermove", onThumbMove);
        this.$thumb.removeEventListener("pointerup", onThumbEnd);
        this.$thumb.removeEventListener("pointercancel", onThumbEnd);
        this.$scroller.removeEventListener("pointerdown", onRailDown);
        this.$scroller.removeEventListener("pointermove", onRailMove);
        this.$scroller.removeEventListener("pointerup", onRailEnd);
        this.$scroller.removeEventListener("pointercancel", onRailEnd);
        document.removeEventListener("selectstart", preventSelect);
        if (scrollTimeout) clearTimeout(scrollTimeout);
      };
    }

    // ─── Temperature Helpers ─────────────────────────────────────

    /** @private */
    _getMinTemp() {
      const entity = this.stateObj();
      return this.config.min_temp ?? entity?.attributes?.min_temp ?? JellyHvacCard.DEFAULT_MIN_TEMP;
    }

    /** @private */
    _getMaxTemp() {
      const entity = this.stateObj();
      return this.config.max_temp ?? entity?.attributes?.max_temp ?? JellyHvacCard.DEFAULT_MAX_TEMP;
    }

    /** @private */
    _getCurrentTemp() {
      const entity = this.stateObj();
      return entity?.attributes?.temperature ?? this._getMinTemp();
    }

    /**
     * Compute and cache rail-container dimensions.
     * Min-temp sits at 1/(2·W) of bar width, max at (2W−1)/(2·W).
     * @private
     */
    _computeRailDimensions() {
      const containerWidth = this.$scroller.clientWidth || 300;
      const barWidth = containerWidth * JellyHvacCard.WIDTH_MULTIPLIER;
      const W = JellyHvacCard.WIDTH_MULTIPLIER;

      this._barWidth = barWidth;
      this._minPosition = barWidth * (1 / (2 * W));
      this._maxPosition = barWidth * ((W * 2 - 1) / (2 * W));

      this.$railContainer.style.width = `${barWidth}px`;
      this.$railContainer.style.minWidth = `${barWidth}px`;

      // Drive tick mask edges: start at 1/(2W), end at 1-1/(2W)
      const tickStart = (100 / (2 * W)).toFixed(2);
      const tickEnd = (100 - 100 / (2 * W)).toFixed(2);
      this.$railContainer.style.setProperty('--tick-start', `${tickStart}%`);
      this.$railContainer.style.setProperty('--tick-end', `${tickEnd}%`);
    }

    /**
     * Derive temperature from current scroll position.
     * @private
     */
    _getTempFromScroll() {
      const scrollLeft = this.$scroller.scrollLeft;
      const containerWidth = this.$scroller.clientWidth;
      const centerOffset = scrollLeft + containerWidth / 2;

      const minTemp = this._getMinTemp();
      const maxTemp = this._getMaxTemp();
      const minPos = this._minPosition || 0;
      const maxPos = this._maxPosition || 1;

      const ratio = (centerOffset - minPos) / (maxPos - minPos);
      const temp = minTemp + ratio * (maxTemp - minTemp);
      const rounded = Math.round(temp / JellyHvacCard.TEMP_STEP) * JellyHvacCard.TEMP_STEP;
      return Math.max(minTemp, Math.min(maxTemp, rounded));
    }

    /**
     * Scroll the rail so the given temperature is centred under the notch.
     * @private
     */
    _scrollToTemp(temp) {
      const minTemp = this._getMinTemp();
      const maxTemp = this._getMaxTemp();
      const containerWidth = this.$scroller.clientWidth;
      const minPos = this._minPosition || 0;
      const maxPos = this._maxPosition || 1;

      const ratio = (temp - minTemp) / (maxTemp - minTemp);
      const tempPosition = minPos + ratio * (maxPos - minPos);
      this.$scroller.scrollLeft = tempPosition - containerWidth / 2;
    }

    /**
     * Send temperature to HA via climate service.
     * @private
     */
    _setTemperature(temp) {
      const entity = this.stateObj();
      if (!entity) return;
      this.callService("climate", "set_temperature", {
        entity_id: this.config.entity,
        temperature: temp
      });
    }

    // ─── Render ──────────────────────────────────────────────────

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

      // state data-attribute
      this.$card.setAttribute("data-state", state);

      // device info
      this.$name.textContent = name;
      this.$status.textContent = this._getStatusText(state);

      // icon — configurable or pulled from entity
      const icon = this.config.icon || entity.attributes.icon || "mdi:thermostat";
      if (this.$icon) {
        this.$icon.setAttribute("icon", icon);
      }

      // temperature display
      const unit = entity.attributes.unit_of_measurement || "°C";
      this.$tempValue.textContent = temp.toFixed(1);
      this.$tempUnit.textContent = unit;

      // rail dimensions (recompute when temp range changes)
      if (
        !this._railInitialized ||
        this._lastMinTemp !== this._getMinTemp() ||
        this._lastMaxTemp !== this._getMaxTemp()
      ) {
        this._computeRailDimensions();
        this._railInitialized = true;
        this._lastMinTemp = this._getMinTemp();
        this._lastMaxTemp = this._getMaxTemp();
      }

      // centre rail on current target temperature
      this._scrollToTemp(temp);

      // sync overlay fill with actual computed card background
      this._syncOverlayFill();
    }

    /**
     * Sync SVG overlay fill with computed card background color.
     * CSS custom properties don't always resolve inside SVG fill attributes,
     * so we read the computed value and apply it directly.
     * @private
     */
    _syncOverlayFill() {
      if (!this.$overlayFill) return;
      // Read background from the <ha-card> element (the shadow host's first child),
      // which is styled by HA's theme and is the true rendered card background.
      const haCard = this.shadowRoot?.querySelector('ha-card');
      if (!haCard) return;
      const bg = getComputedStyle(haCard).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        this.$overlayFill.setAttribute('fill', bg);
      }
    }

    /**
     * Human-readable HVAC status text.
     * @private
     */
    _getStatusText(state) {
      const stateMap = {
        heat: "Heating",
        cool: "Cooling",
        heat_cool: "Auto",
        auto: "Auto",
        dry: "Dry",
        fan_only: "Fan",
        off: "Off",
        unavailable: "Unavailable"
      };
      return stateMap[state] || state;
    }

    /**
     * Toggle HVAC on/off with optimistic UI.
     * @private
     */
    _handleToggle() {
      const entity = this.stateObj();
      if (!entity) return;

      if (entity.state === "unavailable" || entity.state === "unknown") {
        console.warn("Jelly HVAC: Entity unavailable", this.config.entity);
        return;
      }

      const isOff = entity.state === "off";

      if (isOff) {
        // Turn on — use climate.turn_on
        this.callService("climate", "turn_on", {
          entity_id: this.config.entity
        });
        this.optimisticToggle({
          sendToggle: false,
          applyOptimistic: () => {
            this.$card.setAttribute("data-state", "auto");
            this.$status.textContent = "Auto";
          },
          rollback: () => this.render(),
          confirm: (next) => next?.state !== "off"
        });
      } else {
        // Turn off
        this.callService("climate", "turn_off", {
          entity_id: this.config.entity
        });
        this.optimisticToggle({
          sendToggle: false,
          desiredState: "off",
          applyOptimistic: () => {
            this.$card.setAttribute("data-state", "off");
            this.$status.textContent = "Off";
          },
          rollback: () => this.render(),
          confirm: (next) => next?.state === "off"
        });
      }
    }

    disconnectedCallback() {
      this._unbindRail?.();
      super.disconnectedCallback();
    }
  }
);
