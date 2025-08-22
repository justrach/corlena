<script lang="ts">
  import { onMount } from 'svelte';
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let raf = 0;

  function resize() {
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  onMount(() => {
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    const loop = () => {
      if (!ctx || !canvas) return;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      raf = requestAnimationFrame(loop);
    };
    const onResize = () => resize();
    resize();
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  });
</script>

<style>
  .wrap { display: grid; gap: 12px; }
  .frame { width: 100%; height: 80vh; border-radius: 8px; overflow: hidden; }
  canvas { width: 100%; height: 100%; display: block; background: #000; }
</style>

<div class="wrap">
  <h2>IG Canvas</h2>
  <div class="frame"><canvas bind:this={canvas}></canvas></div>
  <nav><a href="/">Home</a> • <a href="/wasm">WASM Demo</a> • <a href="/canvas">Black Canvas</a></nav>
</div>

