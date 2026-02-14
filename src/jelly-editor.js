// Shared editor shell for all Jelly cards.
// Each widget supplies its own schema via static editorSchema.
// Falls back to a simple entity picker when no schema is provided.

class JellyCardEditor extends HTMLElement {

  /* Called by JellyCardBase.getConfigElement with per-widget metadata */
  setCardMeta({ tag, domains, editorSchema } = {}) {
    this._cardTag = tag || null;
    this._domains = domains || null;

    // Per-widget override or sensible default
    if (editorSchema) {
      // Check if editorSchema is a function (dynamic) or static object
      if (typeof editorSchema === 'function') {
        this._dynamicSchemaCallback = editorSchema;
      } else {
        this._schema = editorSchema.schema;
        this._labels = editorSchema.labels || {};
      }
    } else {
      // Default: just an entity picker filtered by domains
      this._schema = [
        { name: "entity", selector: { entity: { domain: domains || undefined } } },
      ];
      this._labels = { entity: "Entity" };
    }
  }

  setConfig(config) {
    this._config = { ...config };
    this._buildUI();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) {
      this._form.hass = hass;
    }
  }

  _buildUI() {
    if (this._form) {
      // Rebuild schema dynamically based on current config
      this._updateSchema();
      this._form.data = this._config;
      return;
    }

    this.innerHTML = "";

    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = this._config;
    this._updateSchema();
    form.schema = this._schema;
    form.computeLabel = (s) => this._labels[s.name] || s.name;

    form.addEventListener("value-changed", (ev) => {
      this._config = { ...this._config, ...ev.detail.value };
      // Rebuild schema when config changes to handle conditional fields
      this._updateSchema();
      this._form.schema = this._schema;
      this._form.data = this._config; // refresh form data (may be normalized)
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: this._config },
          bubbles: true,
          composed: true,
        })
      );
    });

    this._form = form;
    this.appendChild(form);
  }

  _updateSchema() {
    // Allow cards to provide dynamic schema based on current config
    if (this._dynamicSchemaCallback) {
      const result = this._dynamicSchemaCallback(this._config || {});
      this._schema = result.schema;
      this._labels = result.labels || {};
      // If the schema returns a normalize function, compact/fix the config
      if (typeof result.normalize === 'function') {
        const normalized = result.normalize(this._config);
        if (normalized) this._config = normalized;
      }
    }
    // Otherwise use static schema (already set in setCardMeta)
  }
}

customElements.define("jelly-card-editor", JellyCardEditor);

export default JellyCardEditor;

