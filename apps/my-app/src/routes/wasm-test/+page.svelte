<script lang="ts">
  import { onMount } from 'svelte';

  let log: string[] = [];
  const add = (label: string, data?: any) => {
    try {
      const suffix = data !== undefined ? ' ' + JSON.stringify(data) : '';
      log = [...log, `${label}${suffix}`];
    } catch (_) {
      log = [...log, `${label} <unserializable>`];
    }
  };

  onMount(async () => {
    try {
      // Ensure the WASM bundle path for the wrapper's dynamic loader
      (window as any).__CORLENA_WASM_URL__ = '/wasm/corlena_wasm.js';

      // Import the wrapper via package subpath export
      const wasm = await import('corlena/wasm');
      (window as any).corlenaWasm = wasm; // expose for DevTools usage

      await wasm.init(8);
      wasm.setViewParams(1, 0, 0, (window as any).devicePixelRatio || 1);

      // One node: [id, x, y, w, h, vx, vy, flags]
      wasm.upsertNodes(new Float32Array([1, 100, 100, 50, 50, 0, 0, 0]));

      // Press/drag: [id, x, y, pressure, buttons]
      wasm.applyPointers(new Float32Array([1, 120, 120, 0.7, 1]));
      let out = wasm.processFrame({ dt: 0.016 });
      add('events press/drag', Array.from(out.events));

      // Release
      wasm.applyPointers(new Float32Array([1, 120, 120, 0.0, 0]));
      out = wasm.processFrame({ dt: 0.016 });
      add('events release', Array.from(out.events));

      // Transforms layout: [id, x, y, angle, scaleX, scaleY, reserved] * N
      add('transforms', Array.from(out.transforms));
    } catch (err) {
      console.error(err);
      add('error', String(err));
    }
  });
</script>

<main style="padding:1rem; font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji;">
  <h1>WASM Test</h1>
  <p>Module is also available as <code>window.corlenaWasm</code>.</p>
  <pre style="white-space: pre-wrap; background: #111; color: #0f0; padding: 0.75rem; border-radius: 6px;">{log.join('\n')}</pre>
</main>
