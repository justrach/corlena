import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useScene } from './scene.js';

export function DrawingCanvas({ 
  width = 800, 
  height = 600, 
  brushColor = '#000000', 
  brushWidth = 3,
  onPathComplete,
  onPathStart,
  style,
  className,
  ...props 
}) {
  const canvasRef = useRef(null);
  const { ready, toLocal } = useScene();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPathId, setCurrentPathId] = useState(null);
  const [wasm, setWasm] = useState(null);
  const pathsRef = useRef(new Map());

  // Load WASM module
  useEffect(() => {
    let mounted = true;
    const loadWasm = async () => {
      try {
        const wasmModule = await import('corlena/wasm');
        if (mounted) {
          // Initialize WASM if not already done
          if (!wasmModule.isReady?.()) {
            await wasmModule.init(1024);
          }
          setWasm(wasmModule);
        }
      } catch (err) {
        console.warn('Failed to load WASM for drawing:', err);
      }
    };
    loadWasm();
    return () => { mounted = false; };
  }, []);

  // Convert hex color to packed RGBA
  const colorToRGBA = useCallback((hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = 255;
    return (a << 24) | (b << 16) | (g << 8) | r;
  }, []);

  // Render paths to canvas
  const renderPaths = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !wasm) return;

    const ctx = canvas.getContext('2d');
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
  }, [wasm, width, height]);

  // Animation loop for rendering
  useEffect(() => {
    if (!wasm) return;
    
    let rafId;
    const animate = () => {
      renderPaths();
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [wasm, renderPaths]);

  const startDrawing = useCallback((e) => {
    if (!wasm) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const pathId = Date.now();
    const pressure = e.pressure || 1.0;
    const color = colorToRGBA(brushColor);
    
    if (wasm.startDrawPath(pathId, x, y, pressure, color, brushWidth)) {
      setIsDrawing(true);
      setCurrentPathId(pathId);
      onPathStart?.(pathId);
    }
  }, [wasm, brushColor, brushWidth, colorToRGBA, onPathStart]);

  const continueDrawing = useCallback((e) => {
    if (!isDrawing || !wasm || !currentPathId) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const pressure = e.pressure || 1.0;
    
    wasm.addDrawPoint(currentPathId, x, y, pressure);
  }, [isDrawing, wasm, currentPathId]);

  const stopDrawing = useCallback((e) => {
    if (!isDrawing || !wasm || !currentPathId) return;
    
    wasm.finishDrawPath(currentPathId, false);
    setIsDrawing(false);
    onPathComplete?.(currentPathId);
    setCurrentPathId(null);
  }, [isDrawing, wasm, currentPathId, onPathComplete]);

  // Clear all paths
  const clearPaths = useCallback(() => {
    if (wasm) {
      wasm.clearDrawPaths();
      pathsRef.current.clear();
    }
  }, [wasm]);

  // Expose clear function
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.clearDrawing = clearPaths;
    }
  }, [clearPaths]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        touchAction: 'none',
        cursor: isDrawing ? 'crosshair' : 'default',
        ...style
      }}
      className={className}
      onPointerDown={startDrawing}
      onPointerMove={continueDrawing}
      onPointerUp={stopDrawing}
      onPointerCancel={stopDrawing}
      onPointerLeave={stopDrawing}
      {...props}
    />
  );
}

export default DrawingCanvas;
