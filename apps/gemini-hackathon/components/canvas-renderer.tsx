'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCorlenaCanvas } from '@/lib/corlena-state'
import { useCanvasInteractions } from '@/lib/canvas-interactions'
import { useCanvasViewport } from '@/lib/canvas-viewport'
import { SelectionOverlay } from './selection-overlay'

interface CanvasRendererProps {
  className?: string
  selectedLayerId?: number | null
  onSelectedLayerChange?: (layerId: number | null) => void
}

export function CanvasRenderer({ className, selectedLayerId: propSelectedLayerId, onSelectedLayerChange }: CanvasRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const rafRef = useRef<number>(0)
  const imageElementsRef = useRef<Map<number, HTMLImageElement>>(new Map())
  
  const { getAllLayers } = useCorlenaCanvas()
  const layers = getAllLayers()
  
  // Use viewport system for infinite canvas
  const viewport = useCanvasViewport()
  
  // Use the new interaction system
  const interactions = useCanvasInteractions({
    onSelect: onSelectedLayerChange,
    onDrag: (layerId, position) => {
      console.log('Layer', layerId, 'dragged to:', position)
    },
    onResize: (layerId, size) => {
      console.log('Layer', layerId, 'resized to:', size)
    }
  })
  
  const selectedLayerId = propSelectedLayerId ?? interactions.selectedLayerId

  const getCanvasSize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return { wCss: 0, hCss: 0, dpr: 1 }
    const dpr = Math.max(1, (window.devicePixelRatio || 1))
    const wCss = canvas.clientWidth
    const hCss = canvas.clientHeight
    return { wCss, hCss, dpr }
  }, [])

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    
    const { wCss, hCss, dpr } = getCanvasSize()
    canvas.width = Math.floor(wCss * dpr)
    canvas.height = Math.floor(hCss * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [getCanvasSize])

  const compose = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return

    // Clear canvas
    ctx.fillStyle = "#f9fafb" // Light gray background
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)

    // Save context and apply viewport transform
    ctx.save()
    ctx.translate(viewport.viewport.x, viewport.viewport.y)
    ctx.scale(viewport.viewport.zoom, viewport.viewport.zoom)

    // Draw infinite grid pattern
    ctx.strokeStyle = 'rgba(0,0,0,0.03)'
    ctx.lineWidth = 1 / viewport.viewport.zoom // Keep line width consistent
    const gridSize = 32
    
    // Calculate visible world bounds
    const topLeft = viewport.screenToWorld(0, 0)
    const bottomRight = viewport.screenToWorld(canvas.clientWidth, canvas.clientHeight)
    
    // Draw vertical grid lines
    const startX = Math.floor(topLeft.x / gridSize) * gridSize
    const endX = Math.ceil(bottomRight.x / gridSize) * gridSize
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, topLeft.y - 100)
      ctx.lineTo(x, bottomRight.y + 100)
      ctx.stroke()
    }
    
    // Draw horizontal grid lines
    const startY = Math.floor(topLeft.y / gridSize) * gridSize
    const endY = Math.ceil(bottomRight.y / gridSize) * gridSize
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(topLeft.x - 100, y)
      ctx.lineTo(bottomRight.x + 100, y)
      ctx.stroke()
    }

    // Draw images
    const imageElements = imageElementsRef.current
    for (const layer of layers) {
      if (layer.type === 'image' && layer.visible) {
        const img = imageElements.get(layer.nodeId)
        if (img && img.complete) {
          try {
            // Get transform from interaction system (now in world coordinates)
            const baseX = 50 + (layer.nodeId * 120) % 400
            const baseY = 50 + Math.floor((layer.nodeId * 120) / 400) * 180
            const transform = interactions.getLayerTransform(layer.nodeId)
            
            const x = baseX + transform.x
            const y = baseY + transform.y
            const w = transform.width
            const h = transform.height
            
            ctx.save()
            ctx.globalAlpha = layer.opacity
            ctx.drawImage(img, x, y, w, h)
            ctx.restore()
            
            // Draw selection border with Figma-like styling
            const isSelected = selectedLayerId === layer.nodeId
            if (isSelected) {
              // Outer purple glow
              ctx.strokeStyle = '#8B5CF6'
              ctx.lineWidth = 2
              ctx.setLineDash([])
              ctx.strokeRect(x - 2, y - 2, w + 4, h + 4)
              
              // Inner white border
              ctx.strokeStyle = '#FFFFFF'
              ctx.lineWidth = 1
              ctx.strokeRect(x - 1, y - 1, w + 2, h + 2)
              
              // Draw resize handles
              const handleSize = 8
              const handles = [
                { x: x, y: y }, // nw
                { x: x + w, y: y }, // ne
                { x: x, y: y + h }, // sw
                { x: x + w, y: y + h }, // se
                { x: x + w/2, y: y }, // n
                { x: x + w, y: y + h/2 }, // e
                { x: x + w/2, y: y + h }, // s
                { x: x, y: y + h/2 }, // w
              ]
              
              handles.forEach(handle => {
                // Handle background
                ctx.fillStyle = '#FFFFFF'
                ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize)
                
                // Handle border
                ctx.strokeStyle = '#8B5CF6'
                ctx.lineWidth = 2
                ctx.strokeRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize)
              })
            }
          } catch (e) {
            console.warn('Failed to draw image:', e)
          }
        }
      }
    }
    
    // Restore context
    ctx.restore()
  }, [layers, selectedLayerId, interactions, viewport])

  const animate = useCallback(() => {
    compose()
    rafRef.current = requestAnimationFrame(animate)
  }, [compose])

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctxRef.current = ctx
    resize()
    animate()

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [resize, animate])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => resize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [resize])

  // Load images when layers change
  useEffect(() => {
    const imageElements = imageElementsRef.current
    for (const layer of layers) {
      
      if (layer.type === 'image' && layer.data && !imageElements.has(layer.nodeId)) {
        const img = new Image()
        img.onload = () => compose()
        img.onerror = (e) => console.error('Failed to load image for layer:', layer.nodeId, e)
        // Handle both direct base64 and data URL formats
        if (layer.data.startsWith('data:')) {
          img.src = layer.data
        } else {
          img.src = `data:image/png;base64,${layer.data}`
        }
        imageElements.set(layer.nodeId, img)
      }
    }

    // Clean up removed layers
    const layerIds = new Set(layers.map(l => l.nodeId))
    for (const [nodeId, img] of imageElements.entries()) {
      if (!layerIds.has(nodeId)) {
        imageElements.delete(nodeId)
      }
    }
  }, [layers, compose])
  

  // Initialize layer transforms with proper defaults
  useEffect(() => {
    layers.forEach(layer => {
      if (layer.type === 'image') {
        const img = imageElementsRef.current.get(layer.nodeId)
        if (img && img.complete) {
          const maxW = 300, maxH = 200
          const imgAspect = img.width / img.height
          const w = imgAspect > maxW / maxH ? maxW : maxH * imgAspect
          const h = imgAspect > maxW / maxH ? maxW / imgAspect : maxH
          
          // Set default transform if not exists
          const current = interactions.getLayerTransform(layer.nodeId)
          if (current.width === 300 && current.height === 200) {
            interactions.updateLayerTransform(layer.nodeId, { width: w, height: h })
          }
        }
      }
    })
  }, [layers, interactions])
  
  // Find which layer is clicked (convert screen to world coordinates)
  const findClickedLayer = (screenX: number, screenY: number) => {
    const worldPos = viewport.screenToWorld(screenX, screenY)
    
    for (const layer of layers.slice().reverse()) { // Check top layers first
      if (layer.type === 'image' && layer.visible) {
        const img = imageElementsRef.current.get(layer.nodeId)
        if (img && img.complete) {
          const baseX = 50 + (layer.nodeId * 120) % 400
          const baseY = 50 + Math.floor((layer.nodeId * 120) / 400) * 180
          const transform = interactions.getLayerTransform(layer.nodeId)
          const layerX = baseX + transform.x
          const layerY = baseY + transform.y
          const w = transform.width
          const h = transform.height
          
          if (worldPos.x >= layerX && worldPos.x <= layerX + w && worldPos.y >= layerY && worldPos.y <= layerY + h) {
            return layer.nodeId
          }
        }
      }
    }
    return null
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    
    const clickedLayer = findClickedLayer(screenX, screenY)
    if (clickedLayer) {
      // Convert screen coordinates to world coordinates for interactions
      const worldPos = viewport.screenToWorld(screenX, screenY)
      const baseX = 50 + (clickedLayer * 120) % 400
      const baseY = 50 + Math.floor((clickedLayer * 120) / 400) * 180
      interactions.handleMouseDown(worldPos.x, worldPos.y, clickedLayer, baseX, baseY)
      onSelectedLayerChange?.(clickedLayer)
    } else {
      // Start viewport panning if not clicking on layer
      viewport.handleMouseDown(e)
      interactions.selectLayer(null)
      onSelectedLayerChange?.(null)
    }
  }
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    
    // Handle viewport panning
    viewport.handleMouseMove(e)
    
    // Handle layer interactions in world coordinates
    if (interactions.selectedLayerId) {
      const worldPos = viewport.screenToWorld(screenX, screenY)
      interactions.handleMouseMove(worldPos.x, worldPos.y)
    }
  }

  const handleMouseUp = () => {
    viewport.handleMouseUp()
    interactions.handleMouseUp()
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: viewport.isDragging ? 'grabbing' : (interactions.selectedLayerId ? 'crosshair' : 'grab'),
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={viewport.handleWheel}
    />
  )
}
