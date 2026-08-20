import { test, assert, assertEq, assertArrayLen, assertApprox } from './test-runner.js';
import { buildPrecipitationUrl, buildGeocodingUrl, parsePrecipitation, extractWindow, colorForPrecipitation, extractCurrentWind } from './api/openmeteo.js';

test('buildPrecipitationUrl produces correct URL', () => {
  const url = buildPrecipitationUrl(48.85, 2.35);
  assert(url.includes('latitude=48.85'), `Missing latitude: ${url}`);
  assert(url.includes('longitude=2.35'), `Missing longitude: ${url}`);
  assert(url.includes('minutely_15=precipitation'), `Missing minutely_15: ${url}`);
  assert(url.includes('hourly=precipitation'), `Missing hourly: ${url}`);
  assert(url.includes('wind_speed_10m'), `Missing wind_speed_10m: ${url}`);
  assert(url.includes('wind_direction_10m'), `Missing wind_direction_10m: ${url}`);
});

test('buildGeocodingUrl produces correct URL', () => {
  const url = buildGeocodingUrl('Paris', 5);
  assert(url.includes('name=Paris'), `Missing name: ${url}`);
  assert(url.includes('count=5'), `Missing count: ${url}`);
  assert(url.includes('language=fr'), `Missing language: ${url}`);
});

test('parsePrecipitation returns 15-min data with Z suffix and probability', () => {
  const mockResponse = {
    minutely_15: {
      time: ['2026-08-20T14:00', '2026-08-20T14:15', '2026-08-20T14:30'],
      precipitation: [0.0, 0.5, 1.2]
    }
  };
  const result = parsePrecipitation(mockResponse);
  assertArrayLen(result, 3);
  assertEq(result[0].time, '2026-08-20T14:00Z');
  assertEq(result[0].value, 0.0);
  assertEq(result[0].probability, 0);
  assertEq(result[1].value, 0.5);
  assertEq(result[2].value, 1.2);
});

test('parsePrecipitation merges hourly forecast beyond 15-min data', () => {
  const mockResponse = {
    minutely_15: {
      time: ['2026-08-20T14:00', '2026-08-20T14:15'],
      precipitation: [0.0, 0.5]
    },
    hourly: {
      time: ['2026-08-20T14:00', '2026-08-20T15:00'],
      precipitation: [0.5, 1.0],
      precipitation_probability: [30, 60]
    }
  };
  const result = parsePrecipitation(mockResponse);
  // 2 from 15-min + 4 from hourly hour 15:00 (14:00 already covered)
  assert(result.length >= 5, `Expected at least 5 entries, got ${result.length}`);
  // Check that 15:00 slot has probability
  const slot1500 = result.find(r => r.time === '2026-08-20T15:00Z');
  assert(slot1500 !== undefined, 'Missing 15:00 slot');
  assertEq(slot1500.probability, 60);
});

test('parsePrecipitation returns empty array for missing data', () => {
  const result = parsePrecipitation({});
  assertArrayLen(result, 0);
});

test('extractWindow returns entries within 2h past + 2h future', () => {
  const now = new Date('2026-08-20T15:00Z');
  const data = [
    { time: '2026-08-20T12:00Z', value: 0.0 }, // 3h ago — excluded
    { time: '2026-08-20T13:00Z', value: 0.1 }, // 2h ago — included (boundary)
    { time: '2026-08-20T14:00Z', value: 0.5 }, // 1h ago — included
    { time: '2026-08-20T15:00Z', value: 1.2 }, // now — included
    { time: '2026-08-20T17:00Z', value: 0.8 }, // +2h — included (boundary)
    { time: '2026-08-20T18:00Z', value: 0.0 }, // +3h — excluded
  ];
  const window = extractWindow(data, now);
  assertArrayLen(window, 4, `Expected 4 entries, got ${window.length}`);
});

test('extractWindow returns empty for empty input', () => {
  const now = new Date('2026-08-20T15:00Z');
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

test('extractCurrentWind returns speed and direction from hourly data', () => {
  const mockResponse = {
    hourly: {
      time: ['2026-08-20T14:00', '2026-08-20T15:00', '2026-08-20T16:00'],
      wind_speed_10m: [10, 15, 20],
      wind_direction_10m: [180, 270, 90],
    }
  };
  const wind = extractCurrentWind(mockResponse);
  assert(typeof wind.speed === 'number', `Expected number, got ${typeof wind.speed}`);
  assert(typeof wind.direction === 'number', `Expected number, got ${typeof wind.direction}`);
  assert(wind.speed >= 0, `Expected non-negative speed, got ${wind.speed}`);
  assert(wind.direction >= 0 && wind.direction <= 360, `Expected 0-360, got ${wind.direction}`);
});

test('extractCurrentWind returns zeros for missing data', () => {
  const wind = extractCurrentWind({});
  assertEq(wind.speed, 0);
  assertEq(wind.direction, 0);
});
