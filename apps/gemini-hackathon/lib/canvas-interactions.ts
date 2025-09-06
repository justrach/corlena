'use client'

import { useCallback, useRef, useState } from 'react'

export interface LayerTransform {
  x: number
  y: number
  width: number
  height: number
}

export interface InteractionState {
  selectedLayerId: number | null
  layerTransforms: Map<number, LayerTransform>
}

export interface InteractionHandlers {
  onDrag?: (layerId: number, position: { x: number; y: number }) => void
  onResize?: (layerId: number, size: { width: number; height: number }) => void
  onSelect?: (layerId: number | null) => void
}

export interface DragState {
  isDragging: boolean
  isResizing: boolean
  resizeHandle: string | null
  startX: number
  startY: number
  layerId: number | null
  originalTransform?: LayerTransform
}

export function useCanvasInteractions(handlers: InteractionHandlers = {}) {
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null)
  const layerTransformsRef = useRef<Map<number, LayerTransform>>(new Map())
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    isResizing: false,
    resizeHandle: null,
    startX: 0,
    startY: 0,
    layerId: null
  })

  const getLayerTransform = useCallback((layerId: number): LayerTransform => {
    return layerTransformsRef.current.get(layerId) || {
      x: 0,
      y: 0,
      width: 300,
      height: 200
    }
  }, [])

  const updateLayerTransform = useCallback((layerId: number, transform: Partial<LayerTransform>) => {
    const current = getLayerTransform(layerId)
    const updated = { ...current, ...transform }
    layerTransformsRef.current.set(layerId, updated)
    
    if (transform.x !== undefined || transform.y !== undefined) {
      handlers.onDrag?.(layerId, { x: updated.x, y: updated.y })
    }
    if (transform.width !== undefined || transform.height !== undefined) {
      handlers.onResize?.(layerId, { width: updated.width, height: updated.height })
    }
  }, [handlers])

  const selectLayer = useCallback((layerId: number | null) => {
    setSelectedLayerId(layerId)
    handlers.onSelect?.(layerId)
  }, [handlers])

  const findResizeHandle = useCallback((x: number, y: number, layerId: number, baseX: number, baseY: number): string | null => {
    const transform = getLayerTransform(layerId)
    const cornerTolerance = 15
    const edgeTolerance = 12
    
    // Calculate absolute position of image corners and edges
    const imgX = baseX + transform.x
    const imgY = baseY + transform.y
    const imgRight = imgX + transform.width
    const imgBottom = imgY + transform.height
    const imgCenterX = imgX + transform.width / 2
    const imgCenterY = imgY + transform.height / 2
    
    // Check corner handles first (priority over edge handles)
    if (Math.abs(x - imgX) <= cornerTolerance && Math.abs(y - imgY) <= cornerTolerance) return 'nw'
    if (Math.abs(x - imgRight) <= cornerTolerance && Math.abs(y - imgY) <= cornerTolerance) return 'ne'
    if (Math.abs(x - imgX) <= cornerTolerance && Math.abs(y - imgBottom) <= cornerTolerance) return 'sw'
    if (Math.abs(x - imgRight) <= cornerTolerance && Math.abs(y - imgBottom) <= cornerTolerance) return 'se'
    
    // Check edge handles - need to be within the image bounds and close to the edge
    const edgeMargin = 20 // How far from the edge we can click
    
    // North edge: top of image, anywhere along width
    if (x >= imgX - edgeMargin && x <= imgRight + edgeMargin && Math.abs(y - imgY) <= edgeTolerance) return 'n'
    
    // South edge: bottom of image, anywhere along width  
    if (x >= imgX - edgeMargin && x <= imgRight + edgeMargin && Math.abs(y - imgBottom) <= edgeTolerance) return 's'
    
    // East edge: right side of image, anywhere along height
    if (y >= imgY - edgeMargin && y <= imgBottom + edgeMargin && Math.abs(x - imgRight) <= edgeTolerance) return 'e'
    
    // West edge: left side of image, anywhere along height
    if (y >= imgY - edgeMargin && y <= imgBottom + edgeMargin && Math.abs(x - imgX) <= edgeTolerance) return 'w'
    
    return null
  }, [getLayerTransform])

  const handleMouseDown = useCallback((x: number, y: number, layerId: number, baseX?: number, baseY?: number) => {
    selectLayer(layerId)
    
    // Default base position calculation if not provided
    const imgBaseX = baseX ?? (50 + (layerId * 120) % 400)
    const imgBaseY = baseY ?? (50 + Math.floor((layerId * 120) / 400) * 180)
    
    // Check for resize handle first
    const resizeHandle = selectedLayerId === layerId ? findResizeHandle(x, y, layerId, imgBaseX, imgBaseY) : null
    
    const transform = getLayerTransform(layerId)
    const imgX = imgBaseX + transform.x
    const imgY = imgBaseY + transform.y
    
    if (resizeHandle) {
      dragStateRef.current = {
        isDragging: false,
        isResizing: true,
        resizeHandle,
        startX: x,
        startY: y,
        layerId,
        originalTransform: { ...transform }
      }
    } else {
      // Store absolute mouse position and current transform for smooth dragging
      dragStateRef.current = {
        isDragging: true,
        isResizing: false,
        resizeHandle: null,
        startX: x,
        startY: y,
        layerId,
        originalTransform: { ...transform }
      }
    }
  }, [selectedLayerId, selectLayer, findResizeHandle, getLayerTransform])

  const handleMouseMove = useCallback((x: number, y: number) => {
    const state = dragStateRef.current
    if (!state.layerId || (!state.isDragging && !state.isResizing)) return

    if (state.isResizing && state.originalTransform) {
      const deltaX = x - state.startX
      const deltaY = y - state.startY
      const original = state.originalTransform
      
      let newWidth = original.width
      let newHeight = original.height
      let newX = original.x
      let newY = original.y
      
      switch (state.resizeHandle) {
        case 'se':
          newWidth = Math.max(50, original.width + deltaX)
          newHeight = Math.max(50, original.height + deltaY)
          break
        case 'sw':
          newWidth = Math.max(50, original.width - deltaX)
          newHeight = Math.max(50, original.height + deltaY)
          newX = original.x + (original.width - newWidth)
          break
        case 'ne':
          newWidth = Math.max(50, original.width + deltaX)
          newHeight = Math.max(50, original.height - deltaY)
          newY = original.y + (original.height - newHeight)
          break
        case 'nw':
          newWidth = Math.max(50, original.width - deltaX)
          newHeight = Math.max(50, original.height - deltaY)
          newX = original.x + (original.width - newWidth)
          newY = original.y + (original.height - newHeight)
          break
        case 'e':
          newWidth = Math.max(50, original.width + deltaX)
          break
        case 'w':
          newWidth = Math.max(50, original.width - deltaX)
          newX = original.x + (original.width - newWidth)
          break
        case 's':
          newHeight = Math.max(50, original.height + deltaY)
          break
        case 'n':
          newHeight = Math.max(50, original.height - deltaY)
          newY = original.y + (original.height - newHeight)
          break
      }
      
      updateLayerTransform(state.layerId, { x: newX, y: newY, width: newWidth, height: newHeight })
    } else if (state.isDragging && state.originalTransform) {
      // Calculate delta from start position and apply to original transform
      const deltaX = x - state.startX
      const deltaY = y - state.startY
      const newX = state.originalTransform.x + deltaX
      const newY = state.originalTransform.y + deltaY
      updateLayerTransform(state.layerId, { x: newX, y: newY })
    }
  }, [updateLayerTransform])

  const handleMouseUp = useCallback(() => {
    dragStateRef.current = {
      isDragging: false,
      isResizing: false,
      resizeHandle: null,
      startX: 0,
      startY: 0,
      layerId: null
    }
  }, [])

  return {
    selectedLayerId,
    selectLayer,
    getLayerTransform,
    updateLayerTransform,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    findResizeHandle,
    isInteracting: dragStateRef.current.isDragging || dragStateRef.current.isResizing
  }
}
