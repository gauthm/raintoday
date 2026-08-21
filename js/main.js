/**
 * Main orchestrator — initializes all modules and wires data flow.
 */
import { fetchRadarFrames, selectFrames } from './api/rainviewer.js';
import { fetchPrecipitation, extractWindow, reverseGeocode } from './api/openmeteo.js';
import { initMap, setRadarLayer, setRadarOpacity, setRadarOffset, setMarker, centerMap, clearRadarLayer, showRadarUnavailable, recheckRadarCoverage } from './map.js';
import { renderGraph, findNearestIndex } from './graph.js';
import { initSlider } from './slider.js';
import { getUserLocationWithFallback } from './geolocation.js';
import { initSearch } from './search.js';
import { t } from './i18n.js';
import { sampleRadarAtLocation } from './radar-sampler.js';

// State
let map = null;
let radarData = null; // { host, frames: [{time, path}] }
let precipData = []; // [{ time, value }]
let windData = { speed: 0, direction: 0 };
let userLat = 48.85;
let userLon = 2.35;
let currentDeltaSec = 0;
let sliderApi = null;
let currentIdx = 0;
let lastRadarFrameTime = null;
const EXTRAPOLATION_MAX_SEC = 90 * 60; // timestamp of the last available radar frame

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

function renderPrecipText(el, value, prob, date) {
  const isFuture = date.getTime() > Date.now();
  const probSuffix = isFuture && prob > 0 ? t.probSuffix(prob) : '';

  if (value <= 0)        el.textContent = prob > 0 ? t.noRainRisk(prob) : t.noRain;
  else if (value < 0.5)  el.textContent = t.veryLightRain(value) + probSuffix;
  else if (value < 2)    el.textContent = t.lightRain(value) + probSuffix;
  else if (value < 10)   el.textContent = t.moderateRain(value) + probSuffix;
  else if (value < 20)   el.textContent = t.heavyRain(value) + probSuffix;
  else                   el.textContent = t.veryHeavyRain(value) + probSuffix;
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
    precipEl.textContent = t.noData;
    return;
  }

  const entry = precipData[idx];
  const date = new Date(entry.time);
  timeEl.textContent = formatLocalDate(date);

  renderPrecipText(precipEl, entry.value, entry.probability, date);

  if (!radarData) return;

  const ts = Math.floor(date.getTime() / 1000);
  const lastFrame = radarData.frames[radarData.frames.length - 1];
  const isFuture = ts > lastFrame.time;

  let sampleLat = userLat;
  let sampleLon = userLon;
  let frameToSample;

  if (isFuture) {
    const deltaSec = ts - lastFrame.time;
    const { dLat, dLon } = computeLatLngOffset(deltaSec);
    sampleLat = userLat - dLat;
    sampleLon = userLon - dLon;
    frameToSample = lastFrame;
  } else {
    frameToSample = findNearestRadarFrame(ts);
  }

  if (!frameToSample) return;

  sampleRadarAtLocation(radarData.host, frameToSample.path, sampleLat, sampleLon)
    .then(mmh => {
      if (mmh !== null && idx === currentIdx) {
        renderPrecipText(precipEl, mmh, entry.probability, date);
      }
    });
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
  const latRad = (userLat * Math.PI) / 180;
  const pxPerKm = (256 * Math.pow(2, zoom)) / (40075 * Math.cos(latRad));
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
 * Compute geographic displacement (dLat, dLon) of precipitation for a given time delta.
 * Used to back-project sample position on radar for future frames.
 * @param {number} deltaSec - Seconds into the future
 * @returns {{dLat: number, dLon: number}}
 */
function computeLatLngOffset(deltaSec) {
  if (deltaSec <= 0 || windData.speed === 0) return { dLat: 0, dLon: 0 };
  const distKm = windData.speed * (deltaSec / 3600);
  const moveDir = (windData.direction + 180) % 360;
  const rad = (moveDir * Math.PI) / 180;
  const dLat = (distKm * Math.cos(rad)) / 111;
  const dLon = (distKm * Math.sin(rad)) / (111 * Math.cos(userLat * Math.PI / 180));
  return { dLat, dLon };
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
    hideForecastBadge();
    return;
  }

  const lastFrame = radarData.frames[radarData.frames.length - 1];
  const isFuture = ts > lastFrame.time;

  if (isFuture) {
    const deltaSec = ts - lastFrame.time;
    currentDeltaSec = deltaSec;

    if (lastFrame.path !== lastRadarPath) {
      lastRadarPath = lastFrame.path;
      setRadarLayer(map, radarData.host, lastFrame.path, { color: 2, size: 256, smooth: 1, snow: 1, opacity: 0.8 });
    }

    const { dx, dy } = computeRadarOffset(deltaSec, map.getZoom());
    setRadarOffset(map, dx, dy);

    const minutesAhead = Math.round((ts - (Date.now() / 1000)) / 60);
    showForecastBadge(map, minutesAhead);
  } else {
    currentDeltaSec = 0;
    setRadarOffset(map, 0, 0);
    hideForecastBadge();
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

let forecastBadge = null;

function showForecastBadge(map, minutesAhead) {
  const label = `${t.estimatedForecast} +${minutesAhead} min`;
  if (forecastBadge) {
    const el = forecastBadge.getContainer();
    if (el) el.textContent = label;
    return;
  }
  forecastBadge = L.control({ position: 'bottomleft' });
  forecastBadge.onAdd = function () {
    const div = L.DomUtil.create('div', 'forecast-badge');
    div.style.cssText = 'background:rgba(20,20,40,0.85);backdrop-filter:blur(8px);border:1px solid rgba(100,160,255,0.4);border-radius:8px;padding:5px 10px;font-size:12px;color:#aac8ff;margin-bottom:30px;margin-left:10px;';
    div.textContent = label;
    return div;
  };
  forecastBadge.addTo(map);
}

function hideForecastBadge() {
  if (forecastBadge) {
    forecastBadge.remove();
    forecastBadge = null;
  }
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
      document.getElementById('precip-info').textContent = t.noForecastData;
    } else {
      const hasRain = precipData.some(d => d.value > 0);
      if (!hasRain) {
        document.getElementById('precip-info').textContent = t.noRain12h;
      }
    }

    return precipData;
  } catch (e) {
    console.error('Precipitation load error:', e);
    precipData = [];
    document.getElementById('precip-info').textContent = t.noData;
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
  userLat = lat;
  userLon = lon;
  setMarker(map, lat, lon);
  centerMap(map, lat, lon, 9);

  // Show loading state
  document.getElementById('current-time').textContent = t.loading;
  document.getElementById('precip-info').textContent = t.loading;

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
}

/**
 * Set static UI labels from i18n.
 */
function initStaticLabels() {
  document.getElementById('search-input').placeholder = t.searchPlaceholder;
  document.getElementById('search-input').setAttribute('aria-label', t.searchAria);
  document.getElementById('geoloc-btn').title = t.geolocTitle;
  document.getElementById('geoloc-btn').setAttribute('aria-label', t.geolocTitle);
  document.getElementById('now-btn').textContent = t.nowBtn;
  document.getElementById('now-btn').title = t.nowBtnTitle;
  document.getElementById('play-btn').textContent = t.play;
}

/**
 * Initialize the app.
 */
async function init() {
  // Get user location
  const location = await getUserLocationWithFallback();
    if (location.isFallback) {
      showToast(t.searchPlaceHint(location.error));
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
      showToast(t.searchPlaceHint(loc.error));
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

  // Recompute radar offset on zoom change + recheck coverage
  map.on('zoomend', () => {
    updateRadar(currentIdx);
    recheckRadarCoverage(map);
  });

  map.on('zoomanim', (e) => {
    if (currentDeltaSec <= 0) return;
    const { dx, dy } = computeRadarOffset(currentDeltaSec, e.zoom);
    setRadarOffset(map, dx, dy, true);
  });

  // Recheck coverage when user pans
  map.on('moveend', () => {
    recheckRadarCoverage(map);
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
initStaticLabels();
init().catch(e => {
  console.error('Init error:', e);
  showToast(t.initError);
});
