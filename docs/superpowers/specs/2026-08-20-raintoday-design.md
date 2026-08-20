# RainToday — Radar Pluie Web App

**Date:** 2026-08-20
**Status:** Design approved

## Overview

Web app légère (vanilla JS, zéro build) affichant un radar de pluie animé sur 3h avec géolocalisation et recherche de lieu. Carte plein écran + graphique de précipitations en barres (mm/h) + curseur temporel unifié.

## Tech Stack

- **HTML/CSS/JS vanilla** — zéro framework, zéro build step
- **Leaflet** (~40KB) — bibliothèque de carte, support natif tuiles raster
- **RainViewer API** — tuiles radar global, gratuit, pas de clé API
- **Open-Meteo API** — précipitations ponctuelles mm/h, gratuit, pas de clé API
- **ES Modules natifs** — imports navigateur, pas de bundler

## Architecture

```
raintoday/
├── index.html              # Entry point, structure DOM
├── css/
│   └── style.css           # Styles globaux, responsive, dark theme
├── js/
│   ├── main.js             # Orchestrator: init modules, wire events
│   ├── api/
│   │   ├── rainviewer.js   # Fetch timestamps radar RainViewer
│   │   └── openmeteo.js    # Fetch précipitations mm/h point
│   ├── map.js              # Leaflet init, tuiles radar, marker
│   ├── graph.js            # Canvas barres précipitations
│   ├── slider.js           # Curseur temporel unifié, play/pause
│   ├── geolocation.js      # navigator.geolocation wrapper
│   └── search.js           # Recherche lieu (Open-Meteo geocoding)
└── assets/
    └── (icônes si besoin)
```

### Principes

- Chaque module exporte des fonctions, pas de state global mutable
- `main.js` orchestre: init modules, wire events entre modules
- Communication inter-modules via `EventTarget` (events custom) ou appels directs de fonctions
- Données passées en paramètres, pas de singleton

## Data Flow

```
[Geolocation/Search] → coords (lat, lon)
         │
         ├──→ [RainViewer API] → pastFrames[] + futureFrames[] (timestamps radar)
         │         │
         │         └──→ [Map] affiche tuile radar pour timestamp sélectionné
         │
         └──→ [Open-Meteo API] → precipitation[] (mm/h, 3h)
                   │
                   └──→ [Graph] barres mm/h

[Slider] ←→ timestamp sélectionné
    ├── met à jour [Map] (change tuile radar)
    └── met à jour [Graph] (highlight barre courante)

[Play/Pause] → anime [Slider] sur la plage 3h
```

### APIs

**RainViewer:**
- Endpoint: `https://api.rainviewer.com/public/weather-maps.json`
- Retourne: liste de timestamps disponibles (passé ~2h + futur ~30min, pas de 10min)
- Tuiles: `https://tilecache.rainviewer.com/v2/radar/{timestamp}/{size}/{z}/{x}/{y}/{color}/{options}.png`
- Color scheme: `2` (Rainbow / dBZ), ou choix utilisateur
- Pas de clé API, pas de rate limit documenté (usage raisonnable)

**Open-Meteo:**
- Endpoint: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&minutely_15=precipitation&past_days=1&forecast_days=1`
- Retourne: précipitations par pas de 15min
- On extrait une fenêtre alignée sur RainViewer: 2h passé + 30min futur (2.5h total)
- Pas de clé API, rate limit: 10,000 calls/jour

**Open-Meteo Geocoding (recherche lieu):**
- Endpoint: `https://geocoding-api.open-meteo.com/v1/search?name={query}&count=5&language=fr&format=json`
- Retourne: liste de lieux avec lat/lon

## UI / Layout

### Layout général

- **Carte plein écran** — Leaflet, dark theme, fond de carte sombre
- **Overlay top-center** — barre de recherche avec auto-complétion
- **Overlay top-right** — bouton géolocalisation (📍)
- **Overlay left** — légende couleur mm/h
- **Panel bas** — graphique barres + curseur temporel + play/pause + indicateur temps

### Graphique précipitations

- Canvas natif pour performance
- Barres verticales: 1 barre par pas de temps (15min)
- Hauteur proportionnelle à mm/h
- Couleur des barres: même échelle que le radar (cohérence visuelle)
- Barre courante (position curseur): highlight + glow + marqueur triangulaire au-dessus
- Barres passées: opacité réduite (0.4)
- Barres futures: opacité moyenne (0.5)

### Curseur temporel unifié

- Plage: 2h passé → 30min futur (aligné sur disponibilité RainViewer)
- Draggable, snap sur pas de 10min (résolution radar)
- Bouton play/pause: anime le curseur à 1x vitesse réelle (ou accélérée)
- Met à jour carte (change tuile radar) + graphique (highlight barre)

### Style

- Dark theme par défaut (pas de toggle dans v1)
- Couleurs: fond #0a0a14, overlay rgba(15,15,30,0.9) + backdrop-blur
- Accent: bleu #0066ff (géoloc, slider), cyan #4acaea (barre courante)
- Font: system-ui, sans-serif
- Responsive: mobile-first, overlay adapte la taille

## Error Handling

| Cas | Comportement |
|-----|-------------|
| Géoloc refusée/indisponible | Carte centrée sur Paris (48.85, 2.35), toast "Géolocalisation indisponible — recherchez un lieu" |
| RainViewer indisponible | Carte affiche fond seul, badge "Radar indisponible", graphique continue avec Open-Meteo |
| Open-Meteo indisponible | Graphique affiche "Données indisponibles", carte radar continue |
| Aucune pluie | Barres plates à 0, message "Aucune précipitation prévue dans les 3h" |
| Recherche sans résultat | Message "Lieu introuvable" dans la barre |
| Timeout réseau | Retry 1x après 3s, puis message d'erreur sur le module concerné |

## Testing

- Pas de framework de test (vanilla JS, zéro build)
- Fichier `test.html` séparé: importe modules, vérifie:
  - Parsing des réponses API (RainViewer timestamps, Open-Meteo precipitation)
  - Logique du slider (bornes, play/pause, vitesse)
  - Géoloc fallback
  - Recherche (résultats vides, cas spéciaux)
- Validation manuelle: ouvrir `index.html` dans navigateur, tester les flows

## Out of Scope (v1)

- PWA / notifications push
- Light theme
- Contrôles carte avancés (slider opacité, choix fond)
- Prévisions au-delà de 3h
- Backend / serveur
