import JellyCardBase from "../jelly-base.js";

/**
 * Camera Card — live camera still-image viewer with periodic refresh.
 * Displays the camera entity's still image as a full-bleed background,
 * a recording indicator pill, and a Live View button for the HA more-info dialog.
 */
customElements.define(
  "jelly-camera-card",
  class JellyCameraCard extends JellyCardBase {

    static minUnits = 2;

    static get cardTag() { return "jelly-camera-card"; }

    static get cardDomains() {
      return ["camera"];
    }

    static get editorSchema() {
      return {
        schema: [
          {
            name: "entity",
            selector: {
              entity: {
                domain: ["camera"]
              }
            }
          },
          { name: "name", selector: { text: {} } },
          {
            name: "refresh_interval",
            selector: {
              select: {
                options: [
                  { value: "5",  label: "5 seconds"  },
                  { value: "10", label: "10 seconds" },
                  { value: "15", label: "15 seconds" },
                  { value: "30", label: "30 seconds" },
                  { value: "60", label: "60 seconds" },
                ],
                mode: "dropdown"
              }
            }
          }
        ],
        labels: {
          entity: "Camera Entity",
          name: "Display Name (optional)",
          refresh_interval: "Image Refresh Rate"
        }
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig(hass) {
      return {
        ...JellyCardBase.getStubConfig.call(this, hass),
        refresh_interval: "10"
      };
    }

    /**
     * No-op: HA grid rows are the sole height authority.
     */
    _applyCardDimensions() {}

    afterLoad() {
      this.$card   = this.qs(".card");
      this.$image  = this.qs(".camera-image");
      this.$label  = this.qs(".rec-label");
      this.$live   = this.qs(".live-pill");

      this._refreshTimer = null;
      this._lastUrl = null;

      // Live View opens HA more-info dialog for this camera entity
      this.bindInteractions(this.$live, {
        onTap: () => this._openLiveView()
      });
    }

    render() {
      if (!this.hass || !this.config || !this.$card) return;

      const entity = this.stateObj();
      if (!entity) {
        this.$label.textContent = "Not found";
        this.$card.setAttribute("data-state", "unavailable");
        this._stopRefresh();
        return;
      }

      if (entity.state === "unavailable") {
        this.$card.setAttribute("data-state", "unavailable");
        this.$label.textContent =
          this.config.name || entity.attributes.friendly_name || this.config.entity;
        this._stopRefresh();
        return;
      }

      this.$card.setAttribute("data-state", "idle");
      this.$label.textContent =
        this.config.name || entity.attributes.friendly_name || this.config.entity;

      // Fetch the still image
      this._refreshImage();
      this._ensureRefreshTimer();
    }

    /* ---- Image refresh ---- */

    _refreshImage() {
      if (!this.hass || !this.config?.entity) return;

      const entity = this.stateObj();
      if (!entity || entity.state === "unavailable") return;

      // Build the camera proxy URL with a cache-busting timestamp
      const entityId = this.config.entity;
      const ts = Date.now();
      const url = `/api/camera_proxy/${entityId}?token=${entity.attributes.access_token}&t=${ts}`;

      // Only update src when the URL actually changes (prevents flicker on same frame)
      if (url !== this._lastUrl) {
        this._lastUrl = url;
        // Use a temporary Image to avoid showing a blank frame while loading
        const img = new Image();
        img.onload = () => {
          if (this.$image) {
            this.$image.src = url;
          }
        };
        img.onerror = () => {
          // Leave previous frame in place on error
        };
        img.src = url;
      }
    }

    _getIntervalMs() {
      const sec = parseInt(this.config?.refresh_interval, 10);
      return (sec > 0 ? sec : 10) * 1000;
    }

    _ensureRefreshTimer() {
      // Clear any old timer so interval changes take effect
      this._stopRefresh();

      this._refreshTimer = setInterval(() => {
        this._lastUrl = null; // force refresh
        this._refreshImage();
      }, this._getIntervalMs());
    }

    _stopRefresh() {
      if (this._refreshTimer) {
        clearInterval(this._refreshTimer);
        this._refreshTimer = null;
      }
    }

    /* ---- Actions ---- */

    _openLiveView() {
      if (!this.config?.entity) return;
      // Fire HA event to open the more-info dialog (full live stream)
      const event = new CustomEvent("hass-more-info", {
        detail: { entityId: this.config.entity },
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(event);
    }

    /* ---- Lifecycle ---- */

    disconnectedCallback() {
      this._stopRefresh();
      super.disconnectedCallback();
    }
  }
);
