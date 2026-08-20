/**
 * Main orchestrator — initializes all modules and wires data flow.
 */
import { fetchRadarFrames, selectFrames } from './api/rainviewer.js';
import { fetchPrecipitation, extractWindow, reverseGeocode } from './api/openmeteo.js';
import { initMap, setRadarLayer, setRadarOffset, setMarker, centerMap, clearRadarLayer, showRadarUnavailable } from './map.js';
import { renderGraph, renderTimeLabels, findNearestIndex } from './graph.js';
import { initSlider } from './slider.js';
import { getUserLocationWithFallback } from './geolocation.js';
import { initSearch } from './search.js';

// State
let map = null;
let radarData = null; // { host, frames: [{time, path}] }
let precipData = []; // [{ time, value }]
let windData = { speed: 0, direction: 0 };
let sliderApi = null;
let currentIdx = 0;
let lastRadarFrameTime = null; // timestamp of the last available radar frame

/**
 * Show a toast message for 3 seconds.
 * @param {string} message
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

/**
 * Format a Date as HH:MM in local timezone.
 * @param {Date} date
 * @returns {string} Formatted time
 */
function formatLocalDate(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Find the nearest radar frame for a given timestamp.
 * @param {number} ts - Unix timestamp in seconds
 * @returns {{time: number, path: string}|null}
 */
function findNearestRadarFrame(ts) {
  if (!radarData || radarData.frames.length === 0) return null;
  let bestFrame = null;
  let bestDiff = Infinity;
  for (const frame of radarData.frames) {
    const diff = Math.abs(frame.time - ts);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestFrame = frame;
    }
  }
  return bestFrame;
}

/**
 * Update the time info display.
 * @param {number} idx - Current index in precipitation data
 */
function updateTimeInfo(idx) {
  const timeEl = document.getElementById('current-time');
  const precipEl = document.getElementById('precip-info');

  if (precipData.length === 0) {
    timeEl.textContent = '--:--';
    precipEl.textContent = 'Données indisponibles';
    return;
  }

  const entry = precipData[idx];
  const date = new Date(entry.time);
  timeEl.textContent = formatLocalDate(date);

  const value = entry.value;
  const prob = entry.probability || 0;
  const now = Date.now();
  const isFuture = date.getTime() > now;
  const probSuffix = isFuture && prob > 0 ? ` (${prob}%)` : '';

  if (value <= 0) {
    precipEl.textContent = prob > 0 ? `Pas de pluie · ${prob}% de risque` : 'Aucune précipitation';
  } else if (value < 0.5) {
    precipEl.textContent = `Très faible pluie · ${value.toFixed(1)} mm/h${probSuffix}`;
  } else if (value < 2) {
    precipEl.textContent = `Faible pluie · ${value.toFixed(1)} mm/h${probSuffix}`;
  } else if (value < 10) {
    precipEl.textContent = `Pluie modérée · ${value.toFixed(1)} mm/h${probSuffix}`;
  } else if (value < 20) {
    precipEl.textContent = `Forte pluie · ${value.toFixed(1)} mm/h${probSuffix}`;
  } else {
    precipEl.textContent = `Très forte pluie · ${value.toFixed(1)} mm/h${probSuffix}`;
  }
}

let lastRadarPath = null;

/**
 * Compute pixel offset for future radar extrapolation.
 * Wind direction = where wind comes FROM, so clouds move in opposite direction.
 * @param {number} deltaSec - Time delta in seconds (positive = future)
 * @param {number} zoom - Current map zoom level
 * @returns {{dx: number, dy: number}} Pixel offset
 */
function computeRadarOffset(deltaSec, zoom) {
  if (deltaSec <= 0 || windData.speed === 0) return { dx: 0, dy: 0 };

  // Wind speed in km/h, time in hours
  const distKm = windData.speed * (deltaSec / 3600);

  // Pixels per km at current zoom: 256 * 2^zoom / 40075 (Earth circumference km)
  const pxPerKm = (256 * Math.pow(2, zoom)) / 40075;
  const distPx = distKm * pxPerKm;

  // Wind direction = where wind comes FROM (degrees clockwise from North)
  // Clouds move TO the opposite direction
  const moveDir = (windData.direction + 180) % 360;
  const rad = (moveDir * Math.PI) / 180;

  // dx = east, dy = south (screen y increases downward)
  const dx = distPx * Math.sin(rad);
  const dy = -distPx * Math.cos(rad);

  return { dx, dy };
}

/**
 * Update the radar layer on the map for the selected time.
 * For future timestamps beyond last radar frame, extrapolate by offsetting the last frame.
 * @param {number} idx - Current index in precipitation data
 */
function updateRadar(idx) {
  if (!map) return;
  if (precipData.length === 0) return;

  const date = new Date(precipData[idx].time);
  const ts = Math.floor(date.getTime() / 1000);
  const frame = findNearestRadarFrame(ts);

  if (!frame) {
    clearRadarLayer(map);
    lastRadarPath = null;
    setRadarOffset(map, 0, 0);
    return;
  }

  // Check if this is a future extrapolation
  const lastFrame = radarData.frames[radarData.frames.length - 1];
  const isFuture = ts > lastFrame.time;

  if (isFuture) {
    // Use last frame, apply offset
    if (lastFrame.path !== lastRadarPath) {
      lastRadarPath = lastFrame.path;
      setRadarLayer(map, radarData.host, lastFrame.path, { color: 2, size: 256, smooth: 1, snow: 1, opacity: 0.8 });
    }
    const deltaSec = ts - lastFrame.time;
    const { dx, dy } = computeRadarOffset(deltaSec, map.getZoom());
    setRadarOffset(map, dx, dy);
  } else {
    // Normal: show nearest frame, reset offset
    setRadarOffset(map, 0, 0);
    if (frame.path !== lastRadarPath) {
      lastRadarPath = frame.path;
      setRadarLayer(map, radarData.host, frame.path, { color: 2, size: 256, smooth: 1, snow: 1, opacity: 0.8 });
    }
  }
}

/**
 * Update the graph highlight for the selected time.
 * @param {number} idx - Current index in precipitation data
 */
function updateGraph(idx) {
  const canvas = document.getElementById('graph-canvas');
  if (precipData.length === 0) {
    renderGraph(canvas, [], 0);
    return;
  }
  renderGraph(canvas, precipData, idx);
}

/**
 * Load radar frames from RainViewer.
 */
async function loadRadar() {
  try {
    const data = await fetchRadarFrames();
    const now = Math.floor(Date.now() / 1000);
    const frames = selectFrames(data.past, data.future, now);

    if (frames.length === 0) {
      throw new Error('Aucune frame radar disponible');
    }

    radarData = { host: data.host, frames };
    showRadarUnavailable(map, false);
    return frames;
  } catch (e) {
    console.error('Radar load error:', e);
    if (map) {
      clearRadarLayer(map);
      showRadarUnavailable(map, true);
    }
    return null;
  }
}

/**
 * Load precipitation data from Open-Meteo.
 * @param {number} lat
 * @param {number} lon
 */
async function loadPrecipitation(lat, lon) {
  try {
    const result = await fetchPrecipitation(lat, lon);
    windData = result.wind;
    const now = new Date();
    precipData = extractWindow(result.data, now);

    if (precipData.length === 0) {
      document.getElementById('precip-info').textContent = 'Aucune donnée de prévision';
    } else {
      const hasRain = precipData.some(d => d.value > 0);
      if (!hasRain) {
        document.getElementById('precip-info').textContent = 'Aucune précipitation prévue dans les 12h';
      }
    }

    return precipData;
  } catch (e) {
    console.error('Precipitation load error:', e);
    precipData = [];
    document.getElementById('precip-info').textContent = 'Données indisponibles';
    return [];
  }
}

/**
 * Initialize the slider with precipitation data timeline.
 */
function setupSlider() {
  if (precipData.length === 0) return;

  // Convert precip data to slider frames (only need time)
  const sliderFrames = precipData.map(d => ({
    time: Math.floor(new Date(d.time).getTime() / 1000),
  }));

  // Set current position to "now" (nearest to current time)
  const nowMs = Date.now();
  let startIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < precipData.length; i++) {
    const diff = Math.abs(new Date(precipData[i].time).getTime() - nowMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      startIdx = i;
    }
  }

  sliderApi = initSlider({
    frames: sliderFrames,
    onTimeChange: (idx) => {
      currentIdx = idx;
      updateRadar(idx);
      updateGraph(idx);
      updateTimeInfo(idx);
    },
    onPlayStateChange: () => {},
  });

  sliderApi.setFrame(startIdx);
}

/**
 * Load all data for a location and update UI.
 * @param {number} lat
 * @param {number} lon
 */
async function loadLocation(lat, lon) {
  setMarker(map, lat, lon);
  centerMap(map, lat, lon, 9);

  // Show loading state
  document.getElementById('current-time').textContent = 'Chargement...';
  document.getElementById('precip-info').textContent = 'Chargement...';

  // Load radar and precipitation in parallel
  await Promise.all([
    loadRadar(),
    loadPrecipitation(lat, lon),
  ]);

  if (precipData.length > 0) {
    setupSlider();
  }

  // Render graph with initial data
  const canvas = document.getElementById('graph-canvas');
  renderGraph(canvas, precipData, currentIdx);
  renderTimeLabels(document.getElementById('time-labels'), precipData);
}

/**
 * Initialize the app.
 */
async function init() {
  // Get user location
  const location = await getUserLocationWithFallback();
  if (location.isFallback) {
    showToast(`${location.error} — recherchez un lieu`);
  }

  // Initialize map
  map = initMap(location.lat, location.lon);

  // Initialize search
  initSearch(async (lat, lon, name) => {
    await loadLocation(lat, lon);
  });

  // Geolocation button
  document.getElementById('geoloc-btn').addEventListener('click', async () => {
    const searchInput = document.getElementById('search-input');
    searchInput.value = '';
    document.getElementById('search-results').classList.remove('visible');
    document.getElementById('search-results').innerHTML = '';

    const loc = await getUserLocationWithFallback();
    if (loc.isFallback) {
      showToast(`${loc.error} — recherchez un lieu`);
    }

    // Reverse geocode to show place name
    if (!loc.isFallback) {
      const placeName = await reverseGeocode(loc.lat, loc.lon);
      if (placeName) searchInput.value = placeName;
    }

    await loadLocation(loc.lat, loc.lon);
  });

  // Now button — jump slider to current time
  document.getElementById('now-btn').addEventListener('click', () => {
    if (!sliderApi || precipData.length === 0) return;
    const nowMs = Date.now();
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < precipData.length; i++) {
      const diff = Math.abs(new Date(precipData[i].time).getTime() - nowMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    sliderApi.setFrame(bestIdx);
  });

  // Load initial location data
  await loadLocation(location.lat, location.lon);

  // Recompute radar offset on zoom change (pixel-per-km changes)
  map.on('zoomend', () => {
    updateRadar(currentIdx);
  });

  // Handle window resize for graph
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const canvas = document.getElementById('graph-canvas');
      if (precipData.length > 0) {
        renderGraph(canvas, precipData, currentIdx);
      }
    }, 200);
  });
}

// Start app
init().catch(e => {
  console.error('Init error:', e);
  showToast("Erreur d'initialisation");
});
