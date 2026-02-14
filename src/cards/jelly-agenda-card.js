import JellyCardBase from "../jelly-base.js";

/**
 * Agenda Card — 5-week calendar grid with travel lane overlays.
 *
 * Week logic:
 *   If today is Wednesday or later  → this week + next 4
 *   Otherwise                       → previous week + this week + next 3
 *
 * Each day cell is a proper box (60px min) with the date number top-right.
 * Today's entire cell is highlighted.
 *
 * Travel lines:
 *   • Circular takeoff icon → thin bar → circular landing icon
 *   • Each trip gets its own lane (row offset) and accent color
 *   • Up to 3 concurrent travel lanes per week row
 *
 * Config:
 *   name   — (optional) display name override
 *   entity — (optional) calendar entity (future)
 *
 * Data source is isolated in fetchTravelData() — currently returns demo data;
 * will be replaced with real Google Calendar / HA calendar integration later.
 */

/* ─── Constants ────────────────────────────────────────────────────── */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/** Catppuccin Mocha accent palette for travel lanes. */
const LANE_ACCENTS = [
  { fill: "rgba(137,180,250,0.30)", stroke: "rgb(137,180,250)", bg: "rgba(137,180,250,0.25)" }, // blue
  { fill: "rgba(245,194,231,0.30)", stroke: "rgb(245,194,231)", bg: "rgba(245,194,231,0.25)" }, // pink
  { fill: "rgba(166,227,161,0.30)", stroke: "rgb(166,227,161)", bg: "rgba(166,227,161,0.25)" }, // green
];

const TRAVEL_ICONS = [
  "mdi:airplane-takeoff",
  "mdi:train",
  "mdi:car",
  "mdi:ferry",
  "mdi:bus",
];

/* ─── Helpers ──────────────────────────────────────────────────────── */

/** Monday of the ISO week containing `date`. */
function mondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD key for a Date. */
function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Add `n` days to a Date (returns new Date). */
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Random int in [min, max]. */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Data source — isolated for future replacement                    */
/* ─────────────────────────────────────────────────────────────────── */

/**
 * Fetch travel / calendar data for the visible date range.
 *
 * Returns an array of travel objects:
 *   { start: Date, end: Date, startKey, endKey, icon, lane, calendar }
 *
 * Currently generates 2–3 random demo trips.
 * Replace this function's body with real Google Calendar / HA calendar
 * integration later — the rest of the card consumes the same shape.
 */
function fetchTravelData(gridStart, gridEnd) {
  const totalDays = Math.round((gridEnd - gridStart) / 86400000) + 1;
  const midDay = Math.floor(totalDays / 2);
  const travelCount = randInt(2, 3);
  const travels = [];

  const zoneStart = Math.max(0, midDay - 7);
  const zoneEnd = Math.min(totalDays - 1, midDay + 7);

  // First trip: anchored near the start of the zone
  const dur1 = randInt(3, Math.min(8, zoneEnd - zoneStart + 1));
  const off1 = randInt(zoneStart, Math.max(zoneStart, zoneStart + 3));
  const s1 = addDays(gridStart, off1);
  const e1 = addDays(gridStart, off1 + dur1 - 1);
  travels.push({
    start: s1, end: e1,
    startKey: dateKey(s1), endKey: dateKey(e1),
    icon: TRAVEL_ICONS[randInt(0, TRAVEL_ICONS.length - 1)],
    lane: 0,
    calendar: "calendar_0",
  });

  // Second trip: guaranteed to overlap with the first
  const overlapStart = randInt(off1 + 1, off1 + dur1 - 1); // starts during trip 1
  const dur2 = randInt(2, Math.min(6, zoneEnd - overlapStart + 1));
  const s2 = addDays(gridStart, overlapStart);
  const e2 = addDays(gridStart, overlapStart + dur2 - 1);
  travels.push({
    start: s2, end: e2,
    startKey: dateKey(s2), endKey: dateKey(e2),
    icon: TRAVEL_ICONS[randInt(0, TRAVEL_ICONS.length - 1)],
    lane: 1,
    calendar: "calendar_1",
  });

  // Optional third trip
  if (travelCount >= 3) {
    const t2End = overlapStart + dur2 - 1;
    const off3 = randInt(
      Math.max(off1 + 1, t2End - 2),
      Math.min(t2End + 2, zoneEnd - 2)
    );
    if (off3 >= 0 && off3 + 2 <= totalDays) {
      const dur3 = randInt(2, Math.min(5, totalDays - off3));
      const s3 = addDays(gridStart, off3);
      const e3 = addDays(gridStart, off3 + dur3 - 1);
      travels.push({
        start: s3, end: e3,
        startKey: dateKey(s3), endKey: dateKey(e3),
        icon: TRAVEL_ICONS[randInt(0, TRAVEL_ICONS.length - 1)],
        lane: 2,
        calendar: "calendar_2",
      });
    }
  }

  return travels;
}

/**
 * Fetch calendar event data for the visible date range.
 *
 * Returns an array of event objects:
 *   { key: "YYYY-MM-DD", date: Date, title: string, location: string,
 *     time: string, color: string, calendar: number }
 *
 * Currently generates demo events across the grid.
 * Replace with real HA calendar integration later.
 */
function fetchEventData(gridStart, gridEnd) {
  const events = [];
  const totalDays = Math.round((gridEnd - gridStart) / 86400000) + 1;
  const titles = [
    "Team standup", "Dentist appt", "Lunch w/ Sam",
    "Design review", "Grocery run", "1:1 with manager",
    "Book club", "Yoga class", "Sprint retro",
    "Date night", "Haircut", "Oil change",
  ];
  const locations = [
    "Google Meet", "Clinic on Main St", "Cafe Nero",
    "Zoom", "Whole Foods", "Office 3B",
    "Library", "Downtown Studio", "Conf Room A",
    "Osteria Roma", "Hair Lab", "AutoZone",
  ];
  const times = [
    "9:00", "9:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  ];
  const colors = [
    "#89b4fa", // blue
    "#f5c2e7", // pink
    "#a6e3a1", // green
    "#fab387", // peach
    "#cba6f7", // mauve
    "#f9e2af", // yellow
  ];

  // Realistic spread: 8–12 events scattered across the grid
  const count = randInt(8, 12);
  const usedDays = new Set();
  for (let i = 0; i < count; i++) {
    let off;
    do { off = randInt(0, totalDays - 1); } while (usedDays.has(off) && usedDays.size < totalDays - 5);
    usedDays.add(off);
    const d = addDays(gridStart, off);
    events.push({
      key: dateKey(d),
      date: d,
      title: titles[i % titles.length],
      location: locations[i % locations.length],
      time: times[randInt(0, times.length - 1)],
      color: colors[i % colors.length],
      calendar: i % 3,
    });
  }

  // Add 1–2 extra events on 2 existing days to create mild stacking
  const occupied = [...usedDays];
  for (let i = 0; i < 2 && occupied.length > 0; i++) {
    const off = occupied[randInt(0, occupied.length - 1)];
    const d = addDays(gridStart, off);
    events.push({
      key: dateKey(d),
      date: d,
      title: titles[randInt(0, titles.length - 1)],
      location: locations[randInt(0, locations.length - 1)],
      time: times[randInt(0, times.length - 1)],
      color: colors[randInt(0, colors.length - 1)],
      calendar: randInt(0, 2),
    });
  }

  return events;
}

/**
 * Build a map: dateKey → count of events on that date.
 */
function buildEventMap(events) {
  const map = new Map();
  for (const e of events) {
    map.set(e.key, (map.get(e.key) || 0) + 1);
  }
  return map;
}

/* ─── Card definition ──────────────────────────────────────────────── */

customElements.define(
  "jelly-agenda-card",
  class JellyAgendaCard extends JellyCardBase {

    static minUnits = 4;

    static get cardTag() { return "jelly-agenda-card"; }
    static get cardDomains() { return null; }

    static get editorSchema() {
      return {
        schema: [
          { name: "name", selector: { text: {} } },
          { name: "weeks", selector: { select: { mode: "dropdown", options: [
            { value: "3", label: "3 weeks" },
            { value: "4", label: "4 weeks" },
            { value: "5", label: "5 weeks" },
          ] } } },
          { name: "show_agenda", selector: { boolean: {} } },
        ],
        labels: {
          name: "Title Prefix (optional)",
          weeks: "Weeks to display",
          show_agenda: "Show Agenda List",
        },
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig() {
      return { type: "custom:jelly-agenda-card", weeks: "4", show_agenda: true };
    }

    /** Entity is NOT required. */
    async setConfig(config) {
      this.config = config || {};
      await this._ensureAssets();
      this._applyCardDimensions();
      this.render?.();
    }

    _applyCardDimensions() {}

    afterLoad() {
      this.$monthLabel = this.qs(".month-label");
      this.$weeks = this.qs(".weeks");
      this.$agenda = this.qs(".agenda");
      this.$card = this.qs(".card");
      this._travelData = null;
      this._lastRangeKey = null;
      this._popover = null;
      this.render();
    }

    /* ────────────────────────────────── */
    /*  Grid computation                 */
    /* ────────────────────────────────── */

    _computeGridStart() {
      const today = new Date();
      const dow = today.getDay();
      const isoDay = dow === 0 ? 7 : dow;
      const thisMon = mondayOfWeek(today);

      return isoDay >= 3 ? thisMon : addDays(thisMon, -7);
    }

    _buildDays(gridStart, totalDays) {
      const todayK = dateKey(new Date());
      const midDate = addDays(gridStart, Math.floor(totalDays / 2));
      const primaryMonth = midDate.getMonth();
      const primaryYear = midDate.getFullYear();

      const days = [];
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(gridStart, i);
        days.push({
          date: d,
          key: dateKey(d),
          dayNum: d.getDate(),
          month: d.getMonth(),
          year: d.getFullYear(),
          isToday: dateKey(d) === todayK,
          isOutside: d.getMonth() !== primaryMonth || d.getFullYear() !== primaryYear,
        });
      }
      return days;
    }

    /* ────────────────────────────────── */
    /*  Travel lookup builder            */
    /* ────────────────────────────────── */

    _buildTravelMap(travels) {
      const map = new Map(); // dateKey → [{ lane, role, icon }]
      for (const t of travels) {
        let cur = new Date(t.start);
        while (cur <= t.end) {
          const k = dateKey(cur);
          if (!map.has(k)) map.set(k, []);
          let role = "mid";
          if (k === t.startKey) role = "start";
          else if (k === t.endKey) role = "end";
          map.get(k).push({ lane: t.lane, role, icon: t.icon });
          cur = addDays(cur, 1);
        }
      }
      return map;
    }

    /* ────────────────────────────────── */
    /*  Render                           */
    /* ────────────────────────────────── */

    render() {
      if (!this.$weeks || !this.$monthLabel) return;
      this._dismissPopover();

      const numWeeks = Math.max(3, Math.min(5, parseInt(this.config.weeks, 10) || 4));
      const totalDays = numWeeks * 7;

      const gridStart = this._computeGridStart();
      const gridEnd = addDays(gridStart, totalDays - 1);
      const days = this._buildDays(gridStart, totalDays);

      // Fetch / regenerate travel data when range changes
      const rangeKey = dateKey(gridStart);
      if (rangeKey !== this._lastRangeKey) {
        this._lastRangeKey = rangeKey;
        this._travelData = fetchTravelData(gridStart, gridEnd);
      }
      const travels = this._travelData;
      const travelMap = this._buildTravelMap(travels);

      // Event data
      if (!this._eventData || rangeKey !== this._lastEventKey) {
        this._lastEventKey = rangeKey;
        this._eventData = fetchEventData(gridStart, gridEnd);
      }
      const eventMap = buildEventMap(this._eventData);

      // Month label — optional prefix
      const months = [...new Set(days.map(d => d.month))];
      const midIdx = Math.floor(totalDays / 2);
      const year = days[midIdx].year;
      let monthStr;
      if (months.length <= 2) {
        monthStr = months.map(m => MONTHS[m]).join(" / ") + ` ${year}`;
      } else {
        monthStr = `${MONTHS[months[0]]} – ${MONTHS[months[months.length - 1]]} ${year}`;
      }
      const prefix = this.config.name?.trim();
      this.$monthLabel.textContent = prefix ? `${prefix} — ${monthStr}` : monthStr;

      // Clear & rebuild
      this.$weeks.innerHTML = "";

      for (let w = 0; w < numWeeks; w++) {
        const weekDays = days.slice(w * 7, w * 7 + 7);
        const weekRow = document.createElement("div");
        weekRow.className = "week-row";

        // SVG overlay for travel bars
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "travel-svg");
        svg.setAttribute("preserveAspectRatio", "none");
        weekRow.appendChild(svg);

        // Day cells
        for (let d = 0; d < 7; d++) {
          const day = weekDays[d];
          const cell = document.createElement("div");
          cell.className = "day-cell";
          if (day.isToday) cell.classList.add("today");

          const num = document.createElement("span");
          num.className = "day-num";
          num.textContent = day.dayNum;
          cell.appendChild(num);

          // Event count badge
          const evCount = eventMap.get(day.key) || 0;
          if (evCount > 0) {
            const badge = document.createElement("span");
            badge.className = "event-badge";
            if (evCount === 1) {
              badge.classList.add("single");
            } else {
              badge.textContent = evCount;
            }
            cell.appendChild(badge);
          }

          cell.addEventListener("click", () => this._showDayPopover(cell, day));
          weekRow.appendChild(cell);
        }

        this.$weeks.appendChild(weekRow);

        // Draw travel lines after layout settles
        this._drawTravelLines(weekRow, svg, weekDays, travelMap);
      }

      // Render agenda list
      this._renderAgenda(this._eventData);
    }

    /* ────────────────────────────────── */
    /*  Travel line rendering            */
    /* ────────────────────────────────── */

    /**
     * Draw travel lines: takeoff icon ──thin bar── landing icon.
     * Each lane gets a vertical offset so up to 3 can stack.
     */
    _drawTravelLines(weekRow, svg, weekDays, travelMap) {
      requestAnimationFrame(() => {
        const rowRect = weekRow.getBoundingClientRect();
        if (rowRect.width === 0 || rowRect.height === 0) return;

        svg.setAttribute("viewBox", `0 0 ${rowRect.width} ${rowRect.height}`);

        const cells = weekRow.querySelectorAll(".day-cell");
        const cellRects = Array.from(cells).map(c => c.getBoundingClientRect());

        // Collect contiguous spans per lane in this row
        const lanesInRow = new Map(); // lane → [{ startCol, endCol, startRole, endRole, icon }]

        for (let col = 0; col < 7; col++) {
          const day = weekDays[col];
          const entries = travelMap.get(day.key) || [];
          for (const e of entries) {
            if (!lanesInRow.has(e.lane)) lanesInRow.set(e.lane, []);
            const spans = lanesInRow.get(e.lane);
            const last = spans[spans.length - 1];
            if (last && last.endCol === col - 1) {
              last.endCol = col;
              last.endRole = e.role;
            } else {
              spans.push({
                startCol: col,
                endCol: col,
                startRole: e.role,
                endRole: e.role,
                icon: e.icon,
              });
            }
          }
        }

        // Lane layout constants
        const barHeight = 3;
        const iconSize = 16;
        const laneSpacing = 11; // tighter stacking
        const laneBaseY = 20;  // clear of date-num area
        const cellInset = 4;   // keep bars off cell edges

        for (const [lane, spans] of lanesInRow) {
          const accent = LANE_ACCENTS[lane % LANE_ACCENTS.length];
          const y = laneBaseY + lane * laneSpacing;
          const centerY = y + iconSize / 2;

          for (const span of spans) {
            const sRect = cellRects[span.startCol];
            const eRect = cellRects[span.endCol];

            // Icon X positions — takeoff near right edge, landing near left edge
            const iconInset = 6; // px from cell edge to icon center
            const startCx = sRect.right - rowRect.left - iconInset - iconSize / 2;
            const endCx = eRect.left - rowRect.left + iconInset + iconSize / 2;

            const hasStartIcon = span.startRole === "start";
            const hasEndIcon = span.endRole === "end";

            // Bar runs from icon edge (if icon present) or cell edge + inset (if continuation)
            const barX1 = hasStartIcon
              ? startCx + iconSize / 2
              : sRect.left - rowRect.left + cellInset;
            const barX2 = hasEndIcon
              ? endCx - iconSize / 2
              : eRect.right - rowRect.left - cellInset;

            // Draw the connecting bar
            if (barX2 > barX1) {
              const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
              bar.setAttribute("x", barX1);
              bar.setAttribute("y", centerY - barHeight / 2);
              bar.setAttribute("width", barX2 - barX1);
              bar.setAttribute("height", barHeight);
              bar.setAttribute("rx", barHeight / 2);
              bar.setAttribute("fill", accent.fill);
              svg.appendChild(bar);
            }

            // Start icon (takeoff) — right side of cell
            if (hasStartIcon) {
              this._addTravelIcon(weekRow, rowRect, startCx, y, "mdi:airplane-takeoff", lane);
            }

            // End icon (landing) — left side of cell
            if (hasEndIcon) {
              this._addTravelIcon(weekRow, rowRect, endCx, y, "mdi:airplane-landing", lane);
            }
          }
        }
      });
    }

    /**
     * Place a circular travel icon at absolute pixel position within weekRow.
     */
    _addTravelIcon(weekRow, rowRect, cx, y, iconName, lane) {
      const iconSize = 16;
      const el = document.createElement("div");
      el.className = `travel-icon lane-${lane % LANE_ACCENTS.length}`;
      el.style.left = `${cx - iconSize / 2}px`;
      el.style.top = `${y}px`;

      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", iconName);
      el.appendChild(icon);

      weekRow.appendChild(el);
    }

    disconnectedCallback() {
      super.disconnectedCallback();
    }

    /* ────────────────────────────────── */
    /*  Agenda list rendering            */
    /* ────────────────────────────────── */

    /* ────────────────────────────────── */
    /*  Day popover                        */
    /* ────────────────────────────────── */

    _dismissPopover() {
      if (this._popoverTimer) {
        clearTimeout(this._popoverTimer);
        this._popoverTimer = null;
      }
      if (this._popover) {
        this._popover.backdrop.remove();
        this._popover.el.remove();
        this._popover = null;
      }
    }

    _showDayPopover(cell, day) {
      // Dismiss existing
      this._dismissPopover();

      const calColors = JellyAgendaCard.CALENDAR_COLORS;
      const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      // Gather travel items that overlap this day
      const travels = (this._travelData || []).filter(t => {
        return day.date >= t.start && day.date <= t.end;
      });

      // Gather single-day events on this date
      const events = (this._eventData || []).filter(e => e.key === day.key)
        .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

      // Build popover
      const pop = document.createElement("div");
      pop.className = "day-popover";

      // Header: "Saturday 14"
      const header = document.createElement("div");
      header.className = "day-popover-header";
      header.textContent = `${DAYS_FULL[day.date.getDay()]} ${day.dayNum}`;
      pop.appendChild(header);

      let hasContent = false;

      // Travel section
      if (travels.length > 0) {
        hasContent = true;
        const sec = document.createElement("div");
        sec.className = "agenda-section";
        const lbl = document.createElement("div");
        lbl.className = "agenda-section-header";
        lbl.textContent = "Full / Multi Day Events";
        sec.appendChild(lbl);
        for (const t of travels) {
          const item = document.createElement("div");
          item.className = "agenda-item";
          const laneIdx = typeof t.lane === "number" ? t.lane : 0;
          item.style.borderLeftColor = calColors[laneIdx % calColors.length];
          const info = document.createElement("div");
          info.className = "agenda-info";
          const label = document.createElement("span");
          label.className = "agenda-label";
          const sd = t.start, ed = t.end;
          label.textContent = `${MONTHS[sd.getMonth()]} ${sd.getDate()} – ${MONTHS[ed.getMonth()]} ${ed.getDate()}`;
          const loc = document.createElement("span");
          loc.className = "agenda-location";
          const dur = Math.round((ed - sd) / 86400000) + 1;
          loc.textContent = `${dur} days`;
          info.appendChild(label);
          info.appendChild(loc);
          item.appendChild(info);
          sec.appendChild(item);
        }
        pop.appendChild(sec);
      }

      // Events section
      if (events.length > 0) {
        hasContent = true;
        const sec = document.createElement("div");
        sec.className = "agenda-section";
        if (travels.length > 0) {
          const lbl = document.createElement("div");
          lbl.className = "agenda-section-header";
          lbl.textContent = "Day Events";
          sec.appendChild(lbl);
        }
        for (const ev of events) {
          const item = document.createElement("div");
          item.className = "agenda-item";
          item.style.borderLeftColor = calColors[ev.calendar % calColors.length];
          const info = document.createElement("div");
          info.className = "agenda-info";
          const label = document.createElement("span");
          label.className = "agenda-label";
          label.textContent = ev.title;
          const loc = document.createElement("span");
          loc.className = "agenda-location";
          loc.textContent = [ev.time, ev.location].filter(Boolean).join(", ");
          info.appendChild(label);
          info.appendChild(loc);
          item.appendChild(info);
          sec.appendChild(item);
        }
        pop.appendChild(sec);
      }

      // Empty state
      if (!hasContent) {
        const empty = document.createElement("div");
        empty.className = "agenda-empty";
        empty.textContent = "No events";
        pop.appendChild(empty);
      }

      // Position: relative to .card
      const cardRect = this.$card.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      const cellCenterX = cellRect.left + cellRect.width / 2 - cardRect.left;
      const cellBottomY = cellRect.bottom - cardRect.top + 4;

      // Horizontal: center on cell, but clamp within card
      const popWidth = 220; // approximate; CSS clamp(180,60%,260)
      let left = cellCenterX - popWidth / 2;
      left = Math.max(4, Math.min(left, cardRect.width - popWidth - 4));
      pop.style.left = `${left}px`;
      pop.style.top = `${cellBottomY}px`;

      // If popover would overflow bottom, show above instead
      // (handled after insertion since we need measured height)

      // Backdrop for dismiss
      const backdrop = document.createElement("div");
      backdrop.className = "day-popover-backdrop";
      backdrop.addEventListener("click", (e) => {
        e.stopPropagation();
        this._dismissPopover();
      });

      this.$card.style.position = "relative";
      this.$card.appendChild(backdrop);
      this.$card.appendChild(pop);

      this._popover = { el: pop, backdrop };

      // Auto-dismiss after 120 s (dashboard kiosk mode)
      this._popoverTimer = setTimeout(() => this._dismissPopover(), 120_000);

      // Adjust if overflowing bottom
      requestAnimationFrame(() => {
        const popRect = pop.getBoundingClientRect();
        if (popRect.bottom > cardRect.bottom - 4) {
          const above = cellRect.top - cardRect.top - 4;
          pop.style.top = `${above - popRect.height}px`;
        }
      });
    }

    /** Calendar lane colors for left border. */
    static CALENDAR_COLORS = [
      "rgb(137,180,250)",  // blue  (lane 0)
      "rgb(245,194,231)",  // pink  (lane 1)
      "rgb(166,227,161)",  // green (lane 2)
    ];

    _renderAgenda(events) {
      if (!this.$agenda) return;
      this.$agenda.innerHTML = "";

      const showAgenda = this.config.show_agenda !== false;
      this.$agenda.style.display = showAgenda ? "" : "none";
      if (!showAgenda) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekEnd = addDays(today, 7);   // today + 6 more days
      const twoWeeksEnd = addDays(today, 14);

      // Filter & sort events from today onward
      const upcoming = events
        .filter(e => e.date >= today && e.date < twoWeeksEnd)
        .sort((a, b) => a.date - b.date || (a.time || "").localeCompare(b.time || ""));

      const thisWeek = upcoming.filter(e => e.date < weekEnd);
      const nextWeek = upcoming.filter(e => e.date >= weekEnd);

      const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      const buildItem = (ev) => {
        const item = document.createElement("div");
        item.className = "agenda-item";
        const calColors = JellyAgendaCard.CALENDAR_COLORS;
        item.style.borderLeftColor = calColors[ev.calendar % calColors.length];

        const info = document.createElement("div");
        info.className = "agenda-info";

        const label = document.createElement("span");
        label.className = "agenda-label";
        label.textContent = ev.title;

        const loc = document.createElement("span");
        loc.className = "agenda-location";
        loc.textContent = [ev.time, ev.location].filter(Boolean).join(", ");

        info.appendChild(label);
        info.appendChild(loc);

        const dateEl = document.createElement("span");
        dateEl.className = "agenda-date";
        const dayStr = DAYS_SHORT[ev.date.getDay()];
        dateEl.textContent = `${dayStr} ${ev.date.getDate()}`;

        item.appendChild(info);
        item.appendChild(dateEl);
        return item;
      };

      // "This week" section
      if (thisWeek.length > 0) {
        const sec = document.createElement("div");
        sec.className = "agenda-section";
        const h = document.createElement("div");
        h.className = "agenda-section-header";
        h.textContent = "Upcoming this week";
        sec.appendChild(h);
        for (const ev of thisWeek) sec.appendChild(buildItem(ev));
        this.$agenda.appendChild(sec);
      }

      // "Next 2 weeks" section
      if (nextWeek.length > 0) {
        const sec = document.createElement("div");
        sec.className = "agenda-section";
        const h = document.createElement("div");
        h.className = "agenda-section-header";
        h.textContent = "In the next 2 weeks";
        sec.appendChild(h);
        for (const ev of nextWeek) sec.appendChild(buildItem(ev));
        this.$agenda.appendChild(sec);
      }

      if (thisWeek.length === 0 && nextWeek.length === 0) {
        const empty = document.createElement("div");
        empty.className = "agenda-empty";
        empty.textContent = "No upcoming events";
        this.$agenda.appendChild(empty);
      }
    }
  }
);
