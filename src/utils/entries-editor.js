/**
 * JellyEntriesEditor — Shared base class for card editors with
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
 *   "entity" → <ha-entity-picker> (fires "value-changed", needs hass)
 *
 * Config shape:  { ...configFields, [entriesKey]: [{ ...entryFields }, …] }
 *
 * Usage:
 *   import { JellyEntriesEditor } from "../utils/entries-editor.js";
 *
 *   class MySipEditor extends JellyEntriesEditor {
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
  .entry-index {
    width: 22px; text-align: center;
    font-size: 11px; font-weight: 700;
    color: var(--primary-text-color); opacity: 0.25;
    flex-shrink: 0;
  }
  .entry-fields {
    flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0;
  }
  .entry-fields ha-textfield,
  .entry-fields ha-icon-picker,
  .entry-fields ha-entity-picker { width: 100%; }

  .entry-actions {
    display: flex; flex-direction: column; gap: 2px; flex-shrink: 0;
  }
  .entry-actions button {
    background: none;
    border: 1px solid var(--divider-color, rgba(255,255,255,0.1));
    border-radius: 4px;
    color: var(--primary-text-color);
    cursor: pointer;
    width: 28px; height: 28px;
    font-size: 14px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    opacity: 0.5; transition: opacity 0.12s;
  }
  .entry-actions button:hover { opacity: 1; }
  .entry-actions button.delete { color: #f38ba8; }
  .entry-actions button:disabled { opacity: 0.15; cursor: default; }

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

export class JellyEntriesEditor extends HTMLElement {

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
    this.querySelectorAll('ha-icon-picker, ha-entity-picker')
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

  _moveEntry(idx, dir) {
    const key = this.constructor.entriesKey;
    const arr = [...this._config[key]];
    const tgt = idx + dir;
    if (tgt < 0 || tgt >= arr.length) return;
    [arr[idx], arr[tgt]] = [arr[tgt], arr[idx]];
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

    // Entry rows
    const key = this.constructor.entriesKey;
    const entries = this._config[key] || [];
    entries.forEach((entry, idx) => {
      wrap.appendChild(this._buildRow(entry, idx, entries.length));
    });

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-btn';
    addBtn.textContent = '+ Add Entry';
    addBtn.addEventListener('click', () => this._addEntry());
    wrap.appendChild(addBtn);

    this.appendChild(wrap);

    // Hydrate components that need hass
    if (this._hass) {
      this.querySelectorAll('ha-icon-picker, ha-entity-picker')
        .forEach(el => { el.hass = this._hass; });
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

    // Index badge
    const num = document.createElement('div');
    num.className = 'entry-index';
    num.textContent = idx + 1;
    row.appendChild(num);

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

    // Action buttons
    row.appendChild(this._buildActions(idx, total));
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
        const picker = document.createElement('ha-entity-picker');
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
      default:
        return document.createElement('div');
    }
  }

  /** Build the move-up / move-down / delete button column */
  _buildActions(idx, total) {
    const actions = document.createElement('div');
    actions.className = 'entry-actions';

    const btn = (text, title, disabled, cls, handler) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.title = title;
      b.disabled = disabled;
      if (cls) b.className = cls;
      b.addEventListener('click', handler);
      actions.appendChild(b);
    };

    btn('↑', 'Move up',   idx === 0,         null,     () => this._moveEntry(idx, -1));
    btn('↓', 'Move down', idx === total - 1,  null,     () => this._moveEntry(idx,  1));
    btn('×', 'Remove',    false,              'delete', () => this._removeEntry(idx));

    return actions;
  }
}

export default JellyEntriesEditor;
