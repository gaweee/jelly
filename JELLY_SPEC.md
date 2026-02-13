# Codename Jelly – HA Custom Dashboard

## Goals
- Build HA custom cards with clean separation: HTML / CSS / JS
- Theme-first: CSS uses ONLY Jelly tokens (`var(--jelly-*)`), no hex
- Minimal hardcoding: assets loaded by convention from custom element name
- Provide a JellyCardBase with:
  - auto-load `{tag}.html` and `{tag}.css`
  - Shadow DOM
  - shared helpers (`qs`, `stateObj`, `callService`)
  - optimistic UI primitives (toggle now, rollback on timeout)
  - gesture system (tap, double-tap, hold, swipe)
  - card dimension system (`50 + 50 * units` px)

## Conventions
- Custom element tag: `jelly-<card-name>`
- Assets:
  - `/local/jelly/src/cards/<tag>.html`
  - `/local/jelly/src/cards/<tag>.css`
- JS file imports base and defines custom element
- Editor: shared `jelly-card-editor` shell, subclasses define `editorSchema` (static or dynamic)

---

## Base Class — JellyCardBase

**File:** `src/jelly-base.js`

| Capability | Detail |
|---|---|
| Asset loading | Fetches `<tag>.html` + `<tag>.css` from `/local/jelly/src/cards/`, caches per tag, injects into shadow DOM |
| Card dimensions | `unitsToPx(u) = 50 + 50*u`; sets `--jelly-card-height` and `--jelly-card-units` CSS vars on host as min-height floor |
| Layout hints | `getLayoutOptions()` → `{ grid_columns: 4, grid_min_columns: 2, grid_rows: _getCardUnits(), grid_min_rows: minUnits }` |
| Height model | HA grid controls actual height via `grid_rows`; `:host` fills grid cell (`height: 100%`); `ha-card` enforces floor (`min-height`), clips (`overflow: hidden`), and enables height-responsive CSS (`container-type: size`) |
| Info block | Shared `.info > .title + .status` contract: flex column, gap 0, text truncation, `--jelly-text` / `--jelly-text-2` colors, `on`-state accent color. Cards override only alignment, positioning, and responsive sizing |
| Gestures | `bindInteractions(target, { onTap, onDoubleTap, onHold, onSwipe })` — pointer-based, auto-cleanup |
| Optimistic toggle | `optimisticToggle({ desiredState, applyOptimistic, rollback, confirm, timeout })` — 1200ms default |
| Helpers | `qs()`, `stateObj()`, `callService()`, `setAnimState()`, `setDebugText()` |
| Editor plumbing | `getConfigElement()` lazy-loads `jelly-editor.js`; `getStubConfig()` picks suitable entity |

---

## Editor System — JellyCardEditor

**File:** `src/jelly-editor.js`

- Shared editor shell for all Jelly cards via `<jelly-card-editor>`
- Receives `{ tag, domains, editorSchema }` from each card class
- Supports **static schemas** (object) and **dynamic schemas** (function of config for conditional fields)
- Falls back to single entity picker filtered by `cardDomains` when no schema provided
- Uses `<ha-form>` for rendering; dispatches `config-changed` events

---

## Utilities

### automation-utils (`src/utils/automation-utils.js`)

| Function | Purpose |
|---|---|
| `executeShortcut(hass, shortcut)` | Executes shortcut entity (automation→trigger, script→turn_on with JSON variables, scene→turn_on, button→press) |
| `isValidShortcutEntity(entityId)` | Validates domain is automation/script/scene/button |
| `getServiceForDomain(domain)` | Returns service name for a given domain |

### status-utils (`src/utils/status-utils.js`)

| Function | Detects |
|---|---|
| `getIntensityStatus` | brightness (→ %), percentage, volume_level (→ Vol %), current_position (→ %) |
| `getModeStatus` | hvac_mode, preset_mode, fan_mode, swing_mode |
| `getMediaStatus` | media_title, media_artist |
| `getLightEffectStatus` | effect, color_temp |
| `getTemperatureStatus` | current_temperature (→ "X°"), target temperature (→ "→X°") |
| `getHumidityStatus` | current_humidity (→ "X%RH") |
| `computeStatus(entity)` | Assembles "State · Detail · Detail" format, truncates at 40 chars |

---

## Cards

### Summary

| Card | Tag | Domains | minUnits | Shortcuts | Dynamic Height | Toggle |
|---|---|---|---|---|---|---|
| Generic | `jelly-generic-card` | switch, light, fan, input_boolean | 1 | No | No | Yes |
| Toggle | `jelly-toggle-card` | switch, light, fan, input_boolean | 2 | No | No | Yes |
| Device | `jelly-device-card` | fan, light, switch, climate, input_boolean | 3 | 4 max | No | Yes |
| HVAC | `jelly-hvac-card` | climate | 4 | No | No | Yes |
| Clock | `jelly-clock-card` | *(none)* | 1 | No | No | No |
| Weather | `jelly-weather-card` | weather | 4 | No | No | No |
| Sensor Graph | `jelly-sensor-graph` | sensor | 4 | No | No | No |
| Knob | `jelly-knob-card` | climate, number, input_number, fan, light | 4 | 4 max | Yes (4u→5u) | Yes |
| Camera | `jelly-camera-card` | camera | 2 | No | No | No |
| Shell | `jelly-shell-card` | *(none)* | — | No | No | No |

---

### jelly-generic-card

Minimal reference card — title and toggle only. Canonical implementation of the Jelly height-sizing contract.

**Config:** `entity` (required), `name`
**States:** `on`, `off`, `unavailable`
**Behavior:**
- Toggle tap → `homeassistant.toggle` with optimistic UI
- Title: `config.name` > `friendly_name` > entity ID

---

### jelly-toggle-card

Simple on/off card with image or icon.

**Config:** `entity` (required), `name`, `image`, `icon`
**States:** `on`, `off`, `unavailable`
**Behavior:**
- Tap → `homeassistant.toggle` with optimistic UI
- Image display priority: `config.image` > icon (`config.icon` > `entity.attributes.icon` > domain default)
- Domain default icons: switch → `mdi:toggle-switch`, light → `mdi:lightbulb`, fan → `mdi:fan`, input_boolean → `mdi:toggle-switch-outline`
- Status computed via `computeStatus()`

---

### jelly-device-card

Device card with image, toggle, and up to 4 shortcut buttons.

**Config:** `entity` (required), `name`, `image`, `shortcut_1..4_automation`, `shortcut_1..4_name`, `shortcut_1..4_icon`, `shortcut_1..4_parameter`
**States:** `on`, `off`, `unavailable`
**Behavior:**
- Tap on card → `homeassistant.toggle` with optimistic UI
- Up to 4 shortcuts in Z-pattern grid; events stop propagation
- Shortcuts execute via `executeShortcut()` (supports JSON parameters for scripts)
- Status computed via `computeStatus()`

---

### jelly-hvac-card

Climate card with scrollable temperature rail and SVG notch overlay.

**Config:** `entity` (required, climate), `name`, `icon`, `min_temp`, `max_temp`
**States:** `heat`, `cool`, `heat_cool`, `auto`, `dry`, `fan_only`, `off`, `unavailable`
**Defaults:** min_temp=18, max_temp=35, step=0.5
**Behavior:**
- Scrollable horizontal temperature rail with thumb drag (inverted) and rail drag (natural)
- Live temperature readout during scroll; debounced (150ms) `climate.set_temperature`
- Toggle: `climate.turn_on`/`climate.turn_off` with optimistic UI
- Status text: heat→"Heating", cool→"Cooling", auto→"Auto", dry→"Dry", fan_only→"Fan", off→"Off"

---

### jelly-clock-card

Client-side clock with date and optional subtitle.

**Config:** `show_time` (default true), `text_entity` (input_text helper)
**No entity required** — overrides `setConfig()` to skip entity validation.
**Behavior:**
- 1-second interval renders `HH:MM` time, "DD Mon" date, full day name
- Optional subtitle from `input_text` entity state
- Timer cleaned up on disconnect

---

### jelly-weather-card

Weather card with inline SVG icons and forecast strip.

**Config:** `entity` (required, weather), `days` (3/5/7, default 5), `show_forecast` (default true), `show_precip` (default true)
**Behavior:**
- HA 2023.12+ `weather/subscribe_forecast` WebSocket; falls back to `attributes.forecast`
- Inline SVG weather icons from `/local/jelly/src/cards/weather-icons/` (SMIL animation support)
- Icon aliases: `windy-variant` → `windy`; humanized condition strings
- Current conditions: icon, temperature, hi/lo from first forecast entry
- Forecast strip: day label, icon, SVG candle range graph (wick + body, globally scaled), hi/lo labels, optional precipitation %

---

### jelly-sensor-graph

Sensor history chart with Chart.js and latest-value pill.

**Config:** `entity` (required, sensor), `title`, `range` (24h/3d/5d/7d, default "3d")
**Range presets:** 24h=24 buckets, 3d=24 buckets, 5d=20 buckets, 7d=21 buckets
**Behavior:**
- Chart.js v4 loaded lazily from CDN
- History: WebSocket `history/history_during_period` → REST API fallback; handles compressed WS format
- O(n) single-pass downsampling into fixed buckets (`Float64Array` + `Uint32Array`)
- Bezier line chart (tension 0.4), gradient fill, no interactivity
- Custom `jellyLatestPill` plugin: floating pill label at last data point with dashed stem, dot glow + ring
- Live patching: latest entity state patched onto last data point without re-fetch
- Auto-refresh every 5 minutes; throttled to max once per 30s

---

### jelly-knob-card

Circular arc knob control with spokes, pointer, +/- buttons, toggle, and shortcuts.

**Config:** `entity` (required), `name`, `icon`, `unit`, `min`, `max`, `step`, `script`, `shortcut_1..4_automation`, `shortcut_1..4_name`, `shortcut_1..4_icon`, `shortcut_1..4_parameter`
**States:** Climate uses actual state (heat/cool/auto/etc.); other domains → `on`/`off`
**Defaults:** min=16, max=32, step=0.5
**Behavior:**
- SVG arc knob: 40 spokes, 220°–140° sweep, 1px outer arc, inward-facing triangular pointer (3:2 ratio)
- Drag interaction: pointer capture on SVG, angle→value mapping with configurable min/max/step
- Spoke pulse effect: spokes near pointer extend inward
- +/- buttons: step increment/decrement with flash animation
- Value sending — domain-aware:
  - `climate` → `climate.set_temperature`
  - `number`/`input_number` → `{domain}.set_value`
  - `fan` → `fan.set_percentage`
  - `light` → `light.turn_on` with `brightness_pct`
  - If `config.script` set → `script.turn_on` with `variables: { value, unit }` (overrides domain logic)
- Toggle: climate on/off with optimistic UI; other domains → `homeassistant.toggle`
- Min/max/step resolution: config > entity attributes > class defaults
- Dynamic height: 4 units without shortcuts, 5 units with shortcuts
- Shortcuts: 4-column CSS grid, positional placement via `data-index` (1–4)

---

### jelly-shell-card

Minimal placeholder card. Does **not** extend JellyCardBase. Renders static "Jelly is alive 🪼" text.

---

### jelly-camera-card

Live camera still-image card with periodic refresh and full-screen live view.

**Config:** `entity` (required, camera), `name`, `refresh_interval` (5/10/15/30/60s, default 10)
**States:** `idle`, `unavailable`
**Behavior:**
- Fetches camera still image via `/api/camera_proxy/` with cache-busting timestamp
- Image fills the entire card background (object-fit: cover) — card behaves like a picture tile
- Top-left translucent pill with blinking red recording dot and camera name (config.name > friendly_name > entity_id)
- Bottom-right translucent "Live View" pill with fullscreen icon → opens full-screen live stream dialog
- Periodic refresh at configurable interval; uses off-screen Image preload to avoid blank-frame flicker
- Respects height/width via HA grid; minimum height of 2 units

#### Camera Dialog (`jelly-camera-dialog`)

Full-viewport live stream overlay, appended to `document.body` to escape Shadow DOM stacking.

| Feature | Detail |
|---|---|
| Stream | Uses HA's `<ha-camera-stream>` (auto WebRTC/HLS/MJPEG); falls back to MJPEG proxy `<img>` |
| Header | Recording dot + camera name pill (left), close button (right); gradient fade overlay |
| Close | X button, backdrop click, or Escape key |
| Animation | Scale + fade entrance (280ms cubic-bezier), reverse on exit |
| Singleton | Only one dialog at a time; previous is removed on open |
| Mobile | Full-viewport (no border-radius) at ≤ 600px |

---

## TODO
- Sparkline card
- Zone control (with multiple sub switches)
- Calendar/Agenda widget