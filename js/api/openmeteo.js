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
