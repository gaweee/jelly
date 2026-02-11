// Base class for Jelly cards. Handles asset loading, shadow DOM, helpers, and optimistic UI.

const ASSET_BASE = "/local/jelly/src/cards/";
const DEFAULT_OPTIMISTIC_TIMEOUT = 1200;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jelly: failed to load ${url}`);
  return res.text();
}

export class JellyCardBase extends HTMLElement {
  static assetCache = new Map();

  constructor() {
    super();
    this._assetsLoaded = false;
    this._assetPromise = null;
    this._pendingToggles = [];
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

  getCardSize() {
    return 1;
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
