class JellyLightButton extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error("entity is required");
    }
    this.config = config;
  }

  set hass(hass) {
    const state = hass.states[this.config.entity];
    if (!state) return;

    const isOn = state.state === "on";

    this.innerHTML = `
      <ha-card>
        <div style="
          padding:16px;
          border-radius:12px;
          text-align:center;
          cursor:pointer;
          background:${isOn ? "#a6e3a1" : "#313244"};
          color:${isOn ? "#11111b" : "#cdd6f4"};
        ">
          ${state.attributes.friendly_name}
        </div>
      </ha-card>
    `;

    this.onclick = () => {
      hass.callService("light", "toggle", {
        entity_id: this.config.entity
      });
    };
  }
}

customElements.define("jelly-light-button", JellyLightButton);