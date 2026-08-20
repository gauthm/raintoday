import { test, assert, assertEq } from './test-runner.js';
import { FALLBACK_LOCATION, getFallbackLocation } from './geolocation.js';

test('FALLBACK_LOCATION is Paris coordinates', () => {
  assertEq(FALLBACK_LOCATION.lat, 48.85);
  assertEq(FALLBACK_LOCATION.lon, 2.35);
  assertEq(FALLBACK_LOCATION.name, 'Paris');
});

test('getFallbackLocation returns Paris object', () => {
  const loc = getFallbackLocation();
  assertEq(loc.lat, 48.85);
  assertEq(loc.lon, 2.35);
});
