import { NextRequest, NextResponse } from 'next/server'
import { getGeminiService } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const { prompt, images, mode = 'generate' } = await request.json()
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }
    
    const gemini = getGeminiService()
    let imageData: string
    
    switch (mode) {
      case 'generate':
        imageData = await gemini.generateImage(prompt)
        break
        
      case 'edit':
        if (!images || images.length === 0) {
          return NextResponse.json(
            { error: 'Base image is required for editing mode' },
            { status: 400 }
          )
        }
        imageData = await gemini.editImage(images[0].data, prompt, images[0].mimeType)
        break
        
      case 'compose':
        if (!images || images.length === 0) {
          return NextResponse.json(
            { error: 'At least one image is required for composition mode' },
            { status: 400 }
          )
        }
        imageData = await gemini.composeImages(images, prompt)
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid mode. Use generate, edit, or compose' },
          { status: 400 }
        )
    }
    
    return NextResponse.json({
      success: true,
      base64: imageData,
      prompt,
      mode,
      timestamp: new Date().toISOString(),
    })
    
  } catch (error) {
    console.error('Gemini API error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false 
      },
      { status: 500 }
    )
  }
}
