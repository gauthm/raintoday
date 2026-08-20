import { test, assert, assertEq } from './test-runner.js';
import { debounce, formatPlaceName } from './search.js';

test('debounce delays function execution', async () => {
  let callCount = 0;
  const fn = debounce(() => { callCount++; }, 50);
  fn();
  fn();
  fn();
  assertEq(callCount, 0); // not called yet
  await new Promise(r => setTimeout(r, 100));
  assertEq(callCount, 1); // called once after delay
});

test('debounce resets timer on subsequent calls', async () => {
  let callCount = 0;
  const fn = debounce(() => { callCount++; }, 50);
  fn();
  await new Promise(r => setTimeout(r, 30));
  fn(); // resets timer
  await new Promise(r => setTimeout(r, 30));
  assertEq(callCount, 0); // still not called, timer reset
  await new Promise(r => setTimeout(r, 50));
  assertEq(callCount, 1);
});

test('formatPlaceName with country and admin', () => {
  const name = formatPlaceName({ name: 'Lyon', country: 'France', admin1: 'Auvergne-Rhône-Alpes' });
  assert(name === 'Lyon, Auvergne-Rhône-Alpes, France', `Unexpected: ${name}`);
});

test('formatPlaceName with country only', () => {
  const name = formatPlaceName({ name: 'Tokyo', country: 'Japan' });
  assert(name === 'Tokyo, Japan', `Unexpected: ${name}`);
});

test('formatPlaceName with name only', () => {
  const name = formatPlaceName({ name: 'Nowhere' });
  assertEq(name, 'Nowhere');
});
