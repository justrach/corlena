<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  let SceneProvider: any;
  let DomLayer: any;
  let DomNode: any;
  let componentsLoaded = false;

  onMount(async () => {
    if (browser) {
      const module = await import('corlena/svelte');
      SceneProvider = module.SceneProvider;
      DomLayer = module.DomLayer;
      DomNode = module.DomNode;
      componentsLoaded = true;
    }
  });

  function handleTap(nodeId: number): void {
    console.log('Tapped node:', nodeId);
  }

  function handleDragStart(nodeId: number): void {
    console.log('Drag start:', nodeId);
  }

  function handleDragEnd(nodeId: number): void {
    console.log('Drag end:', nodeId);
  }
</script>

<svelte:head>
  <title>Corlena Svelte Scene</title>
</svelte:head>

<main style="padding: 20px;">
  <h1 style="margin-bottom: 12px;">Corlena Svelte Scene</h1>
  <p style="margin-bottom: 12px; color: #777;">
    Drag within the node. This page uses SceneProvider + DomLayer + DomNode in Svelte.
  </p>
  
  <div style="
    width: min(420px, 100%);
    aspect-ratio: 9 / 16;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    overflow: hidden;
    background: #000;
    position: relative;
  ">
    {#if componentsLoaded && SceneProvider && DomLayer && DomNode}
      <svelte:component this={SceneProvider} tapParams={[0.1, 2.0, 0.3, 0.05]} capacity={256} let:ready>
        <svelte:component this={DomLayer}>
          <svelte:component 
            this={DomNode}
            id={1}
            style={{
              width: '140px',
              height: '90px',
              background: ready ? '#2a2a2a' : '#444',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '10px',
              boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
            }}
            onTap={handleTap}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            Node 1 {ready ? '✓' : '⏳'}
          </svelte:component>
        </svelte:component>
      </svelte:component>
    {:else}
      <div style="
        display: grid;
        place-items: center;
        height: 100%;
        color: #777;
      ">
        Loading scene...
      </div>
    {/if}
  </div>
  
  <nav style="margin-top: 16px;">
    <a href="/">Home</a>
  </nav>
</main>
