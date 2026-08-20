# RainToday Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vanilla JS web app showing animated rain radar on a full-screen Leaflet map with a precipitation bar chart and unified time slider, using RainViewer + Open-Meteo APIs (no API keys, no backend, no build step).

**Architecture:** ES Modules natifs (browser imports, no bundler). Each module has one responsibility. `main.js` orchestrates. Communication via direct function calls and `EventTarget` custom events. Test harness in `test.html` using a minimal browser-based assertion runner.

**Tech Stack:** HTML/CSS/JS vanilla, Leaflet 1.9.4 (CDN), RainViewer API, Open-Meteo API, Canvas API for graph

---

## File Structure

| File | Responsibility |
|------|---------------|
| `index.html` | DOM structure, CDN imports, entry point |
| `css/style.css` | Dark theme, responsive layout, overlays |
| `js/api/rainviewer.js` | Fetch radar frame timestamps, build tile URLs |
| `js/api/openmeteo.js` | Fetch precipitation mm/h, geocoding search |
| `js/map.js` | Leaflet init, radar tile layer management, marker |
| `js/graph.js` | Canvas bar chart rendering for precipitation |
| `js/slider.js` | Unified time slider with play/pause animation |
| `js/geolocation.js` | navigator.geolocation wrapper with fallback |
| `js/search.js` | Place search with autocomplete dropdown |
| `js/main.js` | Orchestrator — init all modules, wire data flow |
| `test.html` | Browser-based test runner for module assertions |

---

### Task 1: Project Scaffold + Test Harness

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `test.html`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p css js/api assets
```

- [ ] **Step 2: Create index.html with DOM structure and CDN imports**

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RainToday — Radar Pluie</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <!-- Map container -->
  <div id="map"></div>

  <!-- Top overlay: search -->
  <div id="search-container">
    <input type="text" id="search-input" placeholder="Rechercher un lieu..." autocomplete="off" />
    <div id="search-results"></div>
  </div>

  <!-- Top right: geolocation button -->
  <button id="geoloc-btn" title="Ma position">📍</button>

  <!-- Left overlay: color legend -->
  <div id="legend">
    <div class="legend-title">mm/h</div>
    <div class="legend-bar">
      <div style="background:#1a3a5a" title="0"></div>
      <div style="background:#2a7aba" title="0.5"></div>
      <div style="background:#2a9ada" title="2"></div>
      <div style="background:#3abada" title="5"></div>
      <div style="background:#6affda" title="10"></div>
      <div style="background:#ffea00" title="20"></div>
      <div style="background:#ff8800" title="40"></div>
      <div style="background:#ff3333" title="60+"></div>
    </div>
  </div>

  <!-- Toast notifications -->
  <div id="toast"></div>

  <!-- Bottom panel: graph + slider + controls -->
  <div id="bottom-panel">
    <div id="time-info">
      <div id="current-time">--:--</div>
      <div id="precip-info">Chargement...</div>
      <button id="play-btn">▶ Play</button>
    </div>
    <canvas id="graph-canvas"></canvas>
    <div id="time-labels"></div>
    <div id="slider-container">
      <div id="slider-track">
        <div id="slider-fill"></div>
        <div id="slider-handle"></div>
      </div>
    </div>
  </div>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create css/style.css with dark theme and layout**

Create `css/style.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg: #0a0a14;
  --overlay-bg: rgba(15, 15, 30, 0.9);
  --border: rgba(255, 255, 255, 0.1);
  --accent: #0066ff;
  --accent-light: #4acaea;
  --text: #ffffff;
  --text-dim: #888888;
  --font: system-ui, -apple-system, sans-serif;
}

html, body {
  height: 100%;
  overflow: hidden;
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
}

/* Map */
#map {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.leaflet-container {
  background: #0d1117;
}

/* Search overlay */
#search-container {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: 280px;
  max-width: 90vw;
}

#search-input {
  width: 100%;
  background: var(--overlay-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 10px 16px;
  color: var(--text);
  font-size: 14px;
  font-family: var(--font);
  outline: none;
}

#search-input::placeholder {
  color: var(--text-dim);
}

#search-input:focus {
  border-color: var(--accent);
}

#search-results {
  display: none;
  background: var(--overlay-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-top: 4px;
  overflow: hidden;
}

#search-results.visible {
  display: block;
}

.search-result-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: rgba(0, 102, 255, 0.2);
}

/* Geolocation button */
#geoloc-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1000;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--overlay-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

#geoloc-btn:hover {
  background: rgba(0, 102, 255, 0.3);
}

/* Legend */
#legend {
  position: absolute;
  top: 60px;
  left: 12px;
  z-index: 1000;
  background: var(--overlay-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
}

.legend-title {
  font-size: 9px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.legend-bar {
  display: flex;
  gap: 1px;
  border-radius: 3px;
  overflow: hidden;
}

.legend-bar div {
  width: 16px;
  height: 10px;
}

/* Toast */
#toast {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  background: var(--overlay-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 13px;
  color: var(--text);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}

#toast.visible {
  opacity: 1;
}

/* Bottom panel */
#bottom-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(10, 10, 20, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--border);
  padding: 14px 16px 12px;
}

#time-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

#current-time {
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
}

#precip-info {
  color: var(--text-dim);
  font-size: 12px;
  margin-left: 8px;
  flex: 1;
}

#play-btn {
  background: rgba(0, 102, 255, 0.2);
  border: 1px solid rgba(0, 102, 255, 0.4);
  border-radius: 6px;
  padding: 4px 12px;
  color: #4a9aff;
  font-size: 12px;
  font-family: var(--font);
  cursor: pointer;
}

#play-btn:hover {
  background: rgba(0, 102, 255, 0.35);
}

#graph-canvas {
  width: 100%;
  height: 50px;
  display: block;
}

#time-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-dim);
  margin-bottom: 10px;
}

/* Slider */
#slider-container {
  padding: 0 4px;
}

#slider-track {
  position: relative;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  cursor: pointer;
}

#slider-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #1a3a5a, #2a9ada, #3abada);
  border-radius: 3px;
  pointer-events: none;
}

#slider-handle {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  border: 2px solid var(--accent);
  cursor: grab;
  pointer-events: none;
}

#slider-handle.dragging {
  cursor: grabbing;
}

/* Leaflet marker override */
.rain-marker {
  background: var(--accent);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid #fff;
  box-shadow: 0 0 12px rgba(0, 102, 255, 0.8);
}

/* Responsive */
@media (max-width: 600px) {
  #search-container {
    width: 200px;
  }

  #legend {
    display: none;
  }

  #bottom-panel {
    padding: 10px 12px 8px;
  }
}
```

- [ ] **Step 4: Create test.html with minimal browser test runner**

Create `test.html`:

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RainToday — Tests</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0a14; color: #fff; padding: 20px; }
    h1 { margin-bottom: 20px; }
    #results { font-size: 14px; line-height: 2; }
    .pass { color: #4ade80; }
    .fail { color: #f87171; }
    .summary { margin-top: 20px; font-size: 16px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>RainToday — Test Runner</h1>
  <div id="results"></div>
  <div id="summary" class="summary"></div>
  <script type="module" src="js/test-runner.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create js/test-runner.js with assertion utilities and test registration**

Create `js/test-runner.js`:

```js
// Minimal browser-based test runner for vanilla JS ES modules

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

export function assertEq(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

export function assertApprox(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(message || `Expected ~${expected}, got ${actual} (tolerance ${tolerance})`);
  }
}

export function assertArrayLen(arr, len, message) {
  if (!Array.isArray(arr) || arr.length !== len) {
    throw new Error(message || `Expected array of length ${len}, got ${arr ? arr.length : 'not array'}`);
  }
}

async function runTests() {
  const resultsEl = document.getElementById('results');
  const summaryEl = document.getElementById('summary');
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      resultsEl.innerHTML += `<div class="pass">✓ ${t.name}</div>`;
      passed++;
    } catch (e) {
      resultsEl.innerHTML += `<div class="fail">✗ ${t.name}: ${e.message}</div>`;
      failed++;
    }
  }

  summaryEl.textContent = `${passed} passed, ${failed} failed, ${tests.length} total`;
  summaryEl.style.color = failed === 0 ? '#4ade80' : '#f87171';
}

// Auto-run on load
window.addEventListener('DOMContentLoaded', () => {
  runTests();
});
```

- [ ] **Step 6: Start a local HTTP server and verify pages load**

Run:
```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/index.html` — should see dark page with map container, search bar, geoloc button, legend, bottom panel.
Open `http://localhost:8000/test.html` — should see "0 passed, 0 failed, 0 total".

- [ ] **Step 7: Init git and commit scaffold**

```bash
git init
echo ".superpowers/" > .gitignore
git add .
git commit -m "feat: project scaffold with HTML structure, dark theme CSS, and test runner"
```

---

### Task 2: RainViewer API Module

**Files:**
- Create: `js/api/rainviewer.js`
- Create: `js/test-rainviewer.js`
- Modify: `js/test-runner.js` (add import at top)

- [ ] **Step 1: Write test file for rainviewer module**

Create `js/test-rainviewer.js`:

```js
import { test, assert, assertArrayLen } from './test-runner.js';
import { fetchRadarFrames, buildTileUrl, selectFrames } from './api/rainviewer.js';

test('buildTileUrl produces correct URL format', () => {
  const url = buildTileUrl('https://tilecache.rainviewer.com', 1700000000, 10, 5, 3, { color: 2, size: 256 });
  assert(
    url === 'https://tilecache.rainviewer.com/v2/radar/1700000000/256/10/5/3/2/0_0.png',
    `Unexpected URL: ${url}`
  );
});

test('buildTileUrl with smooth option', () => {
  const url = buildTileUrl('https://tilecache.rainviewer.com', 1700000000, 10, 5, 3, { color: 2, size: 256, smooth: 1, snow: 1 });
  assert(
    url === 'https://tilecache.rainviewer.com/v2/radar/1700000000/256/10/5/3/2/1_1.png',
    `Unexpected URL: ${url}`
  );
});

test('selectFrames returns frames within 2h past + 30min future', () => {
  const now = Math.floor(Date.now() / 1000);
  const past = [
    now - 7200,  // 2h ago — should be included (boundary)
    now - 5400,  // 1.5h ago
    now - 3600,  // 1h ago
    now - 1800,  // 30min ago
    now - 600,   // 10min ago
  ];
  const future = [
    now + 600,   // +10min
    now + 1800,  // +30min — should be included (boundary)
  ];

  const frames = selectFrames(past, future, now);
  // All should be within range: 2h past to +30min future
  for (const ts of frames) {
    assert(ts >= now - 7200 && ts <= now + 1800, `Timestamp ${ts} out of range`);
  }
  assertArrayLen(frames, 7, `Expected 7 frames, got ${frames.length}`);
});

test('selectFrames filters out-of-range timestamps', () => {
  const now = Math.floor(Date.now() / 1000);
  const past = [
    now - 10800, // 3h ago — should be excluded
    now - 3600,  // 1h ago — included
  ];
  const future = [
    now + 600,   // +10min — included
    now + 3600,  // +1h — excluded
  ];

  const frames = selectFrames(past, future, now);
  assertArrayLen(frames, 2, `Expected 2 frames, got ${frames.length}`);
});

test('selectFrames returns empty for empty inputs', () => {
  const frames = selectFrames([], [], Math.floor(Date.now() / 1000));
  assertArrayLen(frames, 0);
});

test('selectFrames returns sorted array', () => {
  const now = Math.floor(Date.now() / 1000);
  const past = [now - 600, now - 3600, now - 1800];
  const future = [now + 1200, now + 600];

  const frames = selectFrames(past, future, now);
  for (let i = 1; i < frames.length; i++) {
    assert(frames[i] >= frames[i - 1], `Not sorted at index ${i}: ${frames[i]} < ${frames[i-1]}`);
  }
});
```

- [ ] **Step 2: Add test import to test-runner.js**

Add at the top of `js/test-runner.js`, before the auto-run listener:

```js
// Import test files (they register via test())
import './test-rainviewer.js';
```

- [ ] **Step 3: Run tests to verify they fail**

Open `http://localhost:8000/test.html`
Expected: All rainviewer tests FAIL with "Failed to resolve module specifier" or similar (module doesn't exist yet)

- [ ] **Step 4: Implement rainviewer.js**

Create `js/api/rainviewer.js`:

```js
/**
 * RainViewer API module
 * Fetches radar frame timestamps and builds tile URLs.
 */

const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';

/**
 * Fetch available radar frames from RainViewer.
 * @returns {Promise<{host: string, past: number[], future: number[]}>}
 */
export async function fetchRadarFrames() {
  const res = await fetch(RAINVIEWER_API);
  if (!res.ok) {
    throw new Error(`RainViewer API error: ${res.status}`);
  }
  const data = await res.json();
  const host = data.host;
  const past = (data.radar && data.radar.past) ? data.radar.past.map(f => f.time) : [];
  const future = (data.radar && data.radar.nforecast) ? data.radar.nforecast.map(f => f.time) : [];
  return { host, past, future };
}

/**
 * Build a RainViewer radar tile URL.
 * @param {string} host - RainViewer tile host
 * @param {number} timestamp - Unix timestamp (seconds)
 * @param {number} z - Zoom level
 * @param {number} x - Tile X
 * @param {number} y - Tile Y
 * @param {object} options - { color: number, size: number, smooth: number, snow: number }
 * @returns {string} Full tile URL
 */
export function buildTileUrl(host, timestamp, z, x, y, options = {}) {
  const color = options.color ?? 2;
  const size = options.size ?? 256;
  const smooth = options.smooth ?? 0;
  const snow = options.snow ?? 0;
  return `${host}/v2/radar/${timestamp}/${size}/${z}/${x}/${y}/${color}/${smooth}_${snow}.png`;
}

/**
 * Select frames within 2h past + 30min future window.
 * Returns sorted array of timestamps.
 * @param {number[]} past - Past timestamps (seconds)
 * @param {number[]} future - Future timestamps (seconds)
 * @param {number} now - Current Unix timestamp (seconds)
 * @returns {number[]} Sorted timestamps within range
 */
export function selectFrames(past, future, now) {
  const minTime = now - 7200;  // 2h ago
  const maxTime = now + 1800;  // 30min future

  const all = [...past, ...future]
    .filter(ts => ts >= minTime && ts <= maxTime)
    .sort((a, b) => a - b);

  return all;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Open `http://localhost:8000/test.html`
Expected: All 6 rainviewer tests PASS

- [ ] **Step 6: Commit**

```bash
git add js/api/rainviewer.js js/test-rainviewer.js js/test-runner.js
git commit -m "feat: RainViewer API module with frame selection and tile URL builder"
```

---

### Task 3: Open-Meteo API Module

**Files:**
- Create: `js/api/openmeteo.js`
- Create: `js/test-openmeteo.js`
- Modify: `js/test-runner.js` (add import)

- [ ] **Step 1: Write test file for openmeteo module**

Create `js/test-openmeteo.js`:

```js
import { test, assert, assertEq, assertArrayLen, assertApprox } from './test-runner.js';
import { buildPrecipitationUrl, buildGeocodingUrl, parsePrecipitation, extractWindow, colorForPrecipitation } from './api/openmeteo.js';

test('buildPrecipitationUrl produces correct URL', () => {
  const url = buildPrecipitationUrl(48.85, 2.35);
  assert(url.includes('latitude=48.85'), `Missing latitude: ${url}`);
  assert(url.includes('longitude=2.35'), `Missing longitude: ${url}`);
  assert(url.includes('minutely_15=precipitation'), `Missing minutely_15: ${url}`);
});

test('buildGeocodingUrl produces correct URL', () => {
  const url = buildGeocodingUrl('Paris', 5);
  assert(url.includes('name=Paris'), `Missing name: ${url}`);
  assert(url.includes('count=5'), `Missing count: ${url}`);
  assert(url.includes('language=fr'), `Missing language: ${url}`);
});

test('parsePrecipitation returns array of {time, value} objects', () => {
  const mockResponse = {
    minutely_15: {
      time: ['2026-08-20T14:00', '2026-08-20T14:15', '2026-08-20T14:30'],
      precipitation: [0.0, 0.5, 1.2]
    }
  };
  const result = parsePrecipitation(mockResponse);
  assertArrayLen(result, 3);
  assertEq(result[0].time, '2026-08-20T14:00');
  assertEq(result[0].value, 0.0);
  assertEq(result[1].value, 0.5);
  assertEq(result[2].value, 1.2);
});

test('parsePrecipitation returns empty array for missing data', () => {
  const result = parsePrecipitation({});
  assertArrayLen(result, 0);
});

test('extractWindow returns entries within 2h past + 30min future', () => {
  const now = new Date('2026-08-20T15:00');
  const data = [
    { time: '2026-08-20T12:30', value: 0.0 }, // 2.5h ago — excluded
    { time: '2026-08-20T13:00', value: 0.1 }, // 2h ago — included (boundary)
    { time: '2026-08-20T14:00', value: 0.5 }, // 1h ago — included
    { time: '2026-08-20T15:00', value: 1.2 }, // now — included
    { time: '2026-08-20T15:30', value: 0.8 }, // +30min — included (boundary)
    { time: '2026-08-20T16:00', value: 0.0 }, // +1h — excluded
  ];
  const window = extractWindow(data, now);
  assertArrayLen(window, 4, `Expected 4 entries, got ${window.length}`);
});

test('extractWindow returns empty for empty input', () => {
  const now = new Date('2026-08-20T15:00');
  const window = extractWindow([], now);
  assertArrayLen(window, 0);
});

test('colorForPrecipitation returns dark for 0 mm/h', () => {
  const color = colorForPrecipitation(0);
  assertEq(color, '#1a3a5a');
});

test('colorForPrecipitation returns red for heavy rain', () => {
  const color = colorForPrecipitation(50);
  assertEq(color, '#ff3333');
});

test('colorForPrecipitation returns blue for light rain', () => {
  const color = colorForPrecipitation(1.5);
  assert(color === '#2a9ada', `Unexpected color for 1.5 mm/h: ${color}`);
});

test('colorForPrecipitation returns yellow for moderate rain', () => {
  const color = colorForPrecipitation(15);
  assertEq(color, '#ffea00');
});
```

- [ ] **Step 2: Add test import to test-runner.js**

Add after the rainviewer import:

```js
import './test-openmeteo.js';
```

- [ ] **Step 3: Run tests to verify they fail**

Open `http://localhost:8000/test.html`
Expected: Open-Meteo tests FAIL (module doesn't exist)

- [ ] **Step 4: Implement openmeteo.js**

Create `js/api/openmeteo.js`:

```js
/**
 * Open-Meteo API module
 * Fetches precipitation data and geocoding search results.
 */

const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';

/**
 * Build the Open-Meteo forecast API URL for precipitation.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} Full API URL
 */
export function buildPrecipitationUrl(lat, lon) {
  return `${OPEN_METEO_FORECAST}?latitude=${lat}&longitude=${lon}&minutely_15=precipitation&past_days=1&forecast_days=1&timezone=auto`;
}

/**
 * Build the Open-Meteo geocoding API URL.
 * @param {string} query - Search query
 * @param {number} count - Max results
 * @returns {string} Full API URL
 */
export function buildGeocodingUrl(query, count = 5) {
  return `${OPEN_METEO_GEOCODING}?name=${encodeURIComponent(query)}&count=${count}&language=fr&format=json`;
}

/**
 * Fetch precipitation data from Open-Meteo.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Array<{time: string, value: number}>>}
 */
export async function fetchPrecipitation(lat, lon) {
  const url = buildPrecipitationUrl(lat, lon);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status}`);
  }
  const data = await res.json();
  return parsePrecipitation(data);
}

/**
 * Search for places using Open-Meteo geocoding.
 * @param {string} query - Search query
 * @returns {Promise<Array<{name: string, lat: number, lon: number, country: string}>>}
 */
export async function searchPlaces(query) {
  const url = buildGeocodingUrl(query);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding API error: ${res.status}`);
  }
  const data = await res.json();
  if (!data.results) return [];
  return data.results.map(r => ({
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    country: r.country || '',
    admin1: r.admin1 || '',
  }));
}

/**
 * Parse Open-Meteo response into {time, value} array.
 * @param {object} data - Raw API response
 * @returns {Array<{time: string, value: number}>}
 */
export function parsePrecipitation(data) {
  if (!data.minutely_15) return [];
  const { time, precipitation } = data.minutely_15;
  if (!time || !precipitation) return [];
  return time.map((t, i) => ({ time: t, value: precipitation[i] }));
}

/**
 * Extract a 2.5h window (2h past + 30min future) from precipitation data.
 * @param {Array<{time: string, value: number}>} data - Full precipitation data
 * @param {Date} now - Reference time
 * @returns {Array<{time: string, value: number}>}
 */
export function extractWindow(data, now) {
  const nowMs = now.getTime();
  const minMs = nowMs - 2 * 3600 * 1000;  // 2h ago
  const maxMs = nowMs + 30 * 60 * 1000;   // 30min future

  return data.filter(entry => {
    const entryMs = new Date(entry.time).getTime();
    return entryMs >= minMs && entryMs <= maxMs;
  });
}

/**
 * Map precipitation value (mm/h) to a color matching the radar legend.
 * @param {number} mmh - Precipitation in mm/h
 * @returns {string} Hex color
 */
export function colorForPrecipitation(mmh) {
  if (mmh <= 0) return '#1a3a5a';
  if (mmh < 0.5) return '#2a7aba';
  if (mmh < 2) return '#2a9ada';
  if (mmh < 5) return '#3abada';
  if (mmh < 10) return '#6affda';
  if (mmh < 20) return '#ffea00';
  if (mmh < 40) return '#ff8800';
  return '#ff3333';
}
```

- [ ] **Step 5: Run tests to verify they pass**

Open `http://localhost:8000/test.html`
Expected: All openmeteo tests PASS

- [ ] **Step 6: Commit**

```bash
git add js/api/openmeteo.js js/test-openmeteo.js js/test-runner.js
git commit -m "feat: Open-Meteo API module with precipitation parsing, window extraction, and color mapping"
```

---

### Task 4: Map Module

**Files:**
- Create: `js/map.js`

- [ ] **Step 1: Implement map.js**

Create `js/map.js`:

```js
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
```

- [ ] **Step 2: Verify map loads in browser**

Open `http://localhost:8000/index.html` — map should display (dark CartoDB tiles). Note: map won't function fully yet since main.js isn't wired, but the map container should render.

If JS console shows errors about `main.js` not found, that's expected — we haven't created it yet.

- [ ] **Step 3: Commit**

```bash
git add js/map.js
git commit -m "feat: Leaflet map module with radar tile layer, marker, and centering"
```

---

### Task 5: Graph Module

**Files:**
- Create: `js/graph.js`
- Create: `js/test-graph.js`
- Modify: `js/test-runner.js` (add import)

- [ ] **Step 1: Write test file for graph module**

Create `js/test-graph.js`:

```js
import { test, assert, assertEq, assertApprox } from './test-runner.js';
import { mapValueToHeight, findNearestIndex, formatTimeLabel } from './graph.js';

test('mapValueToHeight returns 0 for 0 mm/h', () => {
  const h = mapValueToHeight(0, 100);
  assertApprox(h, 2, 1); // minimum height
});

test('mapValueToHeight scales proportionally', () => {
  const h0 = mapValueToHeight(5, 100);
  const h1 = mapValueToHeight(10, 100);
  assert(h1 > h0, '10mm/h should be taller than 5mm/h');
  assertApprox(h1, h0 * 2, 5); // roughly double
});

test('mapValueToHeight caps at max height', () => {
  const h = mapValueToHeight(100, 50);
  assert(h <= 50, `Height ${h} should not exceed max 50`);
});

test('mapValueToHeight uses logarithmic scale', () => {
  // Log scale: 0.5 and 20 should both map to reasonable portions of height
  const hLow = mapValueToHeight(0.5, 100);
  const hHigh = mapValueToHeight(20, 100);
  assert(hLow > 2, '0.5 mm/h should be visible');
  assert(hHigh < 100, '20 mm/h should not max out');
  assert(hHigh > hLow, '20 > 0.5');
});

test('findNearestIndex finds exact match', () => {
  const data = [
    { time: '2026-08-20T14:00', value: 0 },
    { time: '2026-08-20T14:15', value: 0.5 },
    { time: '2026-08-20T14:30', value: 1.0 },
  ];
  const idx = findNearestIndex(data, new Date('2026-08-20T14:15'));
  assertEq(idx, 1);
});

test('findNearestIndex finds nearest when no exact match', () => {
  const data = [
    { time: '2026-08-20T14:00', value: 0 },
    { time: '2026-08-20T14:15', value: 0.5 },
    { time: '2026-08-20T14:30', value: 1.0 },
  ];
  const idx = findNearestIndex(data, new Date('2026-08-20T14:08'));
  assertEq(idx, 0); // closer to 14:00
});

test('findNearestIndex returns -1 for empty data', () => {
  const idx = findNearestIndex([], new Date('2026-08-20T14:00'));
  assertEq(idx, -1);
});

test('formatTimeLabel formats as HH:MM', () => {
  const label = formatTimeLabel('2026-08-20T14:30');
  assert(label === '14:30', `Expected 14:30, got ${label}`);
});
```

- [ ] **Step 2: Add test import to test-runner.js**

```js
import './test-graph.js';
```

- [ ] **Step 3: Run tests to verify they fail**

Open `http://localhost:8000/test.html`
Expected: graph tests FAIL

- [ ] **Step 4: Implement graph.js**

Create `js/graph.js`:

```js
/**
 * Graph module — Canvas-based bar chart for precipitation data.
 */
import { colorForPrecipitation } from './api/openmeteo.js';

/**
 * Map a precipitation value (mm/h) to a bar height using logarithmic scale.
 * @param {number} mmh - Precipitation in mm/h
 * @param {number} maxHeight - Max bar height in pixels
 * @returns {number} Bar height in pixels (min 2px)
 */
export function mapValueToHeight(mmh, maxHeight) {
  if (mmh <= 0) return 2; // minimum visible height
  // Logarithmic scale: log10(mmh + 1) / log10(61) * maxHeight
  // Max meaningful value ~60 mm/h
  const logVal = Math.log10(mmh + 1);
  const logMax = Math.log10(61);
  const height = (logVal / logMax) * maxHeight;
  return Math.max(2, Math.min(maxHeight, height));
}

/**
 * Find the index in data array nearest to the target time.
 * @param {Array<{time: string, value: number}>} data
 * @param {Date} targetTime
 * @returns {number} Index or -1 if empty
 */
export function findNearestIndex(data, targetTime) {
  if (data.length === 0) return -1;
  const targetMs = targetTime.getTime();
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < data.length; i++) {
    const diff = Math.abs(new Date(data[i].time).getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Format an ISO time string as HH:MM.
 * @param {string} isoTime - ISO time string
 * @returns {string} Formatted time
 */
export function formatTimeLabel(isoTime) {
  const d = new Date(isoTime);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Render the precipitation bar chart on a canvas.
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array<{time: string, value: number}>} data - Precipitation data
 * @param {number} currentIndex - Index of the currently selected time
 */
export function renderGraph(canvas, data, currentIndex) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (data.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Données indisponibles', cssWidth / 2, cssHeight / 2);
    return;
  }

  const barCount = data.length;
  const gap = 2;
  const barWidth = Math.max(1, (cssWidth - gap * (barCount - 1)) / barCount);
  const maxHeight = cssHeight - 4;

  // Find "now" index (the frame closest to current time)
  const now = new Date();
  const nowIdx = findNearestIndex(data, now);

  for (let i = 0; i < barCount; i++) {
    const value = data[i].value;
    const height = mapValueToHeight(value, maxHeight);
    const x = i * (barWidth + gap);
    const y = cssHeight - height;

    const color = colorForPrecipitation(value);

    if (i === currentIndex) {
      // Current bar: full opacity + glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.globalAlpha = 1.0;
      ctx.fillRect(x, y, barWidth, height);
      ctx.shadowBlur = 0;

      // Triangle marker above current bar
      ctx.fillStyle = '#4acaea';
      const triX = x + barWidth / 2;
      const triY = y - 6;
      ctx.beginPath();
      ctx.moveTo(triX, triY + 5);
      ctx.lineTo(triX - 4, triY);
      ctx.lineTo(triX + 4, triY);
      ctx.closePath();
      ctx.fill();
    } else {
      // Past bars: 0.4 opacity, future bars: 0.5 opacity
      ctx.globalAlpha = i < nowIdx ? 0.4 : 0.5;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, height);
    }
  }

  ctx.globalAlpha = 1.0;
}

/**
 * Render time labels under the graph.
 * @param {HTMLElement} container - The #time-labels element
 * @param {Array<{time: string, value: number}>} data - Precipitation data
 */
export function renderTimeLabels(container, data) {
  if (data.length === 0) {
    container.innerHTML = '';
    return;
  }
  const labels = [
    formatTimeLabel(data[0].time),
    data.length > 2 ? formatTimeLabel(data[Math.floor(data.length / 2)].time) : '',
    formatTimeLabel(data[data.length - 1].time),
  ];
  container.innerHTML = labels.map(l => `<span>${l}</span>`).join('');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Open `http://localhost:8000/test.html`
Expected: All graph tests PASS

- [ ] **Step 6: Commit**

```bash
git add js/graph.js js/test-graph.js js/test-runner.js
git commit -m "feat: Canvas precipitation graph with log-scale bars, current-time highlight, and time labels"
```

---

### Task 6: Slider Module

**Files:**
- Create: `js/slider.js`
- Create: `js/test-slider.js`
- Modify: `js/test-runner.js` (add import)

- [ ] **Step 1: Write test file for slider module**

Create `js/test-slider.js`:

```js
import { test, assert, assertEq, assertApprox } from './test-runner.js';
import { timeToPercent, percentToTime, snapToInterval, findNearestFrame, clamp } from './slider.js';

test('timeToPercent returns 0 for start time', () => {
  const start = 1700000000;
  const end = 1700009000; // 1.5h later
  const pct = timeToPercent(start, start, end);
  assertApprox(pct, 0, 0.01);
});

test('timeToPercent returns 100 for end time', () => {
  const start = 1700000000;
  const end = 1700009000;
  const pct = timeToPercent(end, start, end);
  assertApprox(pct, 100, 0.01);
});

test('timeToPercent returns 50 for midpoint', () => {
  const start = 1700000000;
  const end = 1700009000;
  const pct = timeToPercent((start + end) / 2, start, end);
  assertApprox(pct, 50, 0.01);
});

test('percentToTime is inverse of timeToPercent', () => {
  const start = 1700000000;
  const end = 1700009000;
  const time = 1700004500;
  const pct = timeToPercent(time, start, end);
  const back = percentToTime(pct, start, end);
  assertApprox(back, time, 1);
});

test('snapToInterval rounds to nearest 10min', () => {
  const snapped = snapToInterval(1700000045, 600); // 600s = 10min
  assertEq(snapped, 1700000200); // rounded up to nearest 600
});

test('snapToInterval rounds down when closer', () => {
  const snapped = snapToInterval(1700000290, 600);
  assertEq(snapped, 1700000200); // 290 is closer to 200 than 800
});

test('findNearestFrame returns closest frame index', () => {
  const frames = [1700000000, 1700000600, 1700001200, 1700001800];
  const idx = findNearestFrame(frames, 1700001000);
  assertEq(idx, 2); // closest to 1700001200
});

test('findNearestFrame returns 0 for empty array', () => {
  const idx = findNearestFrame([], 1700001000);
  assertEq(idx, -1);
});

test('clamp constrains value to range', () => {
  assertEq(clamp(5, 0, 10), 5);
  assertEq(clamp(-1, 0, 10), 0);
  assertEq(clamp(15, 0, 10), 10);
});
```

- [ ] **Step 2: Add test import to test-runner.js**

```js
import './test-slider.js';
```

- [ ] **Step 3: Run tests to verify they fail**

Open `http://localhost:8000/test.html`
Expected: slider tests FAIL

- [ ] **Step 4: Implement slider.js**

Create `js/slider.js`:

```js
/**
 * Slider module — Unified time slider with drag, play/pause animation.
 */

/**
 * Convert a timestamp to a percentage of the [start, end] range.
 * @param {number} time - Unix timestamp (seconds)
 * @param {number} start - Range start (seconds)
 * @param {number} end - Range end (seconds)
 * @returns {number} Percentage 0-100
 */
export function timeToPercent(time, start, end) {
  if (end === start) return 0;
  return ((time - start) / (end - start)) * 100;
}

/**
 * Convert a percentage to a timestamp within [start, end].
 * @param {number} percent - 0-100
 * @param {number} start - Range start (seconds)
 * @param {number} end - Range end (seconds)
 * @returns {number} Unix timestamp (seconds)
 */
export function percentToTime(percent, start, end) {
  return start + (percent / 100) * (end - start);
}

/**
 * Snap a timestamp to the nearest interval.
 * @param {number} time - Unix timestamp (seconds)
 * @param {number} interval - Interval in seconds
 * @returns {number} Snapped timestamp
 */
export function snapToInterval(time, interval) {
  return Math.round(time / interval) * interval;
}

/**
 * Find the index of the frame nearest to the target time.
 * @param {number[]} frames - Sorted array of timestamps
 * @param {number} targetTime - Target timestamp
 * @returns {number} Index or -1
 */
export function findNearestFrame(frames, targetTime) {
  if (frames.length === 0) return -1;
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < frames.length; i++) {
    const diff = Math.abs(frames[i] - targetTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Clamp a value to [min, max].
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Initialize the time slider with drag and play/pause.
 * @param {object} options - { frames, onTimeChange, onPlayStateChange }
 *   frames: number[] (sorted timestamps in seconds)
 *   onTimeChange: (frameIndex) => void
 *   onPlayStateChange: (isPlaying) => void
 * @returns {object} { setFrame, play, pause, destroy }
 */
export function initSlider(options) {
  const { frames, onTimeChange, onPlayStateChange } = options;

  const track = document.getElementById('slider-track');
  const fill = document.getElementById('slider-fill');
  const handle = document.getElementById('slider-handle');
  const playBtn = document.getElementById('play-btn');

  let currentIdx = 0;
  let isPlaying = false;
  let animationTimer = null;

  if (frames.length === 0) {
    return { setFrame: () => {}, play: () => {}, pause: () => {}, destroy: () => {} };
  }

  const startTime = frames[0];
  const endTime = frames[frames.length - 1];
  const interval = 600; // 10min snap

  function updateUI() {
    const pct = timeToPercent(frames[currentIdx], startTime, endTime);
    fill.style.width = `${pct}%`;
    handle.style.left = `${pct}%`;
  }

  function setIndex(idx) {
    currentIdx = clamp(idx, 0, frames.length - 1);
    updateUI();
    if (onTimeChange) onTimeChange(currentIdx);
  }

  function setFrame(idx) {
    setIndex(idx);
  }

  function percentFromMouseEvent(e) {
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    return clamp(pct, 0, 100);
  }

  function percentFromTouchEvent(e) {
    const rect = track.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const pct = (x / rect.width) * 100;
    return clamp(pct, 0, 100);
  }

  function percentToIndex(pct) {
    const time = percentToTime(pct, startTime, endTime);
    const snapped = snapToInterval(time, interval);
    return findNearestFrame(frames, snapped);
  }

  // Drag handling
  let isDragging = false;

  function onPointerMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const pct = e.touches ? percentFromTouchEvent(e) : percentFromMouseEvent(e);
    const idx = percentToIndex(pct);
    setIndex(idx);
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    handle.classList.remove('dragging');
    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchend', onPointerUp);
  }

  function onPointerDown(e) {
    e.preventDefault();
    isDragging = true;
    handle.classList.add('dragging');
    const pct = e.touches ? percentFromTouchEvent(e) : percentFromMouseEvent(e);
    const idx = percentToIndex(pct);
    setIndex(idx);
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
  }

  track.addEventListener('mousedown', onPointerDown);
  track.addEventListener('touchstart', onPointerDown, { passive: false });

  // Play/pause
  function play() {
    if (isPlaying) return;
    isPlaying = true;
    playBtn.textContent = '⏸ Pause';
    if (onPlayStateChange) onPlayStateChange(true);

    // Start from beginning if at end
    if (currentIdx >= frames.length - 1) {
      setIndex(0);
    }

    animationTimer = setInterval(() => {
      if (currentIdx >= frames.length - 1) {
        pause();
        return;
      }
      setIndex(currentIdx + 1);
    }, 500); // 500ms per frame
  }

  function pause() {
    if (!isPlaying) return;
    isPlaying = false;
    playBtn.textContent = '▶ Play';
    if (onPlayStateChange) onPlayStateChange(false);
    if (animationTimer) {
      clearInterval(animationTimer);
      animationTimer = null;
    }
  }

  playBtn.addEventListener('click', () => {
    if (isPlaying) pause();
    else play();
  });

  // Init UI
  updateUI();

  return {
    setFrame,
    play,
    pause,
    destroy: () => {
      pause();
      track.removeEventListener('mousedown', onPointerDown);
      track.removeEventListener('touchstart', onPointerDown);
      playBtn.removeEventListener('click', () => {});
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Open `http://localhost:8000/test.html`
Expected: All slider tests PASS

- [ ] **Step 6: Commit**

```bash
git add js/slider.js js/test-slider.js js/test-runner.js
git commit -m "feat: unified time slider with drag, snap-to-10min, and play/pause animation"
```

---

### Task 7: Geolocation Module

**Files:**
- Create: `js/geolocation.js`
- Create: `js/test-geolocation.js`
- Modify: `js/test-runner.js` (add import)

- [ ] **Step 1: Write test file for geolocation module**

Create `js/test-geolocation.js`:

```js
import { test, assert, assertEq } from './test-runner.js';
import { FALLBACK_LOCATION, getFallbackLocation } from './geolocation.js';

test('FALLBACK_LOCATION is Paris coordinates', () => {
  assertEq(FALLBACK_LOCATION.lat, 48.85);
  assertEq(FALLBACK_LOCATION.lon, 2.35);
  assertEq(FALLBACK_LOCATION.name, 'Paris');
});

test('getFallbackLocation returns Paris object', () => {
  const loc = getFallbackLocation();
  assertEq(loc.lat, 48.85);
  assertEq(loc.lon, 2.35);
});
```

- [ ] **Step 2: Add test import to test-runner.js**

```js
import './test-geolocation.js';
```

- [ ] **Step 3: Run tests to verify they fail**

Open `http://localhost:8000/test.html`
Expected: geolocation tests FAIL

- [ ] **Step 4: Implement geolocation.js**

Create `js/geolocation.js`:

```js
/**
 * Geolocation module — wrapper around navigator.geolocation with fallback.
 */

export const FALLBACK_LOCATION = {
  lat: 48.85,
  lon: 2.35,
  name: 'Paris',
};

/**
 * Get the fallback location (Paris).
 * @returns {{lat: number, lon: number, name: string}}
 */
export function getFallbackLocation() {
  return { ...FALLBACK_LOCATION };
}

/**
 * Get the user's current position via navigator.geolocation.
 * @param {object} options - { timeout, enableHighAccuracy }
 * @returns {Promise<{lat: number, lon: number}>}
 */
export function getUserLocation(options = {}) {
  const timeout = options.timeout ?? 10000;
  const enableHighAccuracy = options.enableHighAccuracy ?? true;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation non supportée par ce navigateur'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        let message;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Géolocalisation refusée';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Position indisponible';
            break;
          case error.TIMEOUT:
            message = 'Délai de géolocalisation dépassé';
            break;
          default:
            message = 'Erreur de géolocalisation';
        }
        reject(new Error(message));
      },
      { timeout, enableHighAccuracy }
    );
  });
}

/**
 * Get user location, falling back to Paris on error.
 * Returns { lat, lon, isFallback, error? }.
 * @param {object} options - geolocation options
 * @returns {Promise<{lat: number, lon: number, isFallback: boolean, error?: string}>}
 */
export async function getUserLocationWithFallback(options = {}) {
  try {
    const loc = await getUserLocation(options);
    return { ...loc, isFallback: false };
  } catch (e) {
    return { ...getFallbackLocation(), isFallback: true, error: e.message };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Open `http://localhost:8000/test.html`
Expected: All geolocation tests PASS

- [ ] **Step 6: Commit**

```bash
git add js/geolocation.js js/test-geolocation.js js/test-runner.js
git commit -m "feat: geolocation module with Paris fallback and error handling"
```

---

### Task 8: Search Module

**Files:**
- Create: `js/search.js`
- Create: `js/test-search.js`
- Modify: `js/test-runner.js` (add import)

- [ ] **Step 1: Write test file for search module**

Create `js/test-search.js`:

```js
import { test, assert, assertEq } from './test-runner.js';
import { debounce, formatPlaceName } from './search.js';

test('debounce delays function execution', async () => {
  let callCount = 0;
  const fn = debounce(() => { callCount++; }, 50);
  fn();
  fn();
  fn();
  assertEq(callCount, 0); // not called yet
  await new Promise(r => setTimeout(r, 100));
  assertEq(callCount, 1); // called once after delay
});

test('debounce resets timer on subsequent calls', async () => {
  let callCount = 0;
  const fn = debounce(() => { callCount++; }, 50);
  fn();
  await new Promise(r => setTimeout(r, 30));
  fn(); // resets timer
  await new Promise(r => setTimeout(r, 30));
  assertEq(callCount, 0); // still not called, timer reset
  await new Promise(r => setTimeout(r, 50));
  assertEq(callCount, 1);
});

test('formatPlaceName with country and admin', () => {
  const name = formatPlaceName({ name: 'Lyon', country: 'France', admin1: 'Auvergne-Rhône-Alpes' });
  assert(name === 'Lyon, Auvergne-Rhône-Alpes, France', `Unexpected: ${name}`);
});

test('formatPlaceName with country only', () => {
  const name = formatPlaceName({ name: 'Tokyo', country: 'Japan' });
  assert(name === 'Tokyo, Japan', `Unexpected: ${name}`);
});

test('formatPlaceName with name only', () => {
  const name = formatPlaceName({ name: 'Nowhere' });
  assertEq(name, 'Nowhere');
});
```

- [ ] **Step 2: Add test import to test-runner.js**

```js
import './test-search.js';
```

- [ ] **Step 3: Run tests to verify they fail**

Open `http://localhost:8000/test.html`
Expected: search tests FAIL

- [ ] **Step 4: Implement search.js**

Create `js/search.js`:

```js
/**
 * Search module — Place search with autocomplete dropdown.
 */
import { searchPlaces } from './api/openmeteo.js';

/**
 * Debounce a function call.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Format a place result into a display name.
 * @param {object} place - { name, country, admin1 }
 * @returns {string} Formatted name
 */
export function formatPlaceName(place) {
  const parts = [place.name];
  if (place.admin1 && place.admin1 !== place.name) parts.push(place.admin1);
  if (place.country) parts.push(place.country);
  return parts.join(', ');
}

/**
 * Initialize the search input with autocomplete.
 * @param {function} onPlaceSelect - Callback: (lat, lon, name) => void
 * @returns {object} { destroy }
 */
export function initSearch(onPlaceSelect) {
  const input = document.getElementById('search-input');
  const resultsEl = document.getElementById('search-results');

  const performSearch = debounce(async (query) => {
    if (query.length < 2) {
      resultsEl.classList.remove('visible');
      resultsEl.innerHTML = '';
      return;
    }

    try {
      const results = await searchPlaces(query);
      if (results.length === 0) {
        resultsEl.innerHTML = '<div class="search-result-item" style="color:#888">Lieu introuvable</div>';
        resultsEl.classList.add('visible');
        return;
      }

      resultsEl.innerHTML = results.map(place => {
        const displayName = formatPlaceName(place);
        return `<div class="search-result-item" data-lat="${place.lat}" data-lon="${place.lon}" data-name="${place.name}">${displayName}</div>`;
      }).join('');
      resultsEl.classList.add('visible');

      // Attach click handlers
      resultsEl.querySelectorAll('.search-result-item').forEach(item => {
        if (!item.dataset.lat) return; // skip "not found" message
        item.addEventListener('click', () => {
          const lat = parseFloat(item.dataset.lat);
          const lon = parseFloat(item.dataset.lon);
          const name = item.dataset.name;
          input.value = name;
          resultsEl.classList.remove('visible');
          resultsEl.innerHTML = '';
          if (onPlaceSelect) onPlaceSelect(lat, lon, name);
        });
      });
    } catch (e) {
      resultsEl.innerHTML = '<div class="search-result-item" style="color:#f87171">Erreur de recherche</div>';
      resultsEl.classList.add('visible');
    }
  }, 300);

  function onInput() {
    performSearch(input.value.trim());
  }

  function onBlur() {
    // Delay to allow click on result
    setTimeout(() => {
      resultsEl.classList.remove('visible');
    }, 200);
  }

  function onFocus() {
    if (resultsEl.innerHTML) {
      resultsEl.classList.add('visible');
    }
  }

  input.addEventListener('input', onInput);
  input.addEventListener('blur', onBlur);
  input.addEventListener('focus', onFocus);

  return {
    destroy: () => {
      input.removeEventListener('input', onInput);
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('focus', onFocus);
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Open `http://localhost:8000/test.html`
Expected: All search tests PASS

- [ ] **Step 6: Commit**

```bash
git add js/search.js js/test-search.js js/test-runner.js
git commit -m "feat: place search with debounced autocomplete and geocoding integration"
```

---

### Task 9: Main Orchestrator

**Files:**
- Create: `js/main.js`

- [ ] **Step 1: Implement main.js**

Create `js/main.js`:

```js
/**
 * Main orchestrator — initializes all modules and wires data flow.
 */
import { fetchRadarFrames, selectFrames } from './api/rainviewer.js';
import { fetchPrecipitation, extractWindow } from './api/openmeteo.js';
import { initMap, setRadarLayer, setMarker, centerMap, clearRadarLayer, showRadarUnavailable } from './map.js';
import { renderGraph, renderTimeLabels, findNearestIndex, formatTimeLabel } from './graph.js';
import { initSlider } from './slider.js';
import { getUserLocationWithFallback } from './geolocation.js';
import { initSearch } from './search.js';

// State
let map = null;
let radarData = null; // { host, frames: number[] }
let precipData = []; // [{ time, value }]
let sliderApi = null;

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
      document.getElementById('precip-info').textContent = 'Aucune précipitation prévue';
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
      if (precipData.length > 0 && sliderApi) {
        // Re-render graph — need to find current index from slider state
        // Simplest: re-render with index 0 and let slider callback handle it
        renderGraph(canvas, precipData, 0);
      }
    }, 200);
  });
}

// Start app
init().catch(e => {
  console.error('Init error:', e);
  showToast('Erreur d'initialisation');
});
```

- [ ] **Step 2: Verify app loads in browser**

Open `http://localhost:8000/index.html`

Expected:
- Dark map loads centered on user location (or Paris if denied)
- Search bar visible at top
- Geoloc button at top right
- Legend at left
- Bottom panel with graph, slider, play button
- If geolocation denied, toast message appears

- [ ] **Step 3: Test core flows manually**

Test the following:
1. **Geolocation**: Allow or deny — map should center accordingly
2. **Search**: Type "Lyon" — autocomplete results appear, click one → map moves, radar loads
3. **Slider drag**: Drag the handle — radar changes on map, graph highlight moves, time updates
4. **Play button**: Click ▶ — slider animates through frames, radar animates on map
5. **Resize**: Resize window — graph should re-render

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: main orchestrator wiring all modules — geolocation, radar, precipitation, slider, search"
```

---

### Task 10: Error Handling Polish

**Files:**
- Modify: `js/main.js` (add retry logic, error states)
- Modify: `js/api/rainviewer.js` (add retry)
- Modify: `js/api/openmeteo.js` (add retry)

- [ ] **Step 1: Add retry-with-timeout utility to rainviewer.js**

Add to `js/api/rainviewer.js`:

```js
/**
 * Fetch with timeout and single retry.
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in ms
 * @param {number} retries - Number of retries
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, timeout = 5000, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
  }
}
```

Update `fetchRadarFrames` to use it:

```js
export async function fetchRadarFrames() {
  const res = await fetchWithRetry(RAINVIEWER_API);
  const data = await res.json();
  const host = data.host;
  const past = (data.radar && data.radar.past) ? data.radar.past.map(f => f.time) : [];
  const future = (data.radar && data.radar.nforecast) ? data.radar.nforecast.map(f => f.time) : [];
  return { host, past, future };
}
```

- [ ] **Step 2: Add retry to openmeteo.js**

Add the same `fetchWithRetry` function to `js/api/openmeteo.js`:

```js
async function fetchWithRetry(url, timeout = 5000, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
  }
}
```

Update `fetchPrecipitation` and `searchPlaces` to use it:

```js
export async function fetchPrecipitation(lat, lon) {
  const url = buildPrecipitationUrl(lat, lon);
  const res = await fetchWithRetry(url);
  const data = await res.json();
  return parsePrecipitation(data);
}

export async function searchPlaces(query) {
  const url = buildGeocodingUrl(query);
  const res = await fetchWithRetry(url);
  const data = await res.json();
  if (!data.results) return [];
  return data.results.map(r => ({
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    country: r.country || '',
    admin1: r.admin1 || '',
  }));
}
```

- [ ] **Step 3: Add "no precipitation" message to graph rendering**

In `js/main.js`, update the `loadPrecipitation` function to handle the "no rain" case with a clear message. The `renderGraph` already handles empty data, but let's add a specific check:

```js
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
```

- [ ] **Step 4: Run all tests to verify nothing broke**

Open `http://localhost:8000/test.html`
Expected: All tests still PASS

- [ ] **Step 5: Test error scenarios manually**

1. **Simulate API failure**: Open DevTools → Network tab → block `api.rainviewer.com` → reload. Should see "Radar indisponible" badge, graph still works.
2. **Block Open-Meteo**: Block `api.open-meteo.com` → reload. Graph shows "Données indisponibles", radar still works.
3. **Deny geolocation**: Map centers on Paris, toast shows message.

- [ ] **Step 6: Commit**

```bash
git add js/api/rainviewer.js js/api/openmeteo.js js/main.js
git commit -m "feat: error handling with retry, timeout, and user-facing error states"
```

---

### Task 11: Final Polish + Manual Testing

**Files:**
- Modify: `css/style.css` (responsive adjustments)
- Modify: `js/main.js` (graph re-render on resize with correct index)

- [ ] **Step 1: Fix graph resize to preserve current index**

In `js/main.js`, replace the resize handler with one that tracks current index:

```js
// Track current frame index for resize re-render
let currentFrameIdx = 0;

// In the onTimeChange callback, update currentFrameIdx:
onTimeChange: (idx) => {
  currentFrameIdx = idx;
  updateRadar(idx);
  updateGraph(idx);
  updateTimeInfo(idx);
},
```

Update the resize handler:

```js
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
```

- [ ] **Step 2: Add CSS for map loading state and radar badge**

Add to `css/style.css`:

```css
/* Radar unavailable badge */
.leaflet-control.radar-badge {
  margin-top: 50px !important;
  margin-right: 10px !important;
}

/* Loading state */
#map.loading::before {
  content: 'Chargement de la carte...';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #4a5680;
  z-index: 500;
}

/* Ensure leaflet controls match dark theme */
.leaflet-control-attribution {
  background: rgba(15, 15, 30, 0.8) !important;
  color: #666 !important;
}

.leaflet-control-attribution a {
  color: #888 !important;
}

.leaflet-bar a {
  background: rgba(15, 15, 30, 0.9) !important;
  color: #fff !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.leaflet-bar a:hover {
  background: rgba(0, 102, 255, 0.3) !important;
}
```

- [ ] **Step 3: Run full test suite**

Open `http://localhost:8000/test.html`
Expected: All tests PASS (rainviewer: 6, openmeteo: 10, graph: 8, slider: 9, geolocation: 2, search: 5 = 40 total)

- [ ] **Step 4: Complete manual test checklist**

Open `http://localhost:8000/index.html` and verify:

- [ ] Map loads with dark theme
- [ ] Map centers on user location (or Paris if denied)
- [ ] Location marker visible on map
- [ ] Radar tiles overlay on map (animated when slider moves)
- [ ] Search bar accepts input
- [ ] Search autocomplete shows results
- [ ] Clicking search result moves map and reloads data
- [ ] Graph shows precipitation bars
- [ ] Graph current bar has highlight + triangle marker
- [ ] Slider is draggable
- [ ] Slider snaps to 10-min intervals
- [ ] Play button animates slider through frames
- [ ] Pause button stops animation
- [ ] Time display updates with slider
- [ ] Precipitation info text updates with slider
- [ ] Geoloc button recenters on user position
- [ ] Legend visible on left side (desktop)
- [ ] Responsive: works on narrow viewport
- [ ] No console errors

- [ ] **Step 5: Commit final polish**

```bash
git add css/style.css js/main.js
git commit -m "polish: resize handling, dark theme leaflet controls, final UI adjustments"
```

- [ ] **Step 6: Stop the visual companion server**

```bash
bash "/Users/gauthier.merlin/.cache/opencode/packages/superpowers@git+https:/github.com/obra/superpowers.git/node_modules/superpowers/skills/brainstorming/scripts/stop-server.sh" /Users/gauthier.merlin/raintoday/.superpowers/brainstorm/36334-1787226921
```
