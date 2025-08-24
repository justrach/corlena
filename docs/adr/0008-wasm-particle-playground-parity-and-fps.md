# ADR-0008: WASM Particle Playground Parity and FPS Telemetry

- Status: Accepted
- Date: 2025-08-24
- Components: `apps/nextjs-app/app/playground/page.tsx`, `packages/corlena/wasm/index.js`, `packages/wasm/src/lib.rs`

## Context

The Next.js playground demo "Particles — JS vs WASM" showed incorrect WASM behavior:
- Particles were static or disappeared after a short time.
- Visuals sometimes turned fully black.
- Physics did not match the working Svelte demo (`apps/my-app/src/routes/ig/+page.svelte`).
- No visibility into per-side performance (FPS).

The WASM engine exposes APIs via `packages/corlena/wasm/index.js` that wrap `packages/wasm/src/lib.rs`:
- `init`, `isReady`, `processFrame(dt)`
- `spawnParticles([x,y,vx,vy,r,life]*N)`
- `clearParticles()`
- `setConstraints([left, top, right, bottom, gridX, gridY, inertia, damping])`
- `setViewParams(scale, panX, panY, pixelRatio)`
- `setParticleParams([g_x, g_y, p_damping, restitution])`

## Decision

1) Align the Next.js playground WASM usage with the Svelte implementation:
   - Draw particles with stride 6: `[x, y, vx, vy, r, life]`.
   - Seed particles with radius and lifetime per particle (was missing before).
   - Apply engine params before spawning:
     - `setConstraints([0,0,W,H, 1,1, 0, 0.999])`.
     - `setViewParams(1, 0, 0, 1)`.
     - `setParticleParams([0, 200, 1.0, 0.9])` to match the JS demo (gravity=200, no per-frame damping, restitution=0.9).
   - Use a large lifetime (`life = 1e9`) for demo parity with JS (which has no decay), preventing premature culling.

2) Fix black-canvas artifact:
   - When WASM has no particles or isn’t ready, clear the canvas (`clearRect`) instead of drawing translucent black per frame.

3) Telemetry for performance comparison:
   - Add on-DOM FPS reporting for JS and WASM by timing each side’s step+draw per frame and publishing smoothed values periodically.

## Rationale

- Stride, seeding, and constraints must match the WASM engine’s expectations to produce motion and collisions.
- Lifetime controls removal; the previous short lifetime caused buffers to shrink to zero (white canvas) even when physics worked.
- Black accumulation came from repeatedly painting translucent fills; clearing avoids visual drift.
- Explicit physics params ensure parity with the JS demo for a fair comparison.
- FPS telemetry helps validate perf differences and detect regressions.

## Consequences

- The WASM demo now behaves like the JS demo: particles fall and bounce within bounds and remain visible.
- The badge shows “WASM Active” only after real usage (unchanged design).
- Users can see per-side FPS on the page.

## Implementation Notes

- Files updated: `apps/nextjs-app/app/playground/page.tsx`.
- Wrapper reference: `packages/corlena/wasm/index.js` confirms signatures for `set_constraints`, `set_particle_params`, `process_frame`.
- Engine references: `packages/wasm/src/lib.rs` documents constraints layout, particle params, lifetime handling, and `step(dt)` integration.

## Alternatives Considered

- Keep default WASM gravity/damping: rejected for parity.
- Keep finite lifetime: rejected for demo clarity; fine for real scenes.
- Smoothed canvas trails: rejected; not the goal of the comparison demo.

## Follow-ups

- Re-apply `setConstraints` on canvas resize to keep bounds in sync.
- Optional: expose particle count and step ms alongside FPS.
