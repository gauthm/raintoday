import { test, assert, assertEq, assertArrayLen, assertApprox } from './test-runner.js';
import { buildPrecipitationUrl, buildGeocodingUrl, parsePrecipitation, extractWindow, colorForPrecipitation } from './api/openmeteo.js';

test('buildPrecipitationUrl produces correct URL', () => {
  const url = buildPrecipitationUrl(48.85, 2.35);
  assert(url.includes('latitude=48.85'), `Missing latitude: ${url}`);
  assert(url.includes('longitude=2.35'), `Missing longitude: ${url}`);
  assert(url.includes('minutely_15=precipitation'), `Missing minutely_15: ${url}`);
});

test('buildGeocodingUrl produces correct URL', () => {
  const url = buildGeocodingUrl('Paris', 5);
  assert(url.includes('name=Paris'), `Missing name: ${url}`);
  assert(url.includes('count=5'), `Missing count: ${url}`);
  assert(url.includes('language=fr'), `Missing language: ${url}`);
});

test('parsePrecipitation returns array of {time, value} objects', () => {
  const mockResponse = {
    minutely_15: {
      time: ['2026-08-20T14:00', '2026-08-20T14:15', '2026-08-20T14:30'],
      precipitation: [0.0, 0.5, 1.2]
    }
  };
  const result = parsePrecipitation(mockResponse);
  assertArrayLen(result, 3);
  assertEq(result[0].time, '2026-08-20T14:00');
  assertEq(result[0].value, 0.0);
  assertEq(result[1].value, 0.5);
  assertEq(result[2].value, 1.2);
});

test('parsePrecipitation returns empty array for missing data', () => {
  const result = parsePrecipitation({});
  assertArrayLen(result, 0);
});

test('extractWindow returns entries within 2h past + 30min future', () => {
  const now = new Date('2026-08-20T15:00');
  const data = [
    { time: '2026-08-20T12:30', value: 0.0 }, // 2.5h ago — excluded
    { time: '2026-08-20T13:00', value: 0.1 }, // 2h ago — included (boundary)
    { time: '2026-08-20T14:00', value: 0.5 }, // 1h ago — included
    { time: '2026-08-20T15:00', value: 1.2 }, // now — included
    { time: '2026-08-20T15:30', value: 0.8 }, // +30min — included (boundary)
    { time: '2026-08-20T16:00', value: 0.0 }, // +1h — excluded
  ];
  const window = extractWindow(data, now);
  assertArrayLen(window, 4, `Expected 4 entries, got ${window.length}`);
});

test('extractWindow returns empty for empty input', () => {
  const now = new Date('2026-08-20T15:00');
  const window = extractWindow([], now);
  assertArrayLen(window, 0);
});

test('colorForPrecipitation returns dark for 0 mm/h', () => {
  const color = colorForPrecipitation(0);
  assertEq(color, '#1a3a5a');
});

test('colorForPrecipitation returns red for heavy rain', () => {
  const color = colorForPrecipitation(50);
  assertEq(color, '#ff3333');
});

test('colorForPrecipitation returns blue for light rain', () => {
  const color = colorForPrecipitation(1.5);
  assert(color === '#2a9ada', `Unexpected color for 1.5 mm/h: ${color}`);
});

test('colorForPrecipitation returns yellow for moderate rain', () => {
  const color = colorForPrecipitation(15);
  assertEq(color, '#ffea00');
});
