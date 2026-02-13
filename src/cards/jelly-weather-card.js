import JellyCardBase from "../jelly-base.js";

/**
 * Weather Card — displays current conditions, temperature, and a
 * multi-day forecast strip with SVG candle range graphs.
 * Data comes exclusively from a HA weather.* entity.
 */

const ICON_BASE = "/local/jelly/src/cards/weather-icons/";
const FALLBACK_ICON = `${ICON_BASE}cloudy.svg`;

/**
 * Conditions that don't have their own SVG file;
 * fall back to the closest match that does.
 */
const ICON_ALIAS = {
  "windy-variant": "windy",
};

/** Map HA condition string → SVG URL */
function getWeatherIcon(condition) {
  if (!condition) return FALLBACK_ICON;
  const file = ICON_ALIAS[condition] || condition;
  return `${ICON_BASE}${file}.svg`;
}

/** Humanize a HA weather condition string for display */
function humanizeCondition(condition) {
  const MAP = {
    "sunny":            "Sunny",
    "clear-night":      "Clear",
    "cloudy":           "Cloudy",
    "partlycloudy":     "Partly Cloudy",
    "rainy":            "Rainy",
    "pouring":          "Pouring",
    "snowy":            "Snowy",
    "snowy-rainy":      "Sleet",
    "fog":              "Foggy",
    "hail":             "Hail",
    "lightning":        "Thunderstorm",
    "lightning-rainy":  "Thunderstorm",
    "windy":            "Windy",
    "windy-variant":    "Windy",
    "exceptional":      "Exceptional",
  };
  if (MAP[condition]) return MAP[condition];
  return condition
    ? condition.charAt(0).toUpperCase() + condition.slice(1).replace(/-/g, " ")
    : "Unknown";
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CANDLE_HEIGHT = 60; // SVG viewport height for candle area
const CANDLE_WIDTH = 24;  // SVG viewport width per candle

customElements.define(
  "jelly-weather-card",
  class JellyWeatherCard extends JellyCardBase {

    static minUnits = 4;

    /** @returns {string} Card HTML tag name */
    static get cardTag() {
      return "jelly-weather-card";
    }

    /** @returns {string[]} Preferred entity domains for this card */
    static get cardDomains() {
      return ["weather"];
    }

    /**
     * Returns schema for card editor.
     */
    static get editorSchema() {
      return {
        schema: [
          {
            name: "entity",
            selector: {
              entity: { domain: ["weather"] }
            }
          },
          {
            name: "days",
            selector: {
              select: {
                options: [
                  { value: "3", label: "3 days" },
                  { value: "5", label: "5 days" },
                  { value: "7", label: "7 days" }
                ],
                mode: "dropdown"
              }
            }
          },
          {
            name: "show_forecast",
            selector: { boolean: {} }
          },
          {
            name: "show_precip",
            selector: { boolean: {} }
          }
        ],
        labels: {
          entity: "Weather Entity",
          days: "Forecast Days",
          show_forecast: "Show Forecast Strip",
          show_precip: "Show Precipitation %"
        }
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig(hass) {
      return {
        ...JellyCardBase.getStubConfig.call(this, hass),
        days: 5,
        show_forecast: true,
        show_precip: true
      };
    }

    /**
     * Validates card configuration.
     */
    validateConfig(config) {
      if (!config.entity?.startsWith("weather.")) {
        throw new Error("Jelly Weather Card: entity must be a weather.* entity");
      }
    }

    // ── Lifecycle ──────────────────────────────────────────────

    afterLoad() {
      this.$card = this.qs(".card");
      this.$title = this.qs(".title");
      this.$status = this.qs(".status");
      this.$icon = this.qs(".icon");
      this.$value = this.qs(".value");
      this.$hilo = this.qs(".hilo");
      this.$forecast = this.qs(".forecast");

      // Subscribe to HA forecast service (HA 2023.12+)
      this._forecastData = null;
      this._forecastUnsub = null;
      this._subscribeForecast();
    }

    // ── HA Forecast subscription (modern API) ─────────────────

    /**
     * HA 2023.12+ moved forecasts to a service-based subscription.
     * We try the modern path first; if unavailable we fall back to
     * the legacy `attributes.forecast` array.
     */
    async _subscribeForecast() {
      if (!this.hass || !this.config?.entity) return;

      // Unsubscribe previous if any
      if (this._forecastUnsub) {
        try { this._forecastUnsub(); } catch (_) { /* ignore */ }
        this._forecastUnsub = null;
      }

      try {
        if (this.hass.connection?.subscribeMessage) {
          this._forecastUnsub = await this.hass.connection.subscribeMessage(
            (msg) => {
              this._forecastData = msg?.forecast ?? [];
              this.render?.();
            },
            {
              type: "weather/subscribe_forecast",
              forecast_type: "daily",
              entity_id: this.config.entity
            }
          );
        }
      } catch (err) {
        // Fallback: older HA — forecast lives in attributes
        this._forecastData = null;
      }
    }

    /** Re-subscribe when hass or config changes the entity */
    set hass(hass) {
      const prevEntity = this._hass?.states?.[this.config?.entity];
      super.hass = hass;

      // Re-subscribe if entity changed or first time
      if (
        hass &&
        this.config?.entity &&
        (!this._forecastUnsub || prevEntity !== hass.states?.[this.config?.entity])
      ) {
        this._subscribeForecast();
      }
    }

    get hass() {
      return super.hass;
    }

    // ── Render ─────────────────────────────────────────────────

    render() {
      if (!this.hass || !this.config || !this.$card) return;

      const entity = this.stateObj();
      if (!entity) {
        this.$title.textContent = "Entity not found";
        this.$status.textContent = this.config.entity;
        this.$forecast.innerHTML = "";
        return;
      }

      const condition = entity.state;
      const attrs = entity.attributes || {};
      const currentTemp = attrs.temperature;
      const unit = attrs.temperature_unit || this.hass.config?.unit_system?.temperature || "°";

      // ── Title & location
      this.$title.textContent = humanizeCondition(condition);
      const friendlyName = attrs.friendly_name || "";
      // Strip "weather." prefix if friendly_name not set
      this.$status.textContent = friendlyName
        ? friendlyName.replace(/^weather\.\s*/i, "").replace(/\bforecast\b\s*/i, "").trim()
        : "Home";

      // ── Current icon (inline SVG for animation)
      this._loadMainIcon(getWeatherIcon(condition));

      // ── Current temperature
      if (currentTemp != null) {
        this.$value.textContent = `${Math.round(currentTemp)}${unit}`;
        this.$value.style.display = "";
      } else {
        this.$value.style.display = "none";
      }

      // ── Today hi/lo from first forecast item
      const forecast = this._getForecast(attrs);
      const today = forecast[0];
      if (today) {
        const hi = this._getHigh(today);
        const lo = this._getLow(today);
        const parts = [];
        if (lo != null) parts.push(`L: ${Math.round(lo)}°`);
        if (hi != null) parts.push(`H: ${Math.round(hi)}°`);
        this.$hilo.textContent = parts.join("  ");
        this.$hilo.style.display = "";
      } else {
        this.$hilo.style.display = "none";
      }

      // ── Forecast strip
      const showForecast = this.config.show_forecast !== false;
      if (showForecast && forecast.length > 0) {
        this._renderForecast(forecast, unit);
      } else {
        this.$forecast.innerHTML = "";
      }
    }

    // ── Forecast data helpers ─────────────────────────────────

    _getForecast(attrs) {
      // Prefer subscribed data, fallback to legacy attributes
      const raw = this._forecastData ?? attrs.forecast ?? [];
      const days = parseInt(this.config.days, 10) || 5;
      return raw.slice(0, days);
    }

    _getHigh(item) {
      return item.temperature ?? item.temperature_high ?? null;
    }

    _getLow(item) {
      return item.templow ?? item.temperature_low ?? null;
    }

    _getPrecip(item) {
      return item.precipitation_probability ?? item.precip_probability ?? null;
    }

    // ── Forecast rendering ────────────────────────────────────

    _renderForecast(forecast, unit) {
      const showPrecip = this.config.show_precip !== false;

      // Collect all highs/lows for global scale
      let globalMin = Infinity;
      let globalMax = -Infinity;
      for (const item of forecast) {
        const hi = this._getHigh(item);
        const lo = this._getLow(item);
        if (hi != null && hi > globalMax) globalMax = hi;
        if (lo != null && lo < globalMin) globalMin = lo;
        if (hi != null && hi < globalMin) globalMin = hi;
        if (lo != null && lo > globalMax) globalMax = lo;
      }
      // Add a little padding
      const range = globalMax - globalMin || 1;
      const PAD = 4;

      let html = "";
      for (const item of forecast) {
        const dt = item.datetime ? new Date(item.datetime) : null;
        const dayLabel = dt ? DAY_NAMES[dt.getDay()] : "—";
        const condition = item.condition || "";
        const hi = this._getHigh(item);
        const lo = this._getLow(item);
        const precip = this._getPrecip(item);

        // Candle positions (y axis: 0=top, CANDLE_HEIGHT=bottom)
        // Map temp to y: higher temp → closer to top
        const hiY = hi != null
          ? PAD + (1 - (hi - globalMin) / range) * (CANDLE_HEIGHT - 2 * PAD)
          : CANDLE_HEIGHT / 2;
        const loY = lo != null
          ? PAD + (1 - (lo - globalMin) / range) * (CANDLE_HEIGHT - 2 * PAD)
          : CANDLE_HEIGHT / 2;

        // Wick: thin line full range
        // Body: thicker rect from hi to lo with rounding
        const bodyH = Math.max(loY - hiY, 4);
        const bodyW = 8;
        const wickX = CANDLE_WIDTH / 2;
        const bodyX = (CANDLE_WIDTH - bodyW) / 2;

        const candleSVG = `<svg class="forecast-candle-svg" viewBox="0 0 ${CANDLE_WIDTH} ${CANDLE_HEIGHT}" preserveAspectRatio="none">
          <line class="candle-wick" x1="${wickX}" y1="${hiY}" x2="${wickX}" y2="${loY}" />
          <rect class="candle-body" x="${bodyX}" y="${hiY}" width="${bodyW}" height="${bodyH}" />
        </svg>`;

        // Temperature labels
        let tempLabels = "";
        if (hi != null || lo != null) {
          tempLabels = `<div class="forecast-temp-labels">`;
          if (hi != null) tempLabels += `<span class="forecast-high">${Math.round(hi)}°</span>`;
          if (lo != null) tempLabels += `<span class="forecast-low">${Math.round(lo)}°</span>`;
          tempLabels += `</div>`;
        }

        // Precip
        let precipHTML = "";
        if (showPrecip && precip != null) {
          precipHTML = `<div class="forecast-precip">${Math.round(precip)}%</div>`;
        }

        html += `
          <div class="forecast-day">
            <div class="forecast-day-label">${dayLabel}</div>
            <img class="forecast-day-icon" src="${getWeatherIcon(condition)}" alt="${humanizeCondition(condition)}" />
            <div class="forecast-candle-wrap">${candleSVG}</div>
            ${tempLabels}
            ${precipHTML}
          </div>`;
      }

      this.$forecast.innerHTML = html;
    }


    /**
     * Fetch SVG text and inject it inline into the main icon container
     * so SMIL animations play inside shadow DOM.
     */
    async _loadMainIcon(url) {
      if (!this.$icon || this._currentIconUrl === url) return;
      this._currentIconUrl = url;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const text = await res.text();
        // Only update if URL hasn't changed while we were fetching
        if (this._currentIconUrl === url) {
          this.$icon.innerHTML = text;
        }
      } catch (_) { /* network error — leave previous icon */ }
    }

    // ── Cleanup ───────────────────────────────────────────────

    disconnectedCallback() {
      if (this._forecastUnsub) {
        try { this._forecastUnsub(); } catch (_) { /* ignore */ }
        this._forecastUnsub = null;
      }
      super.disconnectedCallback();
    }
  }
);
