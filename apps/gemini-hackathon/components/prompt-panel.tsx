'use client'

import { useState, useRef, useCallback } from 'react'
import { useCorlenaCanvas } from '@/lib/corlena-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { 
  Sparkles, 
  Upload, 
  Download, 
  Undo2, 
  Redo2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Image as ImageIcon,
  Loader2,
  Wand2
} from 'lucide-react'
import { useCanvasStore } from '@/lib/store'

interface PromptPanelProps {
  className?: string
}

export function PromptPanel({ className }: PromptPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [showPresets, setShowPresets] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const {
    getAllLayers,
    getSelectedNodes,
    addLayer,
    updateLayer,
    deleteLayer,
    selectNodes,
    toggleNodeSelection,
    setGenerating,
    exportSelectedLayers,
    exportAllLayers
  } = useCorlenaCanvas()
  
  const layers = getAllLayers()
  const selectedNodeIds = getSelectedNodes()
  const selectedLayer = selectedNodeIds.length === 1 ? layers.find(l => l.nodeId === selectedNodeIds[0]) : undefined
  
  // For now, we'll implement basic undo/redo placeholders
  const canUndo = false
  const canRedo = false

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return
    
    setIsGenerating(true)
    setGenerating(true)
    
    try {
      let mode = 'generate'
      let images: Array<{ data: string; mimeType: string }> = []
      
      // If a layer is selected and it's an image, use edit mode
      if (selectedLayer && selectedLayer.type === 'image' && selectedLayer.data) {
        mode = 'edit'
        images = [{
          data: selectedLayer.data,
          mimeType: 'image/png'
        }]
      }
      
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          images,
          mode,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate image')
      }
      
      const result = await response.json()
      
      if (result.success) {
        // Create a temporary image to get dimensions
        const img = document.createElement('img')
        img.onload = () => {
          const maxSize = 400
          const aspectRatio = img.width / img.height
          const width = img.width > img.height ? maxSize : maxSize * aspectRatio
          const height = img.height > img.width ? maxSize : maxSize / aspectRatio
          
          if (mode === 'edit' && selectedLayer) {
            // Update the existing layer
            updateLayer(selectedLayer.nodeId, {
              data: result.imageData,
              prompt,
            })
          } else {
            // Add a new layer
            addLayer({
              type: 'generated' as const,
              data: result.imageData,
              prompt,
              visible: true,
              locked: false,
              opacity: 1,
            })
          }
          
          setPrompt('')
        }
        img.src = `data:image/png;base64,${result.imageData}`
      } else {
        throw new Error(result.error || 'Generation failed')
      }
    } catch (error) {
      console.error('Generation error:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate image')
    } finally {
      setIsGenerating(false)
      setGenerating(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePresetClick = (preset: any) => {
    const value = window.prompt(`Enter ${preset.label.toLowerCase()}:`, preset.placeholder)
    if (value) {
      setPrompt(typeof preset.template === 'function' ? preset.template(value) : value)
    }
    setShowPresets(false)
  }

  const QUICK_PRESETS = [
    { label: 'Logo', placeholder: 'company name', template: (name: string) => `A modern, professional logo for ${name}` },
    { label: 'Icon', placeholder: 'concept', template: (concept: string) => `A simple, clean icon representing ${concept}` },
    { label: 'Portrait', placeholder: 'person description', template: (desc: string) => `A professional portrait of ${desc}` },
    { label: 'Scene', placeholder: 'setting', template: (setting: string) => `A beautiful scene of ${setting}` }
  ]

  const handleUpload = () => {
    fileInputRef.current?.click()
  }

  const handleExport = () => {
    // Placeholder for export functionality
    console.log('Export functionality not implemented')
  }

  const handleLayerVisibilityToggle = (layerId: number) => {
    const layer = layers.find(l => l.nodeId === layerId)
    if (layer) {
      updateLayer(layerId, { visible: !layer.visible })
    }
  }

  const handleLayerLockToggle = (layerId: number) => {
    const layer = layers.find(l => l.nodeId === layerId)
    if (layer) {
      updateLayer(layerId, { locked: !layer.locked })
    }
  }

  return (
    <div className={cn('flex flex-col h-full bg-white border-l border-gray-200', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          AI Canvas
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Create and edit with Gemini AI
        </p>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleUpload}
            className="flex items-center gap-1"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={layers.length === 0}
            className="flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => console.log('Undo not implemented')}
            disabled={!canUndo}
            className="flex items-center gap-1"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => console.log('Redo not implemented')}
            disabled={!canRedo}
            className="flex items-center gap-1"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Prompt Input */}
      <div className="p-4 border-b border-gray-200">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                selectedLayer 
                  ? `Edit ${selectedLayer.type}: "${selectedLayer.prompt || 'layer'}"...`
                  : "Describe what you want to create..."
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
              disabled={isGenerating}
              className="flex-1"
            />
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {isGenerating ? 'Generating...' : 'Generate'}
            </Button>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPresets(!showPresets)}
              className="w-full justify-start text-xs"
            >
              Quick Presets {showPresets ? '▼' : '▶'}
            </Button>
            
            {showPresets && (
              <div className="grid grid-cols-2 gap-1">
                {QUICK_PRESETS.map((preset, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePresetClick(preset)}
                    className="text-xs h-8 justify-start"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {selectedLayer && (
            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              Selected: {selectedLayer.type} layer
              {selectedLayer.prompt && (
                <div className="text-gray-600 mt-1">&ldquo;{selectedLayer.prompt}&rdquo;</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Layers Panel */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">Layers ({layers.length})</h3>
            {layers.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => console.log('Clear canvas not implemented')}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Clear All
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {layers
              .slice()
              .sort((a, b) => b.nodeId - a.nodeId)
              .map((layer) => (
                <div
                  key={layer.id}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors',
                    selectedNodeIds.includes(layer.nodeId)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                  onClick={() => console.log('Select layer', layer.nodeId)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <ImageIcon className="w-3 h-3 text-gray-500" />
                      <span className="text-sm font-medium truncate">
                        {layer.type === 'generated' ? 'AI Generated' : 
                         layer.type === 'text' ? 'Text' : 'Image'}
                      </span>
                    </div>
                    {layer.prompt && (
                      <div className="text-xs text-gray-500 truncate mt-1">
                        &ldquo;{layer.prompt}&rdquo;
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLayerVisibilityToggle(layer.nodeId)
                      }}
                      className="w-6 h-6 p-0"
                    >
                      {layer.visible ? (
                        <Eye className="w-3 h-3" />
                      ) : (
                        <EyeOff className="w-3 h-3 opacity-50" />
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLayerLockToggle(layer.nodeId)
                      }}
                      className="w-6 h-6 p-0"
                    >
                      {layer.locked ? (
                        <Lock className="w-3 h-3" />
                      ) : (
                        <Unlock className="w-3 h-3 opacity-50" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        console.log('Duplicate layer not implemented')
                      }}
                      className="w-6 h-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteLayer(layer.nodeId)
                      }}
                      className="w-6 h-6 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}

            {layers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No layers yet</p>
                <p className="text-xs">Upload an image or generate with AI</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
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
                const img = document.createElement('img')
                img.onload = () => {
                  const maxSize = 400
                  const aspectRatio = img.width / img.height
                  const width = img.width > img.height ? maxSize : maxSize * aspectRatio
                  const height = img.height > img.width ? maxSize : maxSize / aspectRatio
                  
                  addLayer({
                    type: 'image',
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
    </div>
  )
}
