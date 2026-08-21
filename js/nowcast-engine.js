/**
 * nowcast-engine.js
 * Dense optical flow + backward semi-Lagrangian warp
 * Replaces CSS translate entirely.
 *
 * Algorithm based on rainymotion/DenseSD + pysteps approach:
 * - Dense block matching between N frame pairs
 * - Temporal averaging of motion fields for stability
 * - Backward warp: for output pixel (x,y), source = (x - dx*t, y - dy*t)
 * - Bilinear interpolation for sub-pixel accuracy
 */

const WARP_ZOOM   = 5;
const BLOCK_SIZE  = 24;
const SEARCH_RAD  = 20;
const MIN_RAIN_ALPHA = 15;

function latLonToTileXY(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

/**
 * Load a 3×3 grid of radar tiles stitched into a single ImageData.
 * Returns { imageData, bounds } where bounds = { north, south, east, west } in degrees.
 */
export async function loadStitchedTile(host, path, lat, lon) {
  const zoom = WARP_ZOOM;
  const center = latLonToTileXY(lat, lon, zoom);
  const n = Math.pow(2, zoom);

  const GRID = 1;
  const gridSize = (2 * GRID + 1) * 256;

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width  = gridSize;
  offscreenCanvas.height = gridSize;
  const ctx = offscreenCanvas.getContext('2d');

  const loads = [];
  for (let dy = -GRID; dy <= GRID; dy++) {
    for (let dx = -GRID; dx <= GRID; dx++) {
      const tx = ((center.x + dx) % n + n) % n;
      const ty = center.y + dy;
      if (ty < 0 || ty >= n) continue;
      const url = `${host}${path}/256/${zoom}/${tx}/${ty}/2/0_0.png`;
      const destX = (dx + GRID) * 256;
      const destY = (dy + GRID) * 256;

      loads.push(new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload  = () => { ctx.drawImage(img, destX, destY); resolve(); };
        img.onerror = () => resolve();
        img.src = url;
      }));
    }
  }

  await Promise.all(loads);

  function tileToLat(ty) {
    const n2 = Math.PI - (2 * Math.PI * ty) / Math.pow(2, zoom);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n2) - Math.exp(-n2)));
  }
  function tileToLon(tx) { return (tx / Math.pow(2, zoom)) * 360 - 180; }

  const bounds = {
    north: tileToLat(center.y - GRID),
    south: tileToLat(center.y + GRID + 1),
    west:  tileToLon(center.x - GRID),
    east:  tileToLon(center.x + GRID + 1),
  };

  try {
    return {
      imageData: ctx.getImageData(0, 0, gridSize, gridSize),
      bounds,
      width: gridSize,
      height: gridSize,
    };
  } catch {
    console.warn('[nowcast] CORS blocked pixel access');
    return null;
  }
}

/**
 * Compute dense motion field between two ImageData frames.
 * Returns Float32Array of length 2 * numBlocksX * numBlocksY.
 */
export function computeMotionField(frame1, frame2, width, height) {
  const d1 = frame1.data;
  const d2 = frame2.data;

  const numBX = Math.ceil(width  / BLOCK_SIZE);
  const numBY = Math.ceil(height / BLOCK_SIZE);
  const field = new Float32Array(numBX * numBY * 2);

  for (let byi = 0; byi < numBY; byi++) {
    for (let bxi = 0; bxi < numBX; bxi++) {
      const originX = bxi * BLOCK_SIZE;
      const originY = byi * BLOCK_SIZE;

      let hasRain = false;
      outer: for (let py = 0; py < BLOCK_SIZE; py++) {
        for (let px = 0; px < BLOCK_SIZE; px++) {
          const ix = originX + px;
          const iy = originY + py;
          if (ix >= width || iy >= height) continue;
          if (d1[((iy * width + ix) * 4) + 3] > MIN_RAIN_ALPHA) {
            hasRain = true;
            break outer;
          }
        }
      }

      const fieldIdx = (byi * numBX + bxi) * 2;
      if (!hasRain) {
        field[fieldIdx] = 0;
        field[fieldIdx + 1] = 0;
        continue;
      }

      let bestDx = 0, bestDy = 0, bestSAD = Infinity;

      for (let sy = -SEARCH_RAD; sy <= SEARCH_RAD; sy++) {
        for (let sx = -SEARCH_RAD; sx <= SEARCH_RAD; sx++) {
          let sad = 0;
          let count = 0;

          for (let py = 0; py < BLOCK_SIZE; py += 2) {
            for (let px = 0; px < BLOCK_SIZE; px += 2) {
              const ix  = originX + px;
              const iy  = originY + py;
              const ix2 = ix + sx;
              const iy2 = iy + sy;

              if (ix  >= width || iy  >= height) continue;
              if (ix2 < 0 || ix2 >= width || iy2 < 0 || iy2 >= height) {
                sad += 255 * 3; count++; continue;
              }

              const i1 = (iy  * width + ix)  * 4;
              const i2 = (iy2 * width + ix2) * 4;

              if (d1[i1 + 3] < MIN_RAIN_ALPHA && d2[i2 + 3] < MIN_RAIN_ALPHA) continue;

              sad += Math.abs(d1[i1]     - d2[i2]);
              sad += Math.abs(d1[i1 + 1] - d2[i2 + 1]);
              sad += Math.abs(d1[i1 + 2] - d2[i2 + 2]);
              count++;
            }
          }

          const avgSAD = count > 0 ? sad / count : Infinity;
          if (avgSAD < bestSAD) {
            bestSAD = avgSAD;
            bestDx = sx;
            bestDy = sy;
          }
        }
      }

      field[fieldIdx]     = bestSAD < 80 ? bestDx : 0;
      field[fieldIdx + 1] = bestSAD < 80 ? bestDy : 0;
    }
  }

  return field;
}

/**
 * Merge N motion fields by taking the median vector at each block position.
 */
export function mergeMotionFields(fields, numBX, numBY) {
  const merged = new Float32Array(numBX * numBY * 2);

  for (let i = 0; i < numBX * numBY; i++) {
    const dxValues = fields.map(f => f[i * 2]);
    const dyValues = fields.map(f => f[i * 2 + 1]);

    dxValues.sort((a, b) => a - b);
    dyValues.sort((a, b) => a - b);

    const mid = Math.floor(fields.length / 2);
    merged[i * 2]     = dxValues[mid];
    merged[i * 2 + 1] = dyValues[mid];
  }

  return merged;
}

function bilinearSample(data, width, height, x, y) {
  x = Math.max(0, Math.min(width  - 1.001, x));
  y = Math.max(0, Math.min(height - 1.001, y));

  const x0 = Math.floor(x), x1 = x0 + 1;
  const y0 = Math.floor(y), y1 = y0 + 1;
  const wx = x - x0, wy = y - y0;

  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;

  const result = new Uint8ClampedArray(4);
  for (let c = 0; c < 4; c++) {
    result[c] = Math.round(
      data[i00 + c] * (1 - wx) * (1 - wy) +
      data[i10 + c] * wx       * (1 - wy) +
      data[i01 + c] * (1 - wx) * wy       +
      data[i11 + c] * wx       * wy
    );
  }
  return result;
}

/**
 * Warp srcImageData forward by timeScale steps using motionField.
 * Uses backward semi-Lagrangian: for each output pixel, trace back to source.
 */
export function backwardWarp(src, field, numBX, timeScale) {
  const { width, height, data } = src;
  const dst = new ImageData(width, height);
  const dstData = dst.data;
  const numBY = Math.ceil(height / BLOCK_SIZE);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bxi = Math.min(Math.floor(x / BLOCK_SIZE), numBX - 1);
      const byi = Math.min(Math.floor(y / BLOCK_SIZE), numBY - 1);
      const fieldIdx = (byi * numBX + bxi) * 2;

      const srcX = x - field[fieldIdx]     * timeScale;
      const srcY = y - field[fieldIdx + 1] * timeScale;

      const color = bilinearSample(data, width, height, srcX, srcY);

      const dstIdx = (y * width + x) * 4;
      dstData[dstIdx]     = color[0];
      dstData[dstIdx + 1] = color[1];
      dstData[dstIdx + 2] = color[2];
      dstData[dstIdx + 3] = color[3];
    }
  }

  return dst;
}

/**
 * Compute nowcast frames from N past radar frames using optical flow.
 *
 * @param {string} host
 * @param {Array<{time, path}>} pastFrames  - At least 2 past frames, sorted ascending
 * @param {number} lat
 * @param {number} lon
 * @param {number} extraFrameCount          - How many extra 10-min frames to generate
 * @returns {Promise<Array<{time, imageData, bounds}>>}
 */
export async function computeNowcastFrames(host, pastFrames, lat, lon, extraFrameCount = 6) {
  const inputFrames = pastFrames.slice(-4);
  if (inputFrames.length < 2) return [];

  console.log(`[nowcast] Loading ${inputFrames.length} frames for motion estimation...`);

  const loaded = await Promise.all(
    inputFrames.map(f => loadStitchedTile(host, f.path, lat, lon))
  );

  const valid = loaded.filter(l => l !== null);
  if (valid.length < 2) {
    console.warn('[nowcast] CORS blocked or tiles unavailable');
    return [];
  }

  const { width, height, bounds } = valid[0];
  const numBX = Math.ceil(width  / BLOCK_SIZE);

  const motionFields = [];
  for (let i = 0; i < valid.length - 1; i++) {
    const field = computeMotionField(valid[i].imageData, valid[i + 1].imageData, width, height);
    motionFields.push(field);
  }

  const stableField = mergeMotionFields(motionFields, numBX, Math.ceil(height / BLOCK_SIZE));

  const lastObservedFrame = valid[valid.length - 1];
  const lastFrameTime = inputFrames[inputFrames.length - 1].time;
  const intervalSec = 10 * 60;

  const nowcastFrames = [];
  for (let t = 1; t <= extraFrameCount; t++) {
    const warped = backwardWarp(lastObservedFrame.imageData, stableField, numBX, t);
    nowcastFrames.push({
      time:      lastFrameTime + t * intervalSec,
      imageData: warped,
      bounds,
    });
  }

  console.log(`[nowcast] Generated ${nowcastFrames.length} extrapolated frames`);
  return nowcastFrames;
}
