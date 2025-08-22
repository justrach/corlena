<script lang="ts">
  import { onMount } from 'svelte';
  import { startCanvasDemo } from '$lib';
  import * as wasm from '@corlena/core/wasm';

  let canvas: HTMLCanvasElement | null = null;
  let handle: { stop(): void } | null = null;
  let touchAction: 'none' | 'auto' | 'pan-x' | 'pan-y' = 'none';

  // Overlay image state
  const OVERLAY_ID = 10001;
  let hasImage = false;
  let origW = 0, origH = 0;
  let scale = 1.0; // 0.1 - 2
  let outW = 0, outH = 0;
  let resized: ImageData | null = null;
  let origData: ImageData | null = null;
  let overlayCanvas: HTMLCanvasElement | null = null;
  let status = '';
  let quality: 'nearest' | 'bilinear' = 'nearest';

  onMount(() => {
    if (!canvas) return;
    start();
    return () => handle?.stop?.();
  });

  async function start() {
    if (!canvas) return;
    handle?.stop?.();
    // Inject overlay drawing via onDraw hook
    handle = await startCanvasDemo(canvas, {
      count: 12, grid: [1, 1], inertia: 1, damping: 0.9,
      onDraw: (ctx) => {
        if (!canvas || !hasImage || !resized || !overlayCanvas) return;
        const x = Math.floor((canvas.clientWidth - resized.width) / 2);
        const y = Math.floor((canvas.clientHeight - resized.height) / 2);
        ctx.drawImage(overlayCanvas, x, y);
      }
    });
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
      hasImage = ok;
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

  function recalc() {
    if (!canvas || !hasImage) return;
    const s = Math.max(0.1, Math.min(2, scale));
    outW = Math.max(1, Math.round(origW * s));
    outH = Math.max(1, Math.round(origH * s));
    // Prefer WASM resize; fallback to canvas scale
    if ((wasm as any).isReady?.()) {
      const mode = quality === 'bilinear' ? 1 : 0;
      const u8: Uint8Array = (wasm as any).resizeImageMode
        ? (wasm as any).resizeImageMode(OVERLAY_ID, outW >>> 0, outH >>> 0, mode >>> 0)
        : wasm.resizeImage(OVERLAY_ID, outW >>> 0, outH >>> 0);
      const clamped = new Uint8ClampedArray(outW * outH * 4);
      clamped.set(u8);
      resized = new ImageData(clamped, outW, outH);
      overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = outW; overlayCanvas.height = outH;
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
      dst.width = outW; dst.height = outH;
      const dctx = dst.getContext('2d');
      if (!dctx) return;
      dctx.imageSmoothingEnabled = true;
      dctx.drawImage(src, 0, 0, outW, outH);
      const data = dctx.getImageData(0, 0, outW, outH);
      resized = data;
      overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = outW; overlayCanvas.height = outH;
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
    <label>Scale:
      <input type="range" min="0.1" max="2" step="0.05" bind:value={scale} on:input={recalc} />
    </label>
    <label>Quality:
      <select bind:value={quality} on:change={recalc}>
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
