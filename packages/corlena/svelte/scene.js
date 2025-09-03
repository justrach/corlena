// Svelte scene overlay - port of React version using stores
import { writable, derived, get } from 'svelte/store';
import { onMount, onDestroy } from 'svelte';

// Scene store - manages WASM and global state
export function createScene(options = {}) {
  const { capacity = 256, pixelRatio = 1, tapParams } = options;
  
  // Core state
  const ready = writable(false);
  const wasmRef = { current: null };
  const rafRef = { current: 0 };
  const lastTs = { current: 0 };
  const transformsRef = { current: new Map() };
  const listenersRef = { current: new Map() };
  const layerRef = { current: null };

  // RAF loop
  const tick = () => {
    rafRef.current = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - lastTs.current) / 1000));
    lastTs.current = now;
    const wasm = wasmRef.current;
    if (!wasm) return;
    const out = wasm.processFrame?.({ dt }) || {};
    const tr = out.transforms;
    if (tr && tr.length) {
      const map = transformsRef.current;
      map.clear();
      const stride = 7; // [id,x,y,angle,sx,sy,reserved]
      for (let i = 0; i + 6 < tr.length; i += stride) {
        const id = tr[i] | 0;
        map.set(id, { x: tr[i + 1], y: tr[i + 2], angle: tr[i + 3], sx: tr[i + 4], sy: tr[i + 5] });
      }
    }
    const ev = out.events;
    if (ev && ev.length) dispatchEvents(ev);
  };

  // Event dispatcher
  const dispatchEvents = (events) => {
    const stride = 4; // [type, a, b, data]
    for (let i = 0; i + 3 < events.length; i += stride) {
      const type = events[i] | 0;
      const nodeId = events[i + 1] | 0;
      const handlers = listenersRef.current.get(nodeId);
      if (!handlers) continue;
      
      if (type === 1 && handlers.onDragStart) handlers.onDragStart(nodeId);
      else if (type === 2 && handlers.onDragEnd) handlers.onDragEnd(nodeId);
      else if (type === 10 && handlers.onTap) handlers.onTap(nodeId);
      else if (type === 11 && handlers.onDoubleTap) handlers.onDoubleTap(nodeId);
    }
  };

  // Initialize WASM
  const init = async () => {
    try {
      const wasm = await import('corlena/wasm');
      wasmRef.current = wasm;
      await wasm.init?.(capacity);
      wasm.setViewParams?.(1, 0, 0, pixelRatio);
      if (tapParams && typeof wasm.setTapParams === 'function') {
        wasm.setTapParams(tapParams);
      }
      // Set physics constraints with higher damping for immediate response
      wasm.setConstraints?.(new Float32Array([0, 0, 1000, 1000, 1, 1, 0, 0.95]));
      ready.set(true);
      lastTs.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      ready.set(false);
    }
  };

  // API functions
  const upsertNode = (node) => {
    const wasm = wasmRef.current;
    if (!wasm) return;
    const { id, x = 0, y = 0, w = 100, h = 60, vx = 0, vy = 0, flags = 0 } = node || {};
    const buf = new Float32Array([id, x, y, w, h, vx, vy, flags]);
    wasm.upsertNodes?.(buf);
  };

  const registerHandlers = (id, handlers) => {
    const map = listenersRef.current;
    if (!handlers) { map.delete(id); return; }
    map.set(id, handlers);
    return () => map.delete(id);
  };

  const applyPointer = (id, x, y, buttons) => {
    const wasm = wasmRef.current;
    if (!wasm) return;
    const arr = new Float32Array([id, x, y, buttons > 0 ? 0.7 : 0.0, buttons]);
    wasm.applyPointers?.(arr);
  };

  const getTransform = (id) => transformsRef.current.get(id) || null;

  const toLocal = (clientX, clientY) => {
    const el = layerRef.current;
    if (!el) return { x: clientX, y: clientY };
    const r = el.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const setLayerRef = (el) => {
    layerRef.current = el;
  };

  const destroy = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  return {
    ready,
    init,
    destroy,
    upsertNode,
    registerHandlers,
    applyPointer,
    getTransform,
    toLocal,
    setLayerRef
  };
}

// Scene context store
let sceneContext = null;

export function getSceneContext() {
  if (!sceneContext) {
    throw new Error('Scene context not found. Make sure to use SceneProvider.');
  }
  return sceneContext;
}

export function setSceneContext(context) {
  sceneContext = context;
}
