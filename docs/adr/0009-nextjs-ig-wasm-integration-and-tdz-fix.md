# ADR-0009: Next.js IG Canvas + WASM integration and TDZ fix

- Status: Accepted
- Date: 2025-08-24
- Components: `apps/nextjs-app/app/ig/page.tsx`, `packages/corlena/wasm/index.js`, `apps/nextjs-app/app/playground/page.tsx`

## Context

- The IG page in Next.js (`apps/nextjs-app/app/ig/page.tsx`) integrates a WASM particle engine from `corlena/wasm` alongside a canvas-based text/image editor.
- During Fast Refresh, the page crashed with: `ReferenceError: Cannot access 'loop' before initialization` and forced full reloads, making edits difficult.
- Separately, the WASM physics sometimes appeared incorrect in playground/IG due to parameter mismatches with the known-good Svelte demo.

## Decision

1) Fix render/TDZ by decoupling `requestAnimationFrame` from a direct closure on `loop`:
   - Introduced `loopFnRef` to always point at the latest `loop` function.
   - Mounted a single `requestAnimationFrame` driver (`tick`) that calls `loopFnRef.current()` each frame.
   - Removed the effect that depended on `[loop]` and scheduled RAF directly, eliminating the Temporal Dead Zone and improving Fast Refresh stability.

2) Align WASM physics with the Svelte demo to ensure parity and stability:
   - Set `setConstraints([0, 0, wCss, hCss, 1, 1, 0, 0.999])` on mount and on resize.
   - Set particle params to `[0, 900, 0.995, 0.6]` = gravityY=900, damping=0.995, restitution=0.6.
   - Clamp `dt` to `0.032` seconds in the RAF loop for stability.
   - Seed particles with stride 6 `[x,y,vx,vy,r,life]` and visually noticeable radius.

3) Confirmed wrapper contracts in `packages/corlena/wasm/index.js`:
   - `set_view_params(scale, panX, panY, pixelRatio)`.
   - `set_particle_params(Float32Array([gx, gy, damping, restitution]))`.
   - `process_frame(dt)` returns `{ transforms, particles, events }` with particle stride 6 `[x,y,vx,vy,r,life]`.

## Rationale

- React evaluates dependency arrays during render; referencing `loop` in an effect’s deps before it’s initialized can surface TDZ in some refresh sequences. A mounted RAF driver calling a ref avoids TDZ and stale-closure bugs.
- Physics parity prevents confusing discrepancies between the Svelte and Next.js demos and avoids artifacts like particles vanishing or overly bouncy collisions.

## Consequences

- Hot editing on `/ig` is stable; Fast Refresh no longer throws a TDZ error.
- Particles in IG and the playground behave consistently (gravity, damping, restitution) and render with correct stride.
- Canvas bounds remain in sync with window resizes.

## Implementation Notes

- `apps/nextjs-app/app/ig/page.tsx`
  - Added `loopFnRef` and a mount-only RAF effect that calls `loopFnRef.current()`.
  - Removed the `[loop]`-dependent RAF effect and the extra `requestAnimationFrame(loop)` call in the mount effect.
  - On mount and resize, call `wasmSetConstraints([0,0,wCss,hCss,1,1,0,0.999])` and set particle params to `[0, 900, 0.995, 0.6]`.
  - Clamp frame `dt` to `0.032` seconds.

- `apps/nextjs-app/app/playground/page.tsx`
  - Matched physics params with Svelte and increased seed radius for visibility.

- `packages/corlena/wasm/index.js`
  - Verified param order and API surface (no code changes required here for this ADR).

## How to run locally

- From repo root:
  - `npm run -w nextjs-app dev` (or `bun run dev` inside `apps/nextjs-app/`).
  - Visit `http://localhost:3000/ig`.

## Alternatives Considered

- Keep the `[loop]` effect and reorder declarations: fragile with Fast Refresh; ref-based driver is more robust.
- Use `useInterval`/`setTimeout`: less smooth than RAF and still subject to closure staleness without a ref.

## Follow-ups

- Add unit tests or a small harness to verify particle param propagation and stride in CI.
- Expose a simple control panel to tweak gravity/damping live for demos.
