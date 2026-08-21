/**
 * Geolocation module — wrapper around navigator.geolocation with fallback.
 */
import { t } from './i18n.js';

export const FALLBACK_LOCATION = {
  lat: 48.85,
  lon: 2.35,
  name: 'Paris',
};

/**
 * Get the fallback location (Paris).
 * @returns {{lat: number, lon: number, name: string}}
 */
export function getFallbackLocation() {
  return { ...FALLBACK_LOCATION };
}

/**
 * Get the user's current position via navigator.geolocation.
 * @param {object} options - { timeout, enableHighAccuracy }
 * @returns {Promise<{lat: number, lon: number}>}
 */
export function getUserLocation(options = {}) {
  const timeout = options.timeout ?? 10000;
  const enableHighAccuracy = options.enableHighAccuracy ?? true;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(t.geolocNotSupported));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        let message;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = t.geolocDenied;
            break;
          case error.POSITION_UNAVAILABLE:
            message = t.geolocUnavailable;
            break;
          case error.TIMEOUT:
            message = t.geolocTimeout;
            break;
          default:
            message = t.geolocError;
        }
        reject(new Error(message));
      },
      { timeout, enableHighAccuracy }
    );
  });
}

/**
 * Get user location, falling back to Paris on error.
 * Returns { lat, lon, isFallback, error? }.
 * @param {object} options - geolocation options
 * @returns {Promise<{lat: number, lon: number, isFallback: boolean, error?: string}>}
 */
export async function getUserLocationWithFallback(options = {}) {
  try {
    const loc = await getUserLocation(options);
    return { ...loc, isFallback: false };
  } catch (e) {
    return { ...getFallbackLocation(), isFallback: true, error: e.message };
  }
}
