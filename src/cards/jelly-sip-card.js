import JellyCardBase from "../jelly-base.js";

customElements.define(
  "jelly-sip-card",
  class JellySipCard extends JellyCardBase {

    static minUnits = 2;

    static get cardTag() { return "jelly-sip-card"; }

    static get cardDomains() { return []; }

    /* ── Editor: custom grouped/reorderable list ── */

    static async getConfigElement() {
      if (!customElements.get("jelly-sip-editor")) {
        await import("./jelly-sip-editor.js");
      }
      return document.createElement("jelly-sip-editor");
    }

    static getStubConfig() {
      return {
        type: "custom:jelly-sip-card",
        name: "Intercom",
        entries: [
          { name: "Living Room", icon: "mdi:sofa" },
          { name: "Family Area", icon: "mdi:home" },
        ],
      };
    }

    /* ── Config: entity NOT required ── */

    async setConfig(config) {
      if (!config) throw new Error("Jelly: config is required");
      this.config = config;
      await this._ensureAssets();
      this._applyCardDimensions();
      this.render?.();
    }

    /* ── Lifecycle ── */

    afterLoad() {
      this.$card       = this.qs(".card");
      this.$title      = this.qs(".title");
      this.$wheel      = this.qs(".picker-wheel");
      this.$track      = this.qs(".picker-track");
      this.$knob       = this.qs(".swipe-knob");
      this.$chevrons   = this.qs(".swipe-chevrons");
      this.$dest       = this.qs(".swipe-dest");
      this.$swipeTrack = this.qs(".swipe-track");

      this._selectedIndex = 0;
      this._offset    = 0;
      this._velocity  = 0;
      this._dragging  = false;
      this._animFrame = null;
      this._wheelSnapTimer = 0;
      this._entries   = [];
      this._entriesKey = '';
      this._cleanups  = [];
      this._minOffset = 0;
      this._maxOffset = 0;

      this._bindPicker();
      this._bindSwipe();
    }

    render() {
      if (!this.config || !this.$card) return;

      this.$title.textContent = this.config.name || "Intercom";

      const entries = Array.isArray(this.config.entries) ? this.config.entries : [];

      // Only rebuild picker if entries actually changed
      const key = JSON.stringify(entries);
      if (this._entriesKey === key) return;
      this._entriesKey = key;
      this._entries = entries;

      this._buildPicker();
    }

    /* ══════════════════════════════════════════
       iOS Drum Picker  (left 60 %)
       — Exact port from test.html
       ══════════════════════════════════════════ */

    _buildPicker() {
      if (!this.$track) return;
      this.$track.innerHTML = '';

      if (!this._entries.length) {
        this.$track.innerHTML = '<div class="empty-state">No entries</div>';
        return;
      }

      this._entries.forEach((entry, i) => {
        const d = document.createElement('div');
        d.className = 'picker-item';
        d.dataset.index = i;
        d.innerHTML = `<ha-icon icon="${entry.icon || 'mdi:phone'}"></ha-icon>${entry.name || ''}`;
        this.$track.appendChild(d);
      });

      // Default select item #2 (index 1) if available
      const defaultIdx = this._entries.length > 1 ? 1 : 0;
      this._selectedIndex = defaultIdx;
      this._offset = 0;

      requestAnimationFrame(() => {
        this._itemH = this._measureItemH();
        const wheelH = this.$wheel.clientHeight;
        const centerOffset = Math.round((wheelH - this._itemH) / 2);
        this.$track.style.top = centerOffset + 'px';
        this._minOffset = -(this._entries.length - 1) * this._itemH;
        this._maxOffset = 0;
        const initialOffset = -defaultIdx * this._itemH;
        this._applyOffset(initialOffset);
        this._updateSelection();
        this._updateKnobIcon(defaultIdx);
      });
    }

    _measureItemH() {
      const item = this.$track?.querySelector('.picker-item');
      return item ? item.offsetHeight : 40;
    }

    _applyOffset(o) {
      this._offset = o;
      this.$track.style.transform = `translateY(${o}px)`;
      const h = this._itemH || 40;
      const idx = this._clamp(Math.round(-o / h), 0, this._entries.length - 1);
      if (idx !== this._selectedIndex) {
        this._selectedIndex = idx;
        this._updateSelection();
        this._updateKnobIcon(idx);
      }
    }

    _updateSelection() {
      this.$track.querySelectorAll('.picker-item').forEach(el => {
        el.classList.toggle('selected', +el.dataset.index === this._selectedIndex);
      });
    }

    _updateKnobIcon(idx) {
      const entry = this._entries[idx];
      if (!entry) return;
      const icon = this.$knob.querySelector('ha-icon');
      if (icon) icon.setAttribute('icon', entry.icon || 'mdi:phone');
    }

    _snapTo(idx) {
      const target = -idx * (this._itemH || 40);
      cancelAnimationFrame(this._animFrame);
      const start = this._offset;
      const dist  = target - start;
      const dur   = 320;
      const t0    = performance.now();
      const tick = (now) => {
        const p = Math.min((now - t0) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
        this._applyOffset(start + dist * ease);
        if (p < 1) this._animFrame = requestAnimationFrame(tick);
      };
      this._animFrame = requestAnimationFrame(tick);
    }

    _coast() {
      cancelAnimationFrame(this._animFrame);
      const friction = 0.94;
      const tick = () => {
        this._velocity *= friction;
        let next = this._offset + this._velocity;
        // Rubber-band at bounds
        if (next > this._maxOffset) { next = this._maxOffset + (next - this._maxOffset) * 0.3; this._velocity *= 0.5; }
        if (next < this._minOffset) { next = this._minOffset + (next - this._minOffset) * 0.3; this._velocity *= 0.5; }
        this._applyOffset(next);
        if (Math.abs(this._velocity) > 0.3) {
          this._animFrame = requestAnimationFrame(tick);
        } else {
          const h = this._itemH || 40;
          this._snapTo(this._clamp(Math.round(-this._offset / h), 0, this._entries.length - 1));
        }
      };
      this._animFrame = requestAnimationFrame(tick);
    }

    _bindPicker() {
      const wheel = this.$wheel;
      if (!wheel) return;

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
        // Rubber-band beyond edges
        if (next > this._maxOffset) next = this._maxOffset + (next - this._maxOffset) * 0.35;
        if (next < this._minOffset) next = this._minOffset + (next - this._minOffset) * 0.35;
        this._applyOffset(next);
        // Track velocity
        const now = performance.now();
        const dt  = now - lastTime;
        if (dt > 0) {
          this._velocity = (e.clientY - lastY) / dt * 16; // px per frame (~16ms)
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
          const h = this._itemH || 40;
          this._snapTo(this._clamp(Math.round(-this._offset / h), 0, this._entries.length - 1));
        }
      };

      const onWheel = (e) => {
        e.preventDefault();
        cancelAnimationFrame(this._animFrame);
        let next = this._offset - e.deltaY;
        next = this._clamp(next, this._minOffset, this._maxOffset);
        this._applyOffset(next);
        clearTimeout(this._wheelSnapTimer);
        this._wheelSnapTimer = setTimeout(() => {
          const h = this._itemH || 40;
          this._snapTo(this._clamp(Math.round(-this._offset / h), 0, this._entries.length - 1));
        }, 120);
      };

      wheel.addEventListener('pointerdown',   onDown);
      wheel.addEventListener('pointermove',   onMove);
      wheel.addEventListener('pointerup',     onEnd);
      wheel.addEventListener('pointercancel', onEnd);
      wheel.addEventListener('wheel', onWheel, { passive: false });

      this._cleanups.push(() => {
        wheel.removeEventListener('pointerdown',   onDown);
        wheel.removeEventListener('pointermove',   onMove);
        wheel.removeEventListener('pointerup',     onEnd);
        wheel.removeEventListener('pointercancel', onEnd);
        wheel.removeEventListener('wheel', onWheel);
      });
    }

    /* ══════════════════════════════════════════
       Swipe-to-Dial  (right 40 %)
       — Exact port from test.html
       ══════════════════════════════════════════ */

    _bindSwipe() {
      const knob     = this.$knob;
      const chevrons = this.$chevrons;
      const dest     = this.$dest;
      const track    = this.$swipeTrack;
      if (!knob || !chevrons || !dest || !track) return;

      const chevEls  = chevrons.querySelectorAll('.chev');
      const PAD       = 3;
      const REST_LEFT = PAD;

      let dragging = false, startX, startLeft, trackW, maxLeft, knobSize;

      const measure = () => {
        knobSize = knob.offsetWidth; // reads CSS-driven size (52 or 42)
        trackW   = track.clientWidth;
        maxLeft  = trackW - knobSize - PAD;
      };

      const layoutChevrons = () => {
        const knobEnd   = REST_LEFT + knobSize;
        const destStart = trackW - knobSize - PAD;
        const centre    = (knobEnd + destStart) / 2;
        const chevsW    = chevrons.offsetWidth || 48;
        chevrons.style.left = (centre - chevsW / 2) + 'px';
      };

      const updateChevrons = (progress) => {
        const thresholds = [0.2, 0.45, 0.7];
        chevEls.forEach((el, i) => {
          el.classList.toggle('lit', progress >= thresholds[i]);
        });
      };

      const onDown = (e) => {
        measure();
        dragging  = true;
        startX    = e.clientX;
        startLeft = knob.offsetLeft;
        knob.classList.add('grabbing');
        knob.setPointerCapture(e.pointerId);
        chevrons.classList.remove('idle');
        e.preventDefault();
      };

      const onMove = (e) => {
        if (!dragging) return;
        let newLeft = startLeft + (e.clientX - startX);
        newLeft = Math.max(REST_LEFT, Math.min(newLeft, maxLeft));
        knob.style.left = newLeft + 'px';
        const progress = (newLeft - REST_LEFT) / (maxLeft - REST_LEFT);
        dest.style.opacity = 0.4 + progress * 0.6;
        updateChevrons(progress);
      };

      const resetKnob = () => {
        knob.style.transition = 'left 0.35s cubic-bezier(.2,.8,.3,1)';
        knob.style.left = REST_LEFT + 'px';
        dest.style.opacity = 0.4;
        chevrons.classList.add('idle');
        updateChevrons(0);
        setTimeout(() => { knob.style.transition = ''; }, 360);
      };

      const triggerDial = () => {
        knob.style.transition = 'left 0.2s ease-out';
        knob.style.left = maxLeft + 'px';
        dest.classList.add('active');
        knob.classList.add('success');
        updateChevrons(1);

        const entry = this._entries[this._selectedIndex];
        if (entry) {
          this.dispatchEvent(new CustomEvent('jelly-sip-dial', {
            detail: { name: entry.name, icon: entry.icon, index: this._selectedIndex },
            bubbles: true,
            composed: true,
          }));
        }

        setTimeout(() => {
          dest.classList.remove('active');
          knob.classList.remove('success');
          resetKnob();
        }, 1600);
      };

      const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        knob.classList.remove('grabbing');
        const currentLeft = knob.offsetLeft;
        const progress = (currentLeft - REST_LEFT) / (maxLeft - REST_LEFT);
        if (progress > 0.8) {
          triggerDial();
        } else {
          resetKnob();
        }
      };

      knob.addEventListener('pointerdown',   onDown);
      knob.addEventListener('pointermove',   onMove);
      knob.addEventListener('pointerup',     onEnd);
      knob.addEventListener('pointercancel', onEnd);

      // Defer initial layout to next frame so DOM dimensions are available
      requestAnimationFrame(() => { measure(); layoutChevrons(); });

      // Re-measure when container query changes the track size
      const ro = new ResizeObserver(() => { measure(); layoutChevrons(); });
      ro.observe(track);

      this._cleanups.push(() => {
        ro.disconnect();
        knob.removeEventListener('pointerdown',   onDown);
        knob.removeEventListener('pointermove',   onMove);
        knob.removeEventListener('pointerup',     onEnd);
        knob.removeEventListener('pointercancel', onEnd);
      });
    }

    /* ── Helpers ── */

    _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    disconnectedCallback() {
      this._cleanups?.forEach(fn => fn());
      this._cleanups = [];
      cancelAnimationFrame(this._animFrame);
      super.disconnectedCallback();
    }
  }
);
