# Jelly Dashboard — Installation & Setup Guide

A step-by-step guide to installing the Jelly custom dashboard for Home Assistant, configuring HVAC, Weather, Camera, and Activity cards, adding custom images, setting up AI-powered quirky messages on the Clock card, and applying the Catppuccin theme.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Install Jelly Files](#install-jelly-files)
3. [Register the Resource](#register-the-resource)
4. [Catppuccin Theme Setup](#catppuccin-theme-setup)
5. [Card Setup: HVAC](#card-setup-hvac)
6. [Card Setup: Weather](#card-setup-weather)
7. [Card Setup: Camera](#card-setup-camera)
8. [Card Setup: Activity](#card-setup-activity)
9. [Adding Custom Images](#adding-custom-images)
10. [AI Quirky Messages on the Clock Card](#ai-quirky-messages-on-the-clock-card)
11. [Pushing Updates (Development)](#pushing-updates-development)

---

## Prerequisites

- **Home Assistant** 2023.12 or later (required for weather forecast WebSocket API)
- SSH or file-system access to your HA config directory (e.g. via the Samba or SSH add-ons)
- A climate entity (e.g. `climate.living_room`) for the HVAC card
- A weather integration (e.g. `weather.home`) for the Weather card
- A camera entity (e.g. `camera.front_door`) for the Camera card

---

## Install Jelly Files

Copy the entire `jelly` folder into your Home Assistant `www` directory so the path looks like:

```
/config/www/jelly/
├── src/
│   ├── jelly.js          ← main entry point
│   ├── jelly-base.js
│   ├── jelly-editor.js
│   ├── cards/
│   │   ├── jelly-hvac-card.js / .html / .css
│   │   ├── jelly-weather-card.js / .html / .css
│   │   ├── jelly-camera-card.js / .html / .css
│   │   ├── weather-icons/   ← SVG weather icons
│   │   └── ...
│   ├── styles/
│   │   ├── jelly-theme.css
│   │   ├── jelly-base-card.css
│   │   └── typography.css
│   └── utils/
├── dist/
│   └── fonts/
│       └── Inter.var.woff2
└── ...
```

> **Tip:** If developing locally, run `npm run push` from the project root to rsync files to your HA instance via SSH.

---

## Register the Resource

1. Go to **Settings → Dashboards → ⋮ (top-right) → Resources**
2. Click **Add Resource**
3. Enter:
   - **URL:** `/local/jelly/src/jelly.js`
   - **Resource type:** JavaScript Module
4. Click **Create**
5. **Hard-refresh** your browser (`Cmd+Shift+R` / `Ctrl+Shift+R`)

All Jelly cards will now appear in the card picker when you edit a dashboard.

---

## Catppuccin Theme Setup

Jelly is designed to consume HA theme variables (`--card-background-color`, `--primary-text-color`, `--accent-color`, etc.) and map them to its own `--jelly-*` tokens. The **Catppuccin** theme family gives Jelly its intended look.

### Step 1 — Install via HACS

1. Open **HACS → Frontend**
2. Search for **Catppuccin Theme**
3. Install it
4. Restart Home Assistant

Or install manually: download the theme YAML from [catppuccin/home-assistant](https://github.com/catppuccin/home-assistant) and place it in `/config/themes/`.

### Step 2 — Activate the Theme

1. Go to **your profile** (bottom-left avatar in the sidebar)
2. Under **Theme**, select one of:
   | Theme | Style |
   |---|---|
   | **Catppuccin Mocha** | Dark, warm — _recommended for Jelly_ |
   | **Catppuccin Macchiato** | Dark, cooler tones |
   | **Catppuccin Frappé** | Medium-dark |
   | **Catppuccin Latte** | Light mode |

3. For dashboard-specific theming, edit the dashboard YAML and add:
   ```yaml
   views:
     - title: Home
       theme: catppuccin-mocha
       cards:
         - type: custom:jelly-clock-card
           ...
   ```

### Step 3 — Verify Token Mapping

Jelly maps HA theme variables automatically in `jelly-theme.css`:

| Jelly Token | HA Variable |
|---|---|
| `--jelly-surface` | `--card-background-color` |
| `--jelly-surface-2` | `--secondary-background-color` |
| `--jelly-text` | `--primary-text-color` |
| `--jelly-text-2` | `--secondary-text-color` |
| `--jelly-accent` | `--accent-color` |
| `--jelly-on` | `--state-active-color` (fallback: `--accent-color`) |
| `--jelly-off` | `--disabled-text-color` |

No additional configuration is needed — Jelly picks up Catppuccin colors automatically once the theme is active.

---

## Card Setup: HVAC

The HVAC card provides a scrollable horizontal temperature rail with a thumb slider.

### Required Entity

A `climate.*` entity — e.g. from the built-in Climate platform, a Tuya thermostat, or an MQTT climate device.

### Add via UI

1. Edit your dashboard → **Add Card** → search **Jelly HVAC Card**
2. Configure:

| Option | Description | Default |
|---|---|---|
| **Entity** | Climate entity (required) | — |
| **Display Name** | Override the friendly name | Entity's `friendly_name` |
| **Icon** | MDI icon override | Entity's icon |
| **Minimum Temperature** | Lower bound of the rail | `18` |
| **Maximum Temperature** | Upper bound of the rail | `35` |

### Add via YAML

```yaml
type: custom:jelly-hvac-card
entity: climate.living_room
name: Living Room
min_temp: 16
max_temp: 30
```

### Sizing

The HVAC card occupies **4 grid units** minimum. In the HA sections layout, drag the card to be at least 4 rows tall. The temperature rail scrolls horizontally within the card.

### Behaviour

- **Drag the rail** to scroll through temperatures (natural scrolling direction)
- **Drag the thumb** to set temperature precisely (inverted direction for fine control)
- **Tap the card** toggles the climate entity on/off with optimistic UI feedback
- Temperature changes are debounced (150ms) and sent via `climate.set_temperature`
- Status text adapts: "Heating", "Cooling", "Auto", "Dry", "Fan", "Off"

---

## Card Setup: Weather

The Weather card shows current conditions with inline SVG icons and a multi-day forecast strip with candle-style temperature range graphs.

### Required Entity

A `weather.*` entity — e.g. from the Met Office, OpenWeatherMap, or AccuWeather integrations.

### Required Assets

Weather SVG icons must be present at `/config/www/jelly/src/cards/weather-icons/`. The following icons are included:

`sunny.svg` · `clear-night.svg` · `cloudy.svg` · `partlycloudy.svg` · `rainy.svg` · `pouring.svg` · `snowy.svg` · `snowy-rainy.svg` · `fog.svg` · `hail.svg` · `lightning.svg` · `lightning-rainy.svg` · `windy.svg` · `exceptional.svg`

### Add via UI

1. Edit your dashboard → **Add Card** → search **Jelly Weather Card**
2. Configure:

| Option | Description | Default |
|---|---|---|
| **Entity** | Weather entity (required) | — |
| **Days** | Forecast days: 3, 5, or 7 | `5` |
| **Show Forecast** | Show the forecast strip | `true` |
| **Show Precipitation** | Show rain % in forecast | `true` |

### Add via YAML

```yaml
type: custom:jelly-weather-card
entity: weather.home
days: 5
show_forecast: true
show_precip: true
```

### Sizing

The Weather card occupies **4 grid units** minimum. The forecast strip shows day labels, weather icons, SVG candle graphs (wick + body bars scaled to the global temperature range), high/low labels, and optional precipitation percentages.

### Forecast Data

- On HA 2023.12+, Jelly uses the `weather/subscribe_forecast` WebSocket for real-time updates
- Falls back to `entity.attributes.forecast` on older versions

---

## Card Setup: Camera

The Camera card shows a live still-image feed with periodic refresh and a full-screen live-stream dialog.

### Required Entity

A `camera.*` entity — e.g. from a generic camera, RTSP stream, Reolink, UniFi Protect, or Frigate integration.

### Add via UI

1. Edit your dashboard → **Add Card** → search **Jelly Camera Card**
2. Configure:

| Option | Description | Default |
|---|---|---|
| **Entity** | Camera entity (required) | — |
| **Display Name** | Name shown on the recording pill | Entity's `friendly_name` |
| **Image Refresh Rate** | How often to refresh the still image (5/10/15/30/60 seconds) | `10` seconds |

### Add via YAML

```yaml
type: custom:jelly-camera-card
entity: camera.front_door
name: Front Door
refresh_interval: 10
```

### Sizing

The Camera card has a minimum of **2 grid units**. The image fills the entire card with `object-fit: cover`, making it look like a picture tile.

### Features

- **Recording pill** — top-left translucent overlay with a blinking red dot and the camera name
- **Timestamp** — bottom-left showing the last refresh time
- **Tap** → opens a full-viewport live-stream dialog using HA's `<ha-camera-stream>` component (auto-selects WebRTC, HLS, or MJPEG)
- **Flicker-free refresh** — images are preloaded off-screen before swapping in
- **Dialog controls** — close via ✕ button, backdrop click, or `Escape` key; animated entrance/exit

### Camera Integration Tips

| Integration | Setup Notes |
|---|---|
| **Generic Camera** | Add via Settings → Devices → Add Integration → Generic Camera. Provide an MJPEG or still-image URL. |
| **RTSP** | Use the Generic Camera integration with your RTSP stream URL. |
| **Frigate** | Install Frigate via add-on; camera entities appear automatically. |
| **UniFi Protect** | Install the UniFi Protect integration; cameras are auto-discovered. |
| **Reolink** | Install the Reolink integration from HACS or built-in (HA 2023.11+). |

---

## Card Setup: Activity

The Activity card shows a scrollable timeline of recent smart home activity events — state changes, device actions, and setting adjustments — with timestamps, domain icons, and color-coded state accents.

It subscribes directly to Home Assistant's WebSocket for real-time `state_changed` events and persists the event log to `localStorage`, so events survive page reloads.

### No Prerequisites Required

Unlike polling-based approaches, this card requires no additional HACS frontends — it subscribes to HA events natively.

### Add via YAML

```yaml
type: custom:jelly-activity-card
title: Recent Activity
max_items: 100
max_hours: 24
domains:
  - light
  - switch
  - climate
  - cover
  - fan
  - lock
  - automation
  - scene
```

### Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| **title** / **name** | string | `"Recent Activity"` | Card heading text |
| **domains** | string[] | `["light","switch","lock","cover","climate","fan","automation","scene"]` | Which entity domains to track. Only `state_changed` events from these domains are logged |
| **max_items** | number | `200` | Maximum number of events stored. Oldest events are trimmed first |
| **max_hours** | number | *(none)* | Drop events older than N hours (checked on every render) |
| **refresh_interval** | number | `30` | Seconds between UI refreshes for live "ago" text. Set to `0` to disable |
| **time_buckets** | array | *(see defaults)* | Custom time separator thresholds — array of `{ title, seconds }` objects |

### Time Buckets

By default, events are grouped under these time separators:

| Separator | Threshold |
|---|---|
| Last 10 mins | ≤ 600 seconds |
| Last hour | ≤ 3 600 seconds |
| Last 4 hours | ≤ 14 400 seconds |
| Last 24 hours | ≤ 86 400 seconds |
| Yesterday & older | Everything else |

Override with custom buckets in the card config:

```yaml
card:
  type: custom:jelly-activity-card
  title: House Log
  time_buckets:
    - title: Just now
      seconds: 300
    - title: This hour
      seconds: 3600
    - title: Earlier today
      seconds: 86400
```

If the last custom bucket is not `Infinity`, an "Older" catch-all is appended automatically.

### Sizing

The Activity card occupies **4 grid units** minimum. It scrolls internally — drag or scroll the list to see older events. The timeline rail and icons remain fixed to the left.

### State Color Coding

Rows are color-coded based on entity domain and state:

| Color | Domains | Condition |
|---|---|---|
| **Primary accent** (green/accent) | light, switch, fan, input_boolean, media_player, vacuum, humidifier, remote | State is not off/unavailable/idle/standby |
| **Blue** (Catppuccin blue) | climate, cover, alarm_control_panel, input_number, number, input_select, select, water_heater, valve | State is not unavailable |
| **Neutral** (default text) | All other domains/states | — |

### Features

- **Real-time WebSocket** — subscribes to `state_changed` events; new rows appear instantly
- **Persistent log** — events stored in `localStorage` (`jelly-activity-log`); survives page reloads
- **Repeating entities** — the same entity appears as many rows as it changes (true event log)
- **Diff messages** — shows what changed: `"Living Room AC temp changed from 18° to 22°"` with highlighted param/value spans
- **Timeline rail** — vertical line with circular icon "stations" for each event
- **State color coding** — primary accent for on-domains, Catppuccin blue for setting-domains
- **Live refresh** — "ago" text auto-updates every `refresh_interval` seconds
- **Domain filtering** — only tracks events from configured `domains`
- **Empty state** — shows "Listening since {time}" message on first load before events arrive
- **Smart icons** — uses entity icon if set, falls back to a 30+ domain icon map

### Domain Tips

| Goal | Config |
|---|---|
| Track everything | `domains: ["light","switch","climate","cover","fan","lock","automation","scene","media_player","vacuum"]` |
| Lights only | `domains: ["light"]` |
| Security focused | `domains: ["lock","alarm_control_panel","binary_sensor"]` |
| Quick overview | Set `max_hours: 4` + `max_items: 30` |

---

## Adding Custom Images

Several Jelly cards support custom images via the `image` config option — **Toggle Card**, **Device Card**, and others.

### Where to Store Images

Place images in your HA `www` directory:

```
/config/www/jelly/images/
├── desk-lamp.png
├── living-room-fan.png
├── bedroom-ac.png
└── ...
```

### Reference in Card Config

Use the `/local/` prefix (HA serves `/config/www/` as `/local/`):

```yaml
type: custom:jelly-toggle-card
entity: light.desk_lamp
name: Desk Lamp
image: /local/jelly/images/desk-lamp.png
```

```yaml
type: custom:jelly-device-card
entity: fan.living_room
name: Living Room Fan
image: /local/jelly/images/living-room-fan.png
```

### Image Guidelines

- **Format:** PNG with transparency works best against the card background; JPEG and WebP are also supported
- **Size:** 200–400px wide is more than enough; keep file sizes small for snappy loading
- **Aspect ratio:** Images are displayed within the card layout — square or portrait images work well for device/toggle cards
- **Naming convention:** Use kebab-case matching your entity names for easy management

### Using Icons Instead

If you don't have a custom image, cards fall back to MDI icons. You can set a specific icon:

```yaml
type: custom:jelly-toggle-card
entity: light.bedroom
icon: mdi:lamp
```

Icon resolution order: `config.icon` → `entity.attributes.icon` → domain default.

---

## AI Quirky Messages on the Clock Card

The Jelly Clock card supports an optional subtitle line via an `input_text` helper entity. You can use a Home Assistant automation with an AI service (like OpenAI or Google Generative AI) to populate this helper with quirky, context-aware messages.

### Step 1 — Create an Input Text Helper

1. Go to **Settings → Devices & Services → Helpers**
2. Click **Create Helper** → **Text**
3. Configure:
   - **Name:** `AI Message` (this creates `input_text.ai_message`)
   - **Max length:** `255`
4. Click **Create**

### Step 2 — Configure the Clock Card

```yaml
type: custom:jelly-clock-card
show_time: true
text_entity: input_text.ai_message
```

The subtitle line will display whatever text is stored in `input_text.ai_message`.

### Step 3 — Install an AI Integration

#### Option A: OpenAI Conversation

1. Go to **Settings → Devices & Services → Add Integration**
2. Search for **OpenAI Conversation**
3. Enter your OpenAI API key
4. Configure the model (e.g. `gpt-4o-mini` for low cost)

#### Option B: Google Generative AI

1. Go to **Settings → Devices & Services → Add Integration**
2. Search for **Google Generative AI**
3. Enter your Google AI API key

#### Option C: Local LLM (Ollama via add-on)

1. Install the **Ollama** add-on from the HA add-on store
2. Pull a small model (e.g. `llama3.2:1b` or `phi3:mini`)
3. Add the Ollama conversation integration

### Step 4 — Create the Automation

Go to **Settings → Automations → Create Automation** and switch to YAML mode:

```yaml
alias: "AI Quirky Clock Message"
description: "Generate a fun one-liner for the Jelly clock subtitle"
mode: single

trigger:
  # Run every 30 minutes
  - platform: time_pattern
    minutes: "/30"

  # Also run at HA startup
  - platform: homeassistant
    event: start

action:
  - action: conversation.process
    data:
      agent_id: conversation.openai  # or your AI agent entity
      text: >
        You are a cheeky, witty smart-home assistant that lives on a
        dashboard clock. Write a single short quip (max 60 characters)
        about the current moment. Be playful and occasionally reference
        the time, weather, or day of the week. No hashtags, no emojis,
        no quotes. Just the raw text.

        Current time: {{ now().strftime('%H:%M') }}
        Day: {{ now().strftime('%A') }}
        Date: {{ now().strftime('%d %B %Y') }}
    response_variable: ai_response

  - action: input_text.set_value
    target:
      entity_id: input_text.ai_message
    data:
      value: "{{ ai_response.response.speech.plain.speech[:255] }}"
```

### Prompt Tips

- **Add sensor context** for richer messages — e.g. include `{{ states('weather.home') }}` or `{{ state_attr('weather.home', 'temperature') }}°` in the prompt
- **Adjust the schedule** — `/30` runs every 30 minutes; use `/60` for hourly or a fixed `at:` time for daily
- **Keep it short** — the subtitle area is a single line; instruct the AI to stay under ~60 characters
- **Tone guidance** — add personality keywords: "sarcastic", "wholesome", "poetic", "dad-joke", etc.

### Example Messages

The AI might produce lines like:

> *"Another Tuesday, another existential crisis"*
> *"14:30 — the post-lunch danger zone"*
> *"It's raining. Perfect couch weather."*
> *"Friday vibes: 98% charged"*

---

## Pushing Updates (Development)

If you're developing Jelly locally and have SSH access to your HA instance:

```bash
# From the jelly project root
npm run push
```

This runs:
```bash
tar -czf - . | ssh root@192.168.64.2 "mkdir -p /config/www/jelly && tar -xzf - -C /config/www/jelly"
```

> **Note:** Update the SSH target in `package.json` to match your HA instance's IP address and credentials.

After pushing, hard-refresh your browser (`Cmd+Shift+R`) to pick up the changes. If cards don't update, clear the resource cache: **Settings → Dashboards → Resources** → edit the Jelly resource URL to add a query string (e.g. `?v=2`), then refresh.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Cards don't appear in the picker | Ensure the resource is registered as a **JavaScript Module** and hard-refresh |
| "Custom element doesn't exist" | Check the resource URL path — it must be `/local/jelly/src/jelly.js` |
| Theme colors look wrong | Verify Catppuccin is the active theme in your user profile |
| Weather icons missing | Confirm SVG files exist at `/config/www/jelly/src/cards/weather-icons/` |
| Camera shows "Not found" | Check that the camera entity exists and is not `unavailable` |
| Clock subtitle is empty | Verify `input_text.ai_message` exists and the automation has run successfully |
| HVAC rail doesn't scroll | Ensure the card has enough height (4+ grid rows in the sections layout) |
| AI automation fails | Check **Settings → Automations → Traces** for the automation; verify the AI integration is configured and the `agent_id` matches your setup |
