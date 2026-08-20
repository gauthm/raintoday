import { test, assert, assertEq, assertApprox } from './test-runner.js';
import { mapValueToHeight, findNearestIndex, formatTimeLabel } from './graph.js';

test('mapValueToHeight returns minimum height for 0 mm/h', () => {
  const h = mapValueToHeight(0, 100);
  assertApprox(h, 2, 1); // minimum height
});

test('mapValueToHeight is monotonic (log scale is sublinear)', () => {
  const h0 = mapValueToHeight(5, 100);
  const h1 = mapValueToHeight(10, 100);
  assert(h1 > h0, '10mm/h should be taller than 5mm/h');
  // Log scale is sublinear: doubling input does NOT double height
  assert(h1 < h0 * 2, '10mm/h height should be less than double 5mm/h (log scale)');
});

test('mapValueToHeight caps at max height', () => {
  const h = mapValueToHeight(100, 50);
  assert(h <= 50, `Height ${h} should not exceed max 50`);
});

test('mapValueToHeight uses logarithmic scale', () => {
  // Log scale: 0.5 and 20 should both map to reasonable portions of height
  const hLow = mapValueToHeight(0.5, 100);
  const hHigh = mapValueToHeight(20, 100);
  assert(hLow > 2, '0.5 mm/h should be visible');
  assert(hHigh < 100, '20 mm/h should not max out');
  assert(hHigh > hLow, '20 > 0.5');
});

test('mapValueToHeight auto-scales with maxValue', () => {
  // With maxValue=1, 0.5 should be much more visible than with maxValue=60
  const hDefault = mapValueToHeight(0.5, 100);
  const hAutoScaled = mapValueToHeight(0.5, 100, 1);
  assert(hAutoScaled > hDefault, 'Auto-scaled 0.5 should be taller than default');
  assert(hAutoScaled > 20, 'Auto-scaled 0.5 should be clearly visible (>20px)');
});

test('mapValueToHeight with maxValue makes low values readable', () => {
  const h = mapValueToHeight(0.1, 80, 0.5);
  assert(h > 10, `0.1 mm/h with max 0.5 should be > 10px, got ${h}`);
});

test('findNearestIndex finds exact match', () => {
  const data = [
    { time: '2026-08-20T14:00Z', value: 0 },
    { time: '2026-08-20T14:15Z', value: 0.5 },
    { time: '2026-08-20T14:30Z', value: 1.0 },
  ];
  const idx = findNearestIndex(data, new Date('2026-08-20T14:15Z'));
  assertEq(idx, 1);
});

test('findNearestIndex finds nearest when no exact match', () => {
  const data = [
    { time: '2026-08-20T14:00Z', value: 0 },
    { time: '2026-08-20T14:15Z', value: 0.5 },
    { time: '2026-08-20T14:30Z', value: 1.0 },
  ];
  const idx = findNearestIndex(data, new Date('2026-08-20T14:05Z'));
  assertEq(idx, 0); // 5min from 14:00, 10min from 14:15
});

test('findNearestIndex returns -1 for empty data', () => {
  const idx = findNearestIndex([], new Date('2026-08-20T14:00Z'));
  assertEq(idx, -1);
});

test('formatTimeLabel formats as HH:MM', () => {
  const label = formatTimeLabel('2026-08-20T14:30Z');
  // Time will be in local timezone, just check format
  assert(label.length === 5 && label[2] === ':', `Expected HH:MM format, got ${label}`);
});
