(function loadJellyTheme() {
  // Compute base path from this module's location
  const moduleUrl = new URL(import.meta.url);
  const basePath = moduleUrl.pathname.replace(/\/[^/]+$/, ''); // Remove jelly.js

  // Inject @font-face with dynamic path
  const fontId = "jelly-font";
  if (!document.getElementById(fontId)) {
    const fontStyle = document.createElement("style");
    fontStyle.id = fontId;
    fontStyle.textContent = `
      @font-face {
        font-family: "Inter";
        src: url("${basePath}/../dist/fonts/Inter.var.woff2") format("woff2-variations");
        font-weight: 100 900;
        font-style: normal;
        font-display: swap;
      }
    `;
    document.head.appendChild(fontStyle);
  }

  // Load theme CSS
  const themeId = "jelly-theme";
  if (!document.getElementById(themeId)) {
    const link = document.createElement("link");
    link.id = themeId;
    link.rel = "stylesheet";
    link.href = `${basePath}/styles/jelly-theme.css?v=dev1`;
    document.head.appendChild(link);
  }
})();

import "./jelly-editor.js";
import "./cards/jelly-device-card.js";
import "./cards/jelly-hvac-card.js";
import "./cards/jelly-sensor-graph.js";
import "./cards/jelly-toggle-card.js";
import "./cards/jelly-weather-card.js";
import "./cards/jelly-clock-card.js";
import "./cards/jelly-knob-card.js";

// Register cards so they appear in Lovelace card picker
(function registerJellyCards() {
  const cards = [
    {
      type: "jelly-device-card",
      name: "Jelly Device Card",
      description: "Device card with custom image, toggle, and helper button shortcuts"
    },
    {
      type: "jelly-hvac-card",
      name: "Jelly HVAC Card",
      description: "Beautiful temperature control with interactive slider"
    },
    {
      type: "jelly-sensor-graph",
      name: "Jelly Sensor Graph",
      description: "Static sensor history chart with smooth line and latest-value label"
    },
    {
      type: "jelly-toggle-card",
      name: "Jelly Toggle Card",
      description: "Compact 1x1 toggle card with image or icon, name, and status"
    },
    {
      type: "jelly-weather-card",
      name: "Jelly Weather Card",
      description: "Weather forecast with condition icons and candle-style temperature range chart"
    },
    {
      type: "jelly-clock-card",
      name: "Jelly Clock Card",
      description: "1×1 tile showing current time, date, and day of week"
    },
    {
      type: "jelly-knob-card",
      name: "Jelly Knob Card",
      description: "Circular arc knob control with spokes, pointer, +/- buttons, and optional shortcuts"
    }
  ];

  window.customCards = window.customCards || [];
  cards.forEach((card) => {
    const already = window.customCards.some((c) => c.type === card.type);
    if (!already) {
      window.customCards.push({
        type: card.type, // HA auto-adds custom: prefix
        name: card.name,
        description: card.description,
        preview: true
      });
    }
  });
})();
