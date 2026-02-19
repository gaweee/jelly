/**
 * Jelly SIP Card — Editor
 *
 * Thin subclass of JellyEntriesEditor. Declares the schema
 * for SIP intercom entries (name + icon). To add fields later
 * (e.g. SIP URL), just extend entrySchema and _defaultEntry().
 *
 * Config shape:
 *   { name: "Intercom", entries: [{ name, icon }, …] }
 */
import { JellyEntriesEditor } from "../utils/entries-editor.js";

class JellySipEditor extends JellyEntriesEditor {

  static get editorTitle()  { return 'Dial Entries'; }

  static get configSchema() {
    return [
      { key: 'name', label: 'Card Title', type: 'text' },
    ];
  }

  static get entrySchema() {
    return [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'icon', label: 'Icon', type: 'icon' },
      // Future: { key: 'url', label: 'SIP URL', type: 'text' },
    ];
  }

  _defaultEntry() {
    return { name: '', icon: 'mdi:phone' };
  }
}

customElements.define("jelly-sip-editor", JellySipEditor);

export default JellySipEditor;
