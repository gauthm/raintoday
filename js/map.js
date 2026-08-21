/**
 * Map module — Leaflet initialization, radar tile layer management, marker.
 */
import { t } from './i18n.js';

/**
 * Initialize a Leaflet map centered on given coordinates.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {object} Leaflet map instance
 */
export function initMap(lat, lon) {
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    minZoom: 3,
    maxZoom: 19,
    maxBounds: [[-90, -180], [90, 180]],
    maxBoundsViscosity: 1.0,
  }).setView([lat, lon], 9);

  // Base layer (OpenStreetMap — no watermark)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
    detectRetina: false,
    subdomains: ['a', 'b', 'c'],
  }).addTo(map);

  return map;
}

/**
 * Add or replace the radar tile layer on the map.
 * @param {object} map - Leaflet map instance
 * @param {string} host - RainViewer tile host
 * @param {string} path - Frame path (e.g. /v2/radar/abc123)
 * @param {object} options - { color, size, smooth, snow, opacity }
 * @returns {object} The radar tile layer
 */
let currentRadarLayer = null;
let previousRadarLayer = null;
let tileLoadCount = 0;
let tileErrorCount = 0;
let coverageCheckTimer = null;
let coverageMap = null;

function checkRadarCoverage(map) {
  if (coverageCheckTimer) clearTimeout(coverageCheckTimer);
  coverageCheckTimer = setTimeout(() => {
    const total = tileLoadCount + tileErrorCount;
    if (total > 0 && tileErrorCount >= total * 0.8) {
      showRadarUnavailable(map, true);
    } else if (tileLoadCount > 0) {
      showRadarUnavailable(map, false);
    }
  }, 1500);
}

/**
 * Force a coverage recheck after map move/zoom.
 * @param {object} map - Leaflet map instance
 */
export function recheckRadarCoverage(map) {
  if (!currentRadarLayer) return;
  tileLoadCount = 0;
  tileErrorCount = 0;
  checkRadarCoverage(map);
}

export function setRadarLayer(map, host, path, options = {}) {
  const color = options.color ?? 2;
  const size = options.size ?? 256;
  const smooth = options.smooth ?? 1;
  const snow = options.snow ?? 1;
  const opacity = options.opacity ?? 0.8;

  const tileUrl = `${host}${path}/${size}/{z}/{x}/{y}/${color}/${smooth}_${snow}.png`;

  // Remove previous-previous layer if still around
  if (previousRadarLayer) {
    map.removeLayer(previousRadarLayer);
    previousRadarLayer = null;
  }

  // Move current to previous, create new layer on top
  previousRadarLayer = currentRadarLayer;

  // Reset tile counters for coverage check
  tileLoadCount = 0;
  tileErrorCount = 0;

  currentRadarLayer = L.tileLayer(tileUrl, {
    opacity: opacity,
    zIndex: 200,
    maxNativeZoom: 7,
    maxZoom: 19,
    detectRetina: false,
  }).addTo(map);

  coverageMap = map;

  currentRadarLayer.on('tileerror', () => {
    tileErrorCount++;
    checkRadarCoverage(map);
  });

  currentRadarLayer.on('tileload', () => {
    tileLoadCount++;
    checkRadarCoverage(map);
  });

  // Remove previous layer once new one has loaded its first tile
  currentRadarLayer.once('tileload', () => {
    if (previousRadarLayer) {
      map.removeLayer(previousRadarLayer);
      previousRadarLayer = null;
    }
  });

  // Fallback: remove previous after 3s even if no tileload fired
  setTimeout(() => {
    if (previousRadarLayer) {
      map.removeLayer(previousRadarLayer);
      previousRadarLayer = null;
    }
  }, 3000);

  return currentRadarLayer;
}

/**
 * Update the opacity of the current radar layer without recreating it.
 * @param {number} opacity - 0 to 1
 */
export function setRadarOpacity(opacity) {
  if (!currentRadarLayer) return;
  currentRadarLayer.setOpacity(opacity);
}

/**
 * Offset the radar tile layer by a number of pixels (for future extrapolation).
 * @param {object} map - Leaflet map instance
 * @param {number} dx - X offset in pixels
 * @param {number} dy - Y offset in pixels
 */
export function setRadarOffset(map, dx = 0, dy = 0) {
  if (!currentRadarLayer) return;

  const container = currentRadarLayer.getContainer();
  if (!container) return;

  if (dx === 0 && dy === 0) {
    container.style.transform = '';
    container.style.margin = '';
    container.style.width = '';
    container.style.height = '';
    return;
  }

  container.style.transform = `translate(${dx}px, ${dy}px)`;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx > 64 || absDy > 64) {
    const padX = Math.ceil(absDx / 256) * 256;
    const padY = Math.ceil(absDy / 256) * 256;
    container.style.margin = `-${padY}px -${padX}px`;
    container.style.width  = `calc(100% + ${padX * 2}px)`;
    container.style.height = `calc(100% + ${padY * 2}px)`;
    if (currentRadarLayer.redraw) currentRadarLayer.redraw();
  }
}

/**
 * Remove the radar layer from the map.
 * @param {object} map - Leaflet map instance
 */
export function clearRadarLayer(map) {
  if (coverageCheckTimer) {
    clearTimeout(coverageCheckTimer);
    coverageCheckTimer = null;
  }
  if (previousRadarLayer) {
    map.removeLayer(previousRadarLayer);
    previousRadarLayer = null;
  }
  if (currentRadarLayer) {
    map.removeLayer(currentRadarLayer);
    currentRadarLayer = null;
  }
}

/**
 * Add or update a location marker on the map.
 * @param {object} map - Leaflet map instance
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {object} Leaflet marker
 */
let currentMarker = null;

export function setMarker(map, lat, lon) {
  if (currentMarker) {
    currentMarker.setLatLng([lat, lon]);
  } else {
    const icon = L.divIcon({
      className: 'rain-marker',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    currentMarker = L.marker([lat, lon], { icon }).addTo(map);
  }
  return currentMarker;
}

/**
 * Center the map on given coordinates with animation.
 * @param {object} map - Leaflet map instance
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} zoom - Optional zoom level
 */
export function centerMap(map, lat, lon, zoom) {
  if (zoom !== undefined) {
    map.flyTo([lat, lon], zoom);
  } else {
    map.flyTo([lat, lon]);
  }
}

/**
 * Show a badge on the map when radar is unavailable.
 * @param {object} map - Leaflet map instance
 * @param {boolean} show - Show or hide
 */
let radarBadge = null;

export function showRadarUnavailable(map, show) {
  if (show && !radarBadge) {
    radarBadge = L.control({ position: 'topright' });
    radarBadge.onAdd = function () {
      const div = L.DomUtil.create('div', 'radar-badge');
      div.style.cssText = 'background:rgba(255,255,255,0.92);backdrop-filter:blur(10px);border:1px solid rgba(255,80,80,0.4);border-radius:8px;padding:6px 12px;font-size:12px;color:#cc0000;margin-top:50px;margin-right:10px;';
      div.textContent = t.radarUnavailable;
      return div;
    };
    radarBadge.addTo(map);
  } else if (!show && radarBadge) {
    radarBadge.remove();
    radarBadge = null;
  }
}
