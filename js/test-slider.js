import { test, assert, assertEq, assertApprox } from './test-runner.js';
import { timeToPercent, percentToTime, snapToInterval, findNearestFrame, clamp } from './slider.js';

test('timeToPercent returns 0 for start time', () => {
  const start = 1700000000;
  const end = 1700009000;
  const pct = timeToPercent(start, start, end);
  assertApprox(pct, 0, 0.01);
});

test('timeToPercent returns 100 for end time', () => {
  const start = 1700000000;
  const end = 1700009000;
  const pct = timeToPercent(end, start, end);
  assertApprox(pct, 100, 0.01);
});

test('timeToPercent returns 50 for midpoint', () => {
  const start = 1700000000;
  const end = 1700009000;
  const pct = timeToPercent((start + end) / 2, start, end);
  assertApprox(pct, 50, 0.01);
});

test('percentToTime is inverse of timeToPercent', () => {
  const start = 1700000000;
  const end = 1700009000;
  const time = 1700004500;
  const pct = timeToPercent(time, start, end);
  const back = percentToTime(pct, start, end);
  assertApprox(back, time, 1);
});

test('snapToInterval rounds to nearest 10min', () => {
  const snapped = snapToInterval(1700000350, 600);
  assertEq(snapped, 1700000400);
});

test('snapToInterval rounds down when closer', () => {
  const snapped = snapToInterval(1700000050, 600);
  assertEq(snapped, 1699999800);
});

test('findNearestFrame returns closest frame index', () => {
  const frames = [
    { time: 1700000000, path: '/a' },
    { time: 1700000600, path: '/b' },
    { time: 1700001200, path: '/c' },
    { time: 1700001800, path: '/d' },
  ];
  const idx = findNearestFrame(frames, 1700001000);
  assertEq(idx, 2);
});

test('findNearestFrame returns -1 for empty array', () => {
  const idx = findNearestFrame([], 1700001000);
  assertEq(idx, -1);
});

test('clamp constrains value to range', () => {
  assertEq(clamp(5, 0, 10), 5);
  assertEq(clamp(-1, 0, 10), 0);
  assertEq(clamp(15, 0, 10), 10);
});
