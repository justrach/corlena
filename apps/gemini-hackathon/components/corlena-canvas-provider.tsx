'use client'

import { useState, useCallback, useMemo } from 'react'
import { useScene } from 'corlena/react'
import { CorlenaCanvasContext, LayerMetadata, AppState, CorlenaCanvasContextValue } from '@/lib/corlena-state'

interface CorlenaCanvasProviderProps {
  children: React.ReactNode
}

export function CorlenaCanvasProvider({ children }: CorlenaCanvasProviderProps) {
  const scene = useScene()
  
  const [appState, setAppState] = useState<AppState>({
    layers: new Map(),
    selectedNodeIds: new Set(),
    isGenerating: false,
    nextNodeId: 1,
  })

  const addLayer = useCallback((layerData: Omit<LayerMetadata, 'id' | 'nodeId' | 'createdAt'>) => {
    const nodeId = appState.nextNodeId
    
    // Create node in WASM engine with initial position and size
    scene.upsertNode({
      id: nodeId,
      x: 100 + Math.random() * 200, // Random initial position
      y: 100 + Math.random() * 200,
      w: layerData.type === 'text' ? 200 : 300,
      h: layerData.type === 'text' ? 100 : 200,
      flags: 0
    })

    // Store metadata
    const layer: LayerMetadata = {
      ...layerData,
      id: `layer-${nodeId}`,
      nodeId,
      createdAt: Date.now(),
    }

    setAppState(prev => ({
      ...prev,
      layers: new Map(prev.layers).set(nodeId, layer),
      nextNodeId: prev.nextNodeId + 1,
    }))

    return nodeId
  }, [scene, appState.nextNodeId])

  const updateLayer = useCallback((nodeId: number, updates: Partial<LayerMetadata>) => {
    setAppState(prev => {
      const layer = prev.layers.get(nodeId)
      if (!layer) return prev
      
      const newLayers = new Map(prev.layers)
      newLayers.set(nodeId, { ...layer, ...updates })
      
      return {
        ...prev,
        layers: newLayers,
      }
    })
  }, [])

  const deleteLayer = useCallback((nodeId: number) => {
    setAppState(prev => {
      const newLayers = new Map(prev.layers)
      newLayers.delete(nodeId)
      
      const newSelectedNodes = new Set(prev.selectedNodeIds)
      newSelectedNodes.delete(nodeId)
      
      return {
        ...prev,
        layers: newLayers,
        selectedNodeIds: newSelectedNodes,
      }
    })
  }, [])

  const getLayer = useCallback((nodeId: number) => {
    return appState.layers.get(nodeId)
  }, [appState.layers])

  const getAllLayers = useCallback(() => {
    return Array.from(appState.layers.values())
  }, [appState.layers])

  const selectNodes = useCallback((nodeIds: number[]) => {
    setAppState(prev => ({
      ...prev,
      selectedNodeIds: new Set(nodeIds),
    }))
  }, [])

  const toggleNodeSelection = useCallback((nodeId: number) => {
    setAppState(prev => {
      const newSelectedNodes = new Set(prev.selectedNodeIds)
      if (newSelectedNodes.has(nodeId)) {
        newSelectedNodes.delete(nodeId)
      } else {
        newSelectedNodes.add(nodeId)
      }
      
      return {
        ...prev,
        selectedNodeIds: newSelectedNodes,
      }
    })
  }, [])

  const getSelectedNodes = useCallback(() => {
    return Array.from(appState.selectedNodeIds)
  }, [appState.selectedNodeIds])

  const setGenerating = useCallback((generating: boolean) => {
    setAppState(prev => ({
      ...prev,
      isGenerating: generating,
    }))
  }, [])

  const exportSelectedLayers = useCallback(() => {
    return Array.from(appState.selectedNodeIds)
      .map(nodeId => appState.layers.get(nodeId))
      .filter((layer): layer is LayerMetadata => layer !== undefined)
  }, [appState.selectedNodeIds, appState.layers])

  const exportAllLayers = useCallback(() => {
    return Array.from(appState.layers.values())
  }, [appState.layers])

  const contextValue: CorlenaCanvasContextValue = useMemo(() => ({
    addLayer,
    updateLayer,
    deleteLayer,
    getLayer,
    getAllLayers,
    selectNodes,
    toggleNodeSelection,
    getSelectedNodes,
    setGenerating,
    exportSelectedLayers,
    exportAllLayers,
  }), [
    addLayer,
    updateLayer,
    deleteLayer,
    getLayer,
    getAllLayers,
    selectNodes,
    toggleNodeSelection,
    getSelectedNodes,
    setGenerating,
    exportSelectedLayers,
    exportAllLayers,
  ])

  return (
    <CorlenaCanvasContext.Provider value={contextValue}>
      {children}
    </CorlenaCanvasContext.Provider>
  )
}
