/**
 * Jelly Scene Card — Editor
 *
 * Uses JellyManagedEntriesEditor for unlimited scene entries.
 * Each entry is a scene entity. Top-level config includes an
 * optional active-scene tracker entity.
 *
 * Config shape:
 *   { name: "Scenes", entity: "input_text.active_scene",
 *     entries: [{ entity: "scene.movie_night" }, …] }
 */
import { JellyManagedEntriesEditor } from "../utils/managed-entries-editor.js";

class JellySceneEditor extends JellyManagedEntriesEditor {

  static get editorTitle()  { return 'Scenes'; }

  static get configSchema() {
    return [
      { key: 'name',   label: 'Display Name (optional)',                          type: 'text'   },
      { key: 'entity', label: 'Active Scene Tracker (input_text / input_select)', type: 'entity', domain: ['input_text', 'input_select'] },
    ];
  }

  static get entrySchema() {
    return [
      { key: 'entity', label: 'Scene Entity', type: 'entity', domain: ['scene'] },
    ];
  }

  _defaultEntry() {
    return { entity: '' };
  }
}

customElements.define("jelly-scene-editor", JellySceneEditor);

export default JellySceneEditor;
