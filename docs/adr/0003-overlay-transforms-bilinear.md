# 0003 – Overlay Transforms (Drag/Rotate/Scale) + Bilinear Resize in WASM

- Status: Accepted
- Date: 2025-08-23

## Context

ADR 0002 introduced image overlay via WASM-backed nearest-neighbor resizing with a JS fallback. Next, we want richer interactions and better visual quality:

- Provide overlay transform controls (drag, rotate, scale), including mobile pinch-zoom + rotate.
- Improve resize quality with bilinear sampling in WASM, selectable at runtime.
- Keep the API stable and minimal while supporting both NN and bilinear.

## Decision

- Add a bilinear resize path in the WASM engine with a new export:
  - Option A (simple): `resize_image_bilinear(id: i32, out_w: u32, out_h: u32) -> Uint8Array`.
  - Option B (extensible): `resize_image_mode(id: i32, out_w: u32, out_h: u32, mode: u32) -> Uint8Array` where mode: `0=NN`, `1=Bilinear`.
- Decision: Choose Option B for extensibility and a stable call site.
- Expose matching JS APIs in `@corlena/core/wasm`:
  - `resizeImageBilinear(id: number, outW: number, outH: number): Uint8Array` (Option A), or
  - `resizeImageMode(id: number, outW: number, outH: number, mode: number): Uint8Array` (Option B).
- Extend the canvas page UI with a quality toggle:
  - `Nearest` (default, faster) and `Bilinear` (smoother) radio/select input.
- Introduce overlay transform state on the page (no physics coupling):
  - `overlayX, overlayY, overlayScale, overlayRotation`.
  - Mouse/touch handles for rotate/scale; drag moves the overlay.
  - Pinch gesture on mobile adjusts scale, two-finger twist adjusts rotation.
  - Apply transforms at draw time: `ctx.setTransform(...)` or `ctx.save/translate/rotate/scale/drawImage/restore`.
  - Persist overlay transform independently from node physics.

## Implementation

1. WASM (`packages/wasm/src/lib.rs`)
   - Add bilinear sampler:
     - For each destination pixel, compute weighted average of the four neighboring source texels.
     - Maintain `images: HashMap<i32, Image>` store from ADR 0002.
   - Export one of the functions above (Option A or B). Start with Option A for simplicity.

2. JS Wrapper (`packages/corlena/wasm/`)
   - Add a passthrough for the new export and TypeScript typings.
   - Keep existing `resizeImage` (NN) to avoid breaking callers.

3. Canvas Page (`apps/my-app/src/routes/canvas/+page.svelte`)
   - Add a UI toggle for resize quality.
   - When `Bilinear` is selected and WASM is ready, call the bilinear export; otherwise fallback to NN or JS scaling.
   - Implement overlay transforms in the page:
     - Drag: pointer down + move updates `overlayX/Y`.
     - Scale/Rotate: gesture handles (corner circle for scale, side handle for rotate) or mobile pinch/twist.
     - Apply transforms when drawing the `overlayCanvas` via `ctx.save/translate/rotate/scale/drawImage/restore`.

4. Testing
   - Verify quality differences between NN and Bilinear at multiple scales.
   - Desktop: mouse drag/rotate/scale handles.
   - iOS: pinch zoom and rotate; verify touch-action modes still work.

## Consequences

- Visual quality improves with bilinear, at additional CPU cost; acceptable for demo usage.
- API surface grows by one function (Option A) or a mode parameter (Option B); still minimal.
- Overlay transform logic resides in the UI layer, preserving engine simplicity and avoiding physics coupling.

## Alternatives Considered

- Adding bilinear into the existing `resize_image` behind a compiled feature: harder to switch at runtime.
- GPU-based scaling (WebGL/WebGPU): higher quality/perf, but more setup and out of current scope.

## Rollout Plan

- Phase 1: Implement Option B (`resize_image_mode`) and UI toggle.
- Phase 2: Add pinch-zoom/rotate gestures and basic transform handles.
- Phase 3: Evaluate performance; consider buffer reuse and, if needed, GPU scaling.
