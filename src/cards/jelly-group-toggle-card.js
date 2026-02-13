import JellyCardBase from "../jelly-base.js";
import { computeStatus } from "../utils/status-utils.js";

/**
 * Group Toggle Card — shows a group entity with master toggle and
 * a dense list of member entity toggles underneath.
 * Entity must be a group of toggle-type entities.
 */
customElements.define(
  "jelly-group-toggle-card",
  class JellyGroupToggleCard extends JellyCardBase {

    static minUnits = 3;

    /** @returns {string} Card HTML tag name */
    static get cardTag() {
      return "jelly-group-toggle-card";
    }

    /** @returns {string[]} Preferred entity domains for entity picker */
    static get cardDomains() {
      return ["group", "light", "switch", "fan", "cover", "input_boolean"];
    }

    /**
     * Editor schema — group entity + configurable icon
     * @returns {Object} Schema and labels for ha-form
     */
    static get editorSchema() {
      return {
        schema: [
          {
            name: "entity",
            selector: {
              entity: {
                domain: ["group", "light", "switch", "fan", "cover", "input_boolean"]
              }
            }
          },
          {
            name: "name",
            selector: { text: {} }
          },
          {
            name: "icon",
            selector: { icon: {} }
          }
        ],
        labels: {
          entity: "Group Entity",
          name: "Display Name (optional)",
          icon: "Icon (optional)"
        }
      };
    }

    static async getConfigElement() {
      return await JellyCardBase.getConfigElement.call(this);
    }

    static getStubConfig(hass) {
      return JellyCardBase.getStubConfig.call(this, hass);
    }

    /**
     * Called after HTML/CSS assets are loaded.
     * Cache DOM references and bind master toggle interaction.
     */
    afterLoad() {
      this.$card = this.qs(".card");
      this.$icon = this.qs(".entity-icon");
      this.$title = this.qs(".title");
      this.$status = this.qs(".status");
      this.$masterToggle = this.qs(".master-toggle");
      this.$memberList = this.qs(".member-list");
      this.$treeTrunk = this.qs(".tree-trunk");

      this.bindInteractions(this.$masterToggle, {
        onTap: () => this._handleMasterToggle()
      });
    }

    /**
     * Render the card: header + dynamic member rows.
     */
    render() {
      if (!this.hass || !this.config || !this.$card) return;

      const group = this.stateObj();
      if (!group) {
        this.$title.textContent = "Entity not found";
        this.$status.textContent = this.config.entity;
        this.$card.setAttribute("data-state", "unavailable");
        return;
      }

      const isOn = group.state === "on";
      this.$card.setAttribute("data-state", isOn ? "on" : "off");

      // Header
      this.$title.textContent =
        this.config.name || group.attributes.friendly_name || this.config.entity;

      const icon = this.config.icon
        || group.attributes.icon
        || "mdi:lightning-bolt";
      this.$icon.setAttribute("icon", icon);

      // Status line — count of active members
      const memberIds = group.attributes.entity_id || [];
      const onCount = memberIds.filter(
        (id) => this._memberIsOn(id)
      ).length;
      this.$status.textContent =
        onCount === 0
          ? "All off"
          : onCount === memberIds.length
            ? "All on"
            : `${onCount} of ${memberIds.length} on`;

      // Render member rows
      this._renderMembers(memberIds);
    }

    /**
     * Build / update the member list rows.
     * Re-uses existing rows when the member set hasn't changed.
     */
    _renderMembers(memberIds) {
      // Rebuild rows if member list changed
      const currentIds = this._memberIds || [];
      const changed =
        memberIds.length !== currentIds.length ||
        memberIds.some((id, i) => id !== currentIds[i]);

      if (changed) {
        this._memberIds = memberIds.slice();
        // Detach trunk before clearing
        if (this.$treeTrunk?.parentNode) {
          this.$treeTrunk.remove();
        }
        this.$memberList.innerHTML = "";
        // Re-insert trunk
        this.$memberList.appendChild(this.$treeTrunk);
        this._memberCleanups?.forEach((fn) => fn());
        this._memberCleanups = [];

        memberIds.forEach((entityId) => {
          const row = this._createMemberRow(entityId);
          this.$memberList.appendChild(row);
        });
      }

      // Update each row's state
      memberIds.forEach((entityId) => {
        this._updateMemberRow(entityId);
      });

      // Size trunk to stop at last row center
      this._updateTrunkHeight();
    }

    /**
     * Set trunk height so it ends at the vertical center of the last member row.
     */
    _updateTrunkHeight() {
      if (!this.$treeTrunk || !this.$memberList) return;
      const rows = this.$memberList.querySelectorAll(".member-row");
      if (!rows.length) {
        this.$treeTrunk.style.height = "0";
        return;
      }
      const lastRow = rows[rows.length - 1];
      const listRect = this.$memberList.getBoundingClientRect();
      const rowRect = lastRow.getBoundingClientRect();
      const endY = (rowRect.top + rowRect.height / 2) - listRect.top;
      this.$treeTrunk.style.height = `${endY}px`;
    }

    /**
     * Create a single member row element.
     * @param {string} entityId
     * @returns {HTMLElement}
     */
    _createMemberRow(entityId) {
      const row = document.createElement("div");
      row.className = "member-row";
      row.dataset.entity = entityId;

      row.innerHTML = `
        <div class="member-icon">
          <ha-icon icon="mdi:toggle-switch"></ha-icon>
        </div>
        <div class="member-info">
          <div class="member-name"></div>
          <div class="member-status"></div>
        </div>
        <div class="member-toggle">
          <div class="member-toggle-knob"></div>
        </div>
      `;

      // Bind toggle tap on the small toggle
      const toggle = row.querySelector(".member-toggle");
      const cleanup = this.bindInteractions(toggle, {
        onTap: () => this._handleMemberToggle(entityId, row)
      });
      this._memberCleanups.push(cleanup);

      return row;
    }

    /**
     * Update a member row with current entity state.
     * @param {string} entityId
     */
    _updateMemberRow(entityId) {
      const row = this.$memberList.querySelector(
        `[data-entity="${entityId}"]`
      );
      if (!row) return;

      const entity = this.stateObj(entityId);
      if (!entity) {
        row.setAttribute("data-state", "unavailable");
        row.querySelector(".member-name").textContent = entityId;
        row.querySelector(".member-status").textContent = "Unavailable";
        return;
      }

      const isOn = this._memberIsOn(entityId);
      row.setAttribute("data-state", isOn ? "on" : "off");

      row.querySelector(".member-name").textContent =
        entity.attributes.friendly_name || entityId;

      row.querySelector(".member-status").textContent =
        computeStatus(entity, { maxLength: 24 });

      // Set icon from entity attributes or domain default
      const icon =
        entity.attributes.icon || this._domainIcon(entityId);
      row.querySelector(".member-icon ha-icon").setAttribute("icon", icon);
    }

    /**
     * Check if a member entity is in an "on" state.
     */
    _memberIsOn(entityId) {
      const s = this.stateObj(entityId);
      return s && s.state !== "off" && s.state !== "unavailable" && s.state !== "unknown";
    }

    /**
     * Master toggle — toggles the group entity.
     */
    _handleMasterToggle() {
      const group = this.stateObj();
      if (!group || group.state === "unavailable" || group.state === "unknown") return;

      const desiredState = group.state === "on" ? "off" : "on";

      this.optimisticToggle({
        desiredState,
        applyOptimistic: () => {
          this.$card.setAttribute("data-state", desiredState);
        },
        rollback: () => this.render(),
        confirm: (next) => {
          return next?.state === desiredState;
        }
      });
    }

    /**
     * Toggle an individual member entity.
     */
    _handleMemberToggle(entityId, row) {
      const entity = this.stateObj(entityId);
      if (!entity || entity.state === "unavailable" || entity.state === "unknown") return;

      const desiredState = entity.state === "off" ? "on" : "off";

      this.optimisticToggle({
        entityId,
        desiredState,
        applyOptimistic: () => {
          row.setAttribute("data-state", desiredState);
          row.querySelector(".member-status").textContent =
            desiredState === "on" ? "On" : "Off";
        },
        rollback: () => this._updateMemberRow(entityId),
        confirm: (next) => {
          const nextIsOn = next?.state !== "off" && next?.state !== "unavailable";
          return nextIsOn === (desiredState === "on");
        }
      });
    }

    /**
     * Default icon by domain.
     * @param {string} entityId
     * @returns {string}
     */
    _domainIcon(entityId) {
      const domain = entityId?.split(".")?.[0];
      const icons = {
        switch: "mdi:toggle-switch",
        light: "mdi:lightbulb",
        fan: "mdi:fan",
        input_boolean: "mdi:toggle-switch-outline",
        cover: "mdi:blinds",
        lock: "mdi:lock",
        climate: "mdi:thermostat"
      };
      return icons[domain] || "mdi:toggle-switch";
    }

    disconnectedCallback() {
      this._memberCleanups?.forEach((fn) => fn());
      this._memberCleanups = [];
      this._memberIds = [];
      super.disconnectedCallback();
    }
  }
);
