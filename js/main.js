/**
 * Main orchestrator — initializes all modules and wires data flow.
 */
import { fetchRadarFrames, selectFrames } from './api/rainviewer.js';
import { fetchPrecipitation, extractWindow } from './api/openmeteo.js';
import { initMap, setRadarLayer, setMarker, centerMap, clearRadarLayer, showRadarUnavailable } from './map.js';
import { renderGraph, renderTimeLabels, findNearestIndex } from './graph.js';
import { initSlider } from './slider.js';
import { getUserLocationWithFallback } from './geolocation.js';
import { initSearch } from './search.js';

// State
let map = null;
let radarData = null; // { host, frames: number[] }
let precipData = []; // [{ time, value }]
let sliderApi = null;
let currentFrameIdx = 0;

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
 * Update the time info display.
 * @param {number} frameIndex - Current frame index in radar frames
 */
function updateTimeInfo(frameIndex) {
  const timeEl = document.getElementById('current-time');
  const precipEl = document.getElementById('precip-info');

  if (radarData && radarData.frames.length > 0) {
    const ts = radarData.frames[frameIndex];
    const date = new Date(ts * 1000);
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${h}:${m}`;

    // Find precipitation at this time
    if (precipData.length > 0) {
      const precipIdx = findNearestIndex(precipData, date);
      const value = precipData[precipIdx]?.value ?? 0;
      if (value <= 0) {
        precipEl.textContent = 'Aucune précipitation';
      } else if (value < 0.5) {
        precipEl.textContent = `Très faible pluie · ${value.toFixed(1)} mm/h`;
      } else if (value < 2) {
        precipEl.textContent = `Faible pluie · ${value.toFixed(1)} mm/h`;
      } else if (value < 10) {
        precipEl.textContent = `Pluie modérée · ${value.toFixed(1)} mm/h`;
      } else if (value < 20) {
        precipEl.textContent = `Forte pluie · ${value.toFixed(1)} mm/h`;
      } else {
        precipEl.textContent = `Très forte pluie · ${value.toFixed(1)} mm/h`;
      }
    } else {
      precipEl.textContent = 'Données indisponibles';
    }
  }
}

/**
 * Update the radar layer on the map for the selected frame.
 * @param {number} frameIndex
 */
function updateRadar(frameIndex) {
  if (!radarData || !map) return;
  const ts = radarData.frames[frameIndex];
  setRadarLayer(map, radarData.host, ts, { color: 2, size: 256, smooth: 1, snow: 1, opacity: 0.8 });
}

/**
 * Update the graph highlight for the selected frame.
 * @param {number} frameIndex
 */
function updateGraph(frameIndex) {
  const canvas = document.getElementById('graph-canvas');
  if (!radarData || precipData.length === 0) {
    renderGraph(canvas, [], 0);
    return;
  }

  // Find nearest precipitation data index for this radar frame
  const ts = radarData.frames[frameIndex];
  const date = new Date(ts * 1000);
  const precipIdx = findNearestIndex(precipData, date);

  renderGraph(canvas, precipData, precipIdx);
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
    const data = await fetchPrecipitation(lat, lon);
    const now = new Date();
    precipData = extractWindow(data, now);

    if (precipData.length === 0) {
      document.getElementById('precip-info').textContent = 'Aucune précipitation prévue dans les 3h';
    } else {
      const hasRain = precipData.some(d => d.value > 0);
      if (!hasRain) {
        document.getElementById('precip-info').textContent = 'Aucune précipitation prévue dans les 3h';
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
 * Initialize the slider with radar frames.
 */
function setupSlider() {
  if (!radarData || radarData.frames.length === 0) return;

  // Set current position to "now" (nearest frame)
  const now = Math.floor(Date.now() / 1000);
  let startIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < radarData.frames.length; i++) {
    const diff = Math.abs(radarData.frames[i] - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      startIdx = i;
    }
  }

  sliderApi = initSlider({
    frames: radarData.frames,
    onTimeChange: (idx) => {
      currentFrameIdx = idx;
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
  const [frames] = await Promise.all([
    loadRadar(),
    loadPrecipitation(lat, lon),
  ]);

  if (frames) {
    setupSlider();
  }

  // Render graph with initial data
  const canvas = document.getElementById('graph-canvas');
  renderGraph(canvas, precipData, 0);
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
    const loc = await getUserLocationWithFallback();
    if (loc.isFallback) {
      showToast(`${loc.error} — recherchez un lieu`);
    }
    await loadLocation(loc.lat, loc.lon);
  });

  // Load initial location data
  await loadLocation(location.lat, location.lon);

  // Handle window resize for graph
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const canvas = document.getElementById('graph-canvas');
      if (precipData.length > 0 && radarData) {
        const ts = radarData.frames[currentFrameIdx];
        const date = new Date(ts * 1000);
        const precipIdx = findNearestIndex(precipData, date);
        renderGraph(canvas, precipData, precipIdx);
      }
    }, 200);
  });
}

// Start app
init().catch(e => {
  console.error('Init error:', e);
  showToast('Erreur d'initialisation');
});
