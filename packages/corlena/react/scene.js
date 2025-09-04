// React overlay for Corlena WASM
// ESM, no build step required

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const SceneContext = createContext(null);

export function useScene() {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error('useScene must be used inside <SceneProvider>');
  return ctx;
}

export function SceneProvider({ children, tapParams, capacity = 256 }) {
  const wasmRef = useRef(null);
  const lastTs = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const rafRef = useRef(0);
  const [ready, setReady] = useState(false);
  const transformsRef = useRef(new Map()); // id -> { x, y, sx, sy, angle }
  const listenersRef = useRef(new Map());   // id -> { onTap, onDoubleTap, onDragStart, onDragEnd }
  const pixelRatio = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  const layerRef = useRef(null);

  // Drain events to listeners
  const dispatchEvents = useCallback((arr) => {
    if (!arr || arr.length === 0) return;
    const stride = 4; // [type, a, b, data]
    for (let i = 0; i + 3 < arr.length; i += stride) {
      const type = arr[i];
      const a = arr[i + 1];
      // const b = arr[i + 2];
      const h = listenersRef.current.get(a);
      if (!h) continue;
      if (type === 1) h.onDragStart?.(a);
      else if (type === 2) h.onDragEnd?.(a);
      else if (type === 10) h.onTap?.(a);
      else if (type === 11) h.onDoubleTap?.(a);
    }
  }, []);

  // RAF loop
  const tick = useCallback(() => {
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
    if (ev && ev.length) {
      console.log('Events:', ev);
      dispatchEvents(ev);
    }
  }, [dispatchEvents]);

  // Init wasm lazily on client
  useEffect(() => {
    let mounted = true;
    (async () => {
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
        setReady(true);
        lastTs.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setReady(false);
      }
    })();
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [capacity, pixelRatio, tapParams, tick]);

  // API: upsert node, pointer events, subscribe handlers, get transform
  const upsertNode = useCallback((node) => {
    const wasm = wasmRef.current;
    if (!wasm) return;
    const { id, x = 0, y = 0, w = 100, h = 60, vx = 0, vy = 0, flags = 0 } = node || {};
    const buf = new Float32Array([id, x, y, w, h, vx, vy, flags]);
    wasm.upsertNodes?.(buf);
  }, []);

  const registerHandlers = useCallback((id, handlers) => {
    const map = listenersRef.current;
    if (!handlers) { map.delete(id); return; }
    map.set(id, handlers);
    return () => map.delete(id);
  }, []);

  const applyPointer = useCallback((id, x, y, buttons) => {
    const wasm = wasmRef.current;
    if (!wasm) return;
    // stride=5 variant: [id, x, y, pressure, buttons]
    const arr = new Float32Array([id, x, y, buttons > 0 ? 0.7 : 0.0, buttons]);
    wasm.applyPointers?.(arr);
  }, []);

  const getTransform = useCallback((id) => transformsRef.current.get(id) || null, []);

  const toLocal = useCallback((clientX, clientY) => {
    const el = layerRef.current;
    if (!el) return { x: clientX, y: clientY };
    const r = el.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }, []);

  const value = useMemo(() => ({ ready, upsertNode, registerHandlers, applyPointer, getTransform, layerRef, toLocal }), [ready, upsertNode, registerHandlers, applyPointer, getTransform, toLocal]);

  return (
    <SceneContext.Provider value={value}>
      {typeof children === 'function' ? children({ ready }) : children}
    </SceneContext.Provider>
  );
}

export function DomLayer({ style, className, children }) {
  const { layerRef } = useScene();
  const merged = {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'auto',
    overflow: 'visible',
    ...style,
  };
  return (
    <div ref={layerRef} style={merged} className={className}>
      {children}
    </div>
  );
}

export function DomNode({ id, children, style, className, onTap, onDoubleTap, onDragStart, onDragEnd }) {
  const { registerHandlers, upsertNode, applyPointer, getTransform, toLocal } = useScene();
  const ref = useRef(null);
  const [css, setCss] = useState({ transform: 'translate3d(0px,0px,0px) scale(1,1)', transformOrigin: '0 0' });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Register event handlers
  useEffect(() => registerHandlers(id, { onTap, onDoubleTap, onDragStart, onDragEnd }), [id, onTap, onDoubleTap, onDragStart, onDragEnd, registerHandlers]);

  // Measure node and upsert
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new (window.ResizeObserver || class { observe(){} disconnect(){} })(() => {
      const r = el.getBoundingClientRect();
      const { x, y } = toLocal(r.left, r.top);
      upsertNode({ id, x, y, w: r.width, h: r.height });
    });
    try { ro.observe(el); } catch {}
    // initial
    const r = el.getBoundingClientRect();
    const { x, y } = toLocal(r.left, r.top);
    upsertNode({ id, x, y, w: r.width, h: r.height });
    return () => { try { ro.disconnect(); } catch {} };
  }, [id, toLocal, upsertNode]);

  // Animate CSS transform from WASM (only when not actively dragging)
  useEffect(() => {
    let raf = 0, mounted = true;
    const loop = () => {
      if (!mounted) return;
      // Only apply WASM transforms when not actively dragging
      if (!isDraggingRef.current) {
        const t = getTransform(id);
        if (t) {
          const deg = t.angle || 0;
          const tr = `translate3d(${t.x || 0}px, ${t.y || 0}px, 0px) rotate(${deg}rad) scale(${t.sx || 1}, ${t.sy || 1})`;
          setCss((prev) => (prev.transform === tr ? prev : { ...prev, transform: tr }));
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { mounted = false; cancelAnimationFrame(raf); };
  }, [id, getTransform]);

  const onPointerDown = useCallback((e) => {
    try { e.preventDefault(); } catch {}
    const el = e.currentTarget;
    try { el.setPointerCapture?.(e.pointerId); } catch {}
    const p = toLocal(e.clientX, e.clientY);
    
    // Calculate offset from pointer to node's current position (top-left)
    const rect = el.getBoundingClientRect();
    const nodeTopLeft = toLocal(rect.left, rect.top);
    dragOffsetRef.current = { x: p.x - nodeTopLeft.x, y: p.y - nodeTopLeft.y };
    isDraggingRef.current = true;
    
    applyPointer(id, p.x, p.y, 1);
  }, [applyPointer, id, toLocal]);

  const onPointerMove = useCallback((e) => {
    if (e.buttons === 0) return;
    try { e.preventDefault(); } catch {}
    const p = toLocal(e.clientX, e.clientY);
    
    if (isDraggingRef.current) {
      // Direct CSS transform during drag - bypass WASM physics for immediate response
      const targetX = p.x - dragOffsetRef.current.x;
      const targetY = p.y - dragOffsetRef.current.y;
      const tr = `translate3d(${targetX}px, ${targetY}px, 0px) scale(1, 1)`;
      setCss(prev => ({ ...prev, transform: tr }));
    }
    
    applyPointer(id, p.x, p.y, e.buttons);
  }, [applyPointer, id, toLocal]);

  const onPointerUp = useCallback((e) => {
    const p = toLocal(e.clientX, e.clientY);
    
    if (isDraggingRef.current) {
      // Update WASM with final position before releasing drag
      const targetX = p.x - dragOffsetRef.current.x;
      const targetY = p.y - dragOffsetRef.current.y;
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        upsertNode({ id, x: targetX, y: targetY, w: rect.width, h: rect.height });
      }
    }
    
    isDraggingRef.current = false;
    applyPointer(id, p.x, p.y, 0);
  }, [applyPointer, id, toLocal, upsertNode]);

  const mergedStyle = { position: 'absolute', touchAction: 'none', userSelect: 'none', ...css, ...style };

  return (
    <div ref={ref} style={mergedStyle} className={className} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {children}
    </div>
  );
}
