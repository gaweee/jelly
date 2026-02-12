/**
 * Status Utilities for Jelly Cards
 * Provides device-agnostic status computation from Home Assistant entity state and attributes
 */

// Constants
export const BRIGHTNESS_MAX = 255;
export const STATUS_MAX_LENGTH = 40;
export const STATUS_SEPARATOR = " · ";

/**
 * Extracts intensity/level status (brightness, percentage, volume, position)
 * @param {Object} attrs - Entity attributes
 * @returns {string|null} Formatted intensity string or null
 */
export function getIntensityStatus(attrs) {
  if (attrs.brightness !== undefined) {
    const pct = Math.round((attrs.brightness / BRIGHTNESS_MAX) * 100);
    return `${pct}%`;
  }
  if (attrs.percentage !== undefined) {
    return `${attrs.percentage}%`;
  }
  if (attrs.volume_level !== undefined) {
    const vol = Math.round(attrs.volume_level * 100);
    return `Vol ${vol}%`;
  }
  if (attrs.current_position !== undefined) {
    return `${attrs.current_position}%`;
  }
  return null;
}

/**
 * Extracts operating mode status (hvac, preset, fan, swing)
 * @param {Object} attrs - Entity attributes
 * @returns {string|null} Mode name or null
 */
export function getModeStatus(attrs) {
  if (attrs.hvac_mode && attrs.hvac_mode !== "off") {
    return attrs.hvac_mode;
  }
  if (attrs.preset_mode) {
    return attrs.preset_mode;
  }
  if (attrs.fan_mode) {
    return attrs.fan_mode;
  }
  if (attrs.swing_mode && attrs.swing_mode !== "off") {
    return attrs.swing_mode;
  }
  return null;
}

/**
 * Extracts media playback status
 * @param {Object} attrs - Entity attributes
 * @returns {string|null} Media title or artist or null
 */
export function getMediaStatus(attrs) {
  if (attrs.media_title) {
    return attrs.media_title;
  }
  if (attrs.media_artist) {
    return attrs.media_artist;
  }
  return null;
}

/**
 * Extracts light effect or color temperature
 * @param {Object} attrs - Entity attributes
 * @returns {string|null} Effect name or color temp or null
 */
export function getLightEffectStatus(attrs) {
  if (attrs.effect && attrs.effect !== "none") {
    return attrs.effect;
  }
  if (attrs.color_mode === "color_temp" && attrs.color_temp) {
    return `${attrs.color_temp}K`;
  }
  return null;
}

/**
 * Extracts temperature status (current or target)
 * @param {Object} attrs - Entity attributes
 * @param {string} state - Entity state
 * @returns {string|null} Temperature string or null
 */
export function getTemperatureStatus(attrs, state) {
  if (attrs.current_temperature !== undefined) {
    return `${attrs.current_temperature}°`;
  }
  if (attrs.temperature !== undefined && state !== "off") {
    return `→${attrs.temperature}°`;
  }
  return null;
}

/**
 * Extracts humidity status
 * @param {Object} attrs - Entity attributes
 * @returns {string|null} Humidity string or null
 */
export function getHumidityStatus(attrs) {
  if (attrs.current_humidity !== undefined) {
    return `${attrs.current_humidity}%RH`;
  }
  return null;
}

/**
 * Computes human-readable status string from entity state and attributes
 * Works across device types: lights, fans, climate, media players, covers, etc.
 * @param {Object} entity - Home Assistant entity object with state and attributes
 * @param {Object} options - Optional configuration
 * @param {number} options.maxLength - Maximum status length before truncation (default: STATUS_MAX_LENGTH)
 * @param {string} options.separator - Separator between status parts (default: STATUS_SEPARATOR)
 * @returns {string} Formatted status string
 */
export function computeStatus(entity, options = {}) {
  const { 
    maxLength = STATUS_MAX_LENGTH, 
    separator = STATUS_SEPARATOR 
  } = options;
  
  const state = entity.state;
  const attrs = entity.attributes;
  
  // Critical states
  if (state === "unavailable") return "Unavailable";
  if (state === "unknown") return "Unknown";
  
  const statusParts = [];
  
  // Base state (capitalized)
  const baseState = state.charAt(0).toUpperCase() + state.slice(1);
  statusParts.push(baseState);
  
  // Only add details if device is active
  const isActive = state !== "off" && state !== "idle" && state !== "standby";
  if (isActive) {
    const intensity = getIntensityStatus(attrs);
    if (intensity) statusParts.push(intensity);
    
    const mode = getModeStatus(attrs);
    if (mode) statusParts.push(mode);
    
    const media = getMediaStatus(attrs);
    if (media) statusParts.push(media);
    
    const lightEffect = getLightEffectStatus(attrs);
    if (lightEffect) statusParts.push(lightEffect);
  }
  
  // Temperature and humidity (show even when off for climate)
  const temp = getTemperatureStatus(attrs, state);
  if (temp) statusParts.push(temp);
  
  const humidity = getHumidityStatus(attrs);
  if (humidity) statusParts.push(humidity);
  
  // Join and truncate if needed
  let status = statusParts.join(separator);
  
  if (status.length > maxLength) {
    status = status.substring(0, maxLength - 3) + "...";
  }
  
  return status;
}
