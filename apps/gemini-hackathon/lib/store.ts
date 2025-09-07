import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export type LayerType = 'image' | 'text' | 'generated'

export interface Layer {
  id: string
  type: LayerType
  x: number
  y: number
  width: number
  height: number
  data: string // base64 for images, text content for text
  prompt?: string // The prompt used to generate this layer
  consistencyId?: string // For Gemini consistency tracking
  geminiRequestId?: string
  visible: boolean
  locked: boolean
  opacity: number
  zIndex: number
  metadata?: Record<string, unknown>
}

export interface CanvasState {
  layers: Layer[]
  selectedLayerId?: string
  selectedLayerIds: string[]
  isGenerating: boolean
  canvasWidth: number
  canvasHeight: number
  zoom: number
  panX: number
  panY: number
  history: Layer[][]
  historyIndex: number
}

export interface CanvasActions {
  // Layer management
  addLayer: (layer: Omit<Layer, 'id' | 'zIndex'>) => void
  updateLayer: (id: string, updates: Partial<Layer>) => void
  deleteLayer: (id: string) => void
  selectLayer: (id?: string) => void
  selectMultipleLayers: (ids: string[]) => void
  toggleLayerSelection: (id: string) => void
  moveLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void
  duplicateLayer: (id: string) => void
  
  // Canvas state
  setCanvasSize: (width: number, height: number) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  
  // Generation state
  setGenerating: (generating: boolean) => void
  
  // History
  saveHistory: () => void
  undo: () => void
  redo: () => void
  
  // Utility
  exportCanvas: () => Layer[]
  importCanvas: (layers: Layer[]) => void
  clearCanvas: () => void
}

type CanvasStore = CanvasState & CanvasActions

const defaultState: CanvasState = {
  layers: [],
  selectedLayerId: undefined,
  selectedLayerIds: [],
  isGenerating: false,
  canvasWidth: 1024,
  canvasHeight: 768,
  zoom: 1,
  panX: 0,
  panY: 0,
  history: [[]],
  historyIndex: 0,
}

export const useCanvasStore = create<CanvasStore>()(
  subscribeWithSelector((set, get) => ({
    ...defaultState,
    
    addLayer: (layerData) => {
      const newLayer: Layer = {
        ...layerData,
        id: crypto.randomUUID(),
        zIndex: get().layers.length,
      }
      
      set((state) => ({
        layers: [...state.layers, newLayer],
        selectedLayerId: newLayer.id,
      }))
      
      get().saveHistory()
    },
    
    updateLayer: (id, updates) => {
      set((state) => ({
        layers: state.layers.map((layer) =>
          layer.id === id ? { ...layer, ...updates } : layer
        ),
      }))
    },
    
    deleteLayer: (id) => {
      set((state) => ({
        layers: state.layers.filter((layer) => layer.id !== id),
        selectedLayerId: state.selectedLayerId === id ? undefined : state.selectedLayerId,
      }))
      
      get().saveHistory()
    },
    
    selectLayer: (id?: string) => {
      set((state) => ({ 
        ...state, 
        selectedLayerId: id,
        selectedLayerIds: id ? [id] : []
      }))
    },
    
    selectMultipleLayers: (ids: string[]) => {
      set((state) => ({ 
        ...state, 
        selectedLayerIds: ids,
        selectedLayerId: ids.length === 1 ? ids[0] : undefined
      }))
    },
    
    toggleLayerSelection: (id: string) => {
      set((state) => {
        const currentIds = state.selectedLayerIds
        const isSelected = currentIds.includes(id)
        
        if (isSelected) {
          const newIds = currentIds.filter(selectedId => selectedId !== id)
          return {
            ...state,
            selectedLayerIds: newIds,
            selectedLayerId: newIds.length === 1 ? newIds[0] : undefined
          }
        } else {
          const newIds = [...currentIds, id]
          return {
            ...state,
            selectedLayerIds: newIds,
            selectedLayerId: newIds.length === 1 ? newIds[0] : undefined
          }
        }
      })
    },
    
    moveLayer: (id, direction) => {
      const { layers } = get()
      const layerIndex = layers.findIndex((l) => l.id === id)
      if (layerIndex === -1) return
      
      const newLayers = [...layers]
      const layer = newLayers[layerIndex]
      
      switch (direction) {
        case 'up':
          if (layerIndex < layers.length - 1) {
            layer.zIndex += 1
            newLayers[layerIndex + 1].zIndex -= 1
            newLayers.sort((a, b) => a.zIndex - b.zIndex)
          }
          break
        case 'down':
          if (layerIndex > 0) {
            layer.zIndex -= 1
            newLayers[layerIndex - 1].zIndex += 1
            newLayers.sort((a, b) => a.zIndex - b.zIndex)
          }
          break
        case 'top':
          layer.zIndex = Math.max(...layers.map(l => l.zIndex)) + 1
          break
        case 'bottom':
          layer.zIndex = Math.min(...layers.map(l => l.zIndex)) - 1
          break
      }
      
      set({ layers: newLayers })
      get().saveHistory()
    },
    
    duplicateLayer: (id) => {
      const layer = get().layers.find((l) => l.id === id)
      if (!layer) return
      
      const duplicate: Layer = {
        ...layer,
        id: crypto.randomUUID(),
        x: layer.x + 20,
        y: layer.y + 20,
        zIndex: get().layers.length,
      }
      
      set((state) => ({
        layers: [...state.layers, duplicate],
        selectedLayerId: duplicate.id,
      }))
      
      get().saveHistory()
    },
    
    setCanvasSize: (width, height) => {
      set({ canvasWidth: width, canvasHeight: height })
    },
    
    setZoom: (zoom) => {
      set({ zoom: Math.max(0.1, Math.min(5, zoom)) })
    },
    
    setPan: (x, y) => {
      set({ panX: x, panY: y })
    },
    
    setGenerating: (generating) => {
      set({ isGenerating: generating })
    },
    
    saveHistory: () => {
      const { layers, history, historyIndex } = get()
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(JSON.parse(JSON.stringify(layers)))
      
      // Limit history to 20 states
      if (newHistory.length > 20) {
        newHistory.shift()
      } else {
        set({ historyIndex: historyIndex + 1 })
      }
      
      set({ history: newHistory })
    },
    
    undo: () => {
      const { history, historyIndex } = get()
      if (historyIndex > 0) {
        const previousLayers = history[historyIndex - 1]
        set({
          layers: JSON.parse(JSON.stringify(previousLayers)),
          historyIndex: historyIndex - 1,
          selectedLayerId: undefined,
        })
      }
    },
    
    redo: () => {
      const { history, historyIndex } = get()
      if (historyIndex < history.length - 1) {
        const nextLayers = history[historyIndex + 1]
        set({
          layers: JSON.parse(JSON.stringify(nextLayers)),
          historyIndex: historyIndex + 1,
          selectedLayerId: undefined,
        })
      }
    },
    
    exportCanvas: () => {
      return JSON.parse(JSON.stringify(get().layers))
    },
    
    importCanvas: (layers) => {
      set({ layers: JSON.parse(JSON.stringify(layers)), selectedLayerId: undefined })
      get().saveHistory()
    },
    
    clearCanvas: () => {
      set({ layers: [], selectedLayerId: undefined })
      get().saveHistory()
    },
  }))
)

// Selectors for common operations
export const useSelectedLayer = () => {
  return useCanvasStore((state) => 
    state.layers.find((layer) => layer.id === state.selectedLayerId)
  )
}

export const useCanUndo = () => {
  return useCanvasStore((state) => state.historyIndex > 0)
}

export const useCanRedo = () => {
  return useCanvasStore((state) => state.historyIndex < state.history.length - 1)
}
