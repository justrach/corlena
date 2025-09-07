import { useCallback, useRef, useState } from 'react'

export interface ViewportState {
  x: number
  y: number
  zoom: number
}

export interface UseCanvasViewportReturn {
  viewport: ViewportState
  panBy: (deltaX: number, deltaY: number) => void
  zoomTo: (zoom: number, centerX?: number, centerY?: number) => void
  zoomBy: (factor: number, centerX?: number, centerY?: number) => void
  resetViewport: () => void
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number }
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number }
  handleMouseDown: (e: React.MouseEvent) => void
  handleMouseMove: (e: React.MouseEvent) => void
  handleMouseUp: () => void
  handleWheel: (e: React.WheelEvent) => void
  isDragging: boolean
}

const DEFAULT_VIEWPORT: ViewportState = {
  x: 0,
  y: 0,
  zoom: 1
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 10

export function useCanvasViewport(): UseCanvasViewportReturn {
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT)
  const [isDragging, setIsDragging] = useState(false)
  const lastMousePos = useRef<{ x: number; y: number } | null>(null)

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    setViewport(prev => ({
      ...prev,
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }))
  }, [])

  const zoomTo = useCallback((zoom: number, centerX = 0, centerY = 0) => {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
    
    setViewport(prev => {
      const zoomFactor = clampedZoom / prev.zoom
      return {
        x: centerX - (centerX - prev.x) * zoomFactor,
        y: centerY - (centerY - prev.y) * zoomFactor,
        zoom: clampedZoom
      }
    })
  }, [])

  const zoomBy = useCallback((factor: number, centerX = 0, centerY = 0) => {
    setViewport(prev => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * factor))
      const zoomFactor = newZoom / prev.zoom
      
      return {
        x: centerX - (centerX - prev.x) * zoomFactor,
        y: centerY - (centerY - prev.y) * zoomFactor,
        zoom: newZoom
      }
    })
  }, [])

  const resetViewport = useCallback(() => {
    setViewport(DEFAULT_VIEWPORT)
  }, [])

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - viewport.x) / viewport.zoom,
      y: (screenY - viewport.y) / viewport.zoom
    }
  }, [viewport])

  const worldToScreen = useCallback((worldX: number, worldY: number) => {
    return {
      x: worldX * viewport.zoom + viewport.x,
      y: worldY * viewport.zoom + viewport.y
    }
  }, [viewport])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start panning if not clicking on an interactive element
    if (e.target === e.currentTarget) {
      setIsDragging(true)
      lastMousePos.current = { x: e.clientX, y: e.clientY }
      e.preventDefault()
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && lastMousePos.current) {
      const deltaX = e.clientX - lastMousePos.current.x
      const deltaY = e.clientY - lastMousePos.current.y
      
      panBy(deltaX, deltaY)
      lastMousePos.current = { x: e.clientX, y: e.clientY }
    }
  }, [isDragging, panBy])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    lastMousePos.current = null
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const centerX = e.clientX - rect.left
    const centerY = e.clientY - rect.top
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    zoomBy(zoomFactor, centerX, centerY)
  }, [zoomBy])

  return {
    viewport,
    panBy,
    zoomTo,
    zoomBy,
    resetViewport,
    screenToWorld,
    worldToScreen,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    isDragging
  }
}
