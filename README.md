# Corlena — Fast, iOS‑friendly Canvas UI Toolkit

[![corlena on npm](https://img.shields.io/npm/v/corlena?label=corlena)](https://www.npmjs.com/package/corlena)
[![corlena downloads](https://img.shields.io/npm/dm/corlena)](https://www.npmjs.com/package/corlena)
[![@corlena/wasm on npm](https://img.shields.io/npm/v/%40corlena%2Fwasm?label=%40corlena%2Fwasm)](https://www.npmjs.com/package/@corlena/wasm)
[![@corlena/wasm downloads](https://img.shields.io/npm/dm/%40corlena%2Fwasm)](https://www.npmjs.com/package/@corlena/wasm)

<!-- Demo GIF placeholder: uncomment and replace src when recording is ready
<p align="center">
  <img src="docs/demo/corlena-demo.gif" alt="Corlena demo (canvas + iOS gestures)" width="900" />
  <br />
  <em>IG-style composer and canvas overlay running on iOS Safari</em>
  
</p>
-->

Corlena is a developer‑first canvas toolkit for building responsive, high‑performance editors and interactive media UIs. It ships Svelte‑native actions and stores for interaction (drag, resize, pinch, gesture state) plus an optional Rust/WebAssembly core for heavy lifting — all tuned to run smoothly on iOS Safari and low‑power devices.

Use it to build IG‑style composers, whiteboards, image/video overlays, particle scenes, or any canvas app that needs great touch ergonomics and predictable performance.

See `summary.md` for a concise architecture overview.

## Highlights
- Fast interactions: predictable 60–120 fps with typed‑array data paths and minimal allocations
- iOS‑ready by default: correct `touch-action`, passive listeners, scroll lock, pinch/gesture handling, wheel normalization
- Svelte‑first ergonomics: drop‑in actions (`draggable`, `resizable`, `droppable`) and a composable gesture store
- Deterministic export: what you draw is what you can save (DPR‑aware)
- WASM acceleration (optional): Rust core for image transforms, particles, and heavier math; JS fallback always available
- SSR/Vite‑friendly: clean ESM with SSR‑safe dynamic loading and simple Vite config

Who is this for? Frontend engineers building canvas‑heavy UIs who want reliable touch behavior on iOS, performance that scales, and simple, typed primitives instead of bespoke glue.

## Packages and Names
- `packages/corlena` → `corlena`: Svelte-native actions and stores (draggable, resizable, droppable, gesture store). Exposes typed APIs for app integration.
- `packages/wasm` → `@corlena/wasm`: Rust/WASM engine (wasm-bindgen) for heavy transforms.

Imports
- JS APIs: `import * as corlena from 'corlena'`
- WASM boundary: `import { init, isReady, ... } from 'corlena/wasm'` (internally loads from `@corlena/wasm`)

## Apps / Examples
- `apps/my-app`: SvelteKit example app.
  - Route `/ig`: Instagram-style 9:16 canvas example demonstrating image upload, text overlay, live inline editing, drag, and pinch/wheel scaling. This is an example of how to use the primitives, not the library itself.

## Quick Start
1) Install deps
   
   ```sh
   npm install
   ```

2) (Optional) Build WASM
   
   ```sh
   npm run wasm:build
   ```

3) Run example app
   
   ```sh
   # Run the example SvelteKit app
   npm run -w my-app dev
   # then open http://localhost:5173/ig
   ```

## Install

Use Bun (recommended):

```sh
bun add corlena @corlena/wasm
```

Or with npm:

```sh
npm i corlena @corlena/wasm
```

Then import from the packages as usual in your app.

### Actions: draggable, resizable, droppable

```svelte
<script lang="ts">
  import { draggable, resizable } from 'corlena';
  let pos = { x: 100, y: 120 };
  let size = { w: 240, h: 160 };
  function onDrag(e) { pos = e.detail; }
  function onResize(e) { size = e.detail; }
  $: style = `left:${pos.x}px; top:${pos.y}px; width:${size.w}px; height:${size.h}px;`;
</script>

<div use:draggable on:dragmove={onDrag} style={style}>
  <div use:resizable on:resizemove={onResize}>Resize Me</div>
</div>
```

### Gesture/Interaction store

```ts
import { createGestureStore } from 'corlena';

const gestures = createGestureStore();
gestures.subscribe((state) => {
  // state includes pointers, pinch scale, drag targets, etc.
});
```

### Optional WASM integration

```ts
// Enable Rust/WASM APIs for heavy transforms
import { init, isReady, processFrame, resizeImage } from 'corlena/wasm';
await init(256);
const ok = isReady();
```

Vite setup (SvelteKit)

```ts
// apps/my-app/vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
export default {
  plugins: [sveltekit()],
  optimizeDeps: { exclude: ['corlena/wasm', '@corlena/wasm'] },
  ssr: { noExternal: ['corlena', 'corlena/wasm', '@corlena/wasm'] },
  assetsInclude: ['**/*.wasm']
};
```
Notes: do not import JS from `/public` (e.g. `/wasm/...`) in source; to debug a public copy during dev you can set `window.__CORLENA_WASM_URL__` before initializing.

## Why it’s fast
- Typed arrays and batched state reduce GC churn across frames
- Minimal cross‑boundary hops; DOM updates (CSS transforms/canvas draw) stay on the JS side
- Optional WASM moves hotspots (resampling, particle math) into native speed without forcing it on every consumer

## iOS behavior that “just works”
- Correct `touch-action` defaults to keep pinch/drag behavior stable
- Optional scroll‑lock during interactions to avoid rubber‑banding
- Pointer + wheel normalization for gesture parity across platforms

## Design Notes
- Library is Svelte-first via actions and stores; WASM boundary is typed-array based to avoid GC churn.
- iOS-friendly defaults: `touch-action` and `user-select` guards handled in actions/examples.
- Examples aim for export parity (canvas render == downloaded image).

## Contributing / Development
- Repo uses npm workspaces.
- Useful scripts:

```sh
# Example app
npm run -w my-app dev
npm run -w my-app build

# Core build checks
npm run -w corlena build

# WASM (optional)
npm run wasm:build
```

## Testing

- **Rust unit tests** (engine physics, image resize helpers as they evolve):

  ```sh
  npm run test:rust
  # or directly
  cargo test --manifest-path packages/wasm/Cargo.toml
  ```

- **JS tests** (wrapper fallback behavior without WASM pkg):

  ```sh
  npm run test:js
  ```

- **Run all**:

  ```sh
  npm test
  ```

## Benchmarks (Node, real WASM)

Measure average `process_frame(dt)` time and estimated FPS for various particle counts using Node with the real WebAssembly build.

1) Install `wasm-pack` if needed:

   ```sh
   # macOS
   brew install wasm-pack
   # or via Cargo
   cargo install wasm-pack
   ```

2) Build the Node target and run the benchmark:

   ```sh
   npm run wasm:build:node
   npm run bench:wasm:node
   ```

Output format:

```
WASM particle step benchmark (Node target)
cols: particles, avg_step_ms, est_fps
   100       0.035     28450.6
  1000       0.180      5555.6
  5000       0.900      1111.1
 10000       1.800       555.6
```

Notes:
- `avg_step_ms` is the average time per `process_frame` call.
- `est_fps` = 1000 / `avg_step_ms` (theoretical single-thread max).

## Architecture Overview

- `packages/corlena` (`corlena`): Svelte actions/stores; WASM boundary at `packages/corlena/wasm/index.js` that dynamically loads `@corlena/wasm`.
- `packages/wasm` (`@corlena/wasm`): Rust engine (wasm-bindgen). Exposes stateful APIs like `init`, `process_frame`, particle functions, and image resize (`resize_image`, `resize_image_mode`).
- `apps/my-app`: SvelteKit example (`/ig`, `/canvas`, `/wasm`) wiring drag/resize/text + optional particles.

Data flow (WASM path):
- JS calls `init()` then per-frame `process_frame(dt)` in WASM; numbers return via typed arrays. DOM updates (CSS transforms/canvas draw) remain in JS for minimal crossings.

## Release and Publish

- Quick guide: see `apps/my-app/howtomakethiswork.md`.
- Scripted release from repo root:

```sh
npm run release:dry   # verify
npm run release       # publishes @corlena/wasm then corlena
```
