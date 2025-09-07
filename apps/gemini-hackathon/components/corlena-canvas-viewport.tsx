'use client'

import { CanvasRenderer } from './canvas-renderer'

interface CorlenaCanvasViewportProps {
  className?: string
  selectedLayerId?: number | null
  onSelectedLayerChange?: (layerId: number | null) => void
}

export function CorlenaCanvasViewport({ className, selectedLayerId, onSelectedLayerChange }: CorlenaCanvasViewportProps) {
  return (
    <div className={className}>
      <CanvasRenderer 
        className="w-full h-full" 
        selectedLayerId={selectedLayerId}
        onSelectedLayerChange={onSelectedLayerChange}
      />
    </div>
  )
}
