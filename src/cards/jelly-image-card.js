import JellyCardBase from "../jelly-base.js";

/**
 * Image Card — displays a static image on the dashboard.
 *
 * Config:
 *   name            — optional alt text (not displayed)
 *   image           — image path (e.g. /local/my-image.png)
 *   fit             — CSS object-fit value: fill | contain | cover (default "contain")
 *   borderless      — boolean, removes card background/radius so image floats on dashboard
 */
customElements.define(
  "jelly-image-card",
  class JellyImageCard extends JellyCardBase {

    static minUnits = 2;

    static get cardTag() { return "jelly-image-card"; }
    static get cardDomains() { return []; }

    static get editorSchema() {
      return {
        schema: [
          { name: "name", selector: { text: {} } },
          {
            name: "image",
            selector: {
              text: { type: "url" }
            }
          },
          {
            name: "fit",
            selector: {
              select: {
                options: [
                  { value: "contain", label: "Contain" },
                  { value: "cover",   label: "Cover" },
                  { value: "fill",    label: "Fill" },
                ],
                mode: "dropdown",
              }
            }
          },
          { name: "borderless", selector: { boolean: {} } },
        ],
        labels: {
          name: "Alt Text (optional)",
          image: "Image Path (e.g. /local/image.png — upload via Media)",
          fit: "Image Fit",
          borderless: "Remove Card Border",
        },
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig() {
      return {
        type: "custom:jelly-image-card",
        fit: "contain",
        borderless: false,
      };
    }

    async setConfig(config) {
      this.config = { ...config };
      await this._ensureAssets();
      this._applyCardDimensions();
      this.render?.();
    }

    _applyCardDimensions() {}

    afterLoad() {
      this.$card = this.qs(".card");
      this.$image = this.qs(".image");
      this.$placeholder = this.qs(".placeholder");
    }

    render() {
      if (!this.$card) return;

      const cfg = this.config || {};

      // Borderless treatment
      if (cfg.borderless) {
        this.$card.classList.add("borderless");
      } else {
        this.$card.classList.remove("borderless");
      }

      // Image
      const src = cfg.image;
      if (src) {
        this.$image.src = src;
        this.$image.alt = cfg.name || "";
        this.$image.style.objectFit = cfg.fit || "contain";
        this.$image.style.display = "block";
        this.$placeholder.style.display = "none";
      } else {
        this.$image.style.display = "none";
        this.$placeholder.style.display = "flex";
      }
    }
  }
);
