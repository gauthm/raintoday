/**
 * Search module — Place search with autocomplete dropdown.
 */
import { searchPlaces } from './api/openmeteo.js';

/**
 * Debounce a function call.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Format a place result into a display name.
 * @param {object} place - { name, country, admin1 }
 * @returns {string} Formatted name
 */
export function formatPlaceName(place) {
  const parts = [place.name];
  if (place.admin1 && place.admin1 !== place.name) parts.push(place.admin1);
  if (place.country) parts.push(place.country);
  return parts.join(', ');
}

/**
 * Initialize the search input with autocomplete.
 * @param {function} onPlaceSelect - Callback: (lat, lon, name) => void
 * @returns {object} { destroy }
 */
export function initSearch(onPlaceSelect) {
  const input = document.getElementById('search-input');
  const resultsEl = document.getElementById('search-results');

  const performSearch = debounce(async (query) => {
    if (query.length < 2) {
      resultsEl.classList.remove('visible');
      resultsEl.innerHTML = '';
      return;
    }

    try {
      const results = await searchPlaces(query);
      if (results.length === 0) {
        resultsEl.innerHTML = '<div class="search-result-item" style="color:#888">Lieu introuvable</div>';
        resultsEl.classList.add('visible');
        return;
      }

      resultsEl.innerHTML = results.map(place => {
        const displayName = formatPlaceName(place);
        return `<div class="search-result-item" data-lat="${place.lat}" data-lon="${place.lon}" data-name="${place.name}">${displayName}</div>`;
      }).join('');
      resultsEl.classList.add('visible');

      // Attach click handlers
      resultsEl.querySelectorAll('.search-result-item').forEach(item => {
        if (!item.dataset.lat) return; // skip "not found" message
        item.addEventListener('click', () => {
          const lat = parseFloat(item.dataset.lat);
          const lon = parseFloat(item.dataset.lon);
          const name = item.dataset.name;
          input.value = name;
          resultsEl.classList.remove('visible');
          resultsEl.innerHTML = '';
          if (onPlaceSelect) onPlaceSelect(lat, lon, name);
        });
      });
    } catch (e) {
      resultsEl.innerHTML = '<div class="search-result-item" style="color:#f87171">Erreur de recherche</div>';
      resultsEl.classList.add('visible');
    }
  }, 300);

  function onInput() {
    performSearch(input.value.trim());
  }

  function onBlur() {
    // Delay to allow click on result
    setTimeout(() => {
      resultsEl.classList.remove('visible');
    }, 200);
  }

  function onFocus() {
    if (resultsEl.innerHTML) {
      resultsEl.classList.add('visible');
    }
  }

  input.addEventListener('input', onInput);
  input.addEventListener('blur', onBlur);
  input.addEventListener('focus', onFocus);

  return {
    destroy: () => {
      input.removeEventListener('input', onInput);
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('focus', onFocus);
    },
  };
}
