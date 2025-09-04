# Corlena Svelte Demo

A SvelteKit project showcasing the **Corlena Canvas UI Toolkit** with WASM-accelerated drawing capabilities and interactive scene management.

## Features

### 🎨 Drawing Canvas
- **High-performance drawing** with WASM memory management
- **Pressure-sensitive input** (when supported by device)
- **Smooth path interpolation** with round caps and joins
- **Real-time rendering** with minimal JavaScript overhead
- **Touch and mouse support** across all devices

### 🎭 Scene Management
- **Interactive canvas** with drag and drop
- **Physics simulation** powered by WASM engine
- **Particle effects** and animation loops
- **Responsive design** across mobile and desktop

## Getting Started

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Available Routes

- **`/`** - Main landing page
- **`/scene`** - Interactive scene with physics simulation
- **`/ig`** - IG-style canvas editor (if implemented)
- **`/drawing`** - Standalone drawing canvas demo (if implemented)

## Drawing Usage

### Basic Drawing Canvas
```svelte
<script lang="ts">
  import { SceneProvider, DomLayer, DrawingCanvas } from 'corlena/svelte';
  
  let brushColor = '#2563eb';
  let brushWidth = 3;
  
  function handlePathStart(pathId: number) {
    console.log('Started path:', pathId);
  }
  
  function handlePathComplete(pathId: number) {
    console.log('Completed path:', pathId);
  }
</script>

<SceneProvider capacity={1024} let:ready>
  <DomLayer>
    <DrawingCanvas
      width={600}
      height={400}
      {brushColor}
      {brushWidth}
      onPathStart={handlePathStart}
      onPathComplete={handlePathComplete}
    />
  </DomLayer>
</SceneProvider>
```

### Component Props

#### DrawingCanvas
- **`width`** - Canvas width in pixels
- **`height`** - Canvas height in pixels  
- **`brushColor`** - Hex color for drawing strokes (default: '#000000')
- **`brushWidth`** - Brush width in pixels (default: 3)
- **`onPathStart`** - Callback when drawing path begins
- **`onPathComplete`** - Callback when drawing path ends
- **`style`** - Additional CSS styles object

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
