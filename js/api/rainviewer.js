/**
 * RainViewer API module
 * Fetches radar frame timestamps and builds tile URLs.
 */

const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';

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
 * Fetch available radar frames from RainViewer.
 * @returns {Promise<{host: string, past: number[], future: number[]}>}
 */
export async function fetchRadarFrames() {
  const res = await fetchWithRetry(RAINVIEWER_API);
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
