#!/usr/bin/env node
/**
 * Syncs the wasm-bindgen web bundle from packages/wasm/pkg into
 * packages/corlena/wasm/pkg so the `corlena` package ships with wasm assets.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

async function main() {
  const pkgDir = process.cwd(); // packages/corlena
  const monorepoRoot = path.resolve(pkgDir, '..'); // packages/
  const source1 = path.join(monorepoRoot, 'wasm', 'pkg'); // packages/wasm/pkg
  // Fallback if running outside mono while publishing
  const source2 = path.join(pkgDir, 'node_modules', '@corlena', 'wasm', 'pkg');

  let src = null;
  if (await exists(path.join(source1, 'corlena_wasm.js'))) src = source1;
  else if (await exists(path.join(source2, 'corlena_wasm.js'))) src = source2;

  if (!src) {
    console.warn('[sync-wasm] No wasm pkg found. Did you run `npm run -w @corlena/wasm build`? Skipping.');
    return;
  }

  const dst = path.join(pkgDir, 'wasm', 'pkg');
  await fs.mkdir(dst, { recursive: true });

  const files = ['corlena_wasm.js', 'corlena_wasm_bg.wasm', 'corlena_wasm.d.ts'];
  for (const f of files) {
    const s = path.join(src, f);
    if (await exists(s)) await fs.copyFile(s, path.join(dst, f));
  }
  console.log('[sync-wasm] Synced wasm pkg -> corlena/wasm/pkg');
}

main().catch((e) => { console.error('[sync-wasm] Failed:', e); process.exitCode = 1; });
