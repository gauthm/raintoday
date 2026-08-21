# RainToday

Real-time rain radar with forecasts, interactive map, and precipitation chart.

## Features

- Full-screen map with animated rain radar (2h past → 2h future)
- Bar chart of precipitation intensity (mm/h)
- Unified time slider with play/pause animation
- Geolocation + place search with autocomplete
- Future radar extrapolation using wind speed & direction to translate the last radar frame
- "Now" button to jump back to current time
- Radar coverage detection — shows a badge when the current region has no radar data
- Compact floating bottom panel with inline controls
- 100% vanilla JS, no build step, no API keys, no backend

## APIs Used

- [RainViewer](https://www.rainviewer.com/) — radar precipitation tiles (past 2h)
- [Open-Meteo](https://open-meteo.com/) — precipitation, probability, wind speed/direction, geocoding
- [Nominatim (OpenStreetMap)](https://nominatim.openstreetmap.org/) — reverse geocoding for geolocation
- [OpenStreetMap tiles](https://www.openstreetmap.org/) — base map

## Run Locally

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000)

Or double-click `RainToday.command` (macOS).

## Tests

Open `test.html` in a browser.

## Deployment

Static app — deployable on Netlify, Vercel, GitHub Pages, or any static host.

### Netlify (simplest)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the project folder
3. It's live

### Vercel

```bash
npx vercel
```

## Project Structure

```
raintoday/
├── index.html              # Entry point
├── test.html               # Test runner
├── css/
│   └── style.css           # Light theme, layout, slider, graph, floating panel
├── js/
│   ├── main.js             # Orchestrator — data flow, UI updates, radar extrapolation
│   ├── map.js              # Leaflet, radar tiles, double-buffer, coverage detection, marker
│   ├── graph.js            # Canvas bar chart, auto-scale, slider-aligned bars
│   ├── slider.js           # Time slider — drag, play/pause, pixel-based positioning
│   ├── geolocation.js      # Geolocation with Paris fallback
│   ├── search.js           # Place search with debounced autocomplete
│   ├── api/
│   │   ├── rainviewer.js   # RainViewer API — radar frames, tile URLs
│   │   └── openmeteo.js    # Open-Meteo API — precipitation, wind, geocoding, reverse geocoding
│   ├── test-runner.js      # Minimal test framework
│   ├── test-rainviewer.js  # RainViewer tests
│   ├── test-openmeteo.js   # Open-Meteo tests
│   ├── test-slider.js      # Slider tests
│   └── test-graph.js       # Graph tests
└── assets/
    └── ...                 # Icons, images
```

## Limitations

- RainViewer radar covers Europe, North America, Asia, and Australia. No coverage for Africa, South America, or oceans.
- Future extrapolation is an estimate based on average wind. Accuracy decreases with time (reliable ~30-60min, indicative beyond).
- RainViewer provides only 2h of past data.
- Open-Meteo precipitation is point-based (nearest weather station), not radar — may show 0 mm/h even when radar shows nearby rain.

## License

MIT — see [LICENSE](LICENSE).
