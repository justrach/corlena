'use client'

import { useRef, useCallback, useEffect } from 'react'
import { SceneProvider, DomLayer } from 'corlena/react'
import { useCanvasStore } from '@/lib/store'
import { CanvasLayer } from './canvas-layer'
import { cn } from '@/lib/utils'

interface CanvasViewportProps {
  className?: string
}

export function CanvasViewport({ className }: CanvasViewportProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const {
    layers,
    selectedLayerId,
    selectLayer,
    addLayer,
    canvasWidth,
    canvasHeight,
    zoom,
    panX,
    panY,
    setZoom,
    setPan,
  } = useCanvasStore()

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    for (const file of imageFiles) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        
        if (response.ok) {
          const result = await response.json()
          
          // Create a temporary image to get dimensions
          const img = new Image()
          img.onload = () => {
            const maxSize = 400
            const aspectRatio = img.width / img.height
            const width = img.width > img.height ? maxSize : maxSize * aspectRatio
            const height = img.height > img.width ? maxSize : maxSize / aspectRatio
            
            addLayer({
              type: 'image',
              x: Math.random() * 200 + 100,
              y: Math.random() * 200 + 100,
              width,
              height,
              data: result.data,
              visible: true,
              locked: false,
              opacity: 1,
              metadata: {
                originalFilename: file.name,
                mimeType: result.mimeType,
              },
            })
          }
          img.src = `data:${result.mimeType};base64,${result.data}`
        }
      } catch (error) {
        console.error('Failed to upload file:', error)
      }
    }
  }, [addLayer])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Handle canvas click (deselect layers)
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectLayer(undefined)
    }
  }, [selectLayer])

  // Handle wheel events for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(zoom * delta)
    }
  }, [zoom, setZoom])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault()
        setZoom(1)
        setPan(0, 0)
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '=') {
        e.preventDefault()
        setZoom(zoom * 1.2)
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault()
        setZoom(zoom * 0.8)
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerId) {
          e.preventDefault()
          useCanvasStore.getState().deleteLayer(selectedLayerId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoom, setZoom, setPan, selectedLayerId])

  return (
    <div 
      className={cn(
        'relative w-full h-full overflow-hidden bg-gray-100 cursor-grab active:cursor-grabbing',
        className
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleCanvasClick}
      onWheel={handleWheel}
    >
      {/* Hidden file input for programmatic upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files || [])
          for (const file of files) {
            const formData = new FormData()
            formData.append('file', file)
            
            try {
              const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
              })
              
              if (response.ok) {
                const result = await response.json()
                const img = new Image()
                img.onload = () => {
                  const maxSize = 400
                  const aspectRatio = img.width / img.height
                  const width = img.width > img.height ? maxSize : maxSize * aspectRatio
                  const height = img.height > img.width ? maxSize : maxSize / aspectRatio
                  
                  addLayer({
                    type: 'image',
                    x: 100,
                    y: 100,
                    width,
                    height,
                    data: result.data,
                    visible: true,
                    locked: false,
                    opacity: 1,
                  })
                }
                img.src = `data:${result.mimeType};base64,${result.data}`
              }
            } catch (error) {
              console.error('Upload failed:', error)
            }
          }
          e.target.value = ''
        }}
      />

      {/* Canvas grid background */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${panX}px ${panY}px`,
        }}
      />

      {/* Canvas boundary */}
      <div
        className="absolute border-2 border-gray-400 bg-white shadow-lg"
        style={{
          width: canvasWidth * zoom,
          height: canvasHeight * zoom,
          left: panX + 50,
          top: panY + 50,
        }}
      >
        <SceneProvider>
          <DomLayer className="relative w-full h-full">
            {layers
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((layer) => (
                <CanvasLayer
                  key={layer.id}
                  layer={layer}
                  isSelected={layer.id === selectedLayerId}
                  onSelect={() => selectLayer(layer.id)}
                />
              ))}
          </DomLayer>
        </SceneProvider>
      </div>

      {/* Upload prompt overlay */}
      {layers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-4">
            <div className="text-6xl text-gray-300">🎨</div>
            <h3 className="text-xl font-semibold text-gray-600">
              Corlena × Gemini Canvas
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Drop images here or use the prompt below to start creating with AI
            </p>
            <div className="text-sm text-gray-400 space-y-1">
              <div>⌘/Ctrl + 0: Reset zoom</div>
              <div>⌘/Ctrl + =/-: Zoom in/out</div>
              <div>Delete: Remove selected layer</div>
            </div>
          </div>
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute top-4 right-4 bg-black/75 text-white px-3 py-1 rounded-full text-sm font-mono">
        {Math.round(zoom * 100)}%
      </div>

      {/* Selection info */}
      {selectedLayerId && (
        <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
          Layer selected
        </div>
      )}
    </div>
  )
}
