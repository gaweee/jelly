/**
 * Jelly SIP Card — Editor
 *
 * Thin subclass of JellyEntriesEditor. Declares the schema
 * for SIP intercom entries (name + icon). To add fields later
 * (e.g. SIP URL), just extend entrySchema and _defaultEntry().
 *
 * Config shape:
 *   { name: "Intercom", entries: [{ name, icon, url }, …] }
 *
 * The `url` field accepts any URI the device can open — e.g.
 *   intent:sip:1002@192.168.1.100#Intent;scheme=sip;package=org.linphone;end
 */
import { JellyManagedEntriesEditor } from "../utils/managed-entries-editor.js";

class JellySipEditor extends JellyManagedEntriesEditor {

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
      { key: 'url',  label: 'Dial URL (e.g. intent:sip:…)', type: 'text' },
    ];
  }

  _defaultEntry() {
    return { name: '', icon: 'mdi:phone', url: '' };
  }
}

customElements.define("jelly-sip-editor", JellySipEditor);

export default JellySipEditor;
