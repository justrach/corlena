# Corlena + WASM: How To Make This Work

This doc explains the package names, how to run locally with Vite/SvelteKit, and how to publish to npm.

## Package Names
- corlena: main JS package (unscoped)
- @corlena/wasm: low-level wasm-bindgen output (scoped)
- Import surface:
  - JS API: `import * as corlena from 'corlena'`
  - WASM boundary: `import { init, isReady, ... } from 'corlena/wasm'`
  - The boundary loads the wasm glue from `@corlena/wasm/pkg/corlena_wasm.js`.

## Monorepo Layout (relevant)
- packages/corlena: name `corlena`, exports `./` and `./wasm`
- packages/wasm: name `@corlena/wasm`, contains `pkg/` from `wasm-pack`
- apps/my-app: example SvelteKit app

## Build The WASM Package
From repo root (or packages/wasm):

```sh
# requires rustup + wasm-pack
cd packages/wasm
wasm-pack build --target web --release -d ./pkg
```

This generates `pkg/corlena_wasm.js` and `pkg/corlena_wasm_bg.wasm`.

## Using With Vite (SvelteKit)
Vite cannot import JS from `public/static` and may 404 wasm if prebundled. Configure your app like this:

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';

export default {
  plugins: [sveltekit()],
  optimizeDeps: {
    // Let Vite serve the module directly so it can handle .wasm
    exclude: ['corlena/wasm', '@corlena/wasm']
  },
  ssr: {
    noExternal: ['corlena', 'corlena/wasm', '@corlena/wasm']
  },
  assetsInclude: ['**/*.wasm'],
  server: { host: true, port: 5176, strictPort: true }
};
```

Notes
- Do NOT import `/wasm/corlena_wasm.js` from `public/static` in source code; Vite disallows it.
- For dev debugging only, you can force a public path in the browser console before init:
  `window.__CORLENA_WASM_URL__ = '/wasm/corlena_wasm.js'`

## Local Dev (monorepo)
- Build wasm once (see above).
- Run the example app:

```sh
cd apps/my-app
npm run dev
```

If you see 404 for `corlena_wasm_bg.wasm`, clear Vite cache: `rm -rf node_modules/.vite` and restart dev.

## Publish To npm
Publish order matters: publish `@corlena/wasm` first, then `corlena`.

1) Ensure versions and dependency ranges
- packages/wasm/package.json → `name: "@corlena/wasm"`, bump `version`.
- packages/corlena/package.json → `name: "corlena"`, bump `version`.
- In `packages/corlena/package.json`, set dependency to a semver range (not file:):
  ```json
  {
    "dependencies": {
      "@corlena/wasm": "^<published-version>"
    }
  }
  ```

2) Build wasm bundle
```sh
cd packages/wasm
wasm-pack build --target web --release -d ./pkg
```

3) Login once
```sh
npm login
```

4) Publish packages
```sh
# publish wasm first
cd packages/wasm
npm publish --access public

# update corlena dependency to use the newly published version (^x.y.z), then:
cd ../corlena
npm publish --access public
```

5) Verify install in a fresh app
```sh
npm i corlena @corlena/wasm
```

## Troubleshooting
- Error: Cannot import non-asset file /wasm/... inside /public
  - Remove any `import '/wasm/...'` from source; use `corlena/wasm` import instead.
- 404 for `node_modules/.vite/deps/corlena_wasm_bg.wasm`
  - Ensure Vite config excludes `corlena/wasm` from optimizeDeps and includes `**/*.wasm` in assets.
  - Clear Vite cache: `rm -rf node_modules/.vite` and restart dev.
- Streaming MIME warning
  - This is harmless if it falls back and succeeds; proper serving avoids it.
- Forcing a specific wasm URL in dev
  - In DevTools before initialization: `window.__CORLENA_WASM_URL__ = '/wasm/corlena_wasm.js'`

## Summary
- Publishable packages: `corlena` (main) and `@corlena/wasm` (wasm).
- Apps import via `corlena` and `corlena/wasm` and should use the Vite config shown above.

## Agent Quickstart
- Dev app: `npm run -w my-app dev` → open http://localhost:5176
- Build wasm: `npm run wasm:build` (once per change to Rust)
- Troubleshoot 404/MIME: clear `node_modules/.vite` and restart; ensure Vite config excludes `corlena/wasm` from optimizeDeps.
- Publish (requires @corlena org):
  - Dry-run: `npm run release:dry`
  - Publish: `npm run release`
