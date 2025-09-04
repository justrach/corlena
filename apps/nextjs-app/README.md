This is a [Next.js](https://nextjs.org) project showcasing the **Corlena Canvas UI Toolkit** with WASM-accelerated drawing capabilities.

## Features

### 🎨 Drawing Canvas
- **High-performance drawing** with WASM memory management
- **Pressure-sensitive input** (when supported by device)
- **Smooth path interpolation** with round caps and joins
- **Real-time rendering** with minimal JavaScript overhead
- **Touch and mouse support** across all devices

### 📱 IG Composer
- **Interactive canvas editor** with drawing integration
- **Text and image layers** with drag, resize, and pinch gestures
- **Particle effects** powered by WASM physics engine
- **Export functionality** to PNG format
- **Black canvas background** optimized for social media content

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) (or [http://localhost:3001](http://localhost:3001) if port 3000 is busy) with your browser to see the result.

## Available Routes

- **`/`** - Main landing page
- **`/drawing`** - Standalone drawing canvas demo
- **`/ig`** - Full-featured IG Composer with drawing integration

## Drawing Usage

### Basic Drawing Canvas (`/drawing`)
```jsx
import { SceneProvider, DomLayer, DrawingCanvas } from 'corlena/react';

export default function DrawingDemo() {
  const [brushColor, setBrushColor] = useState('#2563eb');
  const [brushWidth, setBrushWidth] = useState(3);

  return (
    <SceneProvider capacity={1024}>
      {({ ready }) => (
        <DomLayer>
          <DrawingCanvas
            width={600}
            height={400}
            brushColor={brushColor}
            brushWidth={brushWidth}
            onPathStart={(pathId) => console.log('Started path:', pathId)}
            onPathComplete={(pathId) => console.log('Completed path:', pathId)}
          />
        </DomLayer>
      )}
    </SceneProvider>
  );
}
```

### IG Composer with Drawing (`/ig`)
The IG Composer integrates drawing functionality alongside text and image editing:

1. **Enable Drawing Mode** - Check the "Drawing" checkbox
2. **Choose Brush Settings** - Select color and width (1-20px)
3. **Draw on Canvas** - Click and drag to create strokes
4. **Switch Modes** - Uncheck drawing to return to text/image editing
5. **Clear Paths** - Use "Clear Paths" button to remove all drawings
6. **Export** - Save your composition as PNG

## Technical Architecture

- **WASM Engine** - Rust-based physics and drawing path management
- **React Components** - Canvas rendering with 2D context
- **Memory Management** - Efficient path storage in WASM memory
- **Event Handling** - Pointer events with pressure sensitivity
- **Real-time Updates** - Animation loop for smooth rendering

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
