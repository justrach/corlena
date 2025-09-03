<script>
  import { onMount, onDestroy, setContext } from 'svelte';
  import { createScene } from './scene.js';

  export let capacity = 256;
  export let pixelRatio = 1;
  export let tapParams = undefined;

  let ready = false;
  let unsubscribe;

  // Create scene immediately and set context
  const scene = createScene({ capacity, pixelRatio, tapParams });
  setContext('scene', scene);

  onMount(async () => {
    console.log('SceneProvider mounting, scene:', scene);
    
    // Subscribe to ready state
    unsubscribe = scene.ready.subscribe(value => {
      console.log('Scene ready state changed:', value);
      ready = value;
    });
    
    // Initialize WASM
    console.log('Initializing WASM...');
    await scene.init();
    console.log('WASM initialization complete');
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    if (scene) {
      scene.destroy();
    }
  });
</script>

<slot {ready} />
