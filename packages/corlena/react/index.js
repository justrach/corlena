// Lightweight React bindings for Corlena interactions
// ESM, no build step required

import React, { useCallback, useMemo, useRef, useState } from 'react';

export function useDraggable(options = {}) {
  const { initial = { x: 0, y: 0 }, onMove, lockScroll = true } = options;
  const [pos, setPos] = useState({ x: initial.x || 0, y: initial.y || 0 });
  const start = useRef({ x: 0, y: 0 });
  const origin = useRef({ x: pos.x, y: pos.y });

  const onPointerDown = useCallback((e) => {
    if (lockScroll) {
      try { e.preventDefault(); } catch {}
    }
    const el = e.currentTarget;
    try { el.setPointerCapture?.(e.pointerId); } catch {}
    start.current = { x: e.clientX, y: e.clientY };
    origin.current = { x: pos.x, y: pos.y };
  }, [pos.x, pos.y]);

  const onPointerMove = useCallback((e) => {
    if (e.buttons === 0) return; // ignore hover moves
    if (lockScroll) {
      try { e.preventDefault(); } catch {}
    }
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    const next = { x: origin.current.x + dx, y: origin.current.y + dy };
    setPos(next);
    onMove?.(next);
  }, [onMove]);

  const onPointerUp = useCallback(() => {}, []);

  const bind = useMemo(() => ({
    onPointerDown,
    onPointerMove,
    onPointerUp,
    style: { touchAction: 'none', userSelect: 'none', cursor: 'grab' }
  }), [onPointerDown, onPointerMove, onPointerUp]);

  return { ...pos, set: setPos, bind };
}

export function Draggable({ children, initial, onMove, style, className }) {
  const d = useDraggable({ initial, onMove });
  const mergedStyle = { position: 'absolute', left: d.x, top: d.y, ...style };
  return React.createElement('div', 
    { ...d.bind, style: mergedStyle, className }, 
    typeof children === 'function' ? children(d) : children
  );
}

export function useResizable(options = {}) {
  const { initial = { w: 120, h: 80 }, onResize, lockScroll = true } = options;
  const [size, setSize] = useState({ w: initial.w || 0, h: initial.h || 0 });
  const start = useRef({ x: 0, y: 0 });
  const origin = useRef({ w: size.w, h: size.h });

  const onPointerDown = useCallback((e) => {
    if (lockScroll) {
      try { e.preventDefault(); } catch {}
    }
    const el = e.currentTarget;
    try { el.setPointerCapture?.(e.pointerId); } catch {}
    start.current = { x: e.clientX, y: e.clientY };
    origin.current = { w: size.w, h: size.h };
  }, [size.w, size.h]);

  const onPointerMove = useCallback((e) => {
    if (e.buttons === 0) return;
    if (lockScroll) {
      try { e.preventDefault(); } catch {}
    }
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    const next = { w: Math.max(1, origin.current.w + dx), h: Math.max(1, origin.current.h + dy) };
    setSize(next);
    onResize?.(next);
  }, [onResize]);

  const handleProps = useMemo(() => ({
    onPointerDown,
    onPointerMove,
    style: {
      position: 'absolute', right: 0, bottom: 0, width: 14, height: 14,
      cursor: 'nwse-resize', background: 'rgba(0,0,0,0.15)', borderRadius: 2, touchAction: 'none'
    }
  }), [onPointerDown, onPointerMove]);

  return { ...size, set: setSize, handleProps };
}

export function Resizable({ children, style, className, initial, onResize }) {
  const r = useResizable({ initial, onResize });
  const mergedStyle = { position: 'absolute', width: r.w, height: r.h, ...style };
  return React.createElement('div', 
    { style: mergedStyle, className },
    typeof children === 'function' ? children(r) : children,
    React.createElement('div', r.handleProps)
  );
}

// Overlay exports
export { SceneProvider, DomLayer, DomNode, useScene } from './scene.js';
export { DrawingCanvas } from './DrawingCanvas.js';
