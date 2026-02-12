// Base class for Jelly cards. Handles asset loading, shadow DOM, helpers, gestures, and optimistic UI.

const ASSET_BASE = "/local/jelly/src/cards/";
const DEFAULT_OPTIMISTIC_TIMEOUT = 1200;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jelly: failed to load ${url}`);
  return res.text();
}

export class JellyCardBase extends HTMLElement {
  static assetCache = new Map();
  static cardTag = null; // subclasses should set; used for editor helpers
  static cardDomains = null; // optional preferred domains for entity picker
  static defaultUnits = 1; // default card height units; subclasses can override

  constructor() {
    super();
    this._assetsLoaded = false;
    this._assetPromise = null;
    this._pendingToggles = [];
    this._gestureBindings = [];
    this._animState = null;
  }

  async setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("Jelly: entity is required");
    }

    this.config = config;
    if (typeof this.validateConfig === "function") {
      this.validateConfig(config);
    }

    await this._ensureAssets();
    this._applyCardDimensions();
    this.render?.();
  }

  set hass(hass) {
    this._hass = hass;
    this._resolvePending();
    if (this._assetsLoaded) {
      this.render?.();
    }
  }

  get hass() {
    return this._hass;
  }

  qs(selector) {
    return this.shadowRoot?.querySelector(selector) || null;
  }

  stateObj(entityId = this.config?.entity) {
    return this._hass?.states?.[entityId];
  }

  callService(domain, service, data) {
    if (!this._hass?.callService) return;
    return this._hass.callService(domain, service, data);
  }

  /**
   * Wire tap / double-tap / long-press / swipe semantics to a target element.
   * Widgets only supply handlers; base handles timing + cleanup.
   */
  bindInteractions(target, handlers = {}) {
    if (!target) return () => {};

    const {
      onTap,
      onDoubleTap,
      onHold,
      onSwipe,
      holdTime = 500,
      doubleTime = 250,
      swipeThreshold = 24
    } = handlers;

    let holdTimer = null;
    let tapTimer = null;
    let lastTap = 0;
    let pointerDown = false;
    let holdFired = false;
    let startX = 0;
    let startY = 0;

    const clearTimers = () => {
      if (holdTimer) clearTimeout(holdTimer);
      if (tapTimer) clearTimeout(tapTimer);
      holdTimer = tapTimer = null;
    };

    const cancel = () => {
      pointerDown = false;
      holdFired = false;
      clearTimers();
    };

    const handlePointerDown = (ev) => {
      pointerDown = true;
      holdFired = false;
      clearTimers();
      startX = ev.clientX;
      startY = ev.clientY;

      if (onHold) {
        holdTimer = setTimeout(() => {
          holdFired = true;
          onHold();
        }, holdTime);
      }
    };

    const handlePointerUp = (ev) => {
      if (!pointerDown) return;
      pointerDown = false;

      if (holdFired) {
        cancel();
        return;
      }

      // Swipe detection
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (onSwipe && (absX > swipeThreshold || absY > swipeThreshold)) {
        const dir =
          absX > absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        onSwipe(dir);
        cancel();
        return;
      }

      const now = Date.now();
      if (onDoubleTap && now - lastTap <= doubleTime) {
        clearTimers();
        lastTap = 0;
        onDoubleTap();
        return;
      }

      lastTap = now;
      if (onTap) {
        tapTimer = setTimeout(() => {
          onTap();
        }, doubleTime);
      }
      clearTimeout(holdTimer);
    };

    target.addEventListener("pointerdown", handlePointerDown);
    target.addEventListener("pointerup", handlePointerUp);
    target.addEventListener("pointercancel", cancel);
    target.addEventListener("pointerleave", cancel);

    const cleanup = () => {
      cancel();
      target.removeEventListener("pointerdown", handlePointerDown);
      target.removeEventListener("pointerup", handlePointerUp);
      target.removeEventListener("pointercancel", cancel);
      target.removeEventListener("pointerleave", cancel);
    };

    this._gestureBindings.push(cleanup);
    return cleanup;
  }

  /**
   * Set animation state class on host (anim--STATE) and data-anim attribute.
   */
  setAnimState(state) {
    const host = this.shadowRoot?.host || this;
    if (this._animState) {
      host.classList.remove(`anim--${this._animState}`);
    }
    this._animState = state || null;
    if (this._animState) {
      host.classList.add(`anim--${this._animState}`);
      host.dataset.anim = this._animState;
    } else {
      delete host.dataset.anim;
    }
  }

  /**
   * Write debug text if a `.debug` element exists; always log to console.
   */
  setDebugText(text) {
    const debugEl = this.qs(".debug");
    if (debugEl) {
      debugEl.textContent = text;
    }
  }

  optimisticToggle(options = {}) {
    const {
      entityId = this.config?.entity,
      desiredState,
      applyOptimistic,
      rollback,
      confirm,
      timeout = DEFAULT_OPTIMISTIC_TIMEOUT,
      sendToggle = true
    } = options;

    if (!entityId) return;

    if (typeof applyOptimistic === "function") {
      applyOptimistic();
    }

    const predicate =
      typeof confirm === "function"
        ? confirm
        : (state) => (desiredState ? state?.state === desiredState : false);

    const pending = {
      entityId,
      confirm: predicate,
      rollback,
      timer: null
    };

    pending.timer = setTimeout(() => {
      this._dropPending(pending, true);
    }, timeout);

    this._pendingToggles.push(pending);

    if (sendToggle) {
      this.callService("homeassistant", "toggle", { entity_id: entityId });
    }
  }

  // ─── Card Dimension Helpers ─────────────────────────────

  /**
   * Returns the number of height units for this card.
   * Reads from config.card_units, then falls back to the class default.
   */
  _getCardUnits() {
    return this.config?.card_units ?? this.constructor.defaultUnits ?? 1;
  }

  /**
   * Compute card height from units: 175 + 75 * units.
   * 1 unit → 250px, 2 → 325px, 3 → 400px.
   */
  _getCardHeight() {
    return 175 + 75 * this._getCardUnits();
  }

  /**
   * Apply --jelly-card-height and --jelly-card-units CSS custom properties
   * on the host element so all card CSS can reference them.
   */
  _applyCardDimensions() {
    const units = this._getCardUnits();
    const height = 175 + 75 * units;
    const host = this.shadowRoot?.host || this;
    host.style.setProperty('--jelly-card-height', `${height}px`);
    host.style.setProperty('--jelly-card-units', String(units));
  }

  getCardSize() {
    return this._getCardUnits();
  }

  // ----- Lovelace editor plumbing -----

  /**
   * Override in subclass to define per-widget editor fields.
   * Return { schema: [...], labels: {...} }.
   * schema entries use HA selector format: { name, selector }.
   * If not overridden, a default entity picker is generated from cardDomains.
   */
  static get editorSchema() {
    return null; // subclasses override; null = use default
  }

  static async getConfigElement() {
    if (!customElements.get("jelly-card-editor")) {
      await import("./jelly-editor.js");
    }
    const el = document.createElement("jelly-card-editor");
    el.setCardMeta({
      tag: this.cardTag,
      domains: this.cardDomains,
      editorSchema: this.editorSchema,  // per-widget override
    });
    return el;
  }

  static getStubConfig(hass) {
    const tag = this.cardTag || "jelly-card";
    const entity = this._pickEntity(hass, this.cardDomains) || "light.example";
    return { type: `custom:${tag}`, entity };
  }

  static _pickEntity(hass, domains) {
    if (!hass || !hass.states) return null;
    const preferred = domains && domains.length ? domains : ["light", "switch", "scene"];
    for (const domain of preferred) {
      const found = Object.keys(hass.states).find((id) => id.startsWith(domain + "."));
      if (found) return found;
    }
    return Object.keys(hass.states)[0] || null;
  }

  disconnectedCallback() {
    this._gestureBindings.forEach((fn) => fn());
    this._gestureBindings = [];
    this._pendingToggles.forEach((p) => p.timer && clearTimeout(p.timer));
    this._pendingToggles = [];
  }

  async _ensureAssets() {
    if (this._assetsLoaded) return;
    if (!this._assetPromise) {
      this._assetPromise = this._loadAssets();
    }
    await this._assetPromise;
  }

  async _loadAssets() {
    const tag = this.tagName.toLowerCase();
    const cached = JellyCardBase.assetCache.get(tag);

    let html;
    let css;

    if (cached) {
      ({ html, css } = cached);
    } else {
      [html, css] = await Promise.all([
        fetchText(`${ASSET_BASE}${tag}.html`),
        fetchText(`${ASSET_BASE}${tag}.css`)
      ]);
      JellyCardBase.assetCache.set(tag, { html, css });
    }

    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    this.shadowRoot.innerHTML = `<style>${css}</style>${html}`;

    if (typeof this.afterLoad === "function") {
      this.afterLoad();
    }

    this._applyCardDimensions();
    this._assetsLoaded = true;
  }

  _resolvePending() {
    if (!this._pendingToggles.length || !this._hass) return;

    this._pendingToggles.slice().forEach((pending) => {
      const state = this.stateObj(pending.entityId);
      if (pending.confirm(state)) {
        this._dropPending(pending, false);
      }
    });
  }

  _dropPending(pending, shouldRollback) {
    if (pending.timer) clearTimeout(pending.timer);

    const idx = this._pendingToggles.indexOf(pending);
    if (idx !== -1) {
      this._pendingToggles.splice(idx, 1);
    }

    if (shouldRollback && typeof pending.rollback === "function") {
      pending.rollback();
    }
  }
}

export default JellyCardBase;
