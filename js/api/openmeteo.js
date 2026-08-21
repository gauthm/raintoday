/**
 * Open-Meteo API module
 * Fetches precipitation data and geocoding search results.
 */

const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';

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

/**
 * Build the Open-Meteo forecast API URL for precipitation.
 * Uses minutely_15 for past + hourly for future forecast.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} Full API URL
 */
export function buildPrecipitationUrl(lat, lon) {
  return `${OPEN_METEO_FORECAST}?latitude=${lat}&longitude=${lon}` +
    `&minutely_15=precipitation&past_days=1&forecast_days=1` +
    `&hourly=precipitation,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_speed_850hPa,wind_direction_850hPa&past_days=1&forecast_days=3` +
    `&timezone=UTC`;
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
 * Returns merged 15-min past data + hourly forecast interpolated to 15-min.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<{data: Array<{time: string, value: number, probability: number}>, wind: {speed: number, direction: number}}>}
 */
export async function fetchPrecipitation(lat, lon) {
  const url = buildPrecipitationUrl(lat, lon);
  const res = await fetchWithRetry(url);
  const data = await res.json();
  const precip = parsePrecipitation(data);
  const wind = extractCurrentWind(data);
  return { data: precip, wind };
}

/**
 * Search for places using Open-Meteo geocoding.
 * @param {string} query - Search query
 * @returns {Promise<Array<{name: string, lat: number, lon: number, country: string, admin1: string}>>}
 */
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

/**
 * Reverse geocode coordinates to a place name using Nominatim (OpenStreetMap).
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string|null>} Place name or null
 */
export async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr&zoom=10`;
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.address) {
      const name = data.address.city || data.address.town || data.address.village || data.address.county || data.name || '';
      const state = data.address.state || '';
      const country = data.address.country || '';
      const parts = [name];
      if (state && state !== name) parts.push(state);
      if (country) parts.push(country);
      return parts.join(', ') || data.display_name || null;
    }
    return data.display_name || null;
  } catch {
    return null;
  }
}

/**
 * Extract current wind speed and direction from Open-Meteo hourly data.
 * Wind direction is where wind comes FROM (meteorological convention).
 * @param {object} data - Raw API response
 * @returns {{speed: number, direction: number}} Wind speed in km/h, direction in degrees
 */
export function extractCurrentWind(data) {
  if (!data.hourly || !data.hourly.time) return { speed: 0, direction: 0 };
  const nowMs = Date.now();
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < data.hourly.time.length; i++) {
    const diff = Math.abs(new Date(data.hourly.time[i] + 'Z').getTime() - nowMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  const speed850 = data.hourly.wind_speed_850hPa?.[bestIdx];
  const dir850   = data.hourly.wind_direction_850hPa?.[bestIdx];
  const speed10  = data.hourly.wind_speed_10m?.[bestIdx] ?? 0;
  const dir10    = data.hourly.wind_direction_10m?.[bestIdx] ?? 0;

  return {
    speed:     (speed850 != null && speed850 > 0) ? speed850 : speed10,
    direction: (dir850   != null && speed850 > 0) ? dir850   : dir10,
  };
}

/**
 * Parse Open-Meteo response into merged timeline.
 * Past: 15-min resolution. Future: hourly interpolated to 15-min.
 * @param {object} data - Raw API response
 * @returns {Array<{time: string, value: number, probability: number}>}
 */
export function parsePrecipitation(data) {
  const result = [];

  // 15-min past data
  if (data.minutely_15) {
    const { time, precipitation } = data.minutely_15;
    if (time && precipitation) {
      for (let i = 0; i < time.length; i++) {
        result.push({
          time: time[i] + 'Z',
          value: precipitation[i] ?? 0,
          probability: 0,
        });
      }
    }
  }

  // Hourly forecast — merge in future data not covered by 15-min
  if (data.hourly) {
    const { time, precipitation, precipitation_probability } = data.hourly;
    if (time && precipitation) {
      // Build set of existing 15-min timestamps (as epoch ms)
      const existing = new Set(result.map(r => new Date(r.time).getTime()));

      // Find last 15-min timestamp
      let lastMs = 0;
      for (const r of result) {
        const ms = new Date(r.time).getTime();
        if (ms > lastMs) lastMs = ms;
      }

      for (let i = 0; i < time.length; i++) {
        const hourMs = new Date(time[i] + 'Z').getTime();

        // Only add future hours beyond 15-min data
        if (hourMs > lastMs) {
          const value = precipitation[i] ?? 0;
          const prob = precipitation_probability ? (precipitation_probability[i] ?? 0) : 0;

          // Add 4 x 15-min slots per hour (interpolated)
          for (let q = 0; q < 4; q++) {
            const slotMs = hourMs + q * 15 * 60 * 1000;
            if (!existing.has(slotMs)) {
              const slotDate = new Date(slotMs);
              const iso = slotDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
              const slotProb = q === 0 ? prob : Math.round(prob * (1 - q * 0.15));
              result.push({
                time: iso,
                value: value * (1 - q * 0.2),
                probability: Math.max(0, slotProb),
              });
            }
          }
        }
      }
    }
  }

  // Sort by time
  result.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return result;
}

/**
 * Extract a 2h past + 2h future window from precipitation data.
 * @param {Array<{time: string, value: number}>} data - Full precipitation data
 * @param {Date} now - Reference time
 * @returns {Array<{time: string, value: number, probability: number}>}
 */
export function extractWindow(data, now) {
  const nowMs = now.getTime();
  const minMs = nowMs - 2 * 3600 * 1000;   // 2h ago
  const maxMs = nowMs + 2 * 3600 * 1000;    // 2h future

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
