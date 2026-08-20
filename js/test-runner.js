// Minimal browser-based test runner for vanilla JS ES modules

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

export function assertEq(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

export function assertApprox(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(message || `Expected ~${expected}, got ${actual} (tolerance ${tolerance})`);
  }
}

export function assertArrayLen(arr, len, message) {
  if (!Array.isArray(arr) || arr.length !== len) {
    throw new Error(message || `Expected array of length ${len}, got ${arr ? arr.length : 'not array'}`);
  }
}

async function runTests() {
  const resultsEl = document.getElementById('results');
  const summaryEl = document.getElementById('summary');
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      const div = document.createElement('div');
      div.className = 'pass';
      div.textContent = `✓ ${t.name}`;
      resultsEl.appendChild(div);
      passed++;
    } catch (e) {
      const div = document.createElement('div');
      div.className = 'fail';
      div.textContent = `✗ ${t.name}: ${e.message}`;
      resultsEl.appendChild(div);
      failed++;
    }
  }

  summaryEl.textContent = `${passed} passed, ${failed} failed, ${tests.length} total`;
  summaryEl.style.color = failed === 0 ? '#4ade80' : '#f87171';
}

// Import test files (they register via test())
import './test-rainviewer.js';
import './test-openmeteo.js';
import './test-graph.js';
import './test-slider.js';
import './test-geolocation.js';
import './test-search.js';

// Auto-run on load
window.addEventListener('DOMContentLoaded', () => {
  runTests();
});
