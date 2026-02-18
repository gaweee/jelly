/**
 * Jelly SIP Card — Custom Editor
 *
 * Grouped, reorderable, dynamic entry list.
 * Each entry is an { icon, name } pair shown as a single visual row
 * with move-up / move-down / delete controls.
 *
 * Config shape:
 *   { name: "Intercom", entries: [ { name, icon }, … ] }
 */
class JellySipEditor extends HTMLElement {

  setConfig(config) {
    const incoming = JSON.stringify(config);
    // Skip re-render if config hasn't changed (HA echoes config back after each fire)
    if (this._configJson === incoming) return;
    this._configJson = incoming;

    this._config = JSON.parse(incoming); // deep clone
    if (!Array.isArray(this._config.entries)) {
      this._config.entries = [];
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Icon pickers need hass to browse icons
    this.querySelectorAll('ha-icon-picker').forEach(p => { p.hass = hass; });
  }

  /* ── Helpers ── */

  _fire() {
    const config = {
      ...this._config,
      entries: (this._config.entries || []).map(e => ({ ...e })),
    };
    // Cache so the HA echo-back setConfig is recognized and skipped
    this._configJson = JSON.stringify(config);
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config },
      bubbles: true,
      composed: true,
    }));
  }

  _moveEntry(idx, dir) {
    const arr = [...this._config.entries];
    const tgt = idx + dir;
    if (tgt < 0 || tgt >= arr.length) return;
    [arr[idx], arr[tgt]] = [arr[tgt], arr[idx]];
    this._config.entries = arr;
    this._fire();
    this._render();
  }

  _removeEntry(idx) {
    const arr = [...this._config.entries];
    arr.splice(idx, 1);
    this._config.entries = arr;
    this._fire();
    this._render();
  }

  _addEntry() {
    this._config.entries = [
      ...(this._config.entries || []),
      { name: '', icon: 'mdi:phone' },
    ];
    this._fire();
    this._render();
  }

  /* ── Render ── */

  _render() {
    this.innerHTML = '';

    /* --- Scoped styles --- */
    const style = document.createElement('style');
    style.textContent = `
      .sip-editor { padding: 8px 0; }

      /* Title field */
      .sip-field { margin-bottom: 16px; }
      .sip-field label {
        display: block; font-size: 12px; font-weight: 500;
        color: var(--primary-text-color); margin-bottom: 4px; opacity: 0.6;
      }
      .sip-field ha-textfield { width: 100%; }

      /* Section header */
      .entries-header {
        display: flex; align-items: center; justify-content: space-between;
        margin: 0 0 8px; padding: 0 4px;
      }
      .entries-header span {
        font-size: 14px; font-weight: 600; color: var(--primary-text-color);
      }

      /* Entry row — grouped card */
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
      .entry-fields ha-icon-picker { width: 100%; }

      /* Action buttons column */
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

      /* Add button */
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
    this.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'sip-editor';

    /* --- Card title --- */
    const titleField = document.createElement('div');
    titleField.className = 'sip-field';
    titleField.innerHTML = '<label>Card Title</label>';
    const titleInput = document.createElement('ha-textfield');
    titleInput.value = this._config.name || '';
    titleInput.addEventListener('change', (e) => {
      this._config.name = e.target.value;
      this._fire();
    });
    titleField.appendChild(titleInput);
    wrap.appendChild(titleField);

    /* --- Entries header --- */
    const hdr = document.createElement('div');
    hdr.className = 'entries-header';
    hdr.innerHTML = '<span>Dial Entries</span>';
    wrap.appendChild(hdr);

    /* --- Entry rows --- */
    const entries = this._config.entries || [];
    entries.forEach((entry, idx) => {
      wrap.appendChild(this._row(entry, idx, entries.length));
    });

    /* --- Add button --- */
    const addBtn = document.createElement('button');
    addBtn.className = 'add-btn';
    addBtn.textContent = '+ Add Entry';
    addBtn.addEventListener('click', () => this._addEntry());
    wrap.appendChild(addBtn);

    this.appendChild(wrap);

    // Hydrate icon pickers with hass
    if (this._hass) {
      this.querySelectorAll('ha-icon-picker').forEach(p => { p.hass = this._hass; });
    }
  }

  _row(entry, idx, total) {
    const row = document.createElement('div');
    row.className = 'entry-row';

    // Index badge
    const num = document.createElement('div');
    num.className = 'entry-index';
    num.textContent = idx + 1;
    row.appendChild(num);

    // Grouped fields
    const fields = document.createElement('div');
    fields.className = 'entry-fields';

    const nameInput = document.createElement('ha-textfield');
    nameInput.label = 'Name';
    nameInput.value = entry.name || '';
    nameInput.addEventListener('change', (e) => {
      this._config.entries[idx] = { ...this._config.entries[idx], name: e.target.value };
      this._fire();
    });
    fields.appendChild(nameInput);

    const iconPicker = document.createElement('ha-icon-picker');
    iconPicker.label = 'Icon';
    iconPicker.value = entry.icon || '';
    iconPicker.addEventListener('value-changed', (e) => {
      this._config.entries[idx] = { ...this._config.entries[idx], icon: e.detail.value };
      this._fire();
    });
    fields.appendChild(iconPicker);

    row.appendChild(fields);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'entry-actions';

    const upBtn = document.createElement('button');
    upBtn.textContent = '↑';
    upBtn.title = 'Move up';
    upBtn.disabled = idx === 0;
    upBtn.addEventListener('click', () => this._moveEntry(idx, -1));
    actions.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.textContent = '↓';
    downBtn.title = 'Move down';
    downBtn.disabled = idx === total - 1;
    downBtn.addEventListener('click', () => this._moveEntry(idx, 1));
    actions.appendChild(downBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete';
    delBtn.textContent = '×';
    delBtn.title = 'Remove';
    delBtn.addEventListener('click', () => this._removeEntry(idx));
    actions.appendChild(delBtn);

    row.appendChild(actions);
    return row;
  }
}

customElements.define("jelly-sip-editor", JellySipEditor);

export default JellySipEditor;
