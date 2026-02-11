(function loadJellyTheme() {
  const id = "jelly-theme";
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "/local/jelly/src/styles/jelly-theme.css?v=dev1";
  document.head.appendChild(link);
})();

import "./jelly-editor.js";
import "./cards/jelly-light-button.js";

// Register cards so they appear in Lovelace card picker
(function registerJellyCards() {
  const cards = [
    {
      type: "jelly-light-button",
      name: "Jelly Light Button",
      description: "Optimistic light toggle with Jelly theme"
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
