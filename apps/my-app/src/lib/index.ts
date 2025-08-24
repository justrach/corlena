// Demo utilities for interacting with the corlena WASM boundary.
// This sets up a basic stateful scene with N nodes, optional grid snapping,
// bounds clamping, and simple inertia. It uses the WASM engine if available
// (via corlena/wasm), with a JS fallback for local development.

import * as wasm from 'corlena/wasm';

export type DemoOptions = {
  count?: number; // number of nodes
  size?: [number, number]; // node w,h
  grid?: [number, number]; // snap step; 1 means no snap
  inertia?: number; // >0 enables velocity integration
  damping?: number; // [0,1], exponential decay factor
  onDraw?: (ctx: CanvasRenderingContext2D) => void; // optional extra draw hook
};

type DemoHandle = {
  stop: () => void;
  hitAt?: (x: number, y: number) => boolean; // returns true if a node is under CSS pixel coords
};

// Typed array layouts must match the WASM engine:
// nodes: [id, x, y, w, h, vx, vy, flags] * N
// pointers: [id, x, y, buttons] * P
// constraints: [left, top, right, bottom, gridX, gridY, inertia, damping]

export async function startWasmDemo(container: HTMLElement, opts: DemoOptions = {}): Promise<DemoHandle> {
  const count = opts.count ?? 9;
  const [nw, nh] = opts.size ?? [80, 80];
  const [gx, gy] = opts.grid ?? [1, 1];
  const inertia = opts.inertia ?? 0;
  const damping = opts.damping ?? 1;

  // Setup container styles for absolute positioning demo
  container.style.position = container.style.position || 'relative';
  container.style.userSelect = 'none';

  let rect = container.getBoundingClientRect();
  const nodes = new Float32Array(count * 8);
  const pointers = new Float32Array(4); // single active pointer by id
  let hasPointer = false;
  let grabDX = 0, grabDY = 0;

  // Fill nodes in a grid
  let id = 1;
  const cols = Math.ceil(Math.sqrt(count));
  const spacing = Math.max(nw, nh) + 16;
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = 20 + c * spacing;
    const y = 20 + r * spacing;
    const base = i * 8;
    nodes[base + 0] = id; // id
    nodes[base + 1] = x;
    nodes[base + 2] = y;
    nodes[base + 3] = nw;
    nodes[base + 4] = nh;
    nodes[base + 5] = 0; // vx
    nodes[base + 6] = 0; // vy
    nodes[base + 7] = 0; // flags
    id++;
  }

  // Create DOM nodes
  const els: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const base = i * 8;
    const el = document.createElement('div');
    el.className = 'demo-node';
    el.style.position = 'absolute';
    el.style.width = `${nw}px`;
    el.style.height = `${nh}px`;
    el.style.left = `${nodes[base + 1]}px`;
    el.style.top = `${nodes[base + 2]}px`;
    el.style.background = 'rgba(99, 102, 241, 0.2)';
    el.style.border = '1px solid rgba(99, 102, 241, 1)';
    el.style.borderRadius = '8px';
    el.style.display = 'grid';
    el.style.placeItems = 'center';
    el.style.color = '#4f46e5';
    el.textContent = `#${nodes[base + 0]}`;
    el.dataset.id = String(nodes[base + 0]);
    container.appendChild(el);
    els.push(el);

    // Pointer interactions: set pointer to matching id while pressed
    el.addEventListener('pointerdown', (e) => {
      const nid = Number(el.dataset.id || '0');
      (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId);
      hasPointer = true;
      rect = container.getBoundingClientRect();
      pointers[0] = nid;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      pointers[1] = px;
      pointers[2] = py;
      pointers[3] = 1; // buttons down
      // compute grab offset between node top-left and pointer
      {
        const base = (nid - 1) * 8;
        grabDX = nodes[base + 1] - px;
        grabDY = nodes[base + 2] - py;
      }
      e.preventDefault();
    }, { passive: false });

    const onMove = (e: PointerEvent) => {
      if (!hasPointer) return;
      pointers[1] = e.clientX - rect.left;
      pointers[2] = e.clientY - rect.top;
    };
    const onUp = () => { hasPointer = false; pointers[3] = 0; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  // Initialize WASM engine (no-op fallback if pkg not built)
  await wasm.init(count + 16);
  const engineReady = typeof (wasm as any).isReady === 'function' && (wasm as any).isReady();
  if (engineReady) {
    wasm.reset();
    wasm.setView(1);
    wasm.setConstraints(new Float32Array([
      0, 0, rect.width, rect.height, gx, gy, inertia, damping
    ]));
    wasm.upsertNodes(nodes);
  }

  // JS fallback for transforms if WASM engine not available
  const jsStep = (dt: number) => {
    const useInertia = inertia > 0;
    const damp = damping < 1 ? Math.pow(damping, Math.max(0, dt)) : 1;
    for (let i = 0; i < count; i++) {
      const base = i * 8;
      const id = nodes[base + 0];
      // apply pointer if matching id
      if (hasPointer && Math.abs(pointers[0] - id) < 0.5 && pointers[3] > 0) {
        nodes[base + 1] = pointers[1] + grabDX;
        nodes[base + 2] = pointers[2] + grabDY;
        nodes[base + 5] = 0; nodes[base + 6] = 0;
      } else if (useInertia) {
        nodes[base + 1] += nodes[base + 5] * dt;
        nodes[base + 2] += nodes[base + 6] * dt;
        if (damping < 1) {
          nodes[base + 5] *= damp;
          nodes[base + 6] *= damp;
          if (Math.abs(nodes[base + 5]) < 1e-3) nodes[base + 5] = 0;
          if (Math.abs(nodes[base + 6]) < 1e-3) nodes[base + 6] = 0;
        }
      }
      if (gx > 1) nodes[base + 1] = Math.round(nodes[base + 1] / gx) * gx;
      if (gy > 1) nodes[base + 2] = Math.round(nodes[base + 2] / gy) * gy;
      // clamp
      nodes[base + 1] = Math.min(Math.max(0, nodes[base + 1]), Math.max(0, rect.width - nw));
      nodes[base + 2] = Math.min(Math.max(0, nodes[base + 2]), Math.max(0, rect.height - nh));
    }
  };

  // RAF loop
  let raf = 0;
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    // If WASM engine is loaded, use it; otherwise fallback to JS
    const useWasm = typeof (wasm as any).isReady === 'function' && (wasm as any).isReady();
    if (useWasm) {
      (wasm as any).applyPointers?.(pointers);
      const out = wasm.processFrame({ dt });
      const t = out.transforms;
      if (t && t.length >= count * 7) {
        for (let i = 0; i < count; i++) {
          const tid = t[i * 7 + 0];
          const x = t[i * 7 + 1];
          const y = t[i * 7 + 2];
          const base = (tid - 1) * 8;
          if (base >= 0 && base + 7 < nodes.length) {
            nodes[base + 1] = x; nodes[base + 2] = y;
          }
        }
      } else {
        // Safety: fallback if transforms are empty (WASM not actually running)
        jsStep(dt);
      }
    } else {
      jsStep(dt);
    }

    // Apply to DOM
    for (let i = 0; i < count; i++) {
      const base = i * 8;
      els[i].style.transform = `translate(${nodes[base + 1]}px, ${nodes[base + 2]}px)`;
    }

    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop() { cancelAnimationFrame(raf); }
  };
}

export async function startCanvasDemo(canvas: HTMLCanvasElement, opts: DemoOptions = {}): Promise<DemoHandle> {
  const ctx = canvas.getContext('2d')!; // non-null: we throw if unavailable
  if (!ctx) throw new Error('2D context not available');

  const count = opts.count ?? 9;
  const [nw, nh] = opts.size ?? [64, 64];
  const [gx, gy] = opts.grid ?? [1, 1];
  const inertia = opts.inertia ?? 0;
  const damping = opts.damping ?? 1;

  // DPR-aware canvas
  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  const nodes = new Float32Array(count * 8);
  const pointers = new Float32Array(4);
  let hasPointer = false;
  let grabbedId = 0;
  let cGrabDX = 0, cGrabDY = 0;

  // Arrange nodes
  let id = 1;
  const cols = Math.ceil(Math.sqrt(count));
  const spacing = Math.max(nw, nh) + 12;
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = 20 + c * spacing;
    const y = 20 + r * spacing;
    const base = i * 8;
    nodes[base + 0] = id;
    nodes[base + 1] = x;
    nodes[base + 2] = y;
    nodes[base + 3] = nw;
    nodes[base + 4] = nh;
    nodes[base + 5] = 0;
    nodes[base + 6] = 0;
    nodes[base + 7] = 0;
    id++;
  }

  // WASM engine init
  await wasm.init(count + 16);
  const engineReady = typeof (wasm as any).isReady === 'function' && (wasm as any).isReady();
  if (engineReady) {
    wasm.reset();
    wasm.setView(1);
    wasm.setConstraints(new Float32Array([
      0, 0, canvas.clientWidth, canvas.clientHeight, gx, gy, inertia, damping
    ]));
    wasm.upsertNodes(nodes);
  }

  // Hit test helper
  function hitNode(x: number, y: number): number {
    for (let i = count - 1; i >= 0; i--) {
      const base = i * 8;
      const nx = nodes[base + 1], ny = nodes[base + 2];
      const w = nodes[base + 3], h = nodes[base + 4];
      if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) return nodes[base + 0];
    }
    return 0;
  }

  // Pointer events (CSS pixel coordinates)
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    grabbedId = hitNode(x, y);
    if (grabbedId) {
      (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId);
      hasPointer = true;
      pointers[0] = grabbedId;
      pointers[1] = x;
      pointers[2] = y;
      pointers[3] = 1;
      // compute grab offset so node doesn't jump under pointer
      const base = (grabbedId - 1) * 8;
      cGrabDX = nodes[base + 1] - x;
      cGrabDY = nodes[base + 2] - y;
      e.preventDefault();
    }
  }, { passive: false });
  const onMove = (e: PointerEvent) => {
    if (!hasPointer) return;
    const rect = canvas.getBoundingClientRect();
    pointers[1] = e.clientX - rect.left;
    pointers[2] = e.clientY - rect.top;
  };
  const onUp = () => { hasPointer = false; grabbedId = 0; pointers[3] = 0; };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  const jsStep = (dt: number) => {
    const useInertia = inertia > 0;
    const damp = damping < 1 ? Math.pow(damping, Math.max(0, dt)) : 1;
    for (let i = 0; i < count; i++) {
      const base = i * 8;
      const id = nodes[base + 0];
      if (hasPointer && grabbedId === id && pointers[3] > 0) {
        nodes[base + 1] = pointers[1] + cGrabDX;
        nodes[base + 2] = pointers[2] + cGrabDY;
        nodes[base + 5] = 0; nodes[base + 6] = 0;
      } else if (useInertia) {
        nodes[base + 1] += nodes[base + 5] * dt;
        nodes[base + 2] += nodes[base + 6] * dt;
        if (damping < 1) {
          nodes[base + 5] *= damp;
          nodes[base + 6] *= damp;
          if (Math.abs(nodes[base + 5]) < 1e-3) nodes[base + 5] = 0;
          if (Math.abs(nodes[base + 6]) < 1e-3) nodes[base + 6] = 0;
        }
      }
      if (gx > 1) nodes[base + 1] = Math.round(nodes[base + 1] / gx) * gx;
      if (gy > 1) nodes[base + 2] = Math.round(nodes[base + 2] / gy) * gy;
      nodes[base + 1] = Math.min(Math.max(0, nodes[base + 1]), Math.max(0, canvas.clientWidth - nw));
      nodes[base + 2] = Math.min(Math.max(0, nodes[base + 2]), Math.max(0, canvas.clientHeight - nh));
    }
  };

  let raf = 0; let last = performance.now(); let lastW = canvas.clientWidth, lastH = canvas.clientHeight;
  const tick = () => {
    const now = performance.now();
    const dt = (now - last) / 1000; last = now;

    // If resized, update constraints and adjust canvas
    if (canvas.clientWidth !== lastW || canvas.clientHeight !== lastH) {
      lastW = canvas.clientWidth; lastH = canvas.clientHeight; resize();
      if ((wasm as any).isReady?.()) {
        wasm.setConstraints(new Float32Array([0, 0, lastW, lastH, gx, gy, inertia, damping]));
      }
    }

    if ((wasm as any).isReady?.()) {
      (wasm as any).applyPointers?.(pointers);
      const out = wasm.processFrame({ dt });
      const t = out.transforms;
      if (t && t.length >= count * 7) {
        for (let i = 0; i < count; i++) {
          const tid = t[i * 7 + 0];
          const x = t[i * 7 + 1];
          const y = t[i * 7 + 2];
          const base = (tid - 1) * 8;
          if (base >= 0 && base + 7 < nodes.length) {
            nodes[base + 1] = x; nodes[base + 2] = y;
          }
        }
      } else {
        jsStep(dt);
      }
    } else {
      jsStep(dt);
    }

    // Draw
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    // allow page to draw overlays (e.g., image) before nodes
    try { opts.onDraw?.(ctx); } catch {}
    for (let i = 0; i < count; i++) {
      const base = i * 8;
      const x = nodes[base + 1], y = nodes[base + 2];
      ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.strokeStyle = 'rgba(99, 102, 241, 1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(x, y, nw, nh);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#4f46e5';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('#' + nodes[base + 0], x + nw / 2, y + nh / 2);
    }

    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    },
    hitAt(x: number, y: number): boolean {
      try { return hitNode(x, y) !== 0; } catch { return false; }
    }
  };
}
