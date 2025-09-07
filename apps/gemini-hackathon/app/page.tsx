'use client'

import { useState, useEffect } from 'react'
import { SceneProvider } from 'corlena/react'
import { CorlenaCanvasViewport } from '@/components/corlena-canvas-viewport'
import { CorlenaCanvasProvider } from '@/components/corlena-canvas-provider'
import { SimplePromptPanel } from '@/components/simple-prompt-panel'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function Home() {
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null)
  
  useEffect(() => {
    // Check if Gemini API key is available
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      console.warn('Gemini API key not found. Please add NEXT_PUBLIC_GEMINI_API_KEY to your environment variables.')
    }
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C×G</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Corlena × Gemini
            </h1>
            <p className="text-sm text-gray-600">
              AI-Powered Collaborative Canvas
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Hackathon Demo
          </div>
          <div className="w-2 h-2 bg-green-400 rounded-full" title="Ready" />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex gap-4">
        <SceneProvider capacity={256}>
          <CorlenaCanvasProvider>
            {/* Canvas Area */}
            <div className="flex-1 relative">
              <CorlenaCanvasViewport 
                className="w-full h-full" 
                selectedLayerId={selectedLayerId}
                onSelectedLayerChange={setSelectedLayerId}
              />
            </div>
            
            {/* Side Panel */}
            <div className="w-80 border-l border-gray-200">
              <SimplePromptPanel selectedLayerId={selectedLayerId} />
            </div>
          </CorlenaCanvasProvider>
        </SceneProvider>
      </div>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>Built with Corlena + Gemini 2.5 Flash</span>
            <span>•</span>
            <span>Next.js 15 + Tailwind CSS</span>
          </div>
          <div className="flex items-center gap-4">
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⌘/Ctrl+0</kbd>
            <span className="text-xs">Reset zoom</span>
            <span>•</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Del</kbd>
            <span className="text-xs">Delete layer</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
