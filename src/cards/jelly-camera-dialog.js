/**
 * Jelly Camera Dialog — full-screen live stream overlay.
 *
 * Uses HA's native <ha-camera-stream> (WebRTC / HLS / MJPEG auto-negotiation)
 * when available. Falls back to MJPEG proxy stream <img>.
 *
 * Usage:
 *   JellyCameraDialog.open({ hass, entityId, title });
 *
 * Appended to document.body to escape Shadow DOM z-index stacking.
 */

const DIALOG_TAG = "jelly-camera-dialog";

class JellyCameraDialog extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>${JellyCameraDialog._styles()}</style>
      <div class="backdrop"></div>
      <div class="dialog">
        <div class="header">
          <div class="title-pill">
            <span class="rec-dot"></span>
            <span class="title-text"></span>
          </div>
          <button class="close-btn" aria-label="Close">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <div class="stream-container"></div>
      </div>
    `;

    this._$backdrop  = this.shadowRoot.querySelector(".backdrop");
    this._$dialog    = this.shadowRoot.querySelector(".dialog");
    this._$title     = this.shadowRoot.querySelector(".title-text");
    this._$container = this.shadowRoot.querySelector(".stream-container");
    this._$close     = this.shadowRoot.querySelector(".close-btn");

    // Close handlers
    this._$close.addEventListener("click", () => this.close());
    this._$backdrop.addEventListener("click", () => this.close());

    // Escape key
    this._onKey = (e) => { if (e.key === "Escape") this.close(); };
    document.addEventListener("keydown", this._onKey);

    // Render stream
    this._renderStream();

    // Trigger entrance animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._$backdrop.classList.add("visible");
        this._$dialog.classList.add("visible");
      });
    });
  }

  disconnectedCallback() {
    if (this._onKey) {
      document.removeEventListener("keydown", this._onKey);
      this._onKey = null;
    }
  }

  /** Public API to configure before/after connectedCallback */
  configure({ hass, entityId, title }) {
    this._hass = hass;
    this._entityId = entityId;
    this._title = title;
  }

  _renderStream() {
    if (this._title) {
      this._$title.textContent = this._title;
    }

    const entity = this._hass?.states?.[this._entityId];
    if (!entity) {
      this._$container.innerHTML = `<div class="error-msg">Camera not available</div>`;
      return;
    }

    // Try HA's native <ha-camera-stream> first
    if (customElements.get("ha-camera-stream")) {
      const stream = document.createElement("ha-camera-stream");
      stream.hass = this._hass;
      stream.stateObj = entity;
      stream.controls = true;
      stream.muted = true;
      stream.allow = "fullscreen";
      stream.style.cssText = "width:100%;height:100%;display:block;object-fit:contain;";
      this._$container.appendChild(stream);
    } else {
      // Fallback: MJPEG proxy stream via <img>
      const token = entity.attributes.access_token || "";
      const img = document.createElement("img");
      img.src = `/api/camera_proxy_stream/${this._entityId}?token=${token}`;
      img.alt = this._title || "Camera";
      img.style.cssText = "width:100%;height:100%;object-fit:contain;";
      this._$container.appendChild(img);
    }
  }

  close() {
    this._$backdrop.classList.remove("visible");
    this._$dialog.classList.remove("visible");
    // Wait for exit animation then remove from DOM
    setTimeout(() => this.remove(), 280);
  }

  /* ---- Static helpers ---- */

  static open({ hass, entityId, title }) {
    // Only one dialog at a time
    const existing = document.querySelector(DIALOG_TAG);
    if (existing) existing.remove();

    const dialog = document.createElement(DIALOG_TAG);
    dialog.configure({ hass, entityId, title });
    document.body.appendChild(dialog);
    return dialog;
  }

  static _styles() {
    return `
      :host {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        opacity: 0;
        transition: opacity 250ms ease;
      }
      .backdrop.visible { opacity: 1; }

      .dialog {
        position: relative;
        width: min(calc(85vh * 16 / 9), 960px);
        height: auto;
        max-height: 85vh;
        aspect-ratio: 16 / 9;
        display: flex;
        flex-direction: column;
        border-radius: 16px;
        overflow: hidden;
        background: #000;
        transform: scale(0.92);
        opacity: 0;
        transition: transform 280ms cubic-bezier(.2,.9,.3,1), opacity 250ms ease;
      }
      .dialog.visible {
        transform: scale(1);
        opacity: 1;
      }

      .header {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 16px 16px 18px;
        background: linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%);
        pointer-events: none;
      }

      .title-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border-radius: 20px;
        padding: 6px 14px 6px 10px;
        pointer-events: auto;
      }

      .rec-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ff3b30;
        flex-shrink: 0;
        animation: rec-blink 1.6s ease-in-out infinite;
      }

      @keyframes rec-blink {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.3; }
      }

      .title-text {
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        letter-spacing: -0.01em;
      }

      .close-btn {
        pointer-events: auto;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #fff;
        transition: background 150ms ease;
        -webkit-tap-highlight-color: transparent;
      }
      .close-btn:hover { background: rgba(0, 0, 0, 0.7); }
      .close-btn:active { background: rgba(0, 0, 0, 0.85); }

      .stream-container {
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .stream-container img {
        border-radius: 0;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      /* ha-camera-stream fills via its own internals */
      .stream-container ha-camera-stream {
        --video-border-radius: 0;
        max-width: 100%;
        max-height: 100%;
      }

      .error-msg {
        color: rgba(255,255,255,0.5);
        font-size: 16px;
      }

      /* Mobile: tighter padding, full width */
      @media (max-width: 600px) {
        .dialog {
          max-width: 100vw;
          max-height: 100vh;
          border-radius: 0;
          aspect-ratio: auto;
          width: 100vw;
          height: 100vh;
        }
        .header {
          padding: 12px;
        }
      }
    `;
  }
}

if (!customElements.get(DIALOG_TAG)) {
  customElements.define(DIALOG_TAG, JellyCameraDialog);
}

export default JellyCameraDialog;
