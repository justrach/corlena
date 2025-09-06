'use client'

import { useEffect, useRef } from 'react'
import { DomNode } from 'corlena/react'
import { useCorlenaCanvas, LayerMetadata } from '@/lib/corlena-state'
import { cn } from '@/lib/utils'

interface CanvasNodeProps {
  layer: LayerMetadata
  isSelected: boolean
}

export function CanvasNode({ layer, isSelected }: CanvasNodeProps) {
  const { toggleNodeSelection } = useCorlenaCanvas()
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (layer.type === 'image' && imgRef.current && layer.data) {
      console.log('Setting image src for layer:', layer.nodeId, 'data length:', layer.data?.length)
      imgRef.current.src = `data:image/png;base64,${layer.data}`
      imgRef.current.onload = () => console.log('Image loaded successfully for layer:', layer.nodeId)
      imgRef.current.onerror = (e) => console.error('Image failed to load for layer:', layer.nodeId, e)
    }
  }, [layer.data, layer.type])

  const handleTap = () => {
    toggleNodeSelection(layer.nodeId)
  }

  if (layer.type === 'image') {
    return (
      <DomNode
        id={layer.nodeId}
        onTap={handleTap}
        className={cn(
          'border-2 border-transparent transition-all',
          isSelected && 'border-blue-500 border-dashed',
          layer.locked && 'cursor-not-allowed opacity-75'
        )}
        style={{
          width: '300px',
          height: '200px',
          opacity: layer.opacity,
          visibility: layer.visible ? 'visible' : 'hidden',
        }}
      >
        <div className="w-full h-full relative bg-gray-100 border">
          <img
            ref={imgRef}
            alt={layer.prompt || 'Layer image'}
            className="w-full h-full object-contain bg-white"
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
      </DomNode>
    )
  }

  if (layer.type === 'text') {
    return (
      <DomNode
        id={layer.nodeId}
        onTap={handleTap}
        className={cn(
          'border-2 border-transparent transition-all',
          isSelected && 'border-blue-500 border-dashed',
          layer.locked && 'cursor-not-allowed opacity-75'
        )}
        style={{
          width: '200px',
          height: '100px',
          opacity: layer.opacity,
          visibility: layer.visible ? 'visible' : 'hidden',
        }}
      >
        <div className="p-2 bg-white/90 rounded shadow-sm">
          <div className="w-full h-full overflow-hidden">
            {layer.data}
          </div>
        </div>
      </DomNode>
    )
  }

  return null
}
