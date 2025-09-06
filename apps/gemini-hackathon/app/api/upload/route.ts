import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }
    
    // Convert to base64 (server-side)
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    
    return NextResponse.json({
      success: true,
      data: base64Data,
      mimeType: file.type,
      filename: file.name,
      size: file.size,
      timestamp: new Date().toISOString(),
    })
    
  } catch (error) {
    console.error('Upload error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Upload failed',
        success: false 
      },
      { status: 500 }
    )
  }
}
