<script lang="ts">
  import { onMount } from 'svelte';

  // Image layer model
  type ImgLayer = { id: number; img: HTMLImageElement; x: number; y: number; w: number; h: number };
  // Text overlay model
  type TextNode = {
    id: number;
    text: string;
    x: number; // in CSS px (canvas logical units)
    y: number;
    fontFamily: string;
    fontSize: number; // px
    fontWeight: number | string;
    color: string;
    align: CanvasTextAlign;
  };

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let raf = 0;
  let nextId = 1;

  let imgs: ImgLayer[] = [];
  let texts: TextNode[] = [];

  // UI state
  let editingId: number | null = null;
  let editingValue = '';
  let draggingId: number | null = null;
  let draggingType: 'text' | 'image' | null = null;
  let dragDX = 0; // pointer-to-target offset X
  let dragDY = 0; // pointer-to-target offset Y
  let startPX = 0; // pointer down X
  let startPY = 0; // pointer down Y
  let moved = 0; // accumulated move distance

  // Multi-pointer pinch state
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchActive = false;
  let pinchStartDist = 0;
  let pinchStartCenter = { x: 0, y: 0 };
  let pinchTargetType: 'text' | 'image' | null = null;
  let pinchTargetId: number | null = null;
  // Text pinch
  let pinchStartFontSize = 0;
  let pinchStartTextX = 0;
  let pinchStartTextY = 0;
  // Image pinch
  let pinchStartImg = { w: 0, h: 0, x: 0, y: 0, relX: 0, relY: 0 };

  // DOM refs
  let inputEl: HTMLInputElement | null = null;
  let frameEl: HTMLDivElement | null = null;
  let hudEl: HTMLDivElement | null = null;
  let hudPressing = false;

  // Canvas size handled by CSS aspect-ratio, but pixels by DPR
  function resize() {
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const wCss = canvas.clientWidth;
    const hCss = canvas.clientHeight;
    canvas.width = Math.floor(wCss * dpr);
    canvas.height = Math.floor(hCss * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
    if (editingId != null) positionInputOverNode();
    positionHud();
  }

  // Helpers for selected text node (editing takes precedence, else last interacted, else last in list)
  function getSelectedText(): TextNode | null {
    if (editingId != null) return texts.find(t => t.id === editingId) || null;
    if (draggingType === 'text' && draggingId != null) return texts.find(t => t.id === draggingId) || null;
    return texts.length ? texts[texts.length - 1] : null;
  }
  function updateSelectedText(mut: (t: TextNode) => TextNode) {
    const sel = getSelectedText();
    if (!sel) return;
    texts = texts.map(t => t.id === sel.id ? mut(t) : t);
    if (editingId === sel.id) {
      // Keep input positioned with font changes
      positionInputOverNode();
    }
    positionHud();
  }
  function adjustFont(delta: number) {
    updateSelectedText(t => ({ ...t, fontSize: Math.max(8, Math.min(220, Math.round(t.fontSize + delta))) }));
  }
  function setColor(color: string) {
    updateSelectedText(t => ({ ...t, color }));
  }

  function compose() {
    if (!ctx || !canvas) return;
    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    // Draw images
    for (const L of imgs) {
      if (!L.img.complete) continue;
      ctx.drawImage(L.img, L.x, L.y, L.w, L.h);
    }

    // Draw texts
    for (const T of texts) {
      ctx.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
      ctx.textAlign = T.align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = T.color;
      const x = T.x;
      const y = T.y;
      const displayText = (T.id === editingId ? editingValue : T.text);
      // Draw text only if not currently editing this node
      if (T.id !== editingId) {
        // shadow for readability
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 4;
        ctx.lineWidth = 2;
        ctx.fillText(displayText, x, y);
        ctx.shadowBlur = 0;
      }

      // selection bbox (if editing or dragging)
      if (T.id === editingId || T.id === draggingId) {
        const metrics = ctx.measureText(displayText || ' ');
        const width = metrics.width;
        const ascent = metrics.actualBoundingBoxAscent || T.fontSize * 0.8;
        const descent = metrics.actualBoundingBoxDescent || T.fontSize * 0.2;
        const height = ascent + descent;
        let left = x;
        if (T.align === 'center') left = x - width / 2;
        else if (T.align === 'right' || T.align === 'end') left = x - width;
        const top = y - ascent;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.strokeRect(left - 6, top - 6, width + 12, height + 12);
      }
    }
  }

  function loop() {
    compose();
    raf = requestAnimationFrame(loop);
  }

  onMount(() => {
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    const onResize = () => resize();
    resize();
    window.addEventListener('resize', onResize);
    const onDocPointerDown = (e: PointerEvent) => {
      if (editingId == null) return;
      // If click is outside the input element, commit and hide
      const path = (e.composedPath && e.composedPath()) || [];
      if (inputEl && (path as EventTarget[]).includes(inputEl)) return;
      if (hudEl && (path as EventTarget[]).includes(hudEl)) return;
      stopEdit(true);
    };
    window.addEventListener('pointerdown', onDocPointerDown, true);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onDocPointerDown, true);
    };
  });

  // Upload handler
  async function onUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = url;
      });
      // Fit image to width inside frame, keep aspect
      const frameW = canvas?.clientWidth || 360;
      const frameH = canvas?.clientHeight || 640;
      const scale = Math.min(frameW / img.naturalWidth, frameH / img.naturalHeight);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const x = Math.round((frameW - w) / 2);
      const y = Math.round((frameH - h) / 2);
      imgs = [...imgs, { id: nextId++, img, x, y, w, h }];
    }
    // reset
    (e.target as HTMLInputElement).value = '';
  }

  function addText() {
    const frameW = canvas?.clientWidth || 360;
    const frameH = canvas?.clientHeight || 640;
    const node: TextNode = {
      id: nextId++,
      text: 'Tap to edit',
      x: Math.round(frameW / 2),
      y: Math.round(frameH / 2),
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: 28,
      fontWeight: 700,
      color: '#fff',
      align: 'center'
    };
    texts = [...texts, node];
    startEdit(node);
    queueMicrotask(positionHud);
  }

  function startEdit(node: TextNode) {
    editingId = node.id;
    editingValue = node.text;
    // position input over text on next tick
    justOpened = true;
    queueMicrotask(positionInputOverNode);
    queueMicrotask(positionHud);
  }

  function stopEdit(commit = true) {
    if (editingId != null && commit) {
      texts = texts.map(t => t.id === editingId ? { ...t, text: editingValue } : t);
    }
    editingId = null;
    if (inputEl) {
      inputEl.style.display = 'none';
      inputEl.blur();
    }
    queueMicrotask(positionHud);
  }

  let justOpened = false;
  function positionInputOverNode() {
    if (!inputEl || !canvas || editingId == null) return;
    const T = texts.find(t => t.id === editingId);
    if (!T || !ctx) return;
    ctx.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
    ctx.textAlign = T.align;
    const measureText = (editingValue ?? T.text) || ' ';
    const metrics = ctx.measureText(measureText);
    const width = Math.max(60, metrics.width + 16);
    const ascent = metrics.actualBoundingBoxAscent || T.fontSize * 0.8;
    const descent = metrics.actualBoundingBoxDescent || T.fontSize * 0.2;
    const height = ascent + descent;
    let left = T.x;
    if (T.align === 'center') left = T.x - width / 2;
    else if (T.align === 'right' || T.align === 'end') left = T.x - width;
    const top = T.y - ascent;
    const rect = canvas.getBoundingClientRect();
    inputEl.style.display = 'block';
    inputEl.style.left = `${Math.round(rect.left + left - 8)}px`;
    inputEl.style.top = `${Math.round(rect.top + top - 8)}px`;
    inputEl.style.width = `${Math.round(width + 16)}px`;
    inputEl.style.height = `${Math.round(height + 16)}px`;
    inputEl.style.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
    inputEl.style.color = T.color;
    if (inputEl.value !== editingValue) inputEl.value = editingValue;
    if (justOpened) {
      inputEl.focus();
      inputEl.select();
      justOpened = false;
    }
  }

  function positionHud() {
    if (!hudEl || !canvas) return;
    const sel = getSelectedText();
    if (!sel || !ctx) { hudEl.style.display = 'none'; return; }
    // Measure selected text bbox
    ctx.font = `${sel.fontWeight} ${sel.fontSize}px ${sel.fontFamily}`;
    ctx.textAlign = sel.align;
    const m = ctx.measureText((sel.id === editingId ? editingValue : sel.text) || ' ');
    const width = Math.max(1, m.width);
    const ascent = m.actualBoundingBoxAscent || sel.fontSize * 0.8;
    const leftBase = sel.align === 'center' ? sel.x - width / 2 : sel.align === 'right' || sel.align === 'end' ? sel.x - width : sel.x;
    const topBase = sel.y - ascent;
    const rect = canvas.getBoundingClientRect();
    let hudX = rect.left + leftBase + width / 2 - 48; // center HUD approx
    let hudY = rect.top + topBase - 40; // above text
    // Clamp within frame bounds if possible
    const margin = 6;
    hudX = Math.max(margin, Math.min(hudX, rect.right - rect.left - 96 - margin)) + rect.left - rect.left;
    // Position with fixed coordinates
    hudEl.style.display = 'flex';
    hudEl.style.left = `${Math.round(hudX + rect.left)}px`;
    hudEl.style.top = `${Math.round(hudY)}px`;
  }

  function onPointerDown(e: PointerEvent) {
    if (!canvas || !ctx) return;
    // If editing, first commit and hide input, then continue with interaction
    if (editingId != null) {
      stopEdit(true);
    }
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    startPX = x; startPY = y; moved = 0;
    draggingId = null; draggingType = null;

    // Track pointer for potential pinch
    pointers.set(e.pointerId, { x, y });

    // If two pointers active, start pinch
    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      pinchStartCenter = { x: cx, y: cy };
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchStartDist = Math.max(1, Math.hypot(dx, dy));
      // choose target at center (text on top of images)
      pinchTargetId = null; pinchTargetType = null;
      // hit test texts top-most
      for (let i = texts.length - 1; i >= 0; i--) {
        const T = texts[i];
        ctx.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
        ctx.textAlign = T.align;
        const m = ctx.measureText(T.text || ' ');
        const width = Math.max(1, m.width);
        const ascent = m.actualBoundingBoxAscent || T.fontSize * 0.8;
        const descent = m.actualBoundingBoxDescent || T.fontSize * 0.2;
        const height = ascent + descent;
        let left = T.x;
        if (T.align === 'center') left = T.x - width / 2;
        else if (T.align === 'right' || T.align === 'end') left = T.x - width;
        const top = T.y - ascent;
        if (cx >= left - 8 && cx <= left + width + 8 && cy >= top - 8 && cy <= top + height + 8) {
          pinchTargetType = 'text';
          pinchTargetId = T.id;
          pinchStartFontSize = T.fontSize;
          pinchStartTextX = T.x;
          pinchStartTextY = T.y;
          break;
        }
      }
      if (!pinchTargetType) {
        // hit test images
        for (let i = imgs.length - 1; i >= 0; i--) {
          const L = imgs[i];
          if (cx >= L.x && cx <= L.x + L.w && cy >= L.y && cy <= L.y + L.h) {
            pinchTargetType = 'image';
            pinchTargetId = L.id;
            // store start and relative anchor within the image
            pinchStartImg = {
              w: L.w, h: L.h, x: L.x, y: L.y,
              relX: (cx - L.x) / Math.max(1, L.w),
              relY: (cy - L.y) / Math.max(1, L.h)
            };
            break;
          }
        }
      }
      pinchActive = !!pinchTargetType;
      e.preventDefault();
      try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
      return;
    }
    // Prefer text hits first (top-most)
    for (let i = texts.length - 1; i >= 0; i--) {
      const T = texts[i];
      ctx.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
      ctx.textAlign = T.align;
      const m = ctx.measureText(T.text || ' ');
      const width = Math.max(1, m.width);
      const ascent = m.actualBoundingBoxAscent || T.fontSize * 0.8;
      const descent = m.actualBoundingBoxDescent || T.fontSize * 0.2;
      const height = ascent + descent;
      let left = T.x;
      if (T.align === 'center') left = T.x - width / 2;
      else if (T.align === 'right' || T.align === 'end') left = T.x - width;
      const top = T.y - ascent;
      if (x >= left - 8 && x <= left + width + 8 && y >= top - 8 && y <= top + height + 8) {
        draggingId = T.id;
        draggingType = 'text';
        dragDX = x - T.x;
        dragDY = y - T.y;
        e.preventDefault();
        try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
        return;
      }
    }
    // Hit-test images next (top-most)
    for (let i = imgs.length - 1; i >= 0; i--) {
      const L = imgs[i];
      if (x >= L.x && x <= L.x + L.w && y >= L.y && y <= L.y + L.h) {
        draggingId = L.id;
        draggingType = 'image';
        dragDX = x - L.x;
        dragDY = y - L.y;
        e.preventDefault();
        try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
        return;
      }
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update tracked pointer position if present
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x, y });
    }

    // Pinch-to-zoom handling
    if (pinchActive && pointers.size >= 2 && pinchTargetType && pinchTargetId != null) {
      const pts = Array.from(pointers.values()).slice(0, 2);
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const scale = dist / Math.max(1, pinchStartDist);

      if (pinchTargetType === 'text') {
        texts = texts.map(t => {
          if (t.id !== pinchTargetId) return t;
          const newSize = Math.max(8, Math.min(200, Math.round(pinchStartFontSize * scale)));
          // Keep center anchored to current pinch center by moving x/y if alignment is center
          let nx = t.x;
          if (t.align === 'center') nx = cx; // simple: center-aligned text anchors at center
          else if (t.align === 'left' || t.align === 'start') nx = cx; // approximate
          else nx = cx; // right/end approximate
          const ny = cy;
          return { ...t, fontSize: newSize, x: Math.round(nx), y: Math.round(ny) };
        });
        positionHud();
      } else if (pinchTargetType === 'image') {
        imgs = imgs.map(L => {
          if (L.id !== pinchTargetId) return L;
          const newW = Math.max(16, Math.round(pinchStartImg.w * scale));
          const newH = Math.max(16, Math.round(pinchStartImg.h * scale));
          const nx = Math.round(cx - pinchStartImg.relX * newW);
          const ny = Math.round(cy - pinchStartImg.relY * newH);
          return { ...L, w: newW, h: newH, x: nx, y: ny };
        });
      }
      e.preventDefault();
      return;
    }

    // Regular drag (single pointer)
    if (draggingId == null || !draggingType) return;
    moved = Math.max(moved, Math.hypot(x - startPX, y - startPY));
    if (draggingType === 'text') {
      texts = texts.map(t => t.id === draggingId ? { ...t, x: Math.round(x - dragDX), y: Math.round(y - dragDY) } : t);
      positionHud();
    } else if (draggingType === 'image') {
      imgs = imgs.map(L => L.id === draggingId ? { ...L, x: Math.round(x - dragDX), y: Math.round(y - dragDY) } : L);
    }
  }

  function onPointerUp(e: PointerEvent) {
    const rect = canvas?.getBoundingClientRect();
    const px = rect ? e.clientX - rect.left : 0;
    const py = rect ? e.clientY - rect.top : 0;
    // Remove from tracked pointers
    pointers.delete(e.pointerId);
    if (pinchActive && pointers.size < 2) {
      pinchActive = false; pinchTargetType = null; pinchTargetId = null;
    }
    if (draggingId != null && draggingType === 'text') {
      // If it was a click (small movement), open edit
      if (moved < 4) {
        const t = texts.find(n => n.id === draggingId);
        if (t) startEdit(t);
      }
    }
    draggingId = null; draggingType = null; moved = 0;
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch {}
    positionHud();
  }

  function onPointerCancel(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pinchActive && pointers.size < 2) {
      pinchActive = false; pinchTargetType = null; pinchTargetId = null;
    }
    draggingId = null; draggingType = null; moved = 0;
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch {}
  }

  function onWheel(e: WheelEvent) {
    if (!canvas || !ctx) return;
    // Treat Ctrl/Meta + wheel as pinch-zoom for desktop trackpads
    if (!(e.ctrlKey || e.metaKey)) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dz = -e.deltaY;
    // Convert delta to a smooth scale factor
    const scale = Math.exp(dz * 0.0015);

    // Prefer text hit under cursor
    let handled = false;
    for (let i = texts.length - 1; i >= 0; i--) {
      const T = texts[i];
      ctx.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
      ctx.textAlign = T.align;
      const m = ctx.measureText(T.text || ' ');
      const width = Math.max(1, m.width);
      const ascent = m.actualBoundingBoxAscent || T.fontSize * 0.8;
      const descent = m.actualBoundingBoxDescent || T.fontSize * 0.2;
      const height = ascent + descent;
      let left = T.x;
      if (T.align === 'center') left = T.x - width / 2;
      else if (T.align === 'right' || T.align === 'end') left = T.x - width;
      const top = T.y - ascent;
      if (x >= left - 8 && x <= left + width + 8 && y >= top - 8 && y <= top + height + 8) {
        const newSize = Math.max(8, Math.min(220, Math.round(T.fontSize * scale)));
        texts = texts.map(t => t.id === T.id ? { ...t, fontSize: newSize, x: Math.round(x), y: Math.round(y) } : t);
        handled = true;
        break;
      }
    }
    if (!handled) {
      // Try images under cursor
      for (let i = imgs.length - 1; i >= 0; i--) {
        const L = imgs[i];
        if (x >= L.x && x <= L.x + L.w && y >= L.y && y <= L.y + L.h) {
          const relX = (x - L.x) / Math.max(1, L.w);
          const relY = (y - L.y) / Math.max(1, L.h);
          const newW = Math.max(16, Math.round(L.w * scale));
          const newH = Math.max(16, Math.round(L.h * scale));
          const nx = Math.round(x - relX * newW);
          const ny = Math.round(y - relY * newH);
          imgs = imgs.map(img => img.id === L.id ? { ...img, w: newW, h: newH, x: nx, y: ny } : img);
          handled = true;
          break;
        }
      }
    }
    if (handled) {
      e.preventDefault();
      positionHud();
    }
  }

  function exportBlob() {
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      // Auto-download
      const a = document.createElement('a');
      a.href = url;
      a.download = 'composition.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }
</script>

<style>
  .wrap { display: grid; gap: 12px; }
  .toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .frame { width: min(420px, 100%); aspect-ratio: 9 / 16; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a2a; background: #000; position: relative; }
  canvas { width: 100%; height: 100%; display: block; touch-action: none; background: #000; }
  .edit-input { position: fixed; z-index: 10; display: none; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: rgba(0,0,0,0.6); color: #fff; outline: none; }
  .hud { position: fixed; z-index: 11; display: none; gap: 6px; align-items: center; padding: 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.25); background: rgba(24,24,24,0.8); backdrop-filter: blur(6px); }
  .note { color: #888; font-size: 12px; }
</style>

<div class="wrap">
  <h2>IG Composer</h2>
  <div class="toolbar">
    <input type="file" accept="image/*" multiple on:change={onUpload} />
    <button on:click={addText}>Add Text</button>
    <button on:click={exportBlob}>Export PNG</button>
    <div style="display:flex;gap:6px;align-items:center">
      <button on:click={() => adjustFont(-2)} title="Smaller">A-</button>
      <button on:click={() => adjustFont(+2)} title="Larger">A+</button>
      <input type="color" on:input={(e) => setColor((e.target as HTMLInputElement).value)} title="Text color" />
    </div>
    <span class="note">9:16 canvas. Drag text to position. Click text to edit.</span>
  </div>
  <div class="frame" bind:this={frameEl}>
    <canvas
      bind:this={canvas}
      on:pointerdown={onPointerDown}
      on:pointermove={onPointerMove}
      on:pointerup={onPointerUp}
      on:pointercancel={onPointerCancel}
      on:pointerleave={onPointerCancel}
      on:wheel={onWheel}
    ></canvas>
  </div>
  <nav><a href="/">Home</a> • <a href="/igcanvas">Black Canvas</a> • <a href="/canvas">Squares</a> • <a href="/wasm">WASM</a></nav>
</div>

<input class="edit-input" bind:this={inputEl}
  on:blur={() => { if (hudPressing) { queueMicrotask(() => inputEl?.focus()); return; } stopEdit(true); }}
  on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); stopEdit(true); } if (e.key === 'Escape') { e.preventDefault(); stopEdit(false); } }}
  on:input={(e) => { editingValue = (e.target as HTMLInputElement).value; positionInputOverNode(); positionHud(); }}
/>

<div class="hud" bind:this={hudEl} role="toolbar" aria-label="Text controls"
  on:pointerdown={(e) => { hudPressing = true; e.preventDefault(); }}
  on:pointerup={() => { hudPressing = false; }}
  on:pointercancel={() => { hudPressing = false; }}
  on:pointerleave={() => { hudPressing = false; }}>
  <button on:click={() => adjustFont(-2)} title="Smaller">A-</button>
  <button on:click={() => adjustFont(+2)} title="Larger">A+</button>
  <input type="color" on:input={(e) => setColor((e.target as HTMLInputElement).value)} title="Text color" />
</div>
