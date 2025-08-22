import type { ResizableOptions, ResizeEdge, ResizeEventDetail } from '../types';
import { getConfig } from '../config';

type Handle = { edge: ResizeEdge; el: HTMLElement };

const ALL_EDGES: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export function resizable(node: HTMLElement, options: ResizableOptions = {}) {
  let opts: Required<ResizableOptions> = {
    edges: (options.edges ?? 'all') as any,
    min: options.min ?? [20, 20],
    max: (options.max ?? null) as any,
    aspect: options.aspect ?? false,
    lockScroll: options.lockScroll ?? true
  } as any;

  const cfg = getConfig();
  let handles: Handle[] = [];
  let active: ResizeEdge | null = null;
  let startX = 0, startY = 0;
  let startW = 0, startH = 0;
  let startL = 0, startT = 0; // left/top (for absolute positioned)
  let ratio = 1;

  function ensurePositioning() {
    const style = getComputedStyle(node);
    if (style.position === 'static') {
      node.style.position = 'relative';
    }
  }

  function parsePx(val: string | null): number | null {
    if (!val) return null;
    const m = /([-0-9.]+)px/.exec(val);
    return m ? parseFloat(m[1]) : null;
  }

  function getLeftTop(): { left: number; top: number } {
    const cs = getComputedStyle(node);
    const l = parsePx(cs.left);
    const t = parsePx(cs.top);
    if (l != null && t != null) return { left: l, top: t };
    const rect = node.getBoundingClientRect();
    const parentRect = node.parentElement?.getBoundingClientRect();
    if (parentRect) {
      return { left: rect.left - parentRect.left, top: rect.top - parentRect.top };
    }
    return { left: rect.left, top: rect.top };
  }

  function buildHandles() {
    destroyHandles();
    const edges = opts.edges === 'all' ? ALL_EDGES : opts.edges;
    for (const edge of edges) {
      const el = document.createElement('div');
      el.className = `cl-handle cl-handle-${edge}`;
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `Resize ${edge}`);
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); onPointerDown(e as PointerEvent, edge); }, { passive: false });
      el.addEventListener('keydown', (e) => onKeyDown(e as KeyboardEvent, edge));
      node.appendChild(el);
      handles.push({ edge, el });
    }
  }

  function destroyHandles() {
    for (const h of handles) h.el.remove();
    handles = [];
  }

  function clampSize(w: number, h: number) {
    const [minW, minH] = opts.min;
    if (opts.max) {
      const [maxW, maxH] = opts.max;
      w = Math.min(w, maxW);
      h = Math.min(h, maxH);
    }
    w = Math.max(w, minW);
    h = Math.max(h, minH);
    return { w, h };
  }

  function onPointerDown(e: PointerEvent, edge: ResizeEdge) {
    active = edge;
    (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId);
    const rect = node.getBoundingClientRect();
    startW = rect.width; startH = rect.height;
    const lt = getLeftTop();
    startL = lt.left; startT = lt.top;
    ratio = startW / startH || 1;
    startX = e.clientX; startY = e.clientY;
    if (opts.lockScroll) {
      node.style.touchAction = 'none';
      (document.documentElement as HTMLElement).style.userSelect = 'none';
    }
    dispatch('resizestart', { width: startW, height: startH, dw: 0, dh: 0, edge });
    window.addEventListener('pointermove', onPointerMove, { passive: cfg.passive });
    window.addEventListener('pointerup', onPointerUp, { passive: cfg.passive });
    window.addEventListener('pointercancel', onPointerUp, { passive: cfg.passive });
  }

  function onPointerMove(e: PointerEvent) {
    if (!active) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let newW = startW;
    let newH = startH;
    let newL = startL;
    let newT = startT;

    const edge = active;
    if (edge.includes('e')) newW = startW + dx;
    if (edge.includes('s')) newH = startH + dy;
    if (edge.includes('w')) { newW = startW - dx; newL = startL + dx; }
    if (edge.includes('n')) { newH = startH - dy; newT = startT + dy; }

    if (opts.aspect) {
      // preserve aspect by tying the secondary dimension
      const fromW = edge.includes('e') || edge.includes('w');
      if (fromW) {
        newH = newW / ratio;
        if (edge.includes('n')) newT = startT + (startH - newH);
      } else {
        newW = newH * ratio;
        if (edge.includes('w')) newL = startL + (startW - newW);
      }
    }

    const clamped = clampSize(newW, newH);
    newW = clamped.w; newH = clamped.h;

    apply(newL, newT, newW, newH);
    dispatch('resize', { width: newW, height: newH, dw: newW - startW, dh: newH - startH, edge });
  }

  function onPointerUp(_e: PointerEvent) {
    if (!active) return;
    const rect = node.getBoundingClientRect();
    dispatch('resizeend', { width: rect.width, height: rect.height, dw: rect.width - startW, dh: rect.height - startH, edge: active });
    active = null;
    if (opts.lockScroll) {
      node.style.touchAction = '';
      (document.documentElement as HTMLElement).style.userSelect = '';
    }
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }

  function onKeyDown(e: KeyboardEvent, edge: ResizeEdge) {
    const step = e.shiftKey ? 10 : 1;
    const rect = node.getBoundingClientRect();
    let w = rect.width, h = rect.height, l = getLeftTop().left, t = getLeftTop().top;
    if (e.key === 'ArrowRight') { if (edge.includes('w')) { w -= step; l += step; } else { w += step; } }
    if (e.key === 'ArrowLeft')  { if (edge.includes('w')) { w += -step; l += -step; } else { w += -step; } }
    if (e.key === 'ArrowDown')  { if (edge.includes('n')) { h -= step; t += step; } else { h += step; } }
    if (e.key === 'ArrowUp')    { if (edge.includes('n')) { h += -step; t += -step; } else { h += -step; } }
    const clamped = clampSize(w, h);
    apply(l, t, clamped.w, clamped.h);
    dispatch('resize', { width: clamped.w, height: clamped.h, dw: clamped.w - rect.width, dh: clamped.h - rect.height, edge });
  }

  function apply(l: number, t: number, w: number, h: number) {
    // Apply left/top if the element is absolutely positioned
    const cs = getComputedStyle(node);
    if (cs.position === 'absolute' || cs.position === 'relative') {
      node.style.left = `${l}px`;
      node.style.top = `${t}px`;
    }
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
  }

  function dispatch(type: string, detail: ResizeEventDetail) {
    node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  }

  ensurePositioning();
  buildHandles();

  return {
    update(next: ResizableOptions) {
      opts = { ...opts, ...next } as any;
      buildHandles();
    },
    destroy() {
      destroyHandles();
      window.removeEventListener('pointermove', onPointerMove as any);
      window.removeEventListener('pointerup', onPointerUp as any);
      window.removeEventListener('pointercancel', onPointerUp as any);
    }
  };
}
