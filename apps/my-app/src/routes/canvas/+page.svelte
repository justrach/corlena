<script lang="ts">
  import { onMount } from 'svelte';
  import { startCanvasDemo } from '$lib';
  import * as wasm from '@corlena/core/wasm';

  let canvas: HTMLCanvasElement | null = null;
  let handle: { stop(): void; hitAt?: (x: number, y: number) => boolean } | null = null;
  let touchAction: 'none' | 'auto' | 'pan-x' | 'pan-y' = 'none';

  // Overlay image state
  const OVERLAY_ID = 10001;
  let hasImage = false;
  let origW = 0, origH = 0;
  let scale = 1.0; // 0.05 - 8
  let outW = 0, outH = 0;
  let resized: ImageData | null = null;
  let origData: ImageData | null = null;
  let overlayCanvas: HTMLCanvasElement | null = null;
  let status = '';
  let quality: 'nearest' | 'bilinear' = 'nearest';
  let editTarget: 'nodes' | 'image' = 'nodes';
  let wasmEnabled = false;
  // Overlay position (top-left in CSS pixels)
  let overlayX = 0, overlayY = 0;
  let overlayInit = false;
  // Track the live on-screen draw size used in onDraw to anchor center precisely on resample
  let liveDrawW = 0, liveDrawH = 0;
  // Track last pinch centroid (screen coords) to anchor resample at finger location
  let lastPinchCX = 0, lastPinchCY = 0;
  // Pinch-to-zoom tracking
  let pinching = false;
  const touches = new Map<number, { x: number; y: number }>();
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let pinchStartCX = 0, pinchStartCY = 0; // centroid at start
  let overlayStartX = 0, overlayStartY = 0; // overlay top-left at start
  // One-finger image panning
  let panning = false;
  let panStartX = 0, panStartY = 0;
  let recalcTimer: any = null;
  function scheduleRecalc(ms = 120, anchorCenter = true) {
    if (recalcTimer) clearTimeout(recalcTimer);
    recalcTimer = setTimeout(() => recalc(anchorCenter), ms);
  }
  function onScaleInput() { scheduleRecalc(120, true); }

  onMount(() => {
    if (!canvas) return;
    start();
    return () => handle?.stop?.();
  });

  async function start() {
    if (!canvas) return;
    handle?.stop?.();
    const updateWasm = () => { wasmEnabled = Boolean((wasm as any).isReady?.()); };
    updateWasm();
    // Inject overlay drawing via onDraw hook, then start demo first
    handle = await startCanvasDemo(canvas, {
      count: 12, grid: [1, 1], inertia: 1, damping: 0.9,
      onDraw: (ctx) => {
        if (!canvas || !hasImage || !overlayCanvas) return;
        // Draw size follows current scale for smooth 120fps feel
        const drawW = Math.max(1, Math.round(origW * Math.max(0.05, Math.min(8, scale))));
        const drawH = Math.max(1, Math.round(origH * Math.max(0.05, Math.min(8, scale))));
        liveDrawW = drawW; liveDrawH = drawH;
        const x = Math.round(overlayX);
        const y = Math.round(overlayY);
        // High-res buffer is re-sampled lazily by recalc(); here we just scale the buffer for speed
        const ctx2d = ctx as CanvasRenderingContext2D;
        ctx2d.imageSmoothingEnabled = quality === 'bilinear';
        ctx2d.imageSmoothingQuality = 'high';
        ctx.drawImage(overlayCanvas, x, y, drawW, drawH);
      }
    });
    // Recompute wasm enabled after demo init
    updateWasm();

    // Attach gesture handlers in capture phase so we can optionally block node handlers
    const onPDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Smart route: if single-finger and editTarget is 'nodes', only pan if not over a node
      if (touches.size === 1) {
        const rect = canvas!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const overNode = Boolean(handle?.hitAt?.(x, y));
        const forceImage = editTarget === 'image';
        const shouldPan = forceImage || !overNode;
        if (shouldPan) {
          panning = true;
          panStartX = e.clientX; panStartY = e.clientY;
          overlayStartX = overlayX; overlayStartY = overlayY;
        }
      }
      if (touches.size === 2) {
        const [a, b] = Array.from(touches.values());
        const dx = a.x - b.x, dy = a.y - b.y;
        pinchStartDist = Math.hypot(dx, dy) || 1;
        pinchStartScale = scale;
        // centroid (screen coords, previous behavior)
        pinchStartCX = (a.x + b.x) / 2;
        pinchStartCY = (a.y + b.y) / 2;
        overlayStartX = overlayX;
        overlayStartY = overlayY;
        pinching = true;
      }
      // Only capture/block if we are actually handling (pinch or pan image)
      if (pinching || panning) {
        (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId);
        e.preventDefault();
        (e as any).stopImmediatePropagation?.();
      }
    };
    const onPMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (panning && touches.size === 1) {
        overlayX = overlayStartX + (e.clientX - panStartX);
        overlayY = overlayStartY + (e.clientY - panStartY);
        e.preventDefault();
        (e as any).stopImmediatePropagation?.();
      }
      if (pinching && touches.size >= 2) {
        const [a, b] = Array.from(touches.values());
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ratio = dist / pinchStartDist;
        // Update scale (visual only during pinch); hi-res resample deferred until pinch end
        const newScale = Math.min(8, Math.max(0.05, pinchStartScale * ratio));
        // Current centroid (screen coords, previous behavior)
        const cx = (a.x + b.x) / 2; const cy = (a.y + b.y) / 2;
        lastPinchCX = cx; lastPinchCY = cy;
        // Prior behavior: translate by centroid shift and scale around start centroid
        overlayX = overlayStartX + (cx - pinchStartCX) + (1 - ratio) * (pinchStartCX - overlayStartX);
        overlayY = overlayStartY + (cy - pinchStartCY) + (1 - ratio) * (pinchStartCY - overlayStartY);
        scale = newScale;
        e.preventDefault();
        (e as any).stopImmediatePropagation?.();
      }
    };
    const onPUp = (e: PointerEvent) => {
      if (touches.has(e.pointerId)) touches.delete(e.pointerId);
      const wasPinch = pinching;
      if (touches.size < 2) pinching = false;
      if (touches.size === 0) panning = false;
      // After pinch ends, re-sample high-res buffer at new scale for crisp output
      // Anchor to center (previous behavior)
      if (wasPinch && !pinching) recalc(true);
    };
    canvas.addEventListener('pointerdown', onPDown, { passive: false, capture: true } as any);
    canvas.addEventListener('pointermove', onPMove, { passive: false, capture: true } as any);
    canvas.addEventListener('pointerup', onPUp, { capture: true } as any);
    canvas.addEventListener('pointercancel', onPUp, { capture: true } as any);
    // Teardown pinch listeners when demo stops
    const prevStop = handle?.stop;
    const prevHitAt = handle?.hitAt;
    handle = {
      stop() {
        try {
          canvas?.removeEventListener('pointerdown', onPDown as any);
          canvas?.removeEventListener('pointermove', onPMove as any);
          canvas?.removeEventListener('pointerup', onPUp as any);
          canvas?.removeEventListener('pointercancel', onPUp as any);
        } catch {}
        prevStop?.();
      },
      hitAt: prevHitAt
    };
  }

  function onTouchActionChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value as any;
    touchAction = v;
  }

  async function onPick(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    status = 'Loading image…';
    try {
      const bmp = await createImageBitmap(file);
      origW = bmp.width; origH = bmp.height;
      const t = document.createElement('canvas');
      t.width = origW; t.height = origH;
      const tctx = t.getContext('2d');
      if (!tctx) throw new Error('2D context');
      tctx.drawImage(bmp, 0, 0);
      const imgData = tctx.getImageData(0, 0, origW, origH);
      origData = imgData;
      // ensure wasm initialized by demo; store original in WASM
      const ok = wasm.storeImage(OVERLAY_ID, new Uint8Array(imgData.data.buffer), origW, origH);
      wasmEnabled = Boolean((wasm as any).isReady?.());
      hasImage = true; // ensure JS fallback path works even if WASM not ready
      if (!ok) {
        status = 'WASM not ready; using JS fallback for resize.';
      } else {
        status = 'Image loaded.';
      }
      recalc();
    } catch (err) {
      status = 'Failed to load image';
      console.error(err);
    }
  }

  function recalc(anchorCenter = false, anchorPoint?: { x: number; y: number }) {
    if (!canvas || !hasImage) return;
    // Use the live drawn size to compute anchoring to prevent jumps
    const prevW = (anchorPoint && liveDrawW) ? liveDrawW : (anchorCenter && liveDrawW ? liveDrawW : outW);
    const prevH = (anchorPoint && liveDrawH) ? liveDrawH : (anchorCenter && liveDrawH ? liveDrawH : outH);
    const s = Math.max(0.05, Math.min(8, scale));
    outW = Math.max(1, Math.round(origW * s));
    outH = Math.max(1, Math.round(origH * s));
    if (!overlayInit && canvas) {
      overlayX = Math.floor((canvas.clientWidth - outW) / 2);
      overlayY = Math.floor((canvas.clientHeight - outH) / 2);
      overlayInit = true;
    } else if (anchorPoint && prevW > 0 && prevH > 0) {
      // Keep the content under anchorPoint fixed while buffer size changes
      const ax = anchorPoint.x, ay = anchorPoint.y;
      const u = (ax - overlayX) / prevW;
      const v = (ay - overlayY) / prevH;
      overlayX = Math.round(ax - u * outW);
      overlayY = Math.round(ay - v * outH);
    } else if (anchorCenter) {
      // Keep visual center fixed when the buffer size changes due to a resize
      const centerX = overlayX + prevW / 2;
      const centerY = overlayY + prevH / 2;
      overlayX = Math.round(centerX - outW / 2);
      overlayY = Math.round(centerY - outH / 2);
    }
    const dpr = Math.max(1, (window as any).devicePixelRatio || 1);
    const bufW = Math.max(1, Math.round(outW * dpr));
    const bufH = Math.max(1, Math.round(outH * dpr));
    // Prefer WASM resize; fallback to canvas scale
    if ((wasm as any).isReady?.()) {
      const mode = quality === 'bilinear' ? 1 : 0;
      const u8: Uint8Array = (wasm as any).resizeImageMode
        ? (wasm as any).resizeImageMode(OVERLAY_ID, bufW >>> 0, bufH >>> 0, mode >>> 0)
        : wasm.resizeImage(OVERLAY_ID, bufW >>> 0, bufH >>> 0);
      const clamped = new Uint8ClampedArray(bufW * bufH * 4);
      clamped.set(u8);
      resized = new ImageData(clamped, bufW, bufH);
      overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = bufW; overlayCanvas.height = bufH;
      const octx = overlayCanvas.getContext('2d');
      octx?.putImageData(resized, 0, 0);
    } else {
      // JS fallback: scale using canvas with cached origData
      if (!origData) return;
      const src = document.createElement('canvas');
      src.width = origW; src.height = origH;
      const sctx = src.getContext('2d');
      if (!sctx) return;
      sctx.putImageData(origData, 0, 0);
      const dst = document.createElement('canvas');
      dst.width = bufW; dst.height = bufH;
      const dctx = dst.getContext('2d');
      if (!dctx) return;
      dctx.imageSmoothingEnabled = quality === 'bilinear';
      dctx.imageSmoothingQuality = 'high';
      dctx.drawImage(src, 0, 0, bufW, bufH);
      const data = dctx.getImageData(0, 0, bufW, bufH);
      resized = data;
      overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = bufW; overlayCanvas.height = bufH;
      const octx = overlayCanvas.getContext('2d');
      octx?.putImageData(resized, 0, 0);
    }
  }
</script>

<style>
  .frame { width: 100%; height: 80vh; border-radius: 8px; overflow: hidden; }
  canvas { width: 100%; height: 100%; display: block; background: #000; touch-action: var(--ta, none); -webkit-user-select: none; user-select: none; }
  .wrap { display: grid; gap: 12px; }
  h2 { color: #111; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  label { font: 500 12px/1.2 system-ui, sans-serif; color: #333; }
  input[type="range"] { width: 180px; }
  small.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #666; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #666; }
</style>

<div class="wrap">
  <h2>Canvas + Image Overlay</h2>
  <div class="frame">
    <canvas bind:this={canvas} style={`--ta:${touchAction}`}></canvas>
  </div>
  <div class="row">
    <label>Image:
      <input type="file" accept="image/*" on:change={onPick} />
    </label>
    <span class="mono">WASM: {wasmEnabled ? 'Enabled' : 'Disabled'}</span>
    <label>Edit target:
      <select bind:value={editTarget}>
        <option value="nodes">Nodes</option>
        <option value="image">Image</option>
      </select>
    </label>
    <label>Scale:
      <input type="range" min="0.05" max="8" step="0.01" bind:value={scale} on:input={onScaleInput} on:change={() => recalc(true)} />
    </label>
    <label>Quality:
      <select bind:value={quality} on:change={() => recalc(true)}>
        <option value="nearest">Nearest</option>
        <option value="bilinear">Bilinear</option>
      </select>
    </label>
    <label>Touch action:
      <select bind:value={touchAction} on:change={onTouchActionChange}>
        <option value="none">none (drag canvas)</option>
        <option value="pan-x">pan-x (allow horizontal scroll)</option>
        <option value="pan-y">pan-y (allow vertical scroll)</option>
        <option value="auto">auto</option>
      </select>
    </label>
    {#if hasImage}
      <small class="mono">{origW}×{origH} → {outW}×{outH}</small>
    {/if}
    {#if status}
      <small class="mono">{status}</small>
    {/if}
  </div>
  <small style="color:#666">Squares are draggable via WASM if available, otherwise JS fallback. Overlay uses WASM store/resize.</small>
  <nav style="margin-top:8px;">
    <a href="/">Home</a> • <a href="/wasm">WASM Demo</a>
  </nav>
</div>
