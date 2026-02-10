class JellyShellCard extends HTMLElement {
  set hass(hass) {
    if (this._rendered) return;
    this._rendered = true;

    this.innerHTML = `
      <ha-card header="Jelly Shell">
        <div style="padding:16px">
          Jelly is alive 🪼
        </div>
      </ha-card>
    `;
  }

  setConfig(config) {
    this.config = config;
  }
}

customElements.define("jelly-shell-card", JellyShellCard);