<script lang="ts">
  import { draggable, configure } from '@corlena/core';

  // Optional: tweak defaults
  configure({ defaultCursor: 'grabbing' });

  // Scale the whole board visually (does not affect positions)
  let scale = 1;

  type Item = { id: number; text: string };
  const items: Item[] = [
    { id: 1, text: 'Drag me' },
    { id: 2, text: 'Edit me' }
  ];

  // Track positions so they don’t reset on rerender
  let pos: Record<number, { x: number; y: number }> = {
    1: { x: 0, y: 0 },
    2: { x: 140, y: 20 }
  };

  function onDrag(id: number, e: any) {
    pos = { ...pos, [id]: { x: e.detail.x, y: e.detail.y } };
  }

  function onInput(id: number, e: Event) {
    const target = e.target as HTMLInputElement;
    const next = items.map((it) => (it.id === id ? { ...it, text: target.value } : it));
    // reassign to trigger update
    items.length = 0; next.forEach((i) => items.push(i));
  }
</script>

<style>
  .board {
    width: 560px;
    height: 320px;
    border: 1px dashed #888;
    position: relative;
    overflow: hidden;
    border-radius: 8px;
    padding: 8px;
  }
  .item {
    width: 140px;
    min-height: 64px;
    background: #3b82f6;
    color: white;
    border-radius: 8px;
    user-select: none;
    touch-action: none;
    display: grid;
    gap: 8px;
    padding: 8px;
    place-items: center;
  }
  .text {
    width: 100%;
    border: none;
    outline: none;
    border-radius: 6px;
    padding: 6px 8px;
  }
</style>

<h1>Corlena demo</h1>
<p>Drag the items inside the grey area. Use the slider to scale the board.</p>

<label style="display:block; margin-bottom: 8px;">
  Scale: <input type="range" min="0.5" max="1.5" step="0.1" bind:value={scale} /> {scale.toFixed(1)}x
  <small style="color:#666; margin-left:6px;">visual scale only</small>
  </label>

<div class="board" style="zoom: {scale}">
  {#each items as it (it.id)}
    <div
      class="item"
      role="button"
      tabindex="0"
      aria-label={`Draggable item ${it.id}`}
      use:draggable={{ bounds: 'parent', grid: [1, 1], scale }}
      on:drag={(e) => onDrag(it.id, e)}
      style="transform: translate3d({pos[it.id]?.x ?? 0}px, {pos[it.id]?.y ?? 0}px, 0);"
    >
      <strong>{it.text}</strong>
      <input class="text" value={it.text} on:input={(e) => onInput(it.id, e)} placeholder="Type label" />
      <small>({pos[it.id]?.x ?? 0}, {pos[it.id]?.y ?? 0})</small>
    </div>
  {/each}
</div>

<nav style="margin-top:12px; color:#666;">
  <a href="/wasm">WASM Demo</a> • <a href="/canvas">Canvas</a>
  </nav>
