/**
 * Slider module — Unified time slider with drag, play/pause animation.
 */
import { t } from './i18n.js';

/**
 * Convert a timestamp to a percentage of the [start, end] range.
 * @param {number} time - Unix timestamp (seconds)
 * @param {number} start - Range start (seconds)
 * @param {number} end - Range end (seconds)
 * @returns {number} Percentage 0-100
 */
export function timeToPercent(time, start, end) {
  if (end === start) return 0;
  return ((time - start) / (end - start)) * 100;
}

/**
 * Convert a percentage to a timestamp within [start, end].
 * @param {number} percent - 0-100
 * @param {number} start - Range start (seconds)
 * @param {number} end - Range end (seconds)
 * @returns {number} Unix timestamp (seconds)
 */
export function percentToTime(percent, start, end) {
  return start + (percent / 100) * (end - start);
}

/**
 * Snap a timestamp to the nearest interval.
 * @param {number} time - Unix timestamp (seconds)
 * @param {number} interval - Interval in seconds
 * @returns {number} Snapped timestamp
 */
export function snapToInterval(time, interval) {
  return Math.round(time / interval) * interval;
}

/**
 * Find the index of the frame nearest to the target time.
 * @param {Array<{time: number}>} frames - Sorted array of frame objects
 * @param {number} targetTime - Target timestamp
 * @returns {number} Index or -1
 */
export function findNearestFrame(frames, targetTime) {
  if (frames.length === 0) return -1;
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < frames.length; i++) {
    const diff = Math.abs(frames[i].time - targetTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Clamp a value to [min, max].
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Format a Unix timestamp (seconds) as HH:MM in local timezone.
 * @param {number} ts - Unix timestamp in seconds
 * @returns {string} Formatted time
 */
function formatTickTime(ts) {
  const date = new Date(ts * 1000);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Render tick marks with time labels under the slider.
 * @param {HTMLElement} ticksEl - The #slider-ticks container
 * @param {Array<{time: number}>} frames - Sorted frames
 */
function renderTicks(ticksEl, frames) {
  ticksEl.innerHTML = '';
  const total = frames.length;
  if (total === 0) return;

  for (let i = 0; i < total; i++) {
    const pct = timeToPercent(frames[i].time, frames[0].time, frames[total - 1].time);
    const date = new Date(frames[i].time * 1000);
    const minutes = date.getMinutes();
    const isLabel = (minutes % 30 === 0);

    const tick = document.createElement('div');
    tick.className = isLabel ? 'slider-tick' : 'slider-tick-minor';
    tick.style.left = pct + '%';
    tick.style.transform = 'translateX(-50%)';

    if (isLabel) {
      const label = document.createElement('span');
      label.className = 'slider-tick-label';
      label.textContent = formatTickTime(frames[i].time);
      tick.appendChild(label);
    }

    ticksEl.appendChild(tick);
  }
}

/**
 * Initialize the time slider with drag and play/pause.
 * @param {object} options - { frames, onTimeChange, onPlayStateChange }
 *   frames: Array<{time: number, path: string}> (sorted by time)
 *   onTimeChange: (frameIndex) => void
 *   onPlayStateChange: (isPlaying) => void
 * @returns {object} { setFrame, play, pause, destroy }
 */
export function initSlider(options) {
  const { frames, onTimeChange, onPlayStateChange, onDragEnd } = options;

  const track = document.getElementById('slider-track');
  const fill = document.getElementById('slider-fill');
  const handle = document.getElementById('slider-handle');
  const playBtn = document.getElementById('play-btn');
  const ticksEl = document.getElementById('slider-ticks');

  let currentIdx = 0;
  let isPlaying = false;
  let animationTimer = null;

  if (frames.length === 0) {
    return { setFrame: () => {}, play: () => {}, pause: () => {}, destroy: () => {} };
  }

  const startTime = frames[0].time;
  const endTime = frames[frames.length - 1].time;
  const interval = 600; // 10min snap

  // Render tick marks with time labels
  renderTicks(ticksEl, frames);

  function updateUI() {
    const trackWidth = track.offsetWidth;
    if (trackWidth === 0) { requestAnimationFrame(updateUI); return; }

    const pct = timeToPercent(frames[currentIdx].time, startTime, endTime);

    fill.style.width = pct + '%';
    handle.style.left = pct + '%';
  }

  function setIndex(idx) {
    currentIdx = clamp(idx, 0, frames.length - 1);
    updateUI();
    if (onTimeChange) onTimeChange(currentIdx);
  }

  function setFrame(idx) {
    setIndex(idx);
  }

  function percentFromMouseEvent(e) {
    const rect = track.getBoundingClientRect();
    return clamp((e.clientX - rect.left) / rect.width * 100, 0, 100);
  }

  function percentFromTouchEvent(e) {
    const rect = track.getBoundingClientRect();
    return clamp((e.touches[0].clientX - rect.left) / rect.width * 100, 0, 100);
  }

  function percentToIndex(pct) {
    const time = percentToTime(pct, startTime, endTime);
    const snapped = snapToInterval(time, interval);
    return findNearestFrame(frames, snapped);
  }

  // Drag handling
  let isDragging = false;

  function onPointerMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const pct = e.touches ? percentFromTouchEvent(e) : percentFromMouseEvent(e);
    const idx = percentToIndex(pct);
    setIndex(idx);
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    handle.classList.remove('dragging');
    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchend', onPointerUp);
    if (onDragEnd) onDragEnd(currentIdx);
  }

  function onPointerDown(e) {
    e.preventDefault();
    isDragging = true;
    handle.classList.add('dragging');
    const pct = e.touches ? percentFromTouchEvent(e) : percentFromMouseEvent(e);
    const idx = percentToIndex(pct);
    setIndex(idx);
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
  }

  track.addEventListener('mousedown', onPointerDown);
  track.addEventListener('touchstart', onPointerDown, { passive: false });

  // Play/pause
  function play() {
    if (isPlaying) return;
    isPlaying = true;
    playBtn.textContent = t.pause;
    if (onPlayStateChange) onPlayStateChange(true);

    // Start from beginning if at end
    if (currentIdx >= frames.length - 1) {
      setIndex(0);
    }

    animationTimer = setInterval(() => {
      if (currentIdx >= frames.length - 1) {
        pause();
        return;
      }
      setIndex(currentIdx + 1);
    }, 500); // 500ms per frame
  }

  function pause() {
    if (!isPlaying) return;
    isPlaying = false;
    playBtn.textContent = t.play;
    if (onPlayStateChange) onPlayStateChange(false);
    if (animationTimer) {
      clearInterval(animationTimer);
      animationTimer = null;
    }
  }

  playBtn.addEventListener('click', () => {
    if (isPlaying) pause();
    else play();
  });

  // Init UI
  updateUI();

  return {
    setFrame,
    play,
    pause,
    isPlaying: () => isPlaying,
    destroy: () => {
      pause();
      track.removeEventListener('mousedown', onPointerDown);
      track.removeEventListener('touchstart', onPointerDown);
    },
  };
}
