import JellyCardBase from "../jelly-base.js";
import { PickerWheel } from "../utils/picker-wheel.js";
import { SwipeAction }  from "../utils/swipe-action.js";

/**
 * Jelly SIP Card — Intercom dialler with iOS drum picker + swipe-to-dial.
 *
 * Layout: 60/40 horizontal split.
 *   Left  — PickerWheel (scrollable entry selector)
 *   Right — SwipeAction  (swipe knob to confirm dial)
 *
 * Config shape:
 *   { name: "Intercom", entries: [{ name, icon }, …] }
 */
customElements.define(
  "jelly-sip-card",
  class JellySipCard extends JellyCardBase {

    static minUnits = 2;
    static get cardTag()     { return "jelly-sip-card"; }
    static get cardDomains() { return []; }

    /* ── Editor ── */

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

    /* ── Config (entity NOT required) ── */

    async setConfig(config) {
      if (!config) throw new Error("Jelly: config is required");
      this.config = config;
      await this._ensureAssets();
      this._applyCardDimensions();
      this.render?.();
    }

    /* ── Lifecycle ── */

    afterLoad() {
      this.$title      = this.qs(".title");
      this.$wheel      = this.qs(".picker-wheel");
      this.$track      = this.qs(".picker-track");
      this.$knob       = this.qs(".swipe-knob");
      this.$chevrons   = this.qs(".swipe-chevrons");
      this.$dest       = this.qs(".swipe-dest");
      this.$swipeTrack = this.qs(".swipe-track");

      this._entries    = [];
      this._entriesKey = '';

      this._initPicker();
      this._initSwipe();
    }

    /* ── Render ── */

    render() {
      if (!this.config || !this.$title) return;

      this.$title.textContent = this.config.name || "Intercom";

      const entries = Array.isArray(this.config.entries) ? this.config.entries : [];
      const key = JSON.stringify(entries);
      if (this._entriesKey === key) return;
      this._entriesKey = key;
      this._entries = entries;

      this._buildPicker();
    }

    /* ── Picker (delegates to PickerWheel util) ── */

    _initPicker() {
      if (!this.$wheel || !this.$track) return;

      this._picker = new PickerWheel(this.$wheel, this.$track, {
        onSelect: (idx) => this._onEntrySelected(idx),
      });
    }

    _buildPicker() {
      if (!this._picker) return;

      if (!this._entries.length) {
        this.$track.innerHTML = '<div class="empty-state">No entries</div>';
        return;
      }

      const defaultIdx = this._entries.length > 1 ? 1 : 0;

      this._picker.setItems(this._entries, {
        defaultIndex: defaultIdx,
        buildItem: (entry) => {
          const d = document.createElement('div');
          d.className = 'picker-item';
          d.innerHTML = `<ha-icon icon="${entry.icon || 'mdi:phone'}"></ha-icon>${entry.name || ''}`;
          return d;
        },
      });

      this._onEntrySelected(defaultIdx);
    }

    _onEntrySelected(idx) {
      const entry = this._entries[idx];
      if (!entry) return;
      const icon = this.$knob?.querySelector('ha-icon');
      if (icon) icon.setAttribute('icon', entry.icon || 'mdi:phone');
    }

    /* ── Swipe (delegates to SwipeAction util) ── */

    _initSwipe() {
      if (!this.$knob || !this.$chevrons || !this.$dest || !this.$swipeTrack) return;

      this._swipe = new SwipeAction({
        track:    this.$swipeTrack,
        knob:     this.$knob,
        dest:     this.$dest,
        chevrons: this.$chevrons,
        onTrigger: () => this._onDial(),
      });
    }

    _onDial() {
      const idx   = this._picker?.selectedIndex ?? 0;
      const entry = this._entries[idx];
      if (!entry) return;

      this.dispatchEvent(new CustomEvent('jelly-sip-dial', {
        detail: { name: entry.name, icon: entry.icon, index: idx },
        bubbles: true, composed: true,
      }));
    }

    /* ── Cleanup ── */

    disconnectedCallback() {
      this._picker?.destroy();
      this._swipe?.destroy();
      super.disconnectedCallback();
    }
  }
);
