# RainToday

> **Inspired by [raintoday.weatherpro.de](https://raintoday.weatherpro.de/)** — the idea and UX are directly lifted from that app. Credit where credit is due.

Real-time rain radar with animated precipitation tiles, future extrapolation via wind data, and a unified timeline slider. 100% vanilla JavaScript — no framework, no build step, no API keys, no backend.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Data Sources](#data-sources)
- [Radar Extrapolation — How It Works](#radar-extrapolation--how-it-works)
- [Radar Pixel Sampling](#radar-pixel-sampling)
- [Zoom Drift Compensation](#zoom-drift-compensation)
- [Slider & Graph Alignment](#slider--graph-alignment)
- [i18n](#i18n)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Limitations](#limitations)
- [License](#license)

---

## Features

- **Full-screen Leaflet map** with animated RainViewer radar tiles (past 2h)
- **Future radar extrapolation** up to 2h ahead — translates the last radar frame using 850hPa wind data + Mercator projection correction
- **Precipitation bar chart** (Canvas API) — auto-scaled, log-scale, aligned with slider positions
- **Unified time slider** — drag, play/pause animation, ticks every 15min with labels every 30min
- **Radar pixel sampling** — reads the actual RainViewer tile color at the marker position to display accurate mm/h, instead of relying solely on Open-Meteo station data
- **Geolocation** with reverse geocoding (Nominatim) — search bar auto-fills city name
- **Place search** with debounced autocomplete (Open-Meteo geocoding)
- **"Now" button** — jumps slider to nearest precipitation data point to current time
- **Radar coverage detection** — counts tile load vs error events, shows badge if ≥80% fail
- **Forecast badge** — "Estimated forecast +Xmin" indicator when viewing extrapolated frames
- **Zoom drift compensation** — recalculates radar offset on every zoom frame (`zoomanim` + `zoom` events)
- **i18n** — French / English, auto-detected from `navigator.language`
- **Responsive** — mobile-friendly floating panel, touch support
- **Zero dependencies** beyond Leaflet (CDN). No npm, no bundler, no transpilation.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        index.html                            │
│   #map (Leaflet)  ·  #search-container  ·  #bottom-panel     │
└────────────────────────┬─────────────────────────────────────┘
                         │
                    js/main.js
                   (orchestrator)
                         │
          ┌──────────────┼──────────────┬──────────────┐
          ▼              ▼              ▼              ▼
      js/map.js     js/slider.js   js/graph.js   js/search.js
   (Leaflet init,  (drag, play,   (Canvas bar   (debounced
    radar tiles,    ticks, %       chart, log    autocomplete)
    double-buffer,  positioning)   scale, DPR)
    coverage,
    offset)
          │              │              │
          ▼              ▼              ▼
  js/api/rainviewer.js  js/api/openmeteo.js  js/radar-sampler.js
  (frames, tile URLs)   (precip, wind 850hPa, (pixel color → mm/h
                         geocoding, reverse)   via Canvas getImageData)
```

### Module Responsibilities

| Module | Role |
|---|---|
| `main.js` | Orchestrator — loads data in parallel, wires slider→radar→graph→text, computes radar offset, handles zoom events |
| `map.js` | Leaflet init (bounds locked), double-buffer radar layer (no flicker), `setRadarOffset` with tile preloading, coverage detection, marker |
| `slider.js` | `%`-based positioning (handle, fill, ticks all in same coordinate system), drag + touch, play/pause at 500ms/frame |
| `graph.js` | Canvas 2D bar chart — `devicePixelRatio` aware, log-scale height mapping, bars centered on `(i/(n-1)) * usableWidth` |
| `radar-sampler.js` | Fetches the RainViewer tile at zoom 6 for the marker position, reads pixel color via `getImageData`, maps to mm/h via palette matching |
| `api/openmeteo.js` | Builds URLs, fetches precipitation (15-min + hourly interpolated), extracts wind (850hPa preferred, 10m fallback), geocoding, reverse geocoding |
| `api/rainviewer.js` | Fetches available radar frames, selects 2h window (past + nowcast) |
| `i18n.js` | Detects `navigator.language`, exports `t` object with FR/EN strings |
| `geolocation.js` | `navigator.geolocation` with Paris fallback + i18n error messages |

---

## Data Sources

| API | Usage | Auth | Rate limit |
|---|---|---|---|
| [RainViewer](https://www.rainviewer.com/) | Radar precipitation tiles (past 2h + nowcast ~30min) | None | Fair use |
| [Open-Meteo](https://open-meteo.com/) | Precipitation (15-min + hourly), `wind_speed_850hPa`, `wind_direction_850hPa`, precipitation_probability, geocoding | None | 10k req/day (no key) |
| [Nominatim](https://nominatim.openstreetmap.org/) | Reverse geocoding for geolocation button | None | 1 req/sec |
| [OpenStreetMap](https://www.openstreetmap.org/) | Base map tiles | None | Fair use |

All APIs support CORS — no proxy needed.

---

## Radar Extrapolation — How It Works

RainViewer provides real radar tiles for the past 2h and ~30min of nowcast. Beyond that, the app extrapolates:

1. **Keep the last radar frame** as a static tile layer
2. **Fetch wind data at 850hPa** (~1500m altitude) from Open-Meteo — this is where rain clouds actually move, not at 10m surface level
3. **Compute pixel offset**:
   - `distKm = windSpeed * (deltaSec / 3600)` — distance clouds travel
   - `pxPerKm = (256 * 2^zoom) / (40075 * cos(latRad))` — Mercator-corrected pixel density
   - `moveDir = (windDirection + 180) % 360` — clouds move TO opposite of where wind comes FROM
   - `dx = distPx * sin(rad)`, `dy = -distPx * cos(rad)` — screen-space offset
4. **Apply CSS `translate(dx, dy)`** on the tile layer container
5. **Preload tiles** in the shifted zone by expanding container `margin`/`width`/`height` and calling `redraw()`

Wind direction uses meteorological convention (degrees FROM which wind blows, clockwise from North).

### Why 850hPa and not 10m?

Surface wind (10m) is typically 2-3× slower and often in a different direction than the 850hPa flow. A perturbation arriving from the northwest at 60 km/h at 1500m might show as a 20 km/h southwest wind at ground level. Using 10m wind would place the extrapolated rain in the wrong location.

### Mercator correction

Without `cos(latRad)`, the pixel-per-km ratio is only correct at the equator. At Paris (48.8°N), `cos(48.8°) ≈ 0.66` — without correction, the offset would be underestimated by ~34%.

---

## Radar Pixel Sampling

Open-Meteo precipitation data is station-based (point measurement at the nearest weather station). It can return 0 mm/h even when the radar shows rain directly overhead. To fix this:

1. When `updateTimeInfo()` is called, immediately display Open-Meteo data (synchronous, no flash)
2. **Async**: fetch the RainViewer tile at zoom 6 for the marker's lat/lon
3. Load the tile as an `Image` with `crossOrigin: 'anonymous'`
4. Draw to a hidden `<canvas>`, read the pixel at the marker's position via `getImageData()`
5. Match the pixel color to the RainViewer color palette → mm/h
6. If the result is non-null and the slider hasn't moved, update the precipitation text

If CORS blocks the tile read, the function returns `null` and the Open-Meteo value is kept.

---

## Zoom Drift Compensation

When extrapolating (CSS `translate` on the tile container), zooming causes the radar zone to visually drift because:

- Leaflet resets its internal transforms during zoom animation
- The CSS `translate` is in pixels from the old zoom level
- `zoomend` only fires after the animation completes

**Fix**: three event handlers:

| Event | When | Action |
|---|---|---|
| `zoom` | Every frame of pinch/wheel zoom | Recompute offset with `map.getZoom()` |
| `zoomanim` | Before Leaflet resets transforms | Pre-position with `e.zoom` (target zoom) |
| `zoomend` | After animation completes | Full `updateRadar()` + coverage recheck |

`currentDeltaSec` is stored in module state so the handlers can recompute without knowing the slider index.

---

## Slider & Graph Alignment

All three elements (graph bars, slider handle/fill, ticks) use the **same coordinate system**: percentage of track width.

- **Graph**: `centerX = barWidth/2 + (i/(n-1)) * (cssWidth - barWidth)` — bars stay within bounds, uniform width
- **Slider handle**: `handle.style.left = pct + '%'` + CSS `transform: translate(-50%, -50%)`
- **Slider fill**: `fill.style.width = pct + '%'`
- **Ticks**: `tick.style.left = pct + '%'` + `translateX(-50%)` — always centered on the handle position

The `#timeline-wrapper` ensures graph canvas and slider track share the exact same width. Both have `margin: 0 8px` and `width: calc(100% - 16px)` for handle overflow clearance.

---

## i18n

Language is detected via `navigator.language.startsWith('fr')` → French, else English. All user-facing strings (search placeholder, geolocation errors, precipitation descriptions, forecast badge, radar unavailable badge, buttons) are translated. The `t` object is imported by `main.js`, `slider.js`, `geolocation.js`, `search.js`, and `map.js`.

---

## Running Locally

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .

# PHP
php -S localhost:8000
```

Open [http://localhost:8000](http://localhost:8000).

Or double-click `RainToday.command` on macOS (launches a local server and opens the browser).

---

## Testing

Open `test.html` in a browser. Tests use a minimal custom framework (`test-runner.js`) covering:

- RainViewer frame selection and time windowing
- Open-Meteo URL building and precipitation parsing
- Slider percent↔time conversion
- Graph value-to-height mapping

---

## Deployment

Static app — deployable on any static host.

### Netlify (simplest)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the project folder
3. It's live

### Vercel

```bash
npx vercel
```

### GitHub Pages

Push to `main` and enable Pages in repo settings (root directory).

---

## Project Structure

```
raintoday/
├── index.html                  # Entry point — HTML structure, Leaflet CDN, CSS cache-bust
├── test.html                   # Test runner page
├── RainToday.command           # macOS launcher (starts local server + opens browser)
├── LICENSE                     # MIT
├── README.md
├── css/
│   └── style.css               # Light theme, glassmorphism overlays, slider, graph, responsive
├── js/
│   ├── main.js                 # Orchestrator — data flow, radar offset computation, zoom handlers
│   ├── map.js                  # Leaflet init, double-buffer radar layer, setRadarOffset, coverage detection
│   ├── slider.js               # Time slider — % positioning, drag/touch, play/pause, ticks
│   ├── graph.js                # Canvas bar chart — DPR-aware, log-scale, slider-aligned bars
│   ├── radar-sampler.js        # RainViewer tile pixel sampling → mm/h via palette matching
│   ├── i18n.js                 # FR/EN translations, auto-detected from navigator.language
│   ├── geolocation.js          # Geolocation with Paris fallback + i18n errors
│   ├── search.js               # Place search with debounced autocomplete
│   ├── api/
│   │   ├── rainviewer.js       # RainViewer API — fetch frames, select 2h window
│   │   └── openmeteo.js        # Open-Meteo API — precip, wind 850hPa, geocoding, reverse geocoding
│   ├── test-runner.js          # Minimal test framework
│   ├── test-rainviewer.js      # RainViewer tests
│   ├── test-openmeteo.js       # Open-Meteo tests
│   ├── test-slider.js          # Slider tests
│   └── test-graph.js           # Graph tests
└── assets/
    └── ...                     # Icons, images
```

---

## Limitations

- **Radar coverage**: RainViewer covers Europe, North America, Asia, and Australia. No coverage for Africa, South America, or oceans. A badge is shown when the current region has no data.
- **Extrapolation accuracy**: Future radar is a translation of the last frame based on average wind. Reliable ~30-60min, indicative beyond. No growth/dissipation modeling.
- **RainViewer past data**: Only 2h of past radar is available.
- **Open-Meteo precipitation**: Station-based (point), not radar-based (area). May show 0 mm/h even when radar shows nearby rain — mitigated by radar pixel sampling, but sampling can be blocked by CORS.
- **Wind data granularity**: Wind is a single hourly value for the current time — it doesn't vary across the 2h extrapolation window.
- **No offline support**: All data is fetched live. No service worker, no cache.

---

## License

MIT — see [LICENSE](LICENSE).
