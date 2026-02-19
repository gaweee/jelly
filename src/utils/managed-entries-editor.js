/**
 * JellyManagedEntriesEditor — Shared base class for card editors with
 * dynamic, reorderable entry lists and config echo-protection.
 *
 * Subclass contract (static getters + methods):
 *
 *   static get entriesKey()   — Config key for the array  (default: "entries")
 *   static get editorTitle()  — Section header label       (default: "Entries")
 *   static get configSchema() — Top-level fields           [{ key, label, type }]
 *   static get entrySchema()  — Per-entry fields           [{ key, label, type }]
 *   _defaultEntry()           — New blank entry object
 *
 * Supported field types:
 *   "text"   → <ha-textfield>     (fires "change")
 *   "icon"   → <ha-icon-picker>   (fires "value-changed", needs hass)
 *   "entity" → <ha-form> with entity selector (handles lazy-loading, needs hass)
 *
 * Schema field options:
 *   { key, label, type, domain }  — domain: string[] to filter entity picker
 *
 * Config shape:  { ...configFields, [entriesKey]: [{ ...entryFields }, …] }
 *
 * Usage:
 *   import { JellyManagedEntriesEditor } from "../utils/managed-entries-editor.js";
 *
 *   class MySipEditor extends JellyManagedEntriesEditor {
 *     static get entriesKey()   { return "entries"; }
 *     static get editorTitle()  { return "Dial Entries"; }
 *     static get configSchema() {
 *       return [{ key: "name", label: "Card Title", type: "text" }];
 *     }
 *     static get entrySchema() {
 *       return [
 *         { key: "name", label: "Name", type: "text" },
 *         { key: "icon", label: "Icon", type: "icon" },
 *       ];
 *     }
 *     _defaultEntry() { return { name: "", icon: "mdi:phone" }; }
 *   }
 *   customElements.define("my-editor", MySipEditor);
 */

/* ── Shared editor CSS (injected once per instance) ── */
const EDITOR_CSS = `
  .jelly-editor { padding: 8px 0; }

  .jelly-field { margin-bottom: 16px; }
  .jelly-field label {
    display: block; font-size: 12px; font-weight: 500;
    color: var(--primary-text-color); margin-bottom: 4px; opacity: 0.6;
  }
  .jelly-field ha-textfield,
  .jelly-field ha-form,
  .jelly-field ha-entity-picker { width: 100%; }

  .entries-header {
    display: flex; align-items: center; justify-content: space-between;
    margin: 0 0 8px; padding: 0 4px;
  }
  .entries-header span {
    font-size: 14px; font-weight: 600; color: var(--primary-text-color);
  }

  .entry-row {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 10px 10px 6px; margin-bottom: 6px;
    background: var(--card-background-color, #1e1e2e);
    border-radius: 10px;
    border: 1px solid var(--divider-color, rgba(255,255,255,0.08));
  }
  .handle {
    cursor: grab; flex-shrink: 0; padding: 4px 2px;
    color: var(--primary-text-color); opacity: 0.25;
    display: flex; align-items: center;
  }
  .handle:active { cursor: grabbing; }
  .handle svg { width: 18px; height: 18px; fill: currentColor; }
  .entry-fields {
    flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0;
  }
  .entry-fields ha-textfield,
  .entry-fields ha-icon-picker,
  .entry-fields ha-form,
  .entry-fields ha-entity-picker { width: 100%; }

  .entry-actions {
    display: flex; align-items: center; flex-shrink: 0;
  }
  .entry-actions button {
    background: none; border: none;
    color: #f38ba8; cursor: pointer;
    width: 28px; height: 28px;
    font-size: 16px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    opacity: 0.4; transition: opacity 0.12s;
    padding: 0;
  }
  .entry-actions button:hover { opacity: 1; }

  .add-btn {
    width: 100%; padding: 10px; margin-top: 4px;
    background: none;
    border: 2px dashed var(--divider-color, rgba(255,255,255,0.1));
    border-radius: 10px;
    color: var(--primary-text-color);
    cursor: pointer; font-size: 13px; font-weight: 500;
    opacity: 0.5; transition: opacity 0.12s;
  }
  .add-btn:hover { opacity: 1; }
`;

export class JellyManagedEntriesEditor extends HTMLElement {

  /* ── Subclass API (override these) ── */

  /** Config key holding the entries array */
  static get entriesKey() { return 'entries'; }

  /** Section header label */
  static get editorTitle() { return 'Entries'; }

  /** Top-level config field descriptors: [{ key, label, type }] */
  static get configSchema() { return []; }

  /** Per-entry field descriptors: [{ key, label, type }] */
  static get entrySchema() { return []; }

  /** Return a new blank entry object */
  _defaultEntry() { return {}; }

  /* ── Lifecycle ── */

  setConfig(config) {
    const json = JSON.stringify(config);
    if (this._configJson === json) return;           // echo-protection
    this._configJson = json;
    this._config = JSON.parse(json);                 // deep clone
    const key = this.constructor.entriesKey;
    if (!Array.isArray(this._config[key])) this._config[key] = [];
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this.querySelectorAll('ha-icon-picker, ha-form')
      .forEach(el => { el.hass = hass; });
  }

  /* ── Config dispatch ── */

  _fire() {
    const key = this.constructor.entriesKey;
    const config = {
      ...this._config,
      [key]: (this._config[key] || []).map(e => ({ ...e })),
    };
    this._configJson = JSON.stringify(config);
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config },
      bubbles: true, composed: true,
    }));
  }

  /* ── Entry CRUD ── */

  _onSort(e) {
    const { oldIndex, newIndex } = e.detail;
    const key = this.constructor.entriesKey;
    const arr = [...this._config[key]];
    const [moved] = arr.splice(oldIndex, 1);
    arr.splice(newIndex, 0, moved);
    this._config[key] = arr;
    this._fire();
    this._render();
  }

  _removeEntry(idx) {
    const key = this.constructor.entriesKey;
    const arr = [...this._config[key]];
    arr.splice(idx, 1);
    this._config[key] = arr;
    this._fire();
    this._render();
  }

  _addEntry() {
    const key = this.constructor.entriesKey;
    this._config[key] = [...(this._config[key] || []), this._defaultEntry()];
    this._fire();
    this._render();
  }

  /* ── Rendering ── */

  _render() {
    this.innerHTML = '';

    // Inject shared editor CSS
    const style = document.createElement('style');
    style.textContent = EDITOR_CSS;
    this.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'jelly-editor';

    // Top-level config fields
    for (const field of this.constructor.configSchema) {
      wrap.appendChild(this._buildConfigField(field));
    }

    // Section header
    const hdr = document.createElement('div');
    hdr.className = 'entries-header';
    hdr.innerHTML = `<span>${this.constructor.editorTitle}</span>`;
    wrap.appendChild(hdr);

    // Entry rows wrapped in ha-sortable
    const sortable = document.createElement('ha-sortable');
    sortable.setAttribute('handle-selector', '.handle');
    sortable.addEventListener('item-moved', (e) => this._onSort(e));

    const rowContainer = document.createElement('div');
    const key = this.constructor.entriesKey;
    const entries = this._config[key] || [];
    entries.forEach((entry, idx) => {
      rowContainer.appendChild(this._buildRow(entry, idx, entries.length));
    });
    sortable.appendChild(rowContainer);
    wrap.appendChild(sortable);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-btn';
    addBtn.textContent = '+ Add Entry';
    addBtn.addEventListener('click', () => this._addEntry());
    wrap.appendChild(addBtn);

    this.appendChild(wrap);

    // Hydrate components that need hass (immediate + deferred for lazy-upgraded elements)
    if (this._hass) {
      const hydrate = () => {
        this.querySelectorAll('ha-icon-picker, ha-form')
          .forEach(el => { el.hass = this._hass; });
      };
      hydrate();
      requestAnimationFrame(hydrate);
    }
  }

  /* ── Field builders ── */

  /**
   * Build a top-level config field from a schema descriptor.
   * @param {{ key: string, label: string, type: string }} field
   * @returns {HTMLElement}
   */
  _buildConfigField(field) {
    const container = document.createElement('div');
    container.className = 'jelly-field';
    container.innerHTML = `<label>${field.label}</label>`;
    const el = this._createFieldElement(field, this._config, field.key, () => this._fire());
    container.appendChild(el);
    return container;
  }

  /**
   * Build a grouped entry row with index, fields, and action buttons.
   * @param {Object} entry
   * @param {number} idx
   * @param {number} total
   * @returns {HTMLElement}
   */
  _buildRow(entry, idx, total) {
    const row = document.createElement('div');
    row.className = 'entry-row';

    // Drag handle
    const handle = document.createElement('div');
    handle.className = 'handle';
    handle.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 3h2v2H9V3zm4 0h2v2h-2V3zM9 7h2v2H9V7zm4 0h2v2h-2V7zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2z"/></svg>`;
    row.appendChild(handle);

    // Fields
    const fields = document.createElement('div');
    fields.className = 'entry-fields';
    const key = this.constructor.entriesKey;
    for (const schema of this.constructor.entrySchema) {
      const el = this._createFieldElement(
        schema,
        this._config[key], idx,
        () => this._fire(),
        schema.key,
      );
      fields.appendChild(el);
    }
    row.appendChild(fields);

    // Delete button
    row.appendChild(this._buildActions(idx));
    return row;
  }

  /**
   * Create a field element for a schema descriptor.
   * Works for both top-level config fields and per-entry fields.
   *
   * @param {{ key: string, label: string, type: string }} schema
   * @param {Object|Array} target   — The object/array to mutate
   * @param {string|number} prop    — Property key or array index
   * @param {Function} onChange     — Callback after mutation
   * @param {string} [entryKey]     — When target is array, the entry sub-key
   * @returns {HTMLElement}
   */
  _createFieldElement(schema, target, prop, onChange, entryKey) {
    switch (schema.type) {
      case 'text': {
        const input = document.createElement('ha-textfield');
        input.label = schema.label;
        input.value = entryKey ? (target[prop]?.[entryKey] || '') : (target[prop] || '');
        input.addEventListener('change', (e) => {
          if (entryKey) {
            target[prop] = { ...target[prop], [entryKey]: e.target.value };
          } else {
            target[prop] = e.target.value;
          }
          onChange();
        });
        return input;
      }
      case 'icon': {
        const picker = document.createElement('ha-icon-picker');
        picker.label = schema.label;
        picker.value = entryKey ? (target[prop]?.[entryKey] || '') : (target[prop] || '');
        picker.addEventListener('value-changed', (e) => {
          if (entryKey) {
            target[prop] = { ...target[prop], [entryKey]: e.detail.value };
          } else {
            target[prop] = e.detail.value;
          }
          onChange();
        });
        return picker;
      }
      case 'entity': {
        const name = entryKey || String(prop);
        const form = document.createElement('ha-form');
        const domainFilter = schema.domain
          ? (Array.isArray(schema.domain) ? schema.domain : [schema.domain])
          : undefined;
        form.schema = [{
          name,
          selector: { entity: domainFilter ? { domain: domainFilter } : {} },
        }];
        form.data = { [name]: entryKey ? (target[prop]?.[entryKey] || '') : (target[prop] || '') };
        form.computeLabel = () => schema.label;
        if (this._hass) form.hass = this._hass;
        form.addEventListener('value-changed', (e) => {
          const val = e.detail.value?.[name] ?? '';
          if (entryKey) {
            target[prop] = { ...target[prop], [entryKey]: val };
          } else {
            target[prop] = val;
          }
          onChange();
        });
        return form;
      }
      default:
        return document.createElement('div');
    }
  }

  /** Build the delete button for a row */
  _buildActions(idx) {
    const actions = document.createElement('div');
    actions.className = 'entry-actions';
    const b = document.createElement('button');
    b.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
    b.title = 'Remove';
    b.addEventListener('click', () => this._removeEntry(idx));
    actions.appendChild(b);
    return actions;
  }
}

export default JellyManagedEntriesEditor;
