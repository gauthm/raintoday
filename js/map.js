/**
 * Map module — Leaflet initialization, radar tile layer management, marker.
 */

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
  }).setView([lat, lon], 9);

  // Dark base layer (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
  }).addTo(map);

  return map;
}

/**
 * Add or replace the radar tile layer on the map.
 * @param {object} map - Leaflet map instance
 * @param {string} host - RainViewer tile host
 * @param {number} timestamp - Unix timestamp (seconds)
 * @param {object} options - { color, size, smooth, snow, opacity }
 * @returns {object} The radar tile layer
 */
let currentRadarLayer = null;

export function setRadarLayer(map, host, timestamp, options = {}) {
  // Remove existing radar layer
  if (currentRadarLayer) {
    map.removeLayer(currentRadarLayer);
  }

  const color = options.color ?? 2;
  const size = options.size ?? 256;
  const smooth = options.smooth ?? 1;
  const snow = options.snow ?? 1;
  const opacity = options.opacity ?? 0.8;

  const tileUrl = `${host}/v2/radar/${timestamp}/${size}/{z}/{x}/{y}/${color}/${smooth}_${snow}.png`;

  currentRadarLayer = L.tileLayer(tileUrl, {
    opacity: opacity,
    zIndex: 200,
  }).addTo(map);

  return currentRadarLayer;
}

/**
 * Remove the radar layer from the map.
 * @param {object} map - Leaflet map instance
 */
export function clearRadarLayer(map) {
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
      div.style.cssText = 'background:rgba(15,15,30,0.9);backdrop-filter:blur(10px);border:1px solid rgba(255,80,80,0.4);border-radius:8px;padding:6px 12px;font-size:12px;color:#ff8080;margin-top:50px;margin-right:10px;';
      div.textContent = 'Radar indisponible';
      return div;
    };
    radarBadge.addTo(map);
  } else if (!show && radarBadge) {
    radarBadge.remove();
    radarBadge = null;
  }
}
