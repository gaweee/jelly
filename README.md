# Jelly — Custom Dashboard for Home Assistant

A collection of handcrafted custom cards for Home Assistant, built with clean HTML/CSS/JS separation, shadow DOM isolation, and the Catppuccin color palette.

## Features

- **Theme-first design** — all styling uses `--jelly-*` CSS tokens mapped from HA theme variables; works out of the box with Catppuccin Mocha
- **Minimal JS** — HTML templates and CSS live in separate files, loaded by convention
- **Shadow DOM** — every card is fully encapsulated; no style leaks
- **Shared base class** (`JellyCardBase`) — asset loading, gestures (tap/double-tap/hold/swipe), optimistic toggle, card dimensions
- **Shared editor** (`JellyCardEditor`) — schema-driven config UI via `<ha-form>`

## Cards

| Card | Tag | Purpose |
|---|---|---|
| Generic | `jelly-generic-card` | Minimal toggle — title and on/off |
| Toggle | `jelly-toggle-card` | Toggle with image or icon |
| Device | `jelly-device-card` | Device control with image, toggle, and 4 shortcut buttons |
| HVAC | `jelly-hvac-card` | Climate card with scrollable temperature rail |
| Knob | `jelly-knob-card` | Circular arc knob for climate, number, fan, light |
| Clock | `jelly-clock-card` | Client-side clock with optional AI-generated subtitle |
| Weather | `jelly-weather-card` | Current conditions + multi-day forecast with candle graphs |
| Sensor Graph | `jelly-sensor-graph` | History chart with Chart.js and latest-value pill |
| Camera | `jelly-camera-card` | Live still-image feed with full-screen live stream dialog |
| Activity | `jelly-activity-card` | Scrollable timeline of recent smart home events |

## Quick Start

1. Copy the `jelly` folder to `/config/www/jelly/` on your HA instance
2. Register the resource: **Settings → Dashboards → Resources** → add `/local/jelly/src/jelly.js` as **JavaScript Module**
3. Hard-refresh your browser — Jelly cards appear in the card picker
4. Activate the **Catppuccin Mocha** theme for the intended look

See [INSTALL.md](INSTALL.md) for detailed setup instructions including HVAC, Weather, Camera, Activity card configuration, custom images, and AI-powered clock messages.

## Activity Card

The Activity card shows a scrollable timeline of recent smart home events — state changes, settings adjustments, and device activity — with timestamps, domain icons, and color-coded state accents. It subscribes to HA's WebSocket for real-time `state_changed` events and persists the log to `localStorage`.

```yaml
type: custom:jelly-activity-card
title: Recent Activity
max_items: 100
max_hours: 24
refresh_interval: 30
domains:
  - light
  - switch
  - climate
  - cover
  - fan
  - lock
```

| Option | Default | Description |
|---|---|---|
| `title` / `name` | `"Recent Activity"` | Card heading |
| `domains` | 8 defaults (light, switch, lock, cover, climate, fan, automation, scene) | Domains to track |
| `max_items` | `200` | Max stored events (oldest trimmed) |
| `max_hours` | *(none)* | Drop events older than N hours |
| `refresh_interval` | `30` | Seconds between "ago" text refreshes (0 = disabled) |
| `time_buckets` | *(5 defaults)* | Custom time separators — array of `{ title, seconds }` |

## Development

```bash
# Push to HA via SSH
npm run push
```

See [JELLY_SPEC.md](JELLY_SPEC.md) for the full technical specification.

## License

Private project — not published.
