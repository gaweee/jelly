(function loadJellyTheme() {
  const id = "jelly-theme";
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "/local/jelly/src/styles/jelly-theme.css?v=dev1";
  document.head.appendChild(link);
})();

import "./cards/jelly-light-button.js";

console.info("🪼 Jelly loaded");