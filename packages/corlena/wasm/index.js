// WASM boundary wrapper. Aligns with packages/wasm/src/lib.rs
// Dynamic loading with fallback: prefer the co-located pkg/ bundle, else
// fall back to the published '@corlena/wasm' bundle so it works OOTB.

let mod = null; // wasm module bindings (from wasm-pack pkg)
let ready = false;
let wasmInit = null;
let wasmPkg = null;

export async function init(capacity = 256) {
  try {
    // Try local pkg first (synced by scripts/sync-wasm.mjs)
    if (!wasmInit || !wasmPkg) {
      try {
        const m = await import('./pkg/corlena_wasm.js');
        wasmPkg = m;
        wasmInit = m.default;
      } catch {
        // Fallback to published package assets
        const m = await import('@corlena/wasm/pkg/corlena_wasm.js');
        wasmPkg = m;
        wasmInit = m.default;
      }
    }
    if (typeof wasmInit === 'function') {
      await wasmInit();
    }
    mod = wasmPkg;
    if (mod && typeof mod.init === 'function') mod.init(capacity >>> 0);
    ready = true;
  } catch (_) {
    ready = false;
  }
}

export function reset() {
  if (mod && typeof mod.reset === 'function') mod.reset();
}

export function setView(scale) {
  if (mod && typeof mod.set_view === 'function') mod.set_view(Number(scale) || 1);
}

export function setViewParams(scale, panX, panY, pixelRatio) {
  if (mod && typeof mod.set_view_params === 'function') {
    const s = Number(scale) || 1;
    const px = Number(panX) || 0;
    const py = Number(panY) || 0;
    const pr = Number(pixelRatio) || 1;
    mod.set_view_params(s, px, py, pr);
  }
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
    return { transforms: out.transforms, particles: out.particles || new Float32Array(0), events: out.events };
  }
  // Fallback noop
  return { transforms: new Float32Array(0), particles: new Float32Array(0), events: new Int32Array(0) };
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

// Particle APIs
export function spawnParticles(arr) {
  if (mod && typeof mod.spawn_particles === 'function') {
    // Accept number[] or Float32Array
    const data = arr instanceof Float32Array ? arr : new Float32Array(arr || []);
    return mod.spawn_particles(data) >>> 0;
  }
  return 0;
}

export function clearParticles() {
  if (mod && typeof mod.clear_particles === 'function') mod.clear_particles();
}

export function setParticleParams(params) {
  if (mod && typeof mod.set_particle_params === 'function') {
    const data = params instanceof Float32Array ? params : new Float32Array(params || []);
    mod.set_particle_params(data);
  }
}

export function setTapParams(params) {
  // [tap_max_s, move_thresh_px, double_s, single_delay_s]
  if (mod && typeof mod.set_tap_params === 'function') {
    const data = params instanceof Float32Array ? params : new Float32Array(params || []);
    mod.set_tap_params(data);
  }
}
