# Corlena Summary

This document explains how the repo fits together and how to develop, test, and benchmark it.

## Overview
- __Goal__: Svelte-first primitives for interactive canvas/media composition (drag/resize/gestures), with an optional Rust/WebAssembly engine for heavy lifting.
- __Approach__: Keep DOM updates (styles/canvas draws) in JS/Svelte. Push per-frame math/state into WASM when beneficial. Minimize JS↔WASM crossings with typed arrays.

## Packages
- __`packages/corlena` (`@corlena/core`)__
  - Svelte actions: `draggable`, `resizable`, `droppable`.
  - Store: `createGestureStore()` for pointers, pinch, etc.
  - WASM wrapper at `packages/corlena/wasm/index.js` to dynamically load the wasm-bindgen bundle and expose `init`, `processFrame`, image helpers, particle APIs.
- __`packages/wasm` (`@corlena/wasm`)__
  - Rust crate compiled to WebAssembly via `wasm-bindgen`/`wasm-pack`.
  - Example APIs: `init`, `reset`, `process_frame(dt)`, particle functions, `store_image`, `resize_image`, `resize_image_mode`.
- __`apps/my-app`__
  - SvelteKit example with route `/ig` demonstrating upload, overlay, drag/resize, and scaling.

## Data Flow (WASM path)
1. JS calls `init(capacity)` once to allocate internal state in WASM.
2. Per frame, JS calls `process_frame(dt)` in WASM.
3. WASM returns numeric results via typed arrays (transforms, particles, events).
4. JS applies DOM updates (CSS transforms/canvas) using results to avoid costly crossings.

## Build & Run
- __Install__: `npm install`
- __App dev__: `npm run -w my-app dev` and open `http://localhost:5173/ig`
- __WASM build (web or node)__:
  - Web: `npm run wasm:build` (see package scripts inside packages)
  - Node for benchmarking: `npm run wasm:build:node`

## Testing
- __Rust__: `npm run test:rust` (or `cargo test --manifest-path packages/wasm/Cargo.toml`)
- __JS__: `npm run test:js` (Node test runner)
- __All__: `npm test`

## Benchmarks (Node + real WASM)
1. Install `wasm-pack` (mac: `brew install wasm-pack`, or `cargo install wasm-pack`).
2. Build and run:
   ```sh
   npm run wasm:build:node
   npm run bench:wasm:node
   ```
3. Output shows particles, avg ms/step, and FPS estimate.

Script: `scripts/bench/wasm-node-bench.mjs`.

## Image Resize APIs
- Store an image in WASM memory: `store_image(id, rgba, w, h)`.
- Resize:
  - `resize_image(id, outW, outH)` (nearest by default)
  - `resize_image_mode(id, outW, outH, mode)` where `mode` is 0=nearest, 1=bilinear.
- Pure Rust helpers (tested): nearest and bilinear RGBA resampling functions validate correctness.

## Recent Changes

- Node WASM benchmark added: `scripts/bench/wasm-node-bench.mjs` with `npm run bench:wasm:node`.
- Build fix: `wasm:build:node` now outputs to `packages/wasm/pkg-node/` by using `--out-dir pkg-node` relative to the crate.
- Rust: Added pure image resize helpers (nearest, bilinear) with unit tests in `packages/wasm/src/lib.rs`.
- Docs: README updated with testing/bench instructions; `agent.md` updated with Node bench workflow.

### Troubleshooting

- Benchmark module not found: ensure the Node build exists at `packages/wasm/pkg-node/` by running `npm run wasm:build:node`.

## Extensibility Roadmap
- More engine features (inertia, snap, collisions) moved into WASM.
- Memory layouts for nodes/pointers/constraints documented in ADRs.
- Potential Worker + SharedArrayBuffer path for large scenes.
- Criterion benches for regression tracking.
