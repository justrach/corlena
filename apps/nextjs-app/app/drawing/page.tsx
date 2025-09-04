'use client';

import { SceneProvider, DomLayer, DrawingCanvas } from 'corlena/react';
import { useState } from 'react';

export default function DrawingDemo() {
  const [brushColor, setBrushColor] = useState('#2563eb');
  const [brushWidth, setBrushWidth] = useState(3);
  const [pathCount, setPathCount] = useState(0);

  const handlePathStart = (pathId: number) => {
    console.log('Started drawing path:', pathId);
  };

  const handlePathComplete = (pathId: number) => {
    console.log('Completed drawing path:', pathId);
    setPathCount(prev => prev + 1);
  };

  const clearDrawing = () => {
    const canvas = document.querySelector('canvas') as any;
    if (canvas?.clearDrawing) {
      canvas.clearDrawing();
      setPathCount(0);
    }
  };

  return (
    <div style={{ padding: '8px', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      <h1 style={{ 
        fontSize: '20px', 
        fontWeight: 'bold', 
        color: '#111827', 
        marginBottom: '8px',
        textAlign: 'center'
      }}>
        Demo
      </h1>
      
      {/* Compact controls */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '6px', 
        padding: '8px', 
        marginBottom: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          alignItems: 'center',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label htmlFor="color">Color:</label>
            <input
              id="color"
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              style={{ width: '24px', height: '20px', border: 'none' }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label htmlFor="width">Width:</label>
            <input
              id="width"
              type="range"
              min="1"
              max="20"
              value={brushWidth}
              onChange={(e) => setBrushWidth(Number(e.target.value))}
              style={{ width: '60px' }}
            />
            <span>{brushWidth}px</span>
          </div>
          
          <button
            onClick={clearDrawing}
            style={{ 
              padding: '4px 8px', 
              backgroundColor: '#ef4444', 
              color: 'white', 
              borderRadius: '3px', 
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Clear
          </button>
          
          <span>Paths: {pathCount}</span>
        </div>
      </div>

      {/* Compact canvas */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '6px', 
        padding: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <SceneProvider capacity={1024}>
          {({ ready }: { ready: boolean }) => (
            <DomLayer>
              <div style={{ 
                border: '1px solid #e5e7eb', 
                borderRadius: '4px', 
                overflow: 'hidden',
                marginBottom: '8px'
              }}>
                <DrawingCanvas
                  width={600}
                  height={400}
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
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  fontSize: '12px',
                  backgroundColor: ready ? '#dcfce7' : '#fef3c7',
                  color: ready ? '#166534' : '#92400e'
                }}>
                  <div style={{ 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%',
                    backgroundColor: ready ? '#22c55e' : '#eab308'
                  }} />
                  {ready ? 'WASM Ready - Start Drawing!' : 'Loading WASM...'}
                </div>
              </div>
            </DomLayer>
          )}
        </SceneProvider>
      </div>
    </div>
  );
}
