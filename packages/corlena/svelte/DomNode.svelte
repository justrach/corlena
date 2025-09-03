<script>
  import { getContext, onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';

  export let id;
  export let style = {};
  export let className = '';
  export let onTap = undefined;
  export let onDoubleTap = undefined;
  export let onDragStart = undefined;
  export let onDragEnd = undefined;

  const scene = getContext('scene');
  let nodeEl;
  let css = writable({ transform: 'translate3d(0px,0px,0px) scale(1,1)', transformOrigin: '0 0' });
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let rafId = 0;
  let mounted = true;
  let unregister;

  onMount(() => {
    console.log('DomNode mounted', { scene: !!scene, id, nodeEl: !!nodeEl });
    if (!scene) {
      console.error('No scene context in DomNode mount');
      return;
    }

    // Register event handlers
    unregister = scene.registerHandlers(id, { onTap, onDoubleTap, onDragStart, onDragEnd });
    console.log('Event handlers registered for node', id);

    // Measure and upsert node
    const measureAndUpsert = () => {
      if (!nodeEl) return;
      const r = nodeEl.getBoundingClientRect();
      const { x, y } = scene.toLocal(r.left, r.top);
      scene.upsertNode({ id, x, y, w: r.width, h: r.height });
    };

    // Initial measurement
    measureAndUpsert();

    // ResizeObserver for dynamic sizing
    const ro = new (window.ResizeObserver || class { observe(){} disconnect(){} })(measureAndUpsert);
    try { ro.observe(nodeEl); } catch {}

    // Add event listeners directly
    nodeEl.addEventListener('pointerdown', handlePointerDown);
    nodeEl.addEventListener('pointermove', handlePointerMove);
    nodeEl.addEventListener('pointerup', handlePointerUp);
    nodeEl.addEventListener('pointercancel', handlePointerUp);

    // Animation loop - only apply WASM transforms when not dragging
    const loop = () => {
      if (!mounted) return;
      if (!isDragging) {
        const t = scene.getTransform(id);
        if (t) {
          const deg = t.angle || 0;
          const tr = `translate3d(${t.x || 0}px, ${t.y || 0}px, 0px) rotate(${deg}rad) scale(${t.sx || 1}, ${t.sy || 1})`;
          css.update(prev => (prev.transform === tr ? prev : { ...prev, transform: tr }));
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      mounted = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (unregister) unregister();
      try { ro.disconnect(); } catch {}
      // Remove event listeners
      if (nodeEl) {
        nodeEl.removeEventListener('pointerdown', handlePointerDown);
        nodeEl.removeEventListener('pointermove', handlePointerMove);
        nodeEl.removeEventListener('pointerup', handlePointerUp);
        nodeEl.removeEventListener('pointercancel', handlePointerUp);
      }
    };
  });

  onDestroy(() => {
    mounted = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (unregister) unregister();
  });

  function handlePointerDown(e) {
    console.log('handlePointerDown called', { scene: !!scene, id });
    if (!scene) {
      console.error('No scene context available');
      return;
    }
    try { e.preventDefault(); } catch {}
    try { nodeEl.setPointerCapture?.(e.pointerId); } catch {}
    
    const p = scene.toLocal(e.clientX, e.clientY);
    console.log('Pointer down at:', p);
    
    // Calculate offset from pointer to node's current position (top-left)
    const rect = nodeEl.getBoundingClientRect();
    const nodeTopLeft = scene.toLocal(rect.left, rect.top);
    dragOffset = { x: p.x - nodeTopLeft.x, y: p.y - nodeTopLeft.y };
    isDragging = true;
    console.log('Drag started, offset:', dragOffset);
    
    scene.applyPointer(id, p.x, p.y, 1);
  }

  function handlePointerMove(e) {
    if (!scene || e.buttons === 0) return;
    try { e.preventDefault(); } catch {}
    
    const p = scene.toLocal(e.clientX, e.clientY);
    console.log('Pointer move', { isDragging, p, buttons: e.buttons });
    
    if (isDragging) {
      // Direct CSS transform during drag - bypass WASM physics for immediate response
      const targetX = p.x - dragOffset.x;
      const targetY = p.y - dragOffset.y;
      const tr = `translate3d(${targetX}px, ${targetY}px, 0px) scale(1, 1)`;
      console.log('Updating CSS transform:', tr);
      css.update(prev => ({ ...prev, transform: tr }));
    }
    
    scene.applyPointer(id, p.x, p.y, e.buttons);
  }

  function handlePointerUp(e) {
    if (!scene) return;
    const p = scene.toLocal(e.clientX, e.clientY);
    
    if (isDragging) {
      // Update WASM with final position before releasing drag
      const targetX = p.x - dragOffset.x;
      const targetY = p.y - dragOffset.y;
      if (nodeEl) {
        const rect = nodeEl.getBoundingClientRect();
        scene.upsertNode({ id, x: targetX, y: targetY, w: rect.width, h: rect.height });
      }
    }
    
    isDragging = false;
    scene.applyPointer(id, p.x, p.y, 0);
  }

  $: mergedStyle = {
    position: 'absolute',
    touchAction: 'none',
    userSelect: 'none',
    ...$css,
    ...style
  };
</script>

<div 
  bind:this={nodeEl}
  style={Object.entries(mergedStyle).map(([k, v]) => `${k}: ${v}`).join('; ')}
  class={className}
  role="button"
  tabindex="0"
>
  <slot />
</div>
