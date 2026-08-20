# RainToday

Radar de pluie en temps réel avec prévisions, carte interactive et graphique de précipitations.

## Aperçu

- Carte plein écran avec animation radar de pluie (2h passé → 2h futur)
- Graphique de précipitations en barres (mm/h)
- Slider temporel unifié avec play/pause
- Géolocalisation + recherche de lieu
- Prévision future par extrapolation du déplacement des cellules pluvieuses (basée sur le vent)
- 100% vanilla JS, aucun build, aucune clé API, aucun backend

## APIs utilisées

- [RainViewer](https://www.rainviewer.com/) — tuiles radar de précipitations (passé)
- [Open-Meteo](https://open-meteo.com/) — précipitations, probabilité, vent, géocodage
- [Nominatim (OpenStreetMap)](https://nominatim.openstreetmap.org/) — reverse geocoding
- [OpenStreetMap tiles](https://www.openstreetmap.org/) — carte de base

## Lancer en local

```bash
python3 -m http.server 8000
```

Puis ouvrir [http://localhost:8000](http://localhost:8000)

Ou double-cliquer sur `RainToday.command` (macOS).

## Tests

Ouvrir `test.html` dans un navigateur.

## Déploiement

App statique — déployable sur Netlify, Vercel, GitHub Pages, ou tout hébergeur statique.

### Netlify (le plus simple)

1. Aller sur [app.netlify.com/drop](https://app.netlify.com/drop)
2. Glisser le dossier du projet
3. C'est en ligne

### Vercel

```bash
npx vercel
```

## Structure du projet

```
raintoday/
├── index.html              # Point d'entrée
├── test.html               # Runner de tests
├── css/
│   └── style.css           # Thème clair, layout, slider, graph
├── js/
│   ├── main.js             # Orchestrateur (data flow, UI updates)
│   ├── map.js              # Leaflet, tuiles radar, marker, offset extrapolation
│   ├── graph.js            # Canvas bar chart de précipitations
│   ├── slider.js           # Slider temporel drag + play/pause
│   ├── geolocation.js      # Geolocation avec fallback Paris
│   ├── search.js           # Recherche de lieu avec autocomplete
│   ├── api/
│   │   ├── rainviewer.js   # API RainViewer (frames radar, tuiles)
│   │   └── openmeteo.js    # API Open-Meteo (précipitations, vent, géocodage)
│   ├── test-runner.js      # Framework de test minimaliste
│   ├── test-rainviewer.js  # Tests RainViewer
│   ├── test-openmeteo.js   # Tests Open-Meteo
│   ├── test-slider.js      # Tests slider
│   └── test-graph.js       # Tests graph
└── assets/
    └── ...                 # Icônes, images
```

## Limitations

- Le radar RainViewer couvre l'Europe, l'Amérique du Nord, l'Asie et l'Australie. Pas de couverture pour l'Afrique, l'Amérique du Sud et les océans.
- L'extrapolation future est une estimation basée sur le vent moyen. Précision diminue avec le temps (fiable ~30-60min, indicative au-delà).
- RainViewer ne fournit que 2h de données passées.

## Licence

MIT — voir [LICENSE](LICENSE).
