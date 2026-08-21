/**
 * Graph module — Canvas-based bar chart for precipitation data.
 */
import { colorForPrecipitation } from './api/openmeteo.js';

/**
 * Map a precipitation value (mm/h) to a bar height using logarithmic scale.
 * @param {number} mmh - Precipitation in mm/h
 * @param {number} maxHeight - Max bar height in pixels
 * @param {number} maxValue - Max value in dataset for auto-scaling (default 60)
 * @returns {number} Bar height in pixels (min 2px)
 */
export function mapValueToHeight(mmh, maxHeight, maxValue = 60) {
  if (mmh <= 0) return 2; // minimum visible height
  // Logarithmic scale relative to maxValue
  const logVal = Math.log10(mmh + 1);
  const logMax = Math.log10(maxValue + 1);
  const height = (logVal / logMax) * maxHeight;
  return Math.max(2, Math.min(maxHeight, height));
}

/**
 * Find the index in data array nearest to the target time.
 * @param {Array<{time: string, value: number}>} data
 * @param {Date} targetTime
 * @returns {number} Index or -1 if empty
 */
export function findNearestIndex(data, targetTime) {
  if (data.length === 0) return -1;
  const targetMs = targetTime.getTime();
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < data.length; i++) {
    const diff = Math.abs(new Date(data[i].time).getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Format an ISO time string as HH:MM.
 * @param {string} isoTime - ISO time string
 * @returns {string} Formatted time
 */
export function formatTimeLabel(isoTime) {
  const d = new Date(isoTime);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Render the precipitation bar chart on a canvas.
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array<{time: string, value: number}>} data - Precipitation data
 * @param {number} currentIndex - Index of the currently selected time
 */
export function renderGraph(canvas, data, currentIndex) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (data.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Données indisponibles', cssWidth / 2, cssHeight / 2);
    return;
  }

  if (data.length > 0) {
    const maxVal = Math.max(...data.map(d => d.value));
    console.debug('[graph] data points:', data.length, 'max value:', maxVal, 'current idx:', currentIndex, 'value:', data[currentIndex]?.value);
  }

  // Auto-scale: use max value in data, with a floor of 1 mm/h
  const dataMax = Math.max(...data.map(d => d.value));
  const maxValue = Math.max(1, dataMax);

  const barCount = data.length;
  const maxHeight = cssHeight - 8;

  // Bar width: distance between two slider positions, minus gap
  // Slider maps index i to (i / (barCount - 1)) * cssWidth
  const slotWidth = barCount > 1 ? cssWidth / (barCount - 1) : cssWidth;
  const gap = 2;
  const barWidth = Math.max(1, slotWidth - gap);

  // Find "now" index (the frame closest to current time)
  const now = new Date();
  const nowIdx = findNearestIndex(data, now);

  for (let i = 0; i < barCount; i++) {
    const value = data[i].value;
    const height = mapValueToHeight(value, maxHeight, maxValue);
    // Center bar on slider position: (i / (barCount - 1)) * cssWidth
    const centerX = barCount > 1 ? (i / (barCount - 1)) * cssWidth : cssWidth / 2;
    const x = centerX - barWidth / 2;
    const y = cssHeight - height;

    const color = colorForPrecipitation(value);

    if (i === currentIndex) {
      // Current bar: full opacity + glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.globalAlpha = 1.0;
      ctx.fillRect(x, y, barWidth, height);
      ctx.shadowBlur = 0;
    } else {
      // Past bars: 0.5 opacity, future bars: 0.7 opacity
      ctx.globalAlpha = i < nowIdx ? 0.5 : 0.7;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, height);
    }
  }

  ctx.globalAlpha = 1.0;
}

/**
 * Render time labels under the graph.
 * @param {HTMLElement} container - The #time-labels element
 * @param {Array<{time: string, value: number}>} data - Precipitation data
 */
export function renderTimeLabels(container, data) {
  if (data.length === 0) {
    container.innerHTML = '';
    return;
  }
  const labels = [
    formatTimeLabel(data[0].time),
    data.length > 2 ? formatTimeLabel(data[Math.floor(data.length / 2)].time) : '',
    formatTimeLabel(data[data.length - 1].time),
  ];
  container.innerHTML = labels.map(l => `<span>${l}</span>`).join('');
}
