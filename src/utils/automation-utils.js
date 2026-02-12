/**
 * Automation Utilities for Jelly Cards
 * Provides helpers for executing Home Assistant automations, scripts, scenes, and buttons
 */

/**
 * Executes a shortcut action (automation, script, scene, or button)
 * Handles parameter parsing for scripts with proper error notifications
 * @param {Object} hass - Home Assistant object
 * @param {Object} shortcut - Shortcut configuration
 * @param {string} shortcut.automation - Entity ID (e.g., "script.my_script")
 * @param {string} [shortcut.parameter] - Optional JSON parameters for scripts
 * @returns {boolean} True if executed successfully, false otherwise
 */
export function executeShortcut(hass, shortcut) {
  if (!hass || !shortcut?.automation) {
    console.warn("Jelly: Missing hass or shortcut.automation");
    return false;
  }

  const entity = hass.states[shortcut.automation];
  if (!entity) {
    console.warn("Jelly: Entity not found", shortcut.automation);
    return false;
  }

  const [domain] = shortcut.automation.split(".");
  let service, serviceData;

  switch (domain) {
    case "button":
      service = "press";
      serviceData = { entity_id: shortcut.automation };
      break;

    case "scene":
      service = "turn_on";
      serviceData = { entity_id: shortcut.automation };
      break;

    case "automation":
      service = "trigger";
      serviceData = { entity_id: shortcut.automation };
      break;

    case "script":
      service = "turn_on";
      serviceData = { entity_id: shortcut.automation };
      
      // Parse parameters for scripts - must be wrapped in 'variables' key
      if (shortcut.parameter && shortcut.parameter.trim()) {
        try {
          const paramData = JSON.parse(shortcut.parameter);
          // Scripts expect parameters under 'variables' key
          serviceData.variables = paramData;
        } catch (e) {
          // Show user-friendly error notification
          const errorMsg = `Invalid JSON in shortcut parameters. Use format: {"key": "value"} or {"percentage": 75}. Error: ${e.message}`;
          console.error("Jelly:", errorMsg);
          
          // Try to show a notification if available
          if (hass?.callService) {
            hass.callService("persistent_notification", "create", {
              title: "Jelly Card - Invalid Parameters",
              message: errorMsg,
              notification_id: "jelly_param_error"
            });
          }
          
          // Don't execute the script with invalid parameters
          return false;
        }
      }
      break;

    default:
      console.warn("Jelly: Unsupported domain for shortcut", domain);
      return false;
  }

  // Execute the service call
  if (hass.callService) {
    hass.callService(domain, service, serviceData);
    return true;
  }

  return false;
}

/**
 * Validates if an entity can be used as a shortcut
 * @param {string} entityId - Entity ID to validate
 * @returns {boolean} True if entity is a valid shortcut target
 */
export function isValidShortcutEntity(entityId) {
  if (!entityId || typeof entityId !== "string") return false;
  
  const [domain] = entityId.split(".");
  return ["automation", "script", "scene", "button"].includes(domain);
}

/**
 * Gets the default service for an entity domain
 * @param {string} domain - Entity domain (automation, script, scene, button)
 * @returns {string|null} Service name or null if unsupported
 */
export function getServiceForDomain(domain) {
  const serviceMap = {
    button: "press",
    scene: "turn_on",
    automation: "trigger",
    script: "turn_on"
  };
  
  return serviceMap[domain] || null;
}
