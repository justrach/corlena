# 0002 – Canvas Image Overlay + WASM Resize APIs

- Status: Accepted
- Date: 2025-08-22

## Context

We want a simple “Instagram Stories”-style image overlay on the canvas demo, with resizing to test UX on desktop and mobile. We already have a WASM engine for draggable nodes with a JS fallback. The overlay should:

- Upload arbitrary images.
- Resize efficiently (preferably in WASM) to arbitrary output sizes.
- Render as an overlay alongside the existing draggable squares.
- Work on iOS with appropriate touch-action modes.

Key constraints and goals:

- Keep the physics/drag engine changes minimal and orthogonal to image work.
- Provide a reliable JS fallback path if WASM is unavailable.
- Keep the browser <-> WASM interface minimal and typed.

## Decision

Introduce image storage and resize APIs in the WASM engine and surface them through the JS wrapper used by the app:

- WASM exports in `packages/wasm/src/lib.rs`:
  - `store_image(id: i32, rgba: Uint8Array, w: u32, h: u32) -> bool`
  - `resize_image(id: i32, out_w: u32, out_h: u32) -> Uint8Array`
- JS wrapper in `packages/corlena/wasm/index.js` exposes:
  - `storeImage(id: number, rgba: Uint8Array, w: number, h: number): boolean`
  - `resizeImage(id: number, outW: number, outH: number): Uint8Array`
- Types in `packages/corlena/wasm/index.d.ts` reflect these functions.
- The canvas demo (`apps/my-app/src/lib/index.ts`) gains an optional `onDraw(ctx)` hook so pages can render overlays per frame without forking the engine.
- The canvas route (`apps/my-app/src/routes/canvas/+page.svelte`) implements upload, stores the original RGBA in WASM, calls `resizeImage` on scale changes, and draws the overlay via `onDraw`.

## Implementation

1. WASM Engine (`packages/wasm/src/lib.rs`)
   - Added an `images: HashMap<i32, Image>` store to the engine state.
   - `store_image`: validates buffer length `(w*h*4)`, copies RGBA into the image store.
   - `resize_image`: nearest-neighbor scaling to an output RGBA buffer returned as `Uint8Array`.
   - No changes to drag physics beyond previously accepted drag jump fixes.

2. Wrapper + Types (`packages/corlena/wasm/`)
   - `index.js`: dynamic load of wasm-pack bundle; added `storeImage` and `resizeImage` passthroughs; `isReady()` indicates availability.
   - `index.d.ts`: corresponding TypeScript declarations.

3. Canvas Demo Hook (`apps/my-app/src/lib/index.ts`)
   - `DemoOptions` now includes `onDraw?: (ctx) => void`.
   - The render loop calls `opts.onDraw?.(ctx)` before drawing nodes.

4. Canvas Page (`apps/my-app/src/routes/canvas/+page.svelte`)
   - Upload flow converts images to `ImageData` and caches the original (`origData`).
   - Calls `storeImage(OVERLAY_ID, Uint8Array(imgData.data.buffer), w, h)`.
   - On scale changes, prefers `resizeImage` to obtain a resized `Uint8Array` and constructs `ImageData` via a fresh `Uint8ClampedArray` copy.
   - Maintains an offscreen `overlayCanvas` and draws it centered via the `onDraw` hook.
   - Provides a touch-action toggle (`none`, `pan-x`, `pan-y`, `auto`) for iOS interaction tests.
   - JS fallback: if WASM is not ready, performs resizing via canvas `drawImage` using the cached original `ImageData`.

5. Artifacts
   - Built wasm-pack bundle to `packages/wasm/pkg/` and copied `corlena_wasm.js` and `corlena_wasm_bg.wasm` to `apps/my-app/static/wasm/` so the browser can load them at `/wasm/...`.

## Consequences

- Performance: WASM nearest-neighbor scaling is fast and predictable; acceptable for prototyping and UI tests.
- Simplicity: Minimal surface area (two functions) keeps the boundary straightforward.
- Fallback: The app remains usable without WASM, enabling development and broader device coverage.
- Memory: Resized buffers are copied back to JS; callers must manage temporary `ImageData` creation. This is acceptable for the demo. Future optimizations could reuse buffers or render direct to WebGL/WebGPU.

## Alternatives Considered

- Doing all resizing in JS: simpler but slower for large images and misses the WASM test objective.
- Adding more filters (bilinear/bicubic): higher visual quality but more complexity; nearest-neighbor is sufficient now.
- Integrating WebGL for scaling: powerful but outside current scope and adds significant setup overhead.

## Testing

- Desktop (Chrome/Safari/Firefox):
  - Verified drag behavior unchanged and no jumping due to prior ADR 0001.
  - Image upload, WASM `storeImage` success path, and resize via slider.
  - Overlay centered; scales smoothly; fallback path works if WASM gated.
- iOS Safari:
  - Confirmed touch-action toggle changes scroll/drag interactions as expected.

## Future Work

- Add overlay transform controls: drag/rotate/scale handles or pinch-zoom.
- Additional sampling modes (bilinear) or GPU-backed scaling.
- Persist multiple overlays and z-ordering.
- Memory reuse and pooling for resized buffers to reduce GC.
