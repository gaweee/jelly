/**
 * SwipeAction — Composable horizontal swipe-to-confirm gesture with
 * progressive chevron lighting, threshold detection, and auto-reset.
 *
 * Features:
 *   - Pointer-based horizontal drag
 *   - Progressive chevron lighting at configurable thresholds
 *   - Idle pulse animation (CSS class toggle)
 *   - Success state with auto-reset after delay
 *   - Dynamic measurement via ResizeObserver (responds to container queries)
 *
 * DOM contract (expected elements inside track):
 *   track    — Container with overflow:hidden, touch-action:none
 *   knob     — Draggable circle (left-positioned absolutely)
 *   dest     — Target indicator (right-positioned absolutely)
 *   chevrons — Container with child .chev spans
 *
 * Usage:
 *   import { SwipeAction } from "../utils/swipe-action.js";
 *
 *   const swipe = new SwipeAction({
 *     track, knob, dest, chevrons,
 *     onTrigger() { console.log("Confirmed!"); },
 *   });
 *
 *   swipe.destroy();
 */

export class SwipeAction {

  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.track      - Swipe track container
   * @param {HTMLElement} opts.knob       - Draggable knob element
   * @param {HTMLElement} opts.dest       - Destination indicator element
   * @param {HTMLElement} opts.chevrons   - Chevron container element
   * @param {number}   [opts.threshold]   - Progress 0–1 to trigger (default: 0.8)
   * @param {number}   [opts.pad]         - Edge padding in px (default: 3)
   * @param {number}   [opts.resetDelay]  - Ms before auto-reset after trigger (default: 1600)
   * @param {Function} [opts.onTrigger]   - Called when swipe completes
   * @param {Function} [opts.onProgress]  - (progress: 0–1) called during drag
   * @param {number[]} [opts.chevronThresholds] - Progress levels to light chevrons (default: [0.2, 0.45, 0.7])
   */
  constructor(opts) {
    this._track    = opts.track;
    this._knob     = opts.knob;
    this._dest     = opts.dest;
    this._chevrons = opts.chevrons;

    this._threshold  = opts.threshold ?? 0.8;
    this._pad        = opts.pad ?? 3;
    this._resetDelay = opts.resetDelay ?? 1600;
    this._onTrigger  = opts.onTrigger || (() => {});
    this._onProgress = opts.onProgress || (() => {});
    this._chevThresh = opts.chevronThresholds || [0.2, 0.45, 0.7];

    this._chevEls = this._chevrons.querySelectorAll('.chev');
    this._dragging = false;
    this._cleanups = [];

    this._bind();
    this._observe();
  }

  /* ── Public ── */

  /** Reset knob to resting position */
  reset() { this._resetKnob(); }

  /** Tear down all listeners */
  destroy() {
    this._cleanups.forEach(fn => fn());
    this._cleanups = [];
  }

  /* ── Measurement ── */

  _measure() {
    this._knobSize = this._knob.offsetWidth;
    this._trackW   = this._track.clientWidth;
    this._restLeft = this._pad;
    this._maxLeft  = this._trackW - this._knobSize - this._pad;
  }

  _layoutChevrons() {
    const knobEnd   = this._restLeft + this._knobSize;
    const destStart = this._trackW - this._knobSize - this._pad;
    const centre    = (knobEnd + destStart) / 2;
    const chevsW    = this._chevrons.offsetWidth || 48;
    this._chevrons.style.left = (centre - chevsW / 2) + 'px';
  }

  /* ── Chevron state ── */

  _updateChevrons(progress) {
    this._chevEls.forEach((el, i) => {
      el.classList.toggle('lit', progress >= this._chevThresh[i]);
    });
  }

  /* ── Reset / trigger ── */

  _resetKnob() {
    const knob = this._knob;
    knob.style.transition = 'left 0.35s cubic-bezier(.2,.8,.3,1)';
    knob.style.left = this._restLeft + 'px';
    this._dest.style.opacity = 0.4;
    this._chevrons.classList.add('idle');
    this._updateChevrons(0);
    setTimeout(() => { knob.style.transition = ''; }, 360);
  }

  _triggerAction() {
    const knob = this._knob;
    knob.style.transition = 'left 0.2s ease-out';
    knob.style.left = this._maxLeft + 'px';
    this._dest.classList.add('active');
    knob.classList.add('success');
    this._updateChevrons(1);
    this._onTrigger();

    setTimeout(() => {
      this._dest.classList.remove('active');
      knob.classList.remove('success');
      this._resetKnob();
    }, this._resetDelay);
  }

  /* ── Event binding ── */

  _bind() {
    const knob = this._knob;
    let startX, startLeft;

    const onDown = (e) => {
      this._measure();
      this._dragging = true;
      startX    = e.clientX;
      startLeft = knob.offsetLeft;
      knob.classList.add('grabbing');
      knob.setPointerCapture(e.pointerId);
      this._chevrons.classList.remove('idle');
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!this._dragging) return;
      let newLeft = startLeft + (e.clientX - startX);
      newLeft = Math.max(this._restLeft, Math.min(newLeft, this._maxLeft));
      knob.style.left = newLeft + 'px';
      const progress = (newLeft - this._restLeft) / (this._maxLeft - this._restLeft);
      this._dest.style.opacity = 0.4 + progress * 0.6;
      this._updateChevrons(progress);
      this._onProgress(progress);
    };

    const onEnd = () => {
      if (!this._dragging) return;
      this._dragging = false;
      knob.classList.remove('grabbing');
      const progress = (knob.offsetLeft - this._restLeft) / (this._maxLeft - this._restLeft);
      if (progress > this._threshold) {
        this._triggerAction();
      } else {
        this._resetKnob();
      }
    };

    knob.addEventListener('pointerdown',   onDown);
    knob.addEventListener('pointermove',   onMove);
    knob.addEventListener('pointerup',     onEnd);
    knob.addEventListener('pointercancel', onEnd);

    this._cleanups.push(() => {
      knob.removeEventListener('pointerdown',   onDown);
      knob.removeEventListener('pointermove',   onMove);
      knob.removeEventListener('pointerup',     onEnd);
      knob.removeEventListener('pointercancel', onEnd);
    });
  }

  /** ResizeObserver for dynamic sizing (container queries) */
  _observe() {
    // Defer initial layout to next frame so DOM dimensions are available
    requestAnimationFrame(() => { this._measure(); this._layoutChevrons(); });

    const ro = new ResizeObserver(() => { this._measure(); this._layoutChevrons(); });
    ro.observe(this._track);
    this._cleanups.push(() => ro.disconnect());
  }
}

export default SwipeAction;
