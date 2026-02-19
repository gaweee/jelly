/**
 * PickerWheel — Composable iOS-style drum picker with momentum scrolling,
 * rubber-band edges, and snap-to-nearest item.
 *
 * Features:
 *   - Pointer drag with velocity tracking
 *   - Momentum coast with configurable friction
 *   - Elastic rubber-band at bounds
 *   - Smooth ease-out snap to nearest item
 *   - Mouse wheel / trackpad support
 *   - Dynamic item height (reads from DOM)
 *
 * Usage:
 *   import { PickerWheel } from "../utils/picker-wheel.js";
 *
 *   const picker = new PickerWheel(wheelEl, trackEl, {
 *     onSelect(index, item) { ... },
 *   });
 *
 *   picker.setItems(entries, {
 *     defaultIndex: 1,
 *     buildItem(entry, i) {
 *       const div = document.createElement("div");
 *       div.className = "picker-item";
 *       div.innerHTML = `<ha-icon icon="${entry.icon}"></ha-icon>${entry.name}`;
 *       return div;
 *     },
 *   });
 *
 *   picker.destroy();
 */

/** @param {number} v @param {number} lo @param {number} hi */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class PickerWheel {

  /**
   * @param {HTMLElement} wheel - Scrollable viewport (masks overflow)
   * @param {HTMLElement} track - Inner element that translates vertically
   * @param {Object}      [opts]
   * @param {Function}    [opts.onSelect]      - (index, item) on selection change
   * @param {string}      [opts.selectedClass] - CSS class for selected item (default: "selected")
   * @param {number}      [opts.friction]      - Momentum friction 0–1 (default: 0.94)
   * @param {number}      [opts.snapDuration]  - Snap animation ms (default: 320)
   * @param {number}      [opts.wheelSnapDelay]- Delay before snap after wheel event (default: 120)
   */
  constructor(wheel, track, opts = {}) {
    this._wheel = wheel;
    this._track = track;
    this._onSelect      = opts.onSelect || (() => {});
    this._selectedClass = opts.selectedClass || 'selected';
    this._friction      = opts.friction ?? 0.94;
    this._snapDuration  = opts.snapDuration ?? 320;
    this._wheelSnapDelay = opts.wheelSnapDelay ?? 120;

    this._items     = [];
    this._itemEls   = [];
    this._offset    = 0;
    this._velocity  = 0;
    this._dragging  = false;
    this._animFrame = null;
    this._wheelTimer = 0;
    this._selectedIndex = 0;
    this._itemH     = 40;
    this._minOffset = 0;
    this._maxOffset = 0;
    this._cleanups  = [];

    this._bindPointer();
    this._bindWheel();
  }

  /* ── Public API ── */

  /** Currently selected index */
  get selectedIndex() { return this._selectedIndex; }

  /** Currently selected item */
  get selectedItem() { return this._items[this._selectedIndex] ?? null; }

  /**
   * Populate the picker with items.
   * @param {Array}    items
   * @param {Object}   [opts]
   * @param {number}   [opts.defaultIndex] - Initial selection (default: 0)
   * @param {Function} opts.buildItem      - (item, index) => HTMLElement
   */
  setItems(items, opts = {}) {
    const { defaultIndex = 0, buildItem } = opts;
    if (!buildItem) throw new Error('PickerWheel: buildItem callback required');

    this._items = items;
    this._track.innerHTML = '';

    if (!items.length) {
      this._itemEls = [];
      return;
    }

    this._itemEls = items.map((item, i) => {
      const el = buildItem(item, i);
      el.dataset.index = i;
      this._track.appendChild(el);
      return el;
    });

    this._selectedIndex = clamp(defaultIndex, 0, items.length - 1);

    // Defer measurement to next frame so DOM is laid out
    requestAnimationFrame(() => {
      this._itemH = this._measureItemH();
      const wheelH = this._wheel.clientHeight;
      const centerY = Math.round((wheelH - this._itemH) / 2);
      this._track.style.top = centerY + 'px';
      this._minOffset = -(items.length - 1) * this._itemH;
      this._maxOffset = 0;
      const initial = -this._selectedIndex * this._itemH;
      this._applyOffset(initial);
      this._updateSelection();
    });
  }

  /** Animate to a specific index */
  selectIndex(idx) {
    idx = clamp(idx, 0, this._items.length - 1);
    this._snapTo(idx);
  }

  /** Tear down all listeners */
  destroy() {
    this._cleanups.forEach(fn => fn());
    this._cleanups = [];
    cancelAnimationFrame(this._animFrame);
    clearTimeout(this._wheelTimer);
  }

  /* ── Internals ── */

  _measureItemH() {
    const el = this._itemEls[0];
    return el ? el.offsetHeight : 40;
  }

  _applyOffset(o) {
    this._offset = o;
    this._track.style.transform = `translateY(${o}px)`;
    const idx = clamp(Math.round(-o / this._itemH), 0, this._items.length - 1);
    if (idx !== this._selectedIndex) {
      this._selectedIndex = idx;
      this._updateSelection();
      this._onSelect(idx, this._items[idx]);
    }
  }

  _updateSelection() {
    const cls = this._selectedClass;
    this._itemEls.forEach((el, i) => {
      el.classList.toggle(cls, i === this._selectedIndex);
    });
  }

  _snapTo(idx) {
    const target = -idx * this._itemH;
    cancelAnimationFrame(this._animFrame);
    const start = this._offset;
    const dist  = target - start;
    const dur   = this._snapDuration;
    const t0    = performance.now();
    const tick  = (now) => {
      const p    = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      this._applyOffset(start + dist * ease);
      if (p < 1) this._animFrame = requestAnimationFrame(tick);
    };
    this._animFrame = requestAnimationFrame(tick);
  }

  _coast() {
    cancelAnimationFrame(this._animFrame);
    const friction = this._friction;
    const tick = () => {
      this._velocity *= friction;
      let next = this._offset + this._velocity;
      // Rubber-band beyond bounds
      if (next > this._maxOffset) {
        next = this._maxOffset + (next - this._maxOffset) * 0.3;
        this._velocity *= 0.5;
      }
      if (next < this._minOffset) {
        next = this._minOffset + (next - this._minOffset) * 0.3;
        this._velocity *= 0.5;
      }
      this._applyOffset(next);
      if (Math.abs(this._velocity) > 0.3) {
        this._animFrame = requestAnimationFrame(tick);
      } else {
        this._snapTo(clamp(
          Math.round(-this._offset / this._itemH), 0, this._items.length - 1
        ));
      }
    };
    this._animFrame = requestAnimationFrame(tick);
  }

  /* ── Event binding ── */

  _bindPointer() {
    const wheel = this._wheel;
    let startY, startOffset, lastY, lastTime;

    const onDown = (e) => {
      cancelAnimationFrame(this._animFrame);
      this._dragging = true;
      startY      = e.clientY;
      startOffset = this._offset;
      lastY       = e.clientY;
      lastTime    = performance.now();
      this._velocity = 0;
      wheel.classList.add('grabbing');
      wheel.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!this._dragging) return;
      const dy = e.clientY - startY;
      let next = startOffset + dy;
      if (next > this._maxOffset) next = this._maxOffset + (next - this._maxOffset) * 0.35;
      if (next < this._minOffset) next = this._minOffset + (next - this._minOffset) * 0.35;
      this._applyOffset(next);
      const now = performance.now();
      const dt  = now - lastTime;
      if (dt > 0) {
        this._velocity = (e.clientY - lastY) / dt * 16;
        lastY    = e.clientY;
        lastTime = now;
      }
    };

    const onEnd = () => {
      if (!this._dragging) return;
      this._dragging = false;
      wheel.classList.remove('grabbing');
      if (Math.abs(this._velocity) > 1.5) {
        this._coast();
      } else {
        this._snapTo(clamp(
          Math.round(-this._offset / this._itemH), 0, this._items.length - 1
        ));
      }
    };

    wheel.addEventListener('pointerdown',   onDown);
    wheel.addEventListener('pointermove',   onMove);
    wheel.addEventListener('pointerup',     onEnd);
    wheel.addEventListener('pointercancel', onEnd);

    this._cleanups.push(() => {
      wheel.removeEventListener('pointerdown',   onDown);
      wheel.removeEventListener('pointermove',   onMove);
      wheel.removeEventListener('pointerup',     onEnd);
      wheel.removeEventListener('pointercancel', onEnd);
    });
  }

  _bindWheel() {
    const wheel = this._wheel;

    const onWheel = (e) => {
      e.preventDefault();
      cancelAnimationFrame(this._animFrame);
      let next = this._offset - e.deltaY;
      next = clamp(next, this._minOffset, this._maxOffset);
      this._applyOffset(next);
      clearTimeout(this._wheelTimer);
      this._wheelTimer = setTimeout(() => {
        this._snapTo(clamp(
          Math.round(-this._offset / this._itemH), 0, this._items.length - 1
        ));
      }, this._wheelSnapDelay);
    };

    wheel.addEventListener('wheel', onWheel, { passive: false });
    this._cleanups.push(() => wheel.removeEventListener('wheel', onWheel));
  }
}

export default PickerWheel;
