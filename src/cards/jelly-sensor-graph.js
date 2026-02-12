import JellyCardBase from "../jelly-base.js";

/**
 * Sensor Graph Card — static line chart from HA sensor history.
 * Uses Chart.js (CDN) for smooth bezier rendering. No interactivity.
 * Shows latest data point as a floating pill label.
 */

const CHART_CDN =
  "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
const REFRESH_MS = 5 * 60 * 1000; // re-fetch history every 5 min

/* Range presets: hours, target data points */
const RANGES = {
  "24h":  { hours: 24,  buckets: 24  },
  "3d":   { hours: 72,  buckets: 24  },
  "5d":   { hours: 120, buckets: 20  },
  "7d":   { hours: 168, buckets: 21  },
};
const RANGE_KEYS = Object.keys(RANGES);
const DEFAULT_RANGE = "3d";

/* Catppuccin Mocha palette for canvas rendering */
const CTP = {
  blue: "#89b4fa",
  lavender: "#b4befe",
  text: "#cdd6f4",
  subtext0: "#a6adc8",
  overlay0: "#6c7086",
  surface0: "#313244",
};

/* ------------------------------------------------------------------ */
/*  Chart.js plugin – pill label above the latest data point          */
/* ------------------------------------------------------------------ */
const latestPill = {
  id: "jellyLatestPill",

  afterDatasetsDraw(chart) {
    const ds = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    if (!ds || !meta?.data?.length) return;

    // find last non-null index
    let li = ds.data.length - 1;
    while (li >= 0 && ds.data[li] == null) li--;
    if (li < 0) return;

    const pt = meta.data[li];
    const val = ds.data[li];
    const unit = chart.config._jellyUnit || "";
    const text = `${Math.round(val * 10) / 10} ${unit}`.trim();

    const ctx = chart.ctx;
    ctx.save();
    ctx.font = '600 11px "Inter", sans-serif';

    const tw = ctx.measureText(text).width;
    const px = 10,
      py = 5;
    const bw = tw + px * 2;
    const bh = 14 + py * 2;

    // position above the point, clamped inside chart area
    let bx = pt.x - bw / 2;
    let by = pt.y - bh - 16;
    bx = Math.max(
      chart.chartArea.left + 2,
      Math.min(bx, chart.chartArea.right - bw - 2)
    );
    by = Math.max(chart.chartArea.top, by);

    // dashed stem
    ctx.strokeStyle = "rgba(137,180,250,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y - 6);
    ctx.lineTo(pt.x, by + bh);
    ctx.stroke();
    ctx.setLineDash([]);

    // pill bg
    ctx.fillStyle = CTP.surface0;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6);
    ctx.fill();

    // pill text
    ctx.fillStyle = CTP.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, bx + bw / 2, by + bh / 2);

    // dot glow
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(137,180,250,0.25)";
    ctx.fill();

    // dot ring
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = CTP.blue;
    ctx.fill();

    // dot center
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.restore();
  },
};

/* ------------------------------------------------------------------ */
/*  Card definition                                                   */
/* ------------------------------------------------------------------ */
customElements.define(
  "jelly-sensor-graph",
  class JellySensorGraph extends JellyCardBase {
    /* ---- static card metadata ---- */

    static get cardTag() {
      return "jelly-sensor-graph";
    }
    static get cardDomains() {
      return ["sensor"];
    }

    /**
     * Editor schema – entity, title, default range.
     */
    static get editorSchema() {
      return {
        schema: [
          {
            name: "entity",
            selector: { entity: { domain: ["sensor"] } },
          },
          { name: "title", selector: { text: {} } },
          {
            name: "range",
            selector: {
              select: {
                options: [
                  { value: "24h", label: "24 Hours" },
                  { value: "3d",  label: "3 Days" },
                  { value: "5d",  label: "5 Days" },
                  { value: "7d",  label: "7 Days" },
                ],
                mode: "dropdown",
              },
            },
          },
        ],
        labels: {
          entity: "Sensor Entity",
          title: "Card Title (optional)",
          range: "Default Range",
        },
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig(hass) {
      return JellyCardBase.getStubConfig.call(this, hass);
    }

    validateConfig() {
      // sensor entity validated by base class
    }

    /* ---- lifecycle ---- */

    afterLoad() {
      this.$title = this.qs(".title");
      this.$canvas = this.qs(".chart-canvas");
      this.$empty = this.qs(".empty-state");
      this._chart = null;
      this._data = null;
      this._prevEntity = null;
      this._activeRange = null;
      this._fetchAt = 0;
      this._timer = null;
      this._boot();
    }

    async _boot() {
      await this._ensureChartJs();
      this._setRange(this.config.range || DEFAULT_RANGE);
      this._timer = setInterval(() => this._fetchAndDraw(), REFRESH_MS);
    }

    /** Switch active range and re-fetch */
    _setRange(key) {
      if (!RANGES[key]) key = DEFAULT_RANGE;
      this._activeRange = key;
      this._fetchAt = 0; // force re-fetch
      this._fetchAndDraw();
    }

    /** Current range config */
    get _range() {
      return RANGES[this._activeRange] || RANGES[DEFAULT_RANGE];
    }

    render() {
      if (!this.hass || !this.config || !this.$title) return;

      const ent = this.stateObj();
      this.$title.textContent =
        this.config.title ||
        ent?.attributes?.friendly_name ||
        this.config.entity;

      // entity or default range changed in config → full refresh
      if (this.config.entity !== this._prevEntity) {
        this._setRange(this.config.range || this._activeRange || DEFAULT_RANGE);
        return;
      }

      // live-patch latest value onto existing chart
      if (this._chart && ent && !isNaN(parseFloat(ent.state))) {
        const ds = this._chart.data.datasets[0];
        if (ds?.data?.length) {
          ds.data[ds.data.length - 1] = parseFloat(ent.state);
          this._chart.update("none");
        }
      }

      // first paint before history has arrived
      if (!this._data && this.hass) this._fetchAndDraw();
    }

    disconnectedCallback() {
      if (this._timer) clearInterval(this._timer);
      this._chart?.destroy();
      super.disconnectedCallback();
    }

    getCardSize() {
      return 3;
    }

    /* ---- Chart.js CDN loader ---- */

    _ensureChartJs() {
      if (window.Chart) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${CHART_CDN}"]`);
        if (existing) {
          if (window.Chart) return resolve();
          existing.addEventListener("load", resolve);
          return;
        }
        const s = document.createElement("script");
        s.src = CHART_CDN;
        s.onload = resolve;
        s.onerror = () => reject(new Error("Chart.js failed to load"));
        document.head.appendChild(s);
      });
    }

    /* ---- data fetching ---- */

    async _fetchAndDraw() {
      if (!this.hass || !this.config?.entity) return;

      const now = Date.now();
      // throttle: max once per 30s for same entity+range
      if (
        now - this._fetchAt < 30_000 &&
        this._prevEntity === this.config.entity
      )
        return;

      this._fetchAt = now;
      this._prevEntity = this.config.entity;

      const raw = await this._fetchHistory();
      this._data = this._bucket(raw);
      this._draw();
    }

    async _fetchHistory() {
      const h = this._range.hours;
      const start = new Date(Date.now() - h * 36e5).toISOString();
      const end = new Date().toISOString();
      const eid = this.config.entity;

      // Try WebSocket API first (most reliable from HA frontend)
      try {
        const result = await this._hass.callWS({
          type: "history/history_during_period",
          start_time: start,
          end_time: end,
          entity_ids: [eid],
          minimal_response: true,
          no_attributes: true,
          significant_changes_only: false,
        });
        const entries = result?.[eid] || [];
        if (entries.length) return this._normalizeWS(entries);
      } catch (_wsErr) {
        console.warn("Jelly sensor-graph: WS history failed", _wsErr);
      }

      // Fallback: REST API
      try {
        const r = await this._hass.callApi(
          "GET",
          `history/period/${start}?filter_entity_id=${eid}&end_time=${end}&minimal_response&no_attributes`
        );
        const entries = r?.[0] || [];
        return entries;
      } catch (e) {
        console.warn("Jelly sensor-graph: REST history failed", e);
        return [];
      }
    }

    /**
     * Normalize HA WebSocket compressed history.
     * Format:
     *   Entry 0: { state, last_changed (ISO), last_updated (ISO) }
     *   Entry 1+: { s (state), lc? (Unix secs), lu? (Unix secs) }
     *     lc/lu are OMITTED if unchanged — carry forward the last known ts.
     */
    _normalizeWS(entries) {
      let lastTs = null;
      const out = [];

      for (const e of entries) {
        const state = e.s !== undefined ? String(e.s) : String(e.state ?? "");

        // Resolve timestamp — try every possible key/format
        let ts = e.lc ?? e.lu ?? e.last_changed ?? e.last_updated ?? null;

        if (typeof ts === "number") {
          // Unix seconds (< 1e11) vs millis (>= 1e11)
          ts = ts < 1e11 ? ts * 1000 : ts;
        } else if (typeof ts === "string") {
          ts = new Date(ts).getTime();
        }

        // If no timestamp at all, carry forward (HA omits when unchanged)
        if (!ts || !isFinite(ts)) {
          ts = lastTs;
        }
        if (ts) lastTs = ts;

        out.push({ state, last_changed: ts }); // ts is now millis (number)
      }

      return out;
    }

    /* ---- data processing ---- */

    /**
     * Down-sample raw history into fixed-size buckets.
     * Single-pass O(n) using typed arrays.
     */
    _bucket(raw) {
      const pts = raw
        .map((s) => {
          let t;
          const lc = s.last_changed ?? s.lc;
          if (typeof lc === "number") {
            // normalizeWS already converts to millis, but handle both
            t = lc < 1e11 ? lc * 1000 : lc;
          } else if (typeof lc === "string") {
            t = new Date(lc).getTime();
          } else {
            t = NaN;
          }
          const v = parseFloat(s.state ?? s.s);
          return { t, v };
        })
        .filter((p) => isFinite(p.v) && isFinite(p.t))
        .sort((a, b) => a.t - b.t);

      if (!pts.length) return { labels: [], data: [] };

      const numBuckets = this._range.buckets;

      // few enough points → use directly
      if (pts.length <= numBuckets) {
        return {
          labels: pts.map((p) => this._fmt(p.t)),
          data: pts.map((p) => p.v),
        };
      }

      const t0 = pts[0].t;
      const t1 = pts[pts.length - 1].t;
      if (t1 === t0) return { labels: [this._fmt(t0)], data: [pts[0].v] };

      const span = (t1 - t0) / numBuckets;
      const sums = new Float64Array(numBuckets);
      const counts = new Uint32Array(numBuckets);

      for (const p of pts) {
        let i = Math.floor((p.t - t0) / span);
        if (i >= numBuckets) i = numBuckets - 1;
        sums[i] += p.v;
        counts[i]++;
      }

      const labels = [];
      const data = [];
      let last = null;

      for (let i = 0; i < numBuckets; i++) {
        if (counts[i]) last = Math.round((sums[i] / counts[i]) * 10) / 10;
        data.push(last);
        labels.push(this._fmt(t0 + (i + 0.5) * span));
      }

      return { labels, data };
    }

    /** Smart time label based on active range */
    _fmt(ts) {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "";
      const h = this._range.hours;
      if (h <= 24)
        return d.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      if (h <= 72)
        return d.toLocaleDateString([], { weekday: "short", hour: "2-digit" });
      return d.toLocaleDateString([], { weekday: "short" });
    }

    /* ---- chart rendering ---- */

    _draw() {
      if (!this.$canvas || !window.Chart) return;

      const { labels, data } = this._data || { labels: [], data: [] };

      if (!data.length) {
        if (this.$empty) this.$empty.style.display = "flex";
        this.$canvas.style.display = "none";
        return;
      }

      if (this.$empty) this.$empty.style.display = "none";
      this.$canvas.style.display = "block";

      this._chart?.destroy();

      const ctx = this.$canvas.getContext("2d");
      const color = CTP.blue;

      // gradient fill beneath the line
      const wrapH =
        this.$canvas.parentElement?.offsetHeight ||
        this.$canvas.offsetHeight ||
        200;
      const grad = ctx.createLinearGradient(0, 0, 0, wrapH);
      grad.addColorStop(0, color + "30");
      grad.addColorStop(1, color + "00");

      const entity = this.stateObj();
      const unit = entity?.attributes?.unit_of_measurement || "";
      const h = this._range.hours;
      const ticksMax = h <= 24 ? 6 : h <= 72 ? 6 : 7;

      this._chart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              data,
              borderColor: color,
              backgroundColor: grad,
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          events: [], // fully static — no hover / click
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: {
                color: CTP.overlay0,
                font: { family: '"Inter", sans-serif', size: 11 },
                maxTicksLimit: ticksMax,
                maxRotation: 0,
              },
            },
            y: {
              grid: { color: "rgba(108,112,134,0.10)" },
              border: { display: false },
              ticks: {
                color: CTP.overlay0,
                font: { family: '"Inter", sans-serif', size: 11 },
                maxTicksLimit: 5,
                padding: 8,
              },
            },
          },
          layout: { padding: { top: 32, right: 8 } },
        },
        plugins: [latestPill],
      });

      this._chart.config._jellyUnit = unit;
    }
  }
);
