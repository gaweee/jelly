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
