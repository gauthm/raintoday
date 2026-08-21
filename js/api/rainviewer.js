/**
 * RainViewer API module
 * Fetches radar frame timestamps and builds tile URLs.
 */

const RAINVIEWER_API = 'https://api.librewxr.net/public/weather-maps.json';

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
 * @returns {Promise<{host: string, past: Array<{time: number, path: string}>, future: Array<{time: number, path: string}>}>}
 */
export async function fetchRadarFrames() {
  const res = await fetchWithRetry(RAINVIEWER_API);
  const data = await res.json();
  const host = data.host;
  const past = (data.radar && data.radar.past) ? data.radar.past.map(f => ({ time: f.time, path: f.path })) : [];
  const future = (data.radar && data.radar.nowcast) ? data.radar.nowcast.map(f => ({ time: f.time, path: f.path })) : [];
  return { host, past, future };
}

/**
 * Build a RainViewer radar tile URL template for Leaflet.
 * Uses the frame's path (hash) for reliable tile access.
 * @param {string} host - RainViewer tile host
 * @param {string} path - Frame path (e.g. /v2/radar/abc123)
 * @param {object} options - { color: number, size: number, smooth: number, snow: number }
 * @returns {string} Leaflet tile URL template with {z}/{x}/{y} placeholders
 */
export function buildTileUrl(host, path, options = {}) {
  const color = options.color ?? 2;
  const size = options.size ?? 256;
  const smooth = options.smooth ?? 0;
  const snow = options.snow ?? 0;
  return `${host}${path}/${size}/{z}/{x}/{y}/${color}/${smooth}_${snow}.png`;
}

/**
 * Select frames within 2h past + 30min future window.
 * Returns sorted array of frame objects.
 * @param {Array<{time: number, path: string}>} past - Past frames
 * @param {Array<{time: number, path: string}>} future - Future frames
 * @param {number} now - Current Unix timestamp (seconds)
 * @returns {Array<{time: number, path: string}>} Sorted frames within range
 */
export function selectFrames(past, future, now) {
  const minTime = now - 7200;  // 2h ago
  const maxTime = now + 7200;  // 2h future

  const all = [...past, ...future]
    .filter(f => f.time >= minTime && f.time <= maxTime)
    .sort((a, b) => a.time - b.time);

  return all;
}
