# ADR-0007: Vite module resolution, console imports, and WASM loader contract

- Status: Accepted
- Date: 2025-08-24

## Context

We expose a browser-facing WASM engine through the package `@corlena/core` via a subpath export `"./wasm"` that wraps the wasm-bindgen bundle built from `packages/wasm/`.

During local development with SvelteKit/Vite, developers often validate features from the browser DevTools console using dynamic `import()`. We observed:

- `import('/packages/...')` 404s because Vite only serves files under the app root and `node_modules`.
- `import('@corlena/core/wasm')` may fail from the console due to Vite optimize-deps caching and because Vite does not always rewrite bare specifiers for console-entered code.
- Using Vite’s internal id path `import('/@id/@corlena/core/wasm')` sometimes returns 504 “Outdated Optimize Dep” until the server is restarted.

Meanwhile, the same import in application source code works reliably because Vite rewrites and prebundles dependencies during module graph construction.

## Decision

- Official import path for the WASM wrapper is the package subpath export: `@corlena/core/wasm`.
- Resolve the wrapper in application source code (Svelte/TS files), not in DevTools, when possible. For console testing, expose the module on `window` from app code.
- Ensure Vite prebundles and inlines the wrapper on both client and SSR by adding to the app’s Vite config:
  - `optimizeDeps.include: ['@corlena/core', '@corlena/core/wasm']`
  - `ssr.noExternal: ['@corlena/core', '@corlena/core/wasm']`
- Establish a clear WASM asset loading contract for the wrapper:
  1) If `window.__CORLENA_WASM_URL__` is set, the wrapper loads from that URL.
  2) Otherwise it tries `/wasm/corlena_wasm.js` (the recommended public path).
  3) As a monorepo dev fallback, it may try the package-local path.
- Provide a demo route `/wasm-test` that imports the wrapper in app code, sets `window.__CORLENA_WASM_URL__`, runs a minimal scenario, prints results to the page, and exposes the module as `window.corlenaWasm` for console use.

## Implementation

- Package exports in `packages/corlena/package.json`:

```json
{
  "name": "@corlena/core",
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts", "svelte": "./src/index.ts" },
    "./wasm": { "types": "./wasm/index.d.ts", "default": "./wasm/index.js" }
  }
}
```

- App Vite config `apps/my-app/vite.config.ts`:

```ts
const config = {
  plugins: [sveltekit()],
  optimizeDeps: { include: ['@corlena/core', '@corlena/core/wasm'] },
  ssr: { noExternal: ['@corlena/core', '@corlena/core/wasm'] },
  server: { host: true, port: 5176, strictPort: true }
};
export default config;
```

- Serve browser WASM bundle at `/wasm/`:

```
apps/my-app/static/wasm/
  ├─ corlena_wasm.js
  └─ corlena_wasm_bg.wasm
```

- Demo route `apps/my-app/src/routes/wasm-test/+page.svelte`:

```ts
onMount(async () => {
  window.__CORLENA_WASM_URL__ = '/wasm/corlena_wasm.js';
  const wasm = await import('@corlena/core/wasm');
  window.corlenaWasm = wasm;
  await wasm.init(8);
  wasm.setViewParams(1, 0, 0, devicePixelRatio);
  // ... run a minimal sequence and log outputs
});
```

## Alternatives considered

- Import by filesystem path (e.g., `/packages/corlena/wasm/index.js`): fails with 404 outside app root; not portable for published packages.
- Console-only dynamic import with `/@id/...`: brittle across Vite updates and subject to optimize-deps cache; acceptable for debugging but not primary guidance.
- Broadening `server.fs.allow` to include monorepo roots: increases risk surface and still doesn’t address publish-time usage.

## Consequences

- Developers get a deterministic flow: import in source, expose to `window` for console experiments, restart dev server when optimize-deps is stale.
- Consumers of the published package have a simple, stable contract:

```ts
import * as wasm from '@corlena/core/wasm';
window.__CORLENA_WASM_URL__ = '/wasm/corlena_wasm.js';
await wasm.init(256);
```

- The `/wasm-test` route doubles as a CI/manual smoke test.

## Testing

- Verified that `/wasm-test` logs expected `events` and `transforms` arrays.
- Confirmed console access via `window.corlenaWasm`.
- Validated that restarting the dev server resolves “Outdated Optimize Dep” errors after config/package changes.

## Troubleshooting

- __Outdated optimize deps / 504__: Restart the Vite dev server. If it persists, clear `node_modules/.vite` cache for the app and restart.
- __Console `import('@corlena/core/wasm')` fails__: Prefer importing in app code and exposing on `window`. Console-entered code may bypass Vite’s rewrite pipeline.
- __`Failed to fetch dynamically imported module` or `TypeError: Failed to fetch`__: Ensure `window.__CORLENA_WASM_URL__` is set to a valid, same-origin URL. In dev, `/wasm/corlena_wasm.js` must exist under `apps/my-app/static/wasm/`.
- __`WebAssembly.instantiateStreaming` MIME issue__: Make sure the server serves `.wasm` with `application/wasm`. Vite static does this by default; custom servers must be configured.
- __`Cannot find module '@corlena/core/wasm'`__: Ensure the package is linked in the workspace and that the subpath export exists in `packages/corlena/package.json`.

## Notes: DevTools and SSR

- __Expose for DevTools__: In app code, import the wrapper and assign it to `window`.

```ts
import { onMount } from 'svelte';
import { browser } from '$app/environment';

onMount(async () => {
  if (!browser) return;
  (window as any).__CORLENA_WASM_URL__ = '/wasm/corlena_wasm.js';
  const wasm = await import('@corlena/core/wasm');
  (window as any).corlenaWasm = wasm;
});
```

- __SSR guards__: Only reference `window` in the browser (e.g., `onMount` or `if (browser)`). Do not set `__CORLENA_WASM_URL__` from server-only modules.
- __CSP__: Some deployments may require `Content-Security-Policy` allowances for WebAssembly (e.g., `script-src 'self' 'wasm-unsafe-eval'`). Configure per your platform’s guidance.

## Known limitations

- Console import paths that rely on Vite internals (e.g., `/@id/...`) are not stable across versions; use only for debugging.
- Optimize-deps may require a dev server restart after changing `exports`, upgrading Vite, or moving files.
- The wrapper currently relies on a global `window.__CORLENA_WASM_URL__`; future work may replace this with an explicit `init({ url })` parameter.

## Alignment and migration checklist

- __Package name__: Ensure `packages/corlena/package.json` is scoped as `"@corlena/core"` to match app imports and ADR examples. The subpath export `"./wasm"` must resolve to `./wasm/index.js` with types at `./wasm/index.d.ts`.
- __Vite config__: Keep `optimizeDeps.include` and `ssr.noExternal` including both `@corlena/core` and `@corlena/core/wasm`.
- __Static assets__: Ensure `apps/my-app/static/wasm/` contains `corlena_wasm.js` and `corlena_wasm_bg.wasm` for local dev.
- __Demo route__: Verify `/wasm-test` continues to initialize, run a minimal frame, and expose `window.corlenaWasm`.

## Future work

- Provide a tiny Vite plugin or virtual module to auto-inject the correct WASM URL based on env/build output.
- Offer a Node/SSR-targeted wrapper variant and document its usage separately.
- Consider replacing the global URL contract with an explicit `init({ wasmJsUrl })` API for clearer composition.
