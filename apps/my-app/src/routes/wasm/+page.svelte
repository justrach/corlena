<script lang="ts">
  import { onMount } from 'svelte';
  import { startWasmDemo, type DemoOptions } from '$lib';
  import { isReady } from '@corlena/core/wasm';

  let container: HTMLDivElement | null = null;
  let handle: { stop(): void } | null = null;
  let usingWasm = false;

  let count = 9;
  let gridX = 1;
  let gridY = 1;
  let inertia = 1;
  let damping = 0.9;

  async function boot() {
    if (!container) return;
    handle?.stop?.();
    const opts: DemoOptions = {
      count,
      size: [80, 80],
      grid: [gridX, gridY],
      inertia,
      damping
    };
    handle = await startWasmDemo(container, opts);
    // Update badge after init; then poll a bit to catch async load
    usingWasm = !!isReady();
  }

  onMount(() => {
    let t: any;
    boot();
    t = setInterval(() => { usingWasm = !!isReady(); }, 500);
    return () => { handle?.stop?.(); clearInterval(t); };
  });
</script>

<style>
  .wrap { display: grid; gap: 12px; }
  .controls { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; align-items: center; }
  .stage { width: 800px; height: 480px; border: 1px solid #ddd; border-radius: 8px; position: relative; overflow: hidden; background: #fff; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; }
  .wasm { background:#dcfce7; color:#166534; border:1px solid #86efac; }
  .js { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }
  label { display: grid; gap: 6px; font-size: 12px; color: #444; }
  input[type="number"] { width: 100%; padding: 6px 8px; }
</style>

<div class="wrap">
  <h2>WASM Demo
    {#if usingWasm}
      <span class="badge wasm" style="margin-left:8px;">Using WASM</span>
    {:else}
      <span class="badge js" style="margin-left:8px;">Using JS fallback</span>
    {/if}
  </h2>
  <div class="controls">
    <label>Count <input type="number" bind:value={count} min="1" max="64" on:change={boot} /></label>
    <label>Grid X <input type="number" bind:value={gridX} min="1" step="1" on:change={boot} /></label>
    <label>Grid Y <input type="number" bind:value={gridY} min="1" step="1" on:change={boot} /></label>
    <label>Inertia <input type="number" bind:value={inertia} min="0" max="1" step="0.1" on:change={boot} /></label>
    <label>Damping <input type="number" bind:value={damping} min="0" max="1" step="0.05" on:change={boot} /></label>
  </div>
  <div class="stage" bind:this={container}></div>
  <small style="color:#666">Tip: Click and drag the squares. Works with JS fallback if WASM isn’t built yet.</small>
</div>
