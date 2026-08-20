/**
 * Slider module — Unified time slider with drag, play/pause animation.
 */

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
 * @param {number[]} frames - Sorted array of timestamps
 * @param {number} targetTime - Target timestamp
 * @returns {number} Index or -1
 */
export function findNearestFrame(frames, targetTime) {
  if (frames.length === 0) return -1;
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < frames.length; i++) {
    const diff = Math.abs(frames[i] - targetTime);
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
 * Initialize the time slider with drag and play/pause.
 * @param {object} options - { frames, onTimeChange, onPlayStateChange }
 *   frames: number[] (sorted timestamps in seconds)
 *   onTimeChange: (frameIndex) => void
 *   onPlayStateChange: (isPlaying) => void
 * @returns {object} { setFrame, play, pause, destroy }
 */
export function initSlider(options) {
  const { frames, onTimeChange, onPlayStateChange } = options;

  const track = document.getElementById('slider-track');
  const fill = document.getElementById('slider-fill');
  const handle = document.getElementById('slider-handle');
  const playBtn = document.getElementById('play-btn');

  let currentIdx = 0;
  let isPlaying = false;
  let animationTimer = null;

  if (frames.length === 0) {
    return { setFrame: () => {}, play: () => {}, pause: () => {}, destroy: () => {} };
  }

  const startTime = frames[0];
  const endTime = frames[frames.length - 1];
  const interval = 600; // 10min snap

  function updateUI() {
    const pct = timeToPercent(frames[currentIdx], startTime, endTime);
    fill.style.width = `${pct}%`;
    handle.style.left = `${pct}%`;
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
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    return clamp(pct, 0, 100);
  }

  function percentFromTouchEvent(e) {
    const rect = track.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const pct = (x / rect.width) * 100;
    return clamp(pct, 0, 100);
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
    playBtn.textContent = '⏸ Pause';
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
    playBtn.textContent = '▶ Play';
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
    destroy: () => {
      pause();
      track.removeEventListener('mousedown', onPointerDown);
      track.removeEventListener('touchstart', onPointerDown);
    },
  };
}
