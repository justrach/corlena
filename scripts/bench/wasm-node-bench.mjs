#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

async function main() {
  // Import the wasm-pack Node target after building with npm run wasm:build:node
  const mod = await import('../../packages/wasm/pkg-node/corlena_wasm.js');
  if (mod && typeof mod.default === 'function') {
    await mod.default();
  }
  if (typeof mod.init === 'function') mod.init(0);

  // Gravity, damping, restitution
  if (typeof mod.set_particle_params === 'function') {
    mod.set_particle_params(new Float32Array([0, 500, 0.02, 0.2]));
  }

  const counts = [100, 1000, 5000, 10000];
  const dt = 1 / 60;
  const warmupSteps = 120;
  const measureSteps = 600;

  console.log('WASM particle step benchmark (Node target)');
  console.log('cols: particles, avg_step_ms, est_fps');

  for (const n of counts) {
    if (typeof mod.seed_particles_for_bench === 'function') {
      mod.seed_particles_for_bench(n);
    } else {
      console.error('seed_particles_for_bench() missing in wasm module');
      process.exitCode = 1;
      return;
    }

    // Warmup
    for (let i = 0; i < warmupSteps; i++) mod.process_frame(dt);

    const t0 = performance.now();
    for (let i = 0; i < measureSteps; i++) mod.process_frame(dt);
    const t1 = performance.now();

    const totalMs = t1 - t0;
    const avgMs = totalMs / measureSteps;
    const fps = 1000 / avgMs;

    console.log(`${String(n).padStart(6)}  ${avgMs.toFixed(3).padStart(10)}  ${fps.toFixed(1).padStart(8)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
