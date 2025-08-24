# Agent Guide

This repository is a small monorepo with a Rust→WASM engine, a TypeScript wrapper, and a SvelteKit demo app. This guide summarizes structure, workflows, commands, and conventions so an agent (or dev) can act quickly and safely.

## Repository Structure

- `packages/wasm/` — Rust crate compiled to WebAssembly via `wasm-pack`.
  - `src/lib.rs` — engine: draggable nodes physics + image store + resize APIs.
  - `pkg/` — wasm-pack web build output (js, wasm, d.ts).
  - `pkg-node/` — wasm-pack Node build output for local benchmarks.
- `packages/corlena/` — TypeScript package `corlena`.
  - `wasm/` — runtime loader/wrapper for wasm-pack bundle; typed exports.
  - `src/` — small utilities and Svelte helpers used by demos (`stores/interaction.ts`, `actions/resizable.ts`).
- `apps/my-app/` — SvelteKit demo.
  - `src/lib/index.ts` — demo engines (DOM and Canvas). Canvas exposes `onDraw` hook.
  - `src/routes/canvas/+page.svelte` — image overlay UI and interactions (baseline canvas demo).
  - `src/routes/ig/+page.svelte` — Instagram-style composer: text overlays with inline editing, HUD, pinch/scroll scaling, export.
  - `static/wasm/` — browser-served wasm bundle copied from `packages/wasm/pkg/`.
- `docs/adr/` — Architectural Decision Records.

## Key Concepts

- Drag physics and image overlay are independent concerns.
- WASM boundary is minimal and typed. JS fallback paths keep the demo usable when WASM is absent.
- Canvas demo exposes `onDraw(ctx)` so pages can draw overlays per frame without forking the loop.

## Important APIs

From `corlena/wasm` (see `packages/corlena/wasm/index.js` and `index.d.ts`):

- `init(capacity?: number): Promise<void>`
- `reset(): void`
- `setView(scale: number): void`
- `setViewParams(scale: number, panX: number, panY: number, pixelRatio: number): void`
- `setConstraints(params: Float32Array): void`
- `upsertNodes(nodes: Float32Array): void`
- `applyPointers(pointers: Float32Array): void`
- `processFrame({ dt: number }): { transforms: Float32Array; events: Int32Array }`
- `isReady(): boolean`
- `storeImage(id: number, rgba: Uint8Array, w: number, h: number): boolean`
- `resizeImage(id: number, outW: number, outH: number): Uint8Array`

See ADR-0002 for overlay details; ADR-0003 proposes transforms and bilinear resize.

Notes:

- Pointer layout supports optional pressure: `[id, x, y, pressure, buttons] * P` (if pressure omitted, stride=4).
- Events ring buffer now exposed from `process_frame`: `[type, a, b, data] * E` (e.g., `1=drag_start`, `2=drag_end`).

From `corlena/src` helpers used in demos:

- `stores/interaction.ts` — `createGestureStore()` Svelte store for simple gesture state.
- `actions/resizable.ts` — DOM `resizable` action with handles, keyboard resize, min/max & aspect constraints, and optional scroll lock.

## Common Workflows

### 1) Run the demo app

- Dev server (workspace name: `my-app`):
  - `npm run -w my-app dev`
  - open `/canvas` (baseline), `/ig` (IG Composer), `/wasm-test` (WASM smoke test).

### 2) Build the WASM engine

- Web: `npm run -w @corlena/wasm build` → outputs to `packages/wasm/pkg/`.
- Node (for benchmarks): `npm run wasm:build:node` → outputs to `packages/wasm/pkg-node/`.

### 3) WASM loading

Default path loads from the dependency `@corlena/wasm`. No public copy is required.

For dev debugging only, you may serve a public copy under `apps/my-app/static/wasm/` and set in DevTools before init:

```js
window.__CORLENA_WASM_URL__ = '/wasm/corlena_wasm.js';
```

Avoid importing JS from `/public` in source files (Vite restriction).

### 4) Canvas overlay testing

- Upload image → stored via `storeImage`.
- Adjust scale slider → resizes via `resizeImage` (WASM) or JS fallback.
- Toggle touch-action (`none`, `pan-x`, `pan-y`, `auto`) to test mobile behavior.

### 5) IG Composer testing

- Route: `/ig` in the demo app.
- Add text via the toolbar. Tap/click text to edit inline.
- Pinch on touch or hold Ctrl/⌘ and use the mouse wheel anywhere to scale selected/dragging text (works even outside the text bbox).
- HUD appears near selected text with A-/A+ and color controls. Interactions don’t blur/commit the editor.
- Export: click Export to get a PNG Blob with DPR handling.

### 6) Benchmarks (Node + WASM)

- Build Node target: `npm run wasm:build:node`
- Run bench: `npm run bench:wasm:node`
- Script: `scripts/bench/wasm-node-bench.mjs`
- Measures avg `process_frame(dt)` ms and estimated FPS for N=100/1k/5k/10k particles.

### 7) WASM test route

- Route: `/wasm-test` in the demo app.
- What it does:
  - Sets `window.__CORLENA_WASM_URL__ = '/wasm/corlena_wasm.js'` so the wrapper can find the wasm-bindgen loader.
  - Dynamically imports the wrapper via package subpath: `await import('@corlena/core/wasm')`.
  - Runs a minimal `init → setViewParams → upsertNodes → applyPointers → processFrame` sequence.
  - Prints `events` and `transforms` to the page, and exposes the module as `window.corlenaWasm` for DevTools usage.

WASM loader & imports:

- Import in app code (Svelte/TS), not from the DevTools console, for reliable Vite rewriting: `import * as wasm from '@corlena/core/wasm'`.
- If you must use the console, first expose the module in app code: `window.corlenaWasm = await import('@corlena/core/wasm')`.
- Serve `corlena_wasm.js` and `corlena_wasm_bg.wasm` under `/wasm/` (we copy them into `apps/my-app/static/wasm/`).
- You can override the path via `window.__CORLENA_WASM_URL__` before `wasm.init(...)`.

## Coding Notes

- TypeScript: keep types accurate at the wasm boundary; prefer `Uint8Array` for byte buffers and construct `ImageData` via a `Uint8ClampedArray` copy.
- Svelte: keep per-frame draw work light; use offscreen canvases when transferring raw pixels.
- Rust: avoid panics across the boundary; validate inputs; return empty buffers or `false` on error.

## ADR Process

- Add new ADRs under `docs/adr/` with an incremented number, date, status, context, decision, implementation, consequences, and testing.
- Example: `0002-image-overlay-resize-wasm.md`, `0003-overlay-transforms-bilinear.md`, `0007-vite-module-resolution-and-wasm-loader.md`.

## Safety & Ops

- Build commands are non-destructive. Copying wasm artifacts overwrites files in `apps/my-app/static/wasm/`—double-check paths before running.
- Avoid committing large binaries beyond the wasm bundle.
- Prefer small, focused PRs tied to ADRs. Include reproduction steps and before/after notes.

## Troubleshooting

- WASM not loading? Ensure files exist in `apps/my-app/static/wasm/` and hard refresh the browser.
- Type errors on `ImageData`: construct via `new Uint8ClampedArray(width * height * 4)` and `.set(u8)`.
- Drag “jump” regressions: see ADR-0001 and verify grab-offset logic in both WASM and JS fallback.
 - Benchmark module not found: Ensure Node build output path is `packages/wasm/pkg-node/` (use `npm run wasm:build:node`). The bench imports `../../packages/wasm/pkg-node/corlena_wasm.js`.

## Quick Links

- Engine: `packages/wasm/src/lib.rs`
- WASM wrapper: `packages/corlena/wasm/index.js` + `index.d.ts`
- Canvas engine: `apps/my-app/src/lib/index.ts`
- Canvas route: `apps/my-app/src/routes/canvas/+page.svelte`
- IG Composer: `apps/my-app/src/routes/ig/+page.svelte`
- ADRs: `docs/adr/`

---

## IG Composer: Overview

File: `apps/my-app/src/routes/ig/+page.svelte`

- Purpose: Instagram-style 9:16 composer with text overlays and image background.
- Editing: Floating DOM `<input>` is positioned over the canvas for inline text editing. The visible text is drawn on the canvas to avoid duplication. The input is fully transparent; caret color matches the text color.
- HUD: Floating toolbar pinned near the selected text with A-/A+ and color. HUD interaction never commits/blur edits inadvertently.
- Scaling: Pinch and Ctrl/⌘+wheel scale the selected/dragging text even when the gesture occurs outside the text bbox.
- Accessibility: HUD controls expose ARIA roles/labels. Larger color input hit area for mobile.
- iOS specifics: Use `-webkit-text-fill-color` and `caret-color`; manage `hudInteracting` to avoid premature blur during native color picker lifecycle.
- Export: Canvas content to Blob with DPR handling.

See ADR-0005 for UX notes.
