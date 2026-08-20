import { test, assert, assertArrayLen } from './test-runner.js';
import { fetchRadarFrames, buildTileUrl, selectFrames } from './api/rainviewer.js';

test('buildTileUrl produces correct URL with path', () => {
  const url = buildTileUrl('https://tilecache.rainviewer.com', '/v2/radar/abc123', { color: 2, size: 256 });
  assert(
    url === 'https://tilecache.rainviewer.com/v2/radar/abc123/256/{z}/{x}/{y}/2/0_0.png',
    `Unexpected URL: ${url}`
  );
});

test('buildTileUrl with smooth option', () => {
  const url = buildTileUrl('https://tilecache.rainviewer.com', '/v2/radar/abc123', { color: 2, size: 256, smooth: 1, snow: 1 });
  assert(
    url === 'https://tilecache.rainviewer.com/v2/radar/abc123/256/{z}/{x}/{y}/2/1_1.png',
    `Unexpected URL: ${url}`
  );
});

test('selectFrames returns frames within 3h past + 3h future', () => {
  const now = Math.floor(Date.now() / 1000);
  const past = [
    { time: now - 10800, path: '/v2/radar/a' },
    { time: now - 7200, path: '/v2/radar/b' },
    { time: now - 3600, path: '/v2/radar/c' },
    { time: now - 1800, path: '/v2/radar/d' },
    { time: now - 600, path: '/v2/radar/e' },
  ];
  const future = [
    { time: now + 600, path: '/v2/radar/f' },
    { time: now + 10800, path: '/v2/radar/g' },
  ];

  const frames = selectFrames(past, future, now);
  for (const f of frames) {
    assert(f.time >= now - 10800 && f.time <= now + 10800, `Timestamp ${f.time} out of range`);
  }
  assertArrayLen(frames, 7, `Expected 7 frames, got ${frames.length}`);
});

test('selectFrames filters out-of-range timestamps', () => {
  const now = Math.floor(Date.now() / 1000);
  const past = [
    { time: now - 14400, path: '/v2/radar/a' },
    { time: now - 3600, path: '/v2/radar/b' },
  ];
  const future = [
    { time: now + 600, path: '/v2/radar/c' },
    { time: now + 14400, path: '/v2/radar/d' },
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
  const past = [
    { time: now - 600, path: '/v2/radar/a' },
    { time: now - 3600, path: '/v2/radar/b' },
    { time: now - 1800, path: '/v2/radar/c' },
  ];
  const future = [
    { time: now + 1200, path: '/v2/radar/d' },
    { time: now + 600, path: '/v2/radar/e' },
  ];

  const frames = selectFrames(past, future, now);
  for (let i = 1; i < frames.length; i++) {
    assert(frames[i].time >= frames[i - 1].time, `Not sorted at index ${i}: ${frames[i].time} < ${frames[i-1].time}`);
  }
});
