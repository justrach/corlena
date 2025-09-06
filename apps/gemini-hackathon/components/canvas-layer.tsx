'use client'

import { useRef, useEffect } from 'react'
import { Draggable, Resizable } from 'corlena/react'
import { useCanvasStore, Layer } from '@/lib/store'
import { cn } from '@/lib/utils'

interface CanvasLayerProps {
  layer: Layer
  isSelected: boolean
  onSelect: () => void
}

export function CanvasLayer({ layer, isSelected, onSelect }: CanvasLayerProps) {
  const updateLayer = useCanvasStore((state) => state.updateLayer)
  const zoom = useCanvasStore((state) => state.zoom)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (layer.type === 'image' && imgRef.current && layer.data) {
      imgRef.current.src = `data:image/png;base64,${layer.data}`
    }
  }, [layer.data, layer.type])

  const handleMove = (pos: { x: number; y: number }) => {
    if (!layer.locked) {
      updateLayer(layer.id, { x: pos.x, y: pos.y })
    }
  }

  const handleResize = (size: { w: number; h: number }) => {
    if (!layer.locked) {
      updateLayer(layer.id, { width: size.w, height: size.h })
    }
  }

  const layerStyle = {
    opacity: layer.opacity,
    visibility: layer.visible ? 'visible' : 'hidden',
    zIndex: layer.zIndex,
    transform: `scale(${zoom})`,
    transformOrigin: 'top left',
  } as const

  if (layer.type === 'image') {
    return (
      <div
        style={{
          position: 'absolute',
          left: layer.x,
          top: layer.y,
          ...layerStyle
        }}
      >
        <Draggable
          initial={{ x: 0, y: 0 }}
          onMove={layer.locked ? undefined : (pos) => handleMove({ x: layer.x + pos.x, y: layer.y + pos.y })}
        >
          <Resizable
            initial={{ w: layer.width, h: layer.height }}
            onResize={layer.locked ? undefined : handleResize}
          >
            <div
              className={cn(
                'w-full h-full relative border-2 border-transparent',
                isSelected && 'border-blue-500 border-dashed',
                layer.locked ? 'cursor-not-allowed' : 'cursor-move'
              )}
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
              }}
            >
              <img
                ref={imgRef}
                alt={layer.prompt || 'Layer image'}
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
              {isSelected && !layer.locked && (
                <>
                  {/* Corner resize handles */}
                  <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nw-resize" />
                  <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-ne-resize" />
                  <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-sw-resize" />
                  <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-se-resize" />
                </>
              )}
            </div>
          </Resizable>
        </Draggable>
      </div>
    )
  }

  if (layer.type === 'text') {
    return (
      <Draggable
        initial={{ x: layer.x, y: layer.y }}
        onMove={handleMove}
        style={layerStyle}
        className={cn(
          'border-2 border-transparent cursor-move min-w-[100px] min-h-[40px]',
          isSelected && 'border-blue-500 border-dashed',
          layer.locked && 'cursor-not-allowed opacity-75'
        )}
      >
        <div
          className="p-2 bg-white/90 rounded shadow-sm"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          style={{ 
            width: layer.width,
            height: layer.height,
            fontSize: Math.max(12, 16 * zoom),
          }}
        >
          <div className="w-full h-full overflow-hidden">
            {layer.data}
          </div>
        </div>
      </Draggable>
    )
  }

  return null
}
