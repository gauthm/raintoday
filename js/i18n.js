/**
 * i18n module — detects browser language and provides translations.
 * French if browser is FR, English otherwise.
 */

const isFrench = navigator.language.startsWith('fr');

const fr = {
  searchPlaceholder: 'Rechercher un lieu...',
  searchAria: 'Rechercher un lieu',
  geolocTitle: 'Ma position',
  nowBtn: 'Maintenant',
  nowBtnTitle: "Revenir à maintenant",
  play: '▶ Play',
  pause: '⏸ Pause',
  loading: 'Chargement...',
  noData: 'Données indisponibles',
  noForecastData: 'Aucune donnée de prévision',
  noRain12h: 'Aucune précipitation prévue dans les 12h',
  noRain: 'Aucune précipitation',
  noRainRisk: (prob) => `Pas de pluie · ${prob}% de risque`,
  veryLightRain: (v) => `Très faible pluie · ${v.toFixed(1)} mm/h`,
  lightRain: (v) => `Faible pluie · ${v.toFixed(1)} mm/h`,
  moderateRain: (v) => `Pluie modérée · ${v.toFixed(1)} mm/h`,
  heavyRain: (v) => `Forte pluie · ${v.toFixed(1)} mm/h`,
  veryHeavyRain: (v) => `Très forte pluie · ${v.toFixed(1)} mm/h`,
  probSuffix: (prob) => ` (${prob}%)`,
  placeNotFound: 'Lieu introuvable',
  searchError: 'Erreur de recherche',
  radarUnavailable: 'Radar non disponible dans cette région',
  geolocDenied: 'Géolocalisation refusée',
  geolocUnavailable: 'Position indisponible',
  geolocTimeout: 'Délai de géolocalisation dépassé',
  geolocError: 'Erreur de géolocalisation',
  geolocNotSupported: 'Geolocation non supportée par ce navigateur',
  initError: "Erreur d'initialisation",
  searchPlaceHint: (err) => `${err} — recherchez un lieu`,
  estimatedForecast: 'Prévision estimée',
};

const en = {
  searchPlaceholder: 'Search for a place...',
  searchAria: 'Search for a place',
  geolocTitle: 'My location',
  nowBtn: 'Now',
  nowBtnTitle: 'Jump back to current time',
  play: '▶ Play',
  pause: '⏸ Pause',
  loading: 'Loading...',
  noData: 'Data unavailable',
  noForecastData: 'No forecast data',
  noRain12h: 'No precipitation expected in the next 12h',
  noRain: 'No precipitation',
  noRainRisk: (prob) => `No rain · ${prob}% chance`,
  veryLightRain: (v) => `Very light rain · ${v.toFixed(1)} mm/h`,
  lightRain: (v) => `Light rain · ${v.toFixed(1)} mm/h`,
  moderateRain: (v) => `Moderate rain · ${v.toFixed(1)} mm/h`,
  heavyRain: (v) => `Heavy rain · ${v.toFixed(1)} mm/h`,
  veryHeavyRain: (v) => `Very heavy rain · ${v.toFixed(1)} mm/h`,
  probSuffix: (prob) => ` (${prob}%)`,
  placeNotFound: 'Place not found',
  searchError: 'Search error',
  radarUnavailable: 'Radar not available in this region',
  geolocDenied: 'Geolocation denied',
  geolocUnavailable: 'Position unavailable',
  geolocTimeout: 'Geolocation timed out',
  geolocError: 'Geolocation error',
  geolocNotSupported: 'Geolocation not supported by this browser',
  initError: 'Initialization error',
  searchPlaceHint: (err) => `${err} — search for a place`,
  estimatedForecast: 'Estimated forecast',
};

export const t = isFrench ? fr : en;
