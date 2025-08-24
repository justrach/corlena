# Agent Guide (my-app)

This SvelteKit app demonstrates how to use `corlena` and the optional `corlena/wasm` APIs. Use this guide to run, test, and validate behavior quickly.

## Run
- Dev: `npm run -w my-app dev` (hosted on `http://localhost:5176`)
- Build: `npm run -w my-app build`

Vite config is set to handle the WASM dependency (`assetsInclude`, `optimizeDeps.exclude`, `ssr.noExternal`).

## Routes
- `/` — landing with links
- `/canvas` — canvas-based particle + overlay demo (pinch, pan, draw overlay)
- `/ig` — IG-style composer: text overlay, inline editing, HUD adjustments
- `/wasm` and `/wasm-test` — quick WASM capability checks

## Expected Behaviors
- Canvas: drag nodes, pinch to scale image overlay, one-finger pan when not over a node. Overlay draws at 120 fps; hi-res resample deferred after pinch end.
- IG Composer: click/tap text to edit inline, Ctrl/⌘+wheel scales selected text at cursor; HUD shows A-/A+ and color; export produces crisp PNG respecting DPR.
- WASM: when built and loaded, badges show “Using WASM”; otherwise JS fallback runs.

## WASM Notes
- Import from `corlena/wasm`; do not import JS from `/public`.
- To force a specific public file during dev only, set before init in DevTools:

```js
window.__CORLENA_WASM_URL__ = '/wasm/corlena_wasm.js';
```

## Troubleshooting
- 404 for `corlena_wasm_bg.wasm`: clear cache (`rm -rf apps/my-app/node_modules/.vite`) and restart dev. Ensure `packages/wasm/pkg/` is built and dependency installed.
- SSR error about `/wasm/...` import: remove any source imports from public paths; use `corlena/wasm` boundary and the Vite config provided.

## Quick Snippets

```ts
// Example: initialize WASM in a page/component
import { onMount } from 'svelte';
import { init, isReady, processFrame } from 'corlena/wasm';

onMount(async () => {
  await init(256);
  console.log('wasm ready?', isReady());
});
```

```svelte
<!-- Example: use corlena actions -->
<script lang="ts">
  import { draggable, resizable } from 'corlena';
  let pos = { x: 40, y: 40 }, size = { w: 160, h: 120 };
</script>
<div use:draggable style={`left:${pos.x}px;top:${pos.y}px;`}>
  <div use:resizable style={`width:${size.w}px;height:${size.h}px;`}></div>
</div>
```
