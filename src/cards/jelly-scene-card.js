import JellyCardBase from "../jelly-base.js";

/**
 * Scene Card — shows a title and a horizontal scrollable row of scene buttons.
 * Each scene is a squarish icon button; the active scene is highlighted.
 *
 * Config:
 *   entity  — (optional) input_text / input_select entity tracking the active scene
 *   name    — (optional) display name override
 *   entries — [{ entity: "scene.movie_night" }, …]
 */

customElements.define(
  "jelly-scene-card",
  class JellySceneCard extends JellyCardBase {

    static minUnits = 2;

    static get cardTag() { return "jelly-scene-card"; }

    static get cardDomains() { return ["input_text", "input_select"]; }

    /* ── Editor: managed entries list ── */

    static async getConfigElement() {
      if (!customElements.get("jelly-scene-editor")) {
        await import("./jelly-scene-editor.js");
      }
      return document.createElement("jelly-scene-editor");
    }

    static getStubConfig(hass) {
      const tag = this.cardTag;
      const entity = JellyCardBase._pickEntity(hass, ["input_text", "input_select"]) || "";
      const scene = JellyCardBase._pickEntity(hass, ["scene"]) || "";
      return {
        type: `custom:${tag}`,
        entity,
        entries: scene ? [{ entity: scene }] : [],
      };
    }

    /**
     * Override setConfig — entity is optional for scene card.
     */
    async setConfig(config) {
      if (!config) throw new Error("Jelly: config is required");

      if (!Array.isArray(config.entries)) config = { ...config, entries: [] };

      this.config = config;
      await this._ensureAssets();
      this._applyCardDimensions();
      this.render?.();
    }

    /** No-op height — rely on grid rows only */
    _applyCardDimensions() {}

    afterLoad() {
      this.$card = this.qs(".card");
      this.$title = this.qs(".title");
      this.$sceneList = this.qs(".scene-list");
      this.$fadeHint = this.qs(".fade-hint");

      // Watch scroll to toggle fade-hint visibility
      this.$sceneList.addEventListener("scroll", () => this._updateFadeHint());
    }

    render() {
      if (!this.hass || !this.config || !this.$card) return;

      // Title
      this.$title.textContent = this.config.name || "Scenes";

      // Gather configured scenes
      const scenes = this._getScenes();

      // Determine active scene from tracker entity
      const activeSceneId = this._getActiveSceneId();

      // Rebuild buttons if scene list changed
      const sceneKey = scenes.map((s) => s.entityId).join(",");
      if (sceneKey !== this._lastSceneKey) {
        this._lastSceneKey = sceneKey;
        this._rebuildButtons(scenes);
      }

      // Update active state on each button
      scenes.forEach((scene) => {
        const btn = this.$sceneList.querySelector(
          `[data-entity="${scene.entityId}"]`
        );
        if (!btn) return;

        const isActive = activeSceneId && scene.entityId === activeSceneId;
        btn.setAttribute("data-active", isActive ? "true" : "false");

        // Update name from HA entity
        const entity = this.stateObj(scene.entityId);
        const name = entity?.attributes?.friendly_name
          || scene.entityId.split(".").pop().replace(/_/g, " ");
        btn.querySelector(".scene-name").textContent = name;

        // Update entity count
        const memberIds = entity?.attributes?.entity_id || [];
        const countEl = btn.querySelector(".scene-count");
        if (countEl) {
          countEl.textContent = memberIds.length
            ? `${memberIds.length} ${memberIds.length === 1 ? 'entity' : 'entities'}`
            : "";
        }
      });

      // Fade hint
      requestAnimationFrame(() => this._updateFadeHint());
    }

    /**
     * Collect scene entity IDs from entries array.
     */
    _getScenes() {
      const entries = Array.isArray(this.config.entries) ? this.config.entries : [];
      return entries
        .filter(e => e.entity)
        .map(e => ({ entityId: e.entity }));
    }

    /**
     * Read the active scene from the tracker entity.
     */
    _getActiveSceneId() {
      if (!this.config.entity) return null;
      const tracker = this.stateObj(this.config.entity);
      if (!tracker) return null;
      // The state holds the scene entity ID or scene name
      const val = tracker.state;
      // If it already looks like an entity id, use it directly
      if (val && val.startsWith("scene.")) return val;
      // Otherwise check if it matches any configured scene's friendly name
      return null;
    }

    /**
     * Rebuild all scene buttons.
     */
    _rebuildButtons(scenes) {
      // Clean up old bindings
      this._sceneCleanups?.forEach((fn) => fn());
      this._sceneCleanups = [];
      this.$sceneList.innerHTML = "";

      scenes.forEach((scene) => {
        const entity = this.stateObj(scene.entityId);
        const icon = entity?.attributes?.icon || "mdi:palette";
        const name = entity?.attributes?.friendly_name
          || scene.entityId.split(".").pop().replace(/_/g, " ");
        const memberIds = entity?.attributes?.entity_id || [];
        const countText = memberIds.length
          ? `${memberIds.length} ${memberIds.length === 1 ? 'entity' : 'entities'}`
          : "";

        const btn = document.createElement("div");
        btn.className = "scene-btn";
        btn.dataset.entity = scene.entityId;
        btn.innerHTML = `
          <div class="scene-icon">
            <ha-icon icon="${icon}"></ha-icon>
          </div>
          <div class="scene-info">
            <span class="scene-name">${name}</span>
            <span class="scene-count">${countText}</span>
          </div>
        `;

        const cleanup = this.bindInteractions(btn, {
          onTap: () => this._activateScene(scene.entityId)
        });
        this._sceneCleanups.push(cleanup);

        this.$sceneList.appendChild(btn);
      });
    }

    /**
     * Activate a scene and optionally write to the active-scene tracker.
     */
    _activateScene(entityId) {
      // Fire the scene
      this.callService("scene", "turn_on", { entity_id: entityId });

      // Optimistic: highlight immediately
      this.$sceneList.querySelectorAll(".scene-btn").forEach((btn) => {
        btn.setAttribute(
          "data-active",
          btn.dataset.entity === entityId ? "true" : "false"
        );
      });

      // Write to tracker entity if configured
      if (this.config.entity) {
        const domain = this.config.entity.split(".")[0];
        if (domain === "input_text") {
          this.callService("input_text", "set_value", {
            entity_id: this.config.entity,
            value: entityId
          });
        } else if (domain === "input_select") {
          this.callService("input_select", "select_option", {
            entity_id: this.config.entity,
            option: entityId
          });
        }
      }
    }

    /**
     * Show/hide the right-edge fade hint based on scroll overflow.
     */
    _updateFadeHint() {
      if (!this.$sceneList || !this.$fadeHint) return;
      const { scrollLeft, scrollWidth, clientWidth } = this.$sceneList;
      const hasOverflow = scrollWidth > clientWidth + 4;
      const atEnd = scrollLeft + clientWidth >= scrollWidth - 4;
      this.$fadeHint.classList.toggle("visible", hasOverflow && !atEnd);
    }

    disconnectedCallback() {
      this._sceneCleanups?.forEach((fn) => fn());
      this._sceneCleanups = [];
      super.disconnectedCallback();
    }
  }
);
