import { test, assert, assertArrayLen } from './test-runner.js';
import { fetchRadarFrames, buildTileUrl, selectFrames } from './api/rainviewer.js';

test('buildTileUrl produces correct URL format', () => {
  const url = buildTileUrl('https://tilecache.rainviewer.com', 1700000000, 10, 5, 3, { color: 2, size: 256 });
  assert(
    url === 'https://tilecache.rainviewer.com/v2/radar/1700000000/256/10/5/3/2/0_0.png',
    `Unexpected URL: ${url}`
  );
});

test('buildTileUrl with smooth option', () => {
  const url = buildTileUrl('https://tilecache.rainviewer.com', 1700000000, 10, 5, 3, { color: 2, size: 256, smooth: 1, snow: 1 });
  assert(
    url === 'https://tilecache.rainviewer.com/v2/radar/1700000000/256/10/5/3/2/1_1.png',
    `Unexpected URL: ${url}`
  );
});

test('selectFrames returns frames within 2h past + 30min future', () => {
  const now = Math.floor(Date.now() / 1000);
  const past = [
    now - 7200,  // 2h ago — should be included (boundary)
    now - 5400,  // 1.5h ago
    now - 3600,  // 1h ago
    now - 1800,  // 30min ago
    now - 600,   // 10min ago
  ];
  const future = [
    now + 600,   // +10min
    now + 1800,  // +30min — should be included (boundary)
  ];

  const frames = selectFrames(past, future, now);
  // All should be within range: 2h past to +30min future
  for (const ts of frames) {
    assert(ts >= now - 7200 && ts <= now + 1800, `Timestamp ${ts} out of range`);
  }
  assertArrayLen(frames, 7, `Expected 7 frames, got ${frames.length}`);
});

test('selectFrames filters out-of-range timestamps', () => {
  const now = Math.floor(Date.now() / 1000);
  const past = [
    now - 10800, // 3h ago — should be excluded
    now - 3600,  // 1h ago — included
  ];
  const future = [
    now + 600,   // +10min — included
    now + 3600,  // +1h — excluded
  ];

  const frames = selectFrames(past, future, now);
  assertArrayLen(frames, 2, `Expected 2 frames, got ${frames.length}`);
});

test('selectFrames returns empty for empty inputs', () => {
  const frames = selectFrames([], [], Math.floor(Date.now() / 1000));
  assertArrayLen(frames, 0);
});

test('selectFrames returns sorted array', () => {
  const now = Math.floor(Date.now() / 1000);
  const past = [now - 600, now - 3600, now - 1800];
  const future = [now + 1200, now + 600];

  const frames = selectFrames(past, future, now);
  for (let i = 1; i < frames.length; i++) {
    assert(frames[i] >= frames[i - 1], `Not sorted at index ${i}: ${frames[i]} < ${frames[i-1]}`);
  }
});
