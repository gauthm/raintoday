/**
 * Sample precipitation at a lat/lon by reading the pixel color
 * of the RainViewer tile at that position.
 */

const RAINVIEWER_PALETTE = [
  [0,   236, 236, 0.1],
  [1,   160, 246, 0.3],
  [0,   0,   246, 0.7],
  [0,   239, 0,   1.5],
  [0,   200, 0,   3],
  [0,   144, 0,   5],
  [255, 255, 0,   8],
  [231, 192, 0,   12],
  [255, 144, 0,   18],
  [255, 0,   0,   28],
  [214, 0,   0,   40],
  [192, 0,   0,   55],
  [255, 0,   255, 70],
  [153, 85,  201, 90],
];

function colorToMmh(r, g, b, a) {
  if (a < 15) return 0;
  let best = 0;
  let bestDist = Infinity;
  for (const [pr, pg, pb, mmh] of RAINVIEWER_PALETTE) {
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) { bestDist = dist; best = mmh; }
  }
  return bestDist < 15000 ? best : 0;
}

/**
 * @param {string} host
 * @param {string} path
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<number|null>} mm/h, or null if CORS blocked
 */
export async function sampleRadarAtLocation(host, path, lat, lon) {
  const zoom = 6;

  const n = Math.pow(2, zoom);
  const tileX = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const mercY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  const tileY = Math.floor(mercY * n);

  const pixelX = Math.floor(((lon + 180) / 360 * n - tileX) * 256);
  const pixelY = Math.floor((mercY * n - tileY) * 256);

  const url = `${host}${path}/256/${zoom}/${tileX}/${tileY}/2/1_1.png`;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const [r, g, b, a] = ctx.getImageData(pixelX, pixelY, 1, 1).data;
        resolve(colorToMmh(r, g, b, a));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
