// WASM boundary wrapper. Aligns with packages/wasm/src/lib.rs
// Exposes a state-machine API with graceful fallbacks if the WASM build is absent.

let mod = null; // wasm module bindings (from wasm-pack pkg)
let ready = false;

// Attempt dynamic import of generated pkg (if present). Consumers can also call init() directly.
async function tryLoad() {
  if (mod) return mod;
  const override = typeof window !== 'undefined' && window.__CORLENA_WASM_URL__;
  const candidates = [
    override,
    '/wasm/corlena_wasm.js', // recommended: copy pkg into app static dir
    '/packages/wasm/pkg/corlena_wasm.js' // monorepo dev (may require server.fs.allow)
  ].filter(Boolean);
  for (const url of candidates) {
    try {
      // eslint-disable-next-line n/no-unsupported-features/es-syntax
      mod = await import(/* @vite-ignore */ url);
      break;
    } catch (_) {
      mod = null;
    }
  }
  return mod;
}

export async function init(capacity = 256) {
  const m = await tryLoad();
  if (m && m.default) {
    try {
      await m.default();
      if (typeof m.init === 'function') m.init(capacity >>> 0);
      ready = true;
    } catch (_) {
      ready = false;
    }
  } else {
    ready = false;
  }
}

export function reset() {
  if (mod && typeof mod.reset === 'function') mod.reset();
}

export function setView(scale) {
  if (mod && typeof mod.set_view === 'function') mod.set_view(Number(scale) || 1);
}

export function setConstraints(params) {
  if (mod && typeof mod.set_constraints === 'function') mod.set_constraints(params);
}

export function upsertNodes(nodes) {
  if (mod && typeof mod.upsert_nodes === 'function') mod.upsert_nodes(nodes);
}

export function applyPointers(pointers) {
  if (mod && typeof mod.apply_pointers === 'function') mod.apply_pointers(pointers);
}

export function processFrame(input) {
  // Preferred: new API using internal state (dt only)
  if (mod && typeof mod.process_frame === 'function') {
    const out = mod.process_frame(Number(input?.dt ?? 0));
    return { transforms: out.transforms, events: out.events };
  }
  // Fallback noop
  return { transforms: new Float32Array(0), events: new Int32Array(0) };
}

export function isReady() {
  return !!(mod && ready);
}

export function storeImage(id, rgba, w, h) {
  if (mod && typeof mod.store_image === 'function') return !!mod.store_image(id|0, rgba, w>>>0, h>>>0);
  return false;
}

export function resizeImage(id, outW, outH) {
  if (mod && typeof mod.resize_image === 'function') return mod.resize_image(id|0, outW>>>0, outH>>>0);
  return new Uint8Array(0);
}

export function resizeImageMode(id, outW, outH, mode) {
  if (mod && typeof mod.resize_image_mode === 'function') return mod.resize_image_mode(id|0, outW>>>0, outH>>>0, mode>>>0);
  // Fallback to nearest if mode API is missing
  if (mod && typeof mod.resize_image === 'function') return mod.resize_image(id|0, outW>>>0, outH>>>0);
  return new Uint8Array(0);
}
