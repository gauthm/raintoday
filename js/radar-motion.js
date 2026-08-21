/**
 * radar-motion.js
 * Computes actual precipitation motion vector from 2 consecutive radar frames
 * using block matching (simplified optical flow) on canvas tiles.
 * This replaces wind-based extrapolation with real radar-measured movement.
 */

const MOTION_ZOOM = 5;

function latLonToTile(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const tileX = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const mercY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  const tileY = Math.floor(mercY * n);
  return { tileX, tileY };
}

function loadTilePixels(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.getContext('2d').getImageData(0, 0, 256, 256));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function blockSAD(data1, data2, x1, y1, x2, y2, blockSize) {
  const W = 256;
  let sad = 0;
  let count = 0;
  for (let dy = 0; dy < blockSize; dy++) {
    for (let dx = 0; dx < blockSize; dx++) {
      const nx2 = x2 + dx;
      const ny2 = y2 + dy;
      if (nx2 < 0 || nx2 >= W || ny2 < 0 || ny2 >= W) { sad += 255 * 3; count++; continue; }
      const i1 = ((y1 + dy) * W + (x1 + dx)) * 4;
      const i2 = (ny2 * W + nx2) * 4;
      if (data1[i1 + 3] < 10 && data2[i2 + 3] < 10) continue;
      sad += Math.abs(data1[i1]     - data2[i2]);
      sad += Math.abs(data1[i1 + 1] - data2[i2 + 1]);
      sad += Math.abs(data1[i1 + 2] - data2[i2 + 2]);
      count++;
    }
  }
  return count === 0 ? Infinity : sad / count;
}

/**
 * Compute the dominant motion vector between two radar frames.
 *
 * @param {string} host          - RainViewer tile host
 * @param {string} pathOld       - Older frame path
 * @param {string} pathNew       - Newer frame path
 * @param {number} timeDeltaSec  - Time between the two frames (seconds)
 * @param {number} lat           - User latitude
 * @param {number} lon           - User longitude
 * @returns {Promise<{speedKmh: number, directionDeg: number} | null>}
 *          Direction = where clouds are moving TO (degrees CW from North).
 *          Returns null if CORS blocks access or no rain detected.
 */
export async function computeRadarMotion(host, pathOld, pathNew, timeDeltaSec, lat, lon) {
  const { tileX, tileY } = latLonToTile(lat, lon, MOTION_ZOOM);

  const urlOld = `${host}${pathOld}/256/${MOTION_ZOOM}/${tileX}/${tileY}/2/0_0.png`;
  const urlNew = `${host}${pathNew}/256/${MOTION_ZOOM}/${tileX}/${tileY}/2/0_0.png`;

  const [pxOld, pxNew] = await Promise.all([
    loadTilePixels(urlOld),
    loadTilePixels(urlNew),
  ]);

  if (!pxOld || !pxNew) {
    console.warn('[radar-motion] CORS blocked pixel access, falling back to wind');
    return null;
  }

  const BLOCK  = 16;
  const RADIUS = 24;
  const SAD_THRESHOLD = 25;

  const vectors = [];

  for (let by = RADIUS; by < 256 - RADIUS - BLOCK; by += BLOCK) {
    for (let bx = RADIUS; bx < 256 - RADIUS - BLOCK; bx += BLOCK) {

      let hasRain = false;
      for (let py = 0; py < BLOCK && !hasRain; py++) {
        for (let px = 0; px < BLOCK && !hasRain; px++) {
          if (pxOld.data[((by + py) * 256 + (bx + px)) * 4 + 3] > 10) hasRain = true;
        }
      }
      if (!hasRain) continue;

      let bestDx = 0, bestDy = 0, bestSad = Infinity;
      for (let dy = -RADIUS; dy <= RADIUS; dy++) {
        for (let dx = -RADIUS; dx <= RADIUS; dx++) {
          const sad = blockSAD(pxOld.data, pxNew.data, bx, by, bx + dx, by + dy, BLOCK);
          if (sad < bestSad) { bestSad = sad; bestDx = dx; bestDy = dy; }
        }
      }

      if (bestSad < SAD_THRESHOLD) {
        vectors.push({ dx: bestDx, dy: bestDy });
      }
    }
  }

  if (vectors.length < 3) {
    console.warn('[radar-motion] Not enough matched blocks:', vectors.length);
    return null;
  }

  const sortedDx = [...vectors].sort((a, b) => a.dx - b.dx);
  const sortedDy = [...vectors].sort((a, b) => a.dy - b.dy);
  const mid = Math.floor(vectors.length / 2);
  const medDx = sortedDx[mid].dx;
  const medDy = sortedDy[mid].dy;

  const tileWidthKm = (40075 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, MOTION_ZOOM);
  const kmPerPixel  = tileWidthKm / 256;

  const dxKm = medDx * kmPerPixel;
  const dyKm = -medDy * kmPerPixel;

  const distKm  = Math.sqrt(dxKm * dxKm + dyKm * dyKm);
  const speedKmh = distKm / (timeDeltaSec / 3600);

  const directionDeg = (Math.atan2(dxKm, dyKm) * 180 / Math.PI + 360) % 360;

  console.log(`[radar-motion] ${vectors.length} blocks matched | speed=${speedKmh.toFixed(1)}km/h dir=${directionDeg.toFixed(0)}° (from ${vectors.length} vectors)`);

  return { speedKmh, directionDeg };
}
