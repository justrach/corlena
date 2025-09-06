'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useCorlenaCanvas } from '@/lib/corlena-state'
import { Trash2, Eye, EyeOff, Lock, Unlock, Upload, ImageIcon, Sparkles } from 'lucide-react'

interface SimplePromptPanelProps {
  selectedLayerId?: number | null
  onSelectedLayerChange?: (layerId: number | null) => void
}

export function SimplePromptPanel({ selectedLayerId, onSelectedLayerChange }: SimplePromptPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addLayer, getAllLayers, updateLayer, toggleNodeSelection } = useCorlenaCanvas()
  
  const layers = getAllLayers()
  const selectedLayer = selectedLayerId ? layers.find(l => l.nodeId === selectedLayerId) : null

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    
    setIsGenerating(true)
    try {
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          mode: selectedLayer ? 'edit' : 'generate',
          images: selectedLayer ? [{ data: selectedLayer.data, mimeType: 'image/png' }] : undefined,
        }),
      })
      
      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`)
      }
      
      const { base64 } = await response.json()
      console.log('Generated image received, base64 length:', base64?.length)
      
      // Add the generated image as a new layer
      addLayer({
        type: 'image',
        data: base64,
        prompt,
        visible: true,
        locked: false,
        opacity: 1,
      })
      
      setPrompt('')
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate image')
    } finally {
      setIsGenerating(false)
    }
  }
  
  const handleFileUpload = async (files: FileList) => {
    if (files.length === 0) return
    
    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`)
        }
        
        const { data: base64 } = await response.json()
        console.log('Upload response received, base64 length:', base64?.length)
        
        addLayer({
          type: 'image',
          data: base64,
          prompt: `Uploaded: ${file.name}`,
          visible: true,
          locked: false,
          opacity: 1,
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }
  
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }
  
  const handleExportCanvas = useCallback(async () => {
    // Create a temporary canvas to export all visible layers
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = 800
    exportCanvas.height = 600
    const ctx = exportCanvas.getContext('2d')!
    
    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 800, 600)
    
    // Draw all image layers
    for (const layer of layers) {
      if (layer.type === 'image' && layer.visible && layer.data) {
        try {
          // Create image from base64 data
          const img = new Image()
          await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            const dataStr = layer.data!
            const base64Data = dataStr.startsWith('data:') ? dataStr : `data:image/png;base64,${dataStr}`
            img.src = base64Data
          })
          
          // Calculate position and size (same logic as canvas renderer)
          const baseX = 50 + (layer.nodeId * 120) % 400
          const baseY = 50 + Math.floor((layer.nodeId * 120) / 400) * 180
          
          // Maintain aspect ratio
          const maxW = 300
          const maxH = 200
          const imgAspect = img.width / img.height
          
          let w, h
          if (imgAspect > maxW / maxH) {
            w = maxW
            h = maxW / imgAspect
          } else {
            h = maxH
            w = maxH * imgAspect
          }
          
          // Draw with opacity
          ctx.save()
          ctx.globalAlpha = layer.opacity
          ctx.drawImage(img, baseX, baseY, w, h)
          ctx.restore()
        } catch (error) {
          console.error(`Failed to draw layer ${layer.nodeId}:`, error)
        }
      }
    }
    
    // Create download link
    const link = document.createElement('a')
    link.download = 'canvas-export.png'
    link.href = exportCanvas.toDataURL()
    link.click()
  }, [layers])

  const handleExportSelected = useCallback(async () => {
    if (!selectedLayerId) return
    
    const selectedLayer = layers.find(layer => layer.nodeId === selectedLayerId)
    if (!selectedLayer || selectedLayer.type !== 'image') return
    
    // Create a temporary canvas to export just the selected image
    const tempCanvas = document.createElement('canvas')
    const ctx = tempCanvas.getContext('2d')
    if (!ctx) return
    
    try {
      // Create image from base64 data
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        const dataStr = selectedLayer.data!
        const base64Data = dataStr.startsWith('data:') ? dataStr : `data:image/png;base64,${dataStr}`
        img.src = base64Data
      })
      
      // Set canvas size to image size
      tempCanvas.width = img.width
      tempCanvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      // Create download link
      const link = document.createElement('a')
      link.download = `layer-${selectedLayerId}.png`
      link.href = tempCanvas.toDataURL()
      link.click()
    } catch (error) {
      console.error('Failed to export selected image:', error)
      alert('Failed to export selected image')
    }
  }, [selectedLayerId, layers])

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Corlena AI</h2>
        </div>
        <p className="text-sm text-gray-600">Create and edit images with AI</p>
      </div>

      {/* Prompt Section */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Generate</h3>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to create..."
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 transition-colors"
          rows={3}
        />
        
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors text-sm"
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors border border-gray-200"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Layers Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Layers ({layers.length})</h3>
          
          {layers.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ImageIcon className="mx-auto w-8 h-8 mb-3" />
              <p className="text-sm">No images yet</p>
              <p className="text-xs mt-1 text-gray-500">Generate or upload images to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {layers.map((layer) => (
                <div
                  key={layer.nodeId}
                  className={`group relative p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedLayerId === layer.nodeId
                      ? 'bg-blue-50 border-blue-200 shadow-sm'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                  }`}
                  onClick={() => onSelectedLayerChange?.(layer.nodeId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden border border-gray-200">
                        {layer.type === 'image' && layer.data ? (
                          <img 
                            src={layer.data.startsWith('data:') ? layer.data : `data:image/png;base64,${layer.data}`}
                            alt={`Layer ${layer.nodeId}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">Layer {layer.nodeId}</p>
                          {selectedLayerId === layer.nodeId && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded font-medium">
                              Selected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">Opacity: {Math.round(layer.opacity * 100)}%</span>
                          {layer.locked && <Lock className="w-3 h-3 text-gray-500" />}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateLayer(layer.nodeId, { visible: !layer.visible })
                        }}
                      >
                        {layer.visible ? <Eye className="w-4 h-4 text-gray-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateLayer(layer.nodeId, { locked: !layer.locked })
                        }}
                      >
                        {layer.locked ? <Lock className="w-4 h-4 text-gray-600" /> : <Unlock className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    
      {/* Export Section */}
      {layers.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            <button 
              onClick={handleExportCanvas}
              className="flex-1 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-md transition-colors text-sm shadow-sm"
            >
              Export Canvas
            </button>
            <button 
              onClick={handleExportSelected}
              disabled={!selectedLayerId}
              className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors text-sm"
            >
              Export Selected
            </button>
          </div>
        </div>
      )}
    
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          if (e.target.files) {
            handleFileUpload(e.target.files)
          }
        }}
      />
    </div>
  )
}
