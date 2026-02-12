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
import "./cards/jelly-light-button.js";
import "./cards/jelly-device-card.js";
import "./cards/jelly-hvac-card.js";

// Register cards so they appear in Lovelace card picker
(function registerJellyCards() {
  const cards = [
    {
      type: "jelly-light-button",
      name: "Jelly Light Button",
      description: "Optimistic light toggle with Jelly theme"
    },
    {
      type: "jelly-device-card",
      name: "Jelly Device Card",
      description: "Device card with custom image, toggle, and helper button shortcuts"
    },
    {
      type: "jelly-hvac-card",
      name: "Jelly HVAC Card",
      description: "Beautiful temperature control with interactive slider"
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

console.info("🪼 Jelly loaded");
