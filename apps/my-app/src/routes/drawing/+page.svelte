<script lang="ts">
  import { SceneProvider, DomLayer, DrawingCanvas } from 'corlena/svelte';
  import { onMount } from 'svelte';

  let brushColor = '#2563eb';
  let brushWidth = 3;
  let pathCount = 0;
  let canvasComponent: any;

  function handlePathStart(pathId: number) {
    console.log('Started drawing path:', pathId);
  }

  function handlePathComplete(pathId: number) {
    console.log('Completed drawing path:', pathId);
    pathCount += 1;
  }

  function clearDrawing() {
    if (canvasComponent?.clearPaths) {
      canvasComponent.clearPaths();
      pathCount = 0;
    }
  }
</script>

<svelte:head>
  <title>Svelte Drawing Canvas Demo</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 p-8">
  <div class="max-w-6xl mx-auto">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">
      Svelte Drawing Canvas Demo
    </h1>
    
    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div class="flex flex-wrap gap-4 items-center mb-4">
        <div class="flex items-center gap-2">
          <label for="color" class="text-sm font-medium text-gray-700">
            Color:
          </label>
          <input
            id="color"
            type="color"
            bind:value={brushColor}
            class="w-12 h-8 rounded border border-gray-300"
          />
        </div>
        
        <div class="flex items-center gap-2">
          <label for="width" class="text-sm font-medium text-gray-700">
            Width:
          </label>
          <input
            id="width"
            type="range"
            min="1"
            max="20"
            bind:value={brushWidth}
            class="w-24"
          />
          <span class="text-sm text-gray-600 w-8">{brushWidth}px</span>
        </div>
        
        <button
          on:click={clearDrawing}
          class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Clear
        </button>
        
        <div class="text-sm text-gray-600">
          Paths drawn: {pathCount}
        </div>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-lg p-6">
      <SceneProvider capacity={1024} let:ready>
        <DomLayer>
          <div class="border-2 border-gray-200 rounded-lg overflow-hidden">
            <DrawingCanvas
              bind:this={canvasComponent}
              width={800}
              height={600}
              brushColor={brushColor}
              brushWidth={brushWidth}
              onPathStart={handlePathStart}
              onPathComplete={handlePathComplete}
              style={{ 
                display: 'block',
                backgroundColor: '#ffffff'
              }}
            />
          </div>
          <div class="mt-4 text-center">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm {ready 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'}">
              <div class="w-2 h-2 rounded-full {ready ? 'bg-green-500' : 'bg-yellow-500'}"></div>
              {ready ? 'WASM Ready - Start Drawing!' : 'Loading WASM...'}
            </div>
          </div>
        </DomLayer>
      </SceneProvider>
    </div>

    <div class="mt-8 bg-white rounded-lg shadow-lg p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Features</h2>
      <div class="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
        <div>
          <h3 class="font-medium text-gray-900 mb-2">Drawing Features</h3>
          <ul class="space-y-1">
            <li>• Pressure-sensitive drawing (if supported)</li>
            <li>• Smooth path interpolation</li>
            <li>• Real-time rendering</li>
            <li>• Touch and mouse support</li>
          </ul>
        </div>
        <div>
          <h3 class="font-medium text-gray-900 mb-2">WASM Integration</h3>
          <ul class="space-y-1">
            <li>• Efficient path storage in WASM memory</li>
            <li>• High-performance rendering pipeline</li>
            <li>• Minimal JavaScript overhead</li>
            <li>• Scalable to thousands of paths</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    font-family: system-ui, -apple-system, sans-serif;
  }
</style>
