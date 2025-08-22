import type { DraggableOptions, DragEventDetail } from '../types';
import { getConfig } from '../config';

export function draggable(node: HTMLElement, options: DraggableOptions = {}) {
  let opts: Required<DraggableOptions> = {
    axis: options.axis ?? 'both',
    grid: options.grid ?? [1, 1],
    scale: (options as any).scale ?? 1,
    bounds: options.bounds ?? 'parent',
    inertia: options.inertia ?? false,
    lockScroll: options.lockScroll ?? true,
    useWasm: options.useWasm ?? false
  } as any;

  let startX = 0;
  let startY = 0;
  let tx = 0;
  let ty = 0;
  let rectParent: DOMRect | null = null;
  let pointerId: number | null = null;
  let dragging = false;

  const cfg = getConfig();

  function setCursor(v: string | null) {
    if (!v) return;
    node.style.cursor = v;
  }

  function snap(val: number, step: number) {
    return step > 1 ? Math.round(val / step) * step : val;
  }

  function withinBounds(x: number, y: number) {
    if (opts.bounds === 'parent' && rectParent) {
      const r = node.getBoundingClientRect();
      const maxX = rectParent.width - r.width;
      const maxY = rectParent.height - r.height;
      x = Math.min(Math.max(0, x), Math.max(0, maxX));
      y = Math.min(Math.max(0, y), Math.max(0, maxY));
    } else if (opts.bounds && typeof opts.bounds === 'object') {
      const r = node.getBoundingClientRect();
      const maxX = opts.bounds.right - opts.bounds.left - r.width;
      const maxY = opts.bounds.bottom - opts.bounds.top - r.height;
      x = Math.min(Math.max(opts.bounds.left, x), Math.max(opts.bounds.left, maxX));
      y = Math.min(Math.max(opts.bounds.top, y), Math.max(opts.bounds.top, maxY));
    }
    return { x, y };
  }

  function apply(x: number, y: number) {
    node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function dispatch(type: string, detail: DragEventDetail) {
    node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  }

  function onPointerDown(e: PointerEvent) {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    dragging = true;
    if (opts.lockScroll) {
      // Prevent iOS from initiating scroll/zoom gestures on drag start
      e.preventDefault();
    }
    node.setPointerCapture(pointerId);

    const style = getComputedStyle(node);
    const m = /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px/.exec(style.transform);
    if (m) {
      tx = parseFloat(m[1]);
      ty = parseFloat(m[2]);
    } else {
      tx = 0; ty = 0;
    }

    startX = e.clientX;
    startY = e.clientY;
    rectParent = node.parentElement?.getBoundingClientRect() ?? null;

    if (opts.lockScroll) {
      node.style.touchAction = 'none';
      (document.documentElement as HTMLElement).style.userSelect = 'none';
    }

    setCursor(cfg.defaultCursor);

    dispatch('dragstart', {
      x: tx,
      y: ty,
      dx: 0,
      dy: 0,
      source: 'pointer',
      modifiers: { alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey }
    });

    window.addEventListener('pointermove', onPointerMove, { passive: cfg.passive });
    window.addEventListener('pointerup', onPointerUp, { passive: cfg.passive });
    window.addEventListener('pointercancel', onPointerUp, { passive: cfg.passive });
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    const s = opts.scale ?? 1;
    let dx = (e.clientX - startX) / s;
    let dy = (e.clientY - startY) / s;

    let nx = tx + dx;
    let ny = ty + dy;

    if (opts.axis === 'x') ny = ty;
    if (opts.axis === 'y') nx = tx;

    nx = snap(nx, opts.grid[0]);
    ny = snap(ny, opts.grid[1]);

    const bounded = withinBounds(nx, ny);
    nx = bounded.x; ny = bounded.y;

    apply(nx, ny);

    dispatch('drag', {
      x: nx,
      y: ny,
      dx: nx - tx,
      dy: ny - ty,
      source: 'pointer',
      modifiers: { alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey }
    });
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    node.releasePointerCapture(e.pointerId);

    if (opts.lockScroll) {
      node.style.touchAction = '';
      (document.documentElement as HTMLElement).style.userSelect = '';
    }

    const style = getComputedStyle(node);
    const m = /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px/.exec(style.transform);
    const cx = m ? parseFloat(m[1]) : tx;
    const cy = m ? parseFloat(m[2]) : ty;

    dispatch('dragend', {
      x: cx,
      y: cy,
      dx: cx - tx,
      dy: cy - ty,
      source: 'pointer',
      modifiers: { alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey }
    });

    setCursor('');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }

  node.addEventListener('pointerdown', onPointerDown, { passive: getConfig().passive === true ? true : false });

  return {
    update(next: DraggableOptions) {
      opts = { ...opts, ...next } as any;
    },
    destroy() {
      node.removeEventListener('pointerdown', onPointerDown as any);
      window.removeEventListener('pointermove', onPointerMove as any);
      window.removeEventListener('pointerup', onPointerUp as any);
      window.removeEventListener('pointercancel', onPointerUp as any);
    }
  };
}
