<script>
  import { onMount, onDestroy } from 'svelte';
  import { getContext } from 'svelte';

  export let width = 800;
  export let height = 600;
  export let brushColor = '#000000';
  export let brushWidth = 3;
  export let onPathComplete = null;
  export let onPathStart = null;
  export let style = {};
  export let className = '';

  let canvasElement;
  let isDrawing = false;
  let currentPathId = null;
  let wasm = null;
  let rafId = null;

  const sceneContext = getContext('scene');
  $: ready = sceneContext?.ready || false;
  $: toLocal = sceneContext?.toLocal;

  // Load WASM module
  onMount(async () => {
    try {
      const wasmModule = await import('corlena/wasm');
      // Initialize WASM if not already done
      if (!wasmModule.isReady?.()) {
        await wasmModule.init(1024);
      }
      wasm = wasmModule;
    } catch (err) {
      console.warn('Failed to load WASM for drawing:', err);
    }
  });

  // Convert hex color to packed RGBA
  function colorToRGBA(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = 255;
    return (a << 24) | (b << 16) | (g << 8) | r;
  }

  // Render paths to canvas
  function renderPaths() {
    if (!canvasElement || !wasm) return;

    const ctx = canvasElement.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    try {
      const result = wasm.processFrame(0.016);
      if (result?.drawPaths && result.drawPaths.length > 0) {
        const paths = result.drawPaths;
        let i = 0;
        while (i < paths.length) {
          const pathId = paths[i++];
          const color = paths[i++];
          const lineWidth = paths[i++];
          const closed = paths[i++] > 0;
          const pointCount = paths[i++];
          
          if (pointCount > 0) {
            // Extract RGBA from packed color
            const r = (color >>> 0) & 0xFF;
            const g = (color >>> 8) & 0xFF;
            const b = (color >>> 16) & 0xFF;
            const a = ((color >>> 24) & 0xFF) / 255;
            
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            let firstPoint = true;
            
            for (let p = 0; p < pointCount; p++) {
              const x = paths[i++];
              const y = paths[i++];
              const pressure = paths[i++]; // Could use for variable width
              const timestamp = paths[i++];
              
              if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
              } else {
                ctx.lineTo(x, y);
              }
            }
            
            if (closed) {
              ctx.closePath();
            }
            ctx.stroke();
          }
        }
      }
    } catch (err) {
      console.warn('Error rendering paths:', err);
    }
  }

  // Animation loop for rendering
  $: if (wasm && canvasElement) {
    if (rafId) cancelAnimationFrame(rafId);
    const animate = () => {
      renderPaths();
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
  }

  function startDrawing(e) {
    if (!wasm) return;
    
    const rect = canvasElement.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const pathId = Date.now();
    const pressure = e.pressure || 1.0;
    const color = colorToRGBA(brushColor);
    
    if (wasm.startDrawPath(pathId, x, y, pressure, color, brushWidth)) {
      isDrawing = true;
      currentPathId = pathId;
      onPathStart?.(pathId);
    }
  }

  function continueDrawing(e) {
    if (!isDrawing || !wasm || !currentPathId) return;
    
    const rect = canvasElement.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const pressure = e.pressure || 1.0;
    
    wasm.addDrawPoint(currentPathId, x, y, pressure);
  }

  function stopDrawing(e) {
    if (!isDrawing || !wasm || !currentPathId) return;
    
    wasm.finishDrawPath(currentPathId, false);
    isDrawing = false;
    onPathComplete?.(currentPathId);
    currentPathId = null;
  }

  // Clear all paths
  export function clearPaths() {
    if (wasm) {
      wasm.clearDrawPaths();
    }
  }

  onDestroy(() => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  });
</script>

<canvas
  bind:this={canvasElement}
  {width}
  {height}
  class={className}
  style="touch-action: none; cursor: {isDrawing ? 'crosshair' : 'default'}; {Object.entries(style).map(([k, v]) => `${k}: ${v}`).join('; ')}"
  on:pointerdown={startDrawing}
  on:pointermove={continueDrawing}
  on:pointerup={stopDrawing}
  on:pointercancel={stopDrawing}
  on:pointerleave={stopDrawing}
  {...$$restProps}
></canvas>
