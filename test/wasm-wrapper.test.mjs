import test from 'node:test';
import assert from 'node:assert/strict';

// Import the ESM wrapper directly
import * as wasm from '../packages/corlena/wasm/index.js';

// These tests validate fallback behavior when the WASM pkg is not present.
// The wrapper should gracefully no-op and report not ready.

test('wasm wrapper: init() resolves and isReady() is false without pkg', async () => {
  await wasm.init(16);
  assert.equal(wasm.isReady(), false);
});

test('wasm wrapper: processFrame() returns empty typed arrays when not ready', () => {
  const out = wasm.processFrame({ dt: 0.016 });
  assert.ok(out);
  assert.ok(out.transforms instanceof Float32Array);
  assert.ok(out.particles instanceof Float32Array);
  assert.ok(out.events instanceof Int32Array);
  assert.equal(out.transforms.length, 0);
  assert.equal(out.particles.length, 0);
  assert.equal(out.events.length, 0);
});

test('wasm wrapper: particle APIs are no-ops without pkg', () => {
  // Calls should not throw and should return neutral values
  const count = wasm.spawnParticles([0, 0, 0, 0, 1, 1]);
  assert.equal(count, 0);
  assert.doesNotThrow(() => wasm.clearParticles());
  assert.doesNotThrow(() => wasm.setParticleParams([0, 1000, 0.5, 0.5]));
});
