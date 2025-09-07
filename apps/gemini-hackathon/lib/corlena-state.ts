'use client'

import { createContext, useContext } from 'react'

// Layer metadata (not managed by WASM, but associated with nodes)
export interface LayerMetadata {
  id: string
  nodeId: number // Maps to WASM node ID
  type: 'image' | 'text' | 'generated'
  data?: string // Base64 image data or text content
  prompt?: string
  visible: boolean
  locked: boolean
  opacity: number
  createdAt: number
}

// Canvas-level state (UI state not handled by WASM)
export interface AppState {
  layers: Map<number, LayerMetadata> // nodeId -> metadata
  selectedNodeIds: Set<number>
  isGenerating: boolean
  nextNodeId: number
}

// Use Corlena's SceneProvider instead of Zustand
export interface CorlenaCanvasContextValue {
  // Layer metadata management
  addLayer: (layer: Omit<LayerMetadata, 'id' | 'nodeId' | 'createdAt'>) => number
  updateLayer: (nodeId: number, updates: Partial<LayerMetadata>) => void
  deleteLayer: (nodeId: number) => void
  getLayer: (nodeId: number) => LayerMetadata | undefined
  getAllLayers: () => LayerMetadata[]
  
  // Selection (maps to WASM node IDs)
  selectNodes: (nodeIds: number[]) => void
  toggleNodeSelection: (nodeId: number) => void
  getSelectedNodes: () => number[]
  
  // Generation state
  setGenerating: (generating: boolean) => void
  
  // Export functionality
  exportSelectedLayers: () => LayerMetadata[]
  exportAllLayers: () => LayerMetadata[]
}

const CorlenaCanvasContext = createContext<CorlenaCanvasContextValue | null>(null)

export function useCorlenaCanvas() {
  const context = useContext(CorlenaCanvasContext)
  if (!context) {
    throw new Error('useCorlenaCanvas must be used within CorlenaCanvasProvider')
  }
  return context
}

export { CorlenaCanvasContext }
