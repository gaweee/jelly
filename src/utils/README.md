# Jelly Utilities

Shared utility functions for Jelly Cards. Extract common functionality to promote code reuse across different card types.

## status-utils.js

Device-agnostic status computation for Home Assistant entities. Works across lights, fans, climate devices, media players, covers, and more.

### Exports

#### Constants
- `BRIGHTNESS_MAX` (255) - Maximum brightness value for percentage calculations
- `STATUS_MAX_LENGTH` (40) - Maximum status string length before truncation
- `STATUS_SEPARATOR` (" · ") - Separator between status parts

#### Functions

**`computeStatus(entity, options)`**
Main status computation function that orchestrates all status extractors.

```javascript
import { computeStatus } from "../utils/status-utils.js";

const statusText = computeStatus(entity, {
  maxLength: 40,  // optional, default: STATUS_MAX_LENGTH
  separator: " · " // optional, default: STATUS_SEPARATOR
});
```

**Individual Status Extractors:**
- `getIntensityStatus(attrs)` - Brightness, percentage, volume, position
- `getModeStatus(attrs)` - HVAC mode, preset mode, fan mode, swing mode
- `getMediaStatus(attrs)` - Media title, artist
- `getLightEffectStatus(attrs)` - Light effect, color temperature
- `getTemperatureStatus(attrs, state)` - Current/target temperature
- `getHumidityStatus(attrs)` - Current humidity

All return `string|null` - formatted status text or null if not available.

## automation-utils.js

Helpers for executing Home Assistant automations, scripts, scenes, and buttons with proper parameter handling.

### Exports

**`executeShortcut(hass, shortcut)`**
Executes a shortcut action with automatic domain detection and parameter handling.

```javascript
import { executeShortcut } from "../utils/automation-utils.js";

const success = executeShortcut(this.hass, {
  automation: "script.my_script",
  parameter: '{"speed": 75}' // optional, JSON string for scripts
});
```

Automatically handles:
- Button entities → `button.press`
- Scene entities → `scene.turn_on`
- Automation entities → `automation.trigger`
- Script entities → `script.turn_on` with parameters wrapped in `variables` key
- JSON validation with user-friendly error notifications

**`isValidShortcutEntity(entityId)`**
Validates if an entity can be used as a shortcut target.

```javascript
if (isValidShortcutEntity("script.my_script")) {
  // Valid
}
```

**`getServiceForDomain(domain)`**
Returns the default service name for a given domain.

```javascript
const service = getServiceForDomain("button"); // returns "press"
```

## Usage Examples

### Status in a Custom Card

```javascript
import JellyCardBase from "../jelly-base.js";
import { computeStatus } from "../utils/status-utils.js";

class MyCard extends JellyCardBase {
  render() {
    const entity = this.stateObj();
    const status = computeStatus(entity);
    this.$status.textContent = status;
  }
}
```

### Shortcuts in a Custom Card

```javascript
import { executeShortcut } from "../utils/automation-utils.js";

class MyCard extends JellyCardBase {
  _handleShortcut(config) {
    executeShortcut(this.hass, {
      automation: config.entity,
      parameter: config.params
    });
  }
}
```

## entries-editor.js

Shared base class for card editors with dynamic, reorderable entry lists.
Provides config echo-protection, entry CRUD, and declarative field schemas.

### Subclass Contract

| Override | Type | Default | Description |
|---|---|---|---|
| `static entriesKey` | getter | `"entries"` | Config key holding the array |
| `static editorTitle` | getter | `"Entries"` | Section header label |
| `static configSchema` | getter | `[]` | Top-level config fields |
| `static entrySchema` | getter | `[]` | Per-entry fields |
| `_defaultEntry()` | method | `{}` | New blank entry object |

### Supported Field Types

- `"text"` → `<ha-textfield>` (fires `change`)
- `"icon"` → `<ha-icon-picker>` (fires `value-changed`, needs hass)
- `"entity"` → `<ha-entity-picker>` (fires `value-changed`, needs hass)

### Example: SIP Card Editor

```javascript
import { JellyEntriesEditor } from "../utils/entries-editor.js";

class JellySipEditor extends JellyEntriesEditor {
  static get editorTitle()  { return "Dial Entries"; }
  static get configSchema() {
    return [{ key: "name", label: "Card Title", type: "text" }];
  }
  static get entrySchema() {
    return [
      { key: "name", label: "Name", type: "text" },
      { key: "icon", label: "Icon", type: "icon" },
      // { key: "url", label: "SIP URL", type: "text" },
    ];
  }
  _defaultEntry() { return { name: "", icon: "mdi:phone" }; }
}
customElements.define("jelly-sip-editor", JellySipEditor);
```

## picker-wheel.js

Composable iOS-style drum picker with momentum scrolling, rubber-band
edges, and snap-to-nearest item. Works with any vertical scrollable list.

### Constructor

```javascript
import { PickerWheel } from "../utils/picker-wheel.js";

const picker = new PickerWheel(wheelEl, trackEl, {
  onSelect(index, item) { console.log("Selected:", index, item); },
  selectedClass: "selected",  // CSS class for active item (default)
  friction: 0.94,             // momentum friction (default)
  snapDuration: 320,          // snap animation ms (default)
});
```

### API

| Method | Description |
|---|---|
| `setItems(items, { defaultIndex, buildItem })` | Populate picker; `buildItem(item, i) → HTMLElement` |
| `selectIndex(idx)` | Animate to index |
| `selectedIndex` | Current index (getter) |
| `selectedItem` | Current item data (getter) |
| `destroy()` | Remove all listeners |

### Example

```javascript
picker.setItems(entries, {
  defaultIndex: 1,
  buildItem(entry, i) {
    const div = document.createElement("div");
    div.className = "picker-item";
    div.innerHTML = `<ha-icon icon="${entry.icon}"></ha-icon>${entry.name}`;
    return div;
  },
});
```

## swipe-action.js

Composable horizontal swipe-to-confirm gesture with progressive chevron
lighting, threshold detection, ResizeObserver for container queries,
and auto-reset.

### Constructor

```javascript
import { SwipeAction } from "../utils/swipe-action.js";

const swipe = new SwipeAction({
  track: trackEl,
  knob: knobEl,
  dest: destEl,
  chevrons: chevronsEl,
  threshold: 0.8,            // progress to trigger (default)
  pad: 3,                    // edge padding px (default)
  resetDelay: 1600,          // ms before auto-reset (default)
  onTrigger() { ... },
  onProgress(p) { ... },     // 0–1 during drag
  chevronThresholds: [0.2, 0.45, 0.7],  // default
});
```

### API

| Method | Description |
|---|---|
| `reset()` | Reset knob to start |
| `destroy()` | Remove all listeners + ResizeObserver |

### DOM Contract

The swipe track must contain:
- `.swipe-knob` — draggable circle (left-positioned)
- `.swipe-chevrons` — container with `.chev` spans, `.idle` class for pulse
- `.swipe-dest` — target indicator (right-positioned), `.active` class on trigger
