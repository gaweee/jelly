# Codename Jelly – HA Custom Dashboard

## Goals
- Build HA custom cards with clean separation: HTML / CSS / JS
- Theme-first: CSS uses ONLY Jelly tokens (var(--jelly-*)), no hex
- Minimal hardcoding: assets loaded by convention from custom element name
- Provide a JellyCardBase with:
  - auto-load {tag}.html and {tag}.css
  - Shadow DOM
  - shared helpers (qs, stateObj, callService)
  - optimistic UI primitives (toggle now, rollback on timeout)

## Conventions
- Custom element tag: jelly-<card-name>
- Assets:
  - /local/jelly/src/cards/<tag>.html
  - /local/jelly/src/cards/<tag>.css
- JS file imports base and defines custom element

## Current cards
- jelly-light-button
  - on/off/unavailable visual states
  - uses homeassistant.toggle
  - optimistic UI (1200ms timeout)