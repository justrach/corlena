# Corlena Monorepo

Corlena provides Svelte-first primitives for building canvas/media composition UIs: drag, resize, gestures, interaction stores, and an optional Rust/WASM core.

## Packages
- `packages/corlena` (`@corlena/core`): Svelte-native actions and stores (draggable, resizable, droppable, gesture store). Exposes typed APIs for app integration.
- `packages/wasm` (`@corlena/wasm`): Optional Rust/WASM engine (wasm-bindgen) for heavy transforms. Currently a stub – integrate when features stabilize.

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

## Using @corlena/core
Install (workspace already wired here):

```sh
npm i @corlena/core
```

### Actions: draggable, resizable, droppable

```svelte
<script lang="ts">
  import { draggable, resizable } from '@corlena/core';
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
import { createGestureStore } from '@corlena/core';

const gestures = createGestureStore();
gestures.subscribe((state) => {
  // state includes pointers, pinch scale, drag targets, etc.
});
```

### Optional WASM integration

```ts
// When ready to enable Rust/WASM APIs for heavy transforms:
import wasm from '@corlena/core/wasm';
// wasm.init(), wasm.transformImage(...), etc. (subject to ADRs as the API evolves)
```

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
npm run -w @corlena/core build

# WASM (optional)
npm run wasm:build
```
