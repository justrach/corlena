#!/usr/bin/env node
/**
 * Copies the wasm-bindgen browser bundle into Next.js public assets.
 *
 * Targets:
 *   - public/wasm/corlena_wasm.js
 *   - public/wasm/corlena_wasm_bg.wasm
 *
 * Source candidates (checked in order):
 *   - node_modules/corlena/node_modules/@corlena/wasm/pkg/
 *   - node_modules/@corlena/wasm/pkg/
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'node_modules', 'corlena', 'node_modules', '@corlena', 'wasm', 'pkg'),
    path.join(cwd, 'node_modules', '@corlena', 'wasm', 'pkg'),
  ];

  let srcDir = null;
  for (const dir of candidates) {
    if (await exists(path.join(dir, 'corlena_wasm.js')) && await exists(path.join(dir, 'corlena_wasm_bg.wasm'))) {
      srcDir = dir; break;
    }
  }
  if (!srcDir) {
    console.warn('[copy-wasm] Could not locate @corlena/wasm pkg directory. Skipping copy.');
    return;
  }

  const outDir = path.join(cwd, 'public', 'wasm');
  await fs.mkdir(outDir, { recursive: true });

  const files = ['corlena_wasm.js', 'corlena_wasm_bg.wasm'];
  for (const f of files) {
    const src = path.join(srcDir, f);
    const dst = path.join(outDir, f);
    await fs.copyFile(src, dst);
  }
  console.log('[copy-wasm] Copied wasm bundle to public/wasm/.');
}

main().catch((e) => { console.error('[copy-wasm] Failed:', e); process.exitCode = 1; });
