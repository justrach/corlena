<script>
  import { getContext, onMount } from 'svelte';

  export let style = {};
  export let className = '';

  const scene = getContext('scene');
  let layerEl;

  onMount(() => {
    console.log('DomLayer mounted', { scene: !!scene, layerEl: !!layerEl });
    if (scene && layerEl) {
      scene.setLayerRef(layerEl);
      console.log('Layer ref set');
    }
  });

  $: merged = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    ...style
  };
</script>

<div bind:this={layerEl} style={Object.entries(merged).map(([k, v]) => `${k}: ${v}`).join('; ')} class={className}>
  <slot />
</div>
