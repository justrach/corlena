import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini AI - in production, this should use environment variables
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ''

export class GeminiService {
  private ai: GoogleGenerativeAI
  
  constructor(apiKey: string = API_KEY) {
    if (!apiKey) {
      throw new Error('Gemini API key is required')
    }
    this.ai = new GoogleGenerativeAI(apiKey)
  }
  
  /**
   * Generate image from text prompt
   */
  async generateImage(prompt: string): Promise<string> {
    try {
      console.log('Generating image with prompt:', prompt)
      const model = this.ai.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' })
      
      const response = await model.generateContent(prompt)
      
      // Comprehensive logging for debugging
      console.log('Full Gemini response:', JSON.stringify(response, null, 2))
      console.log('Response keys:', Object.keys(response || {}))
      console.log('Response.response keys:', Object.keys(response?.response || {}))
      
      // Check if response has the expected structure
      if (!response || !response.response) {
        throw new Error('Invalid response structure from Gemini')
      }
      
      // Find the image part in the response
      const candidates = response.response.candidates || []
      console.log('Number of candidates:', candidates.length)
      
      if (candidates.length === 0) {
        throw new Error('No candidates in response')
      }
      
      const firstCandidate = candidates[0]
      console.log('First candidate structure:', JSON.stringify(firstCandidate, null, 2))
      
      const parts = firstCandidate?.content?.parts || []
      console.log('Number of parts:', parts.length)
      
      for (const part of parts) {
        console.log('Part structure:', JSON.stringify(part, null, 2))
        if (part.inlineData?.data) {
          console.log('Found image data, length:', part.inlineData.data.length)
          return part.inlineData.data // Return base64 image data
        }
      }
      
      console.log('❌ No image found. Full response structure:')
    console.log('Response:', response)
    console.log('Response.response:', response?.response)
    console.log('Candidates:', candidates)
    console.log('Parts from all candidates:', candidates.map(c => c?.content?.parts))
    
    throw new Error('No image generated in response - check logs for response structure')
    } catch (error) {
      console.error('Gemini image generation error:', error)
      throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Edit existing image with text prompt
   */
  async editImage(imageBase64: string, prompt: string, mimeType: string = 'image/png'): Promise<string> {
    try {
      const model = this.ai.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' })
      
      const requestParts = [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ]
      
      const response = await model.generateContent(requestParts)
      
      // Find the image part in the response
      const candidates = response.response.candidates || []
      if (candidates.length === 0) {
        throw new Error('No candidates in response')
      }
      
      const parts = candidates[0]?.content?.parts || []
      for (const part of parts) {
        if (part.inlineData?.data) {
          return part.inlineData.data
        }
      }
      
      console.log('Gemini edit - Full response:', JSON.stringify(response, null, 2))
      throw new Error('No image generated in edit response')
    } catch (error) {
      console.error('Gemini image editing error:', error)
      throw new Error(`Failed to edit image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Compose multiple images with text prompt
   */
  async composeImages(images: Array<{ data: string; mimeType: string }>, prompt: string): Promise<string> {
    try {
      const model = this.ai.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' })
      
      const requestParts = [
        { text: prompt },
        ...images.map(img => ({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data,
          },
        })),
      ]
      
      const response = await model.generateContent(requestParts)
      
      // Find the image part in the response  
      const candidates = response.response.candidates || []
      if (candidates.length === 0) {
        throw new Error('No candidates in response')
      }
      
      const parts = candidates[0]?.content?.parts || []
      for (const part of parts) {
        if (part.inlineData?.data) {
          return part.inlineData.data
        }
      }
      
      console.log('Gemini compose - Full response:', JSON.stringify(response, null, 2))
      throw new Error('No image generated in compose response')
    } catch (error) {
      console.error('Gemini image composition error:', error)
      throw new Error(`Failed to compose images: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Singleton instance
let geminiService: GeminiService | null = null

export function getGeminiService(): GeminiService {
  if (!geminiService) {
    geminiService = new GeminiService()
  }
  return geminiService
}

// Prompt templates for common operations
export const PROMPT_TEMPLATES = {
  STYLE_TRANSFER: (style: string) => 
    `Transform this image into the artistic style of ${style}. Preserve the original composition but render it with the characteristic elements of ${style}.`,
  
  BACKGROUND_CHANGE: (background: string) => 
    `Change the background of this image to ${background}. Keep the main subject exactly the same, only replace the background.`,
  
  OBJECT_REMOVAL: (object: string) => 
    `Remove the ${object} from this image. Fill in the space naturally so it looks like the ${object} was never there.`,
  
  OBJECT_ADDITION: (object: string, location?: string) => 
    `Add a ${object} to this image${location ? ` ${location}` : ''}. Make it look natural and match the lighting and style of the original image.`,
  
  COLOR_CHANGE: (target: string, newColor: string) => 
    `Change the color of the ${target} in this image to ${newColor}. Keep everything else exactly the same.`,
  
  MOOD_CHANGE: (mood: string) => 
    `Transform the mood of this image to be ${mood}. Adjust the lighting, colors, and atmosphere while keeping the main subjects unchanged.`,
  
  FESTIVE_THEME: (festival: string) => 
    `Transform this image to have a ${festival} theme. Add appropriate decorations, lighting, and festive elements while keeping the main subject recognizable.`,
  
  PRODUCT_MOCKUP: (environment: string) => 
    `Place this product in a ${environment}. Create a realistic product photography setup with appropriate lighting and background.`,
}

// Quick preset configurations
export const QUICK_PRESETS = [
  { label: 'Change Style', template: PROMPT_TEMPLATES.STYLE_TRANSFER, placeholder: 'e.g., impressionist painting, anime, watercolor' },
  { label: 'Add Background', template: PROMPT_TEMPLATES.BACKGROUND_CHANGE, placeholder: 'e.g., snowy mountains, beach sunset, cozy living room' },
  { label: 'Remove Object', template: PROMPT_TEMPLATES.OBJECT_REMOVAL, placeholder: 'e.g., person, car, background clutter' },
  { label: 'Add Object', template: PROMPT_TEMPLATES.OBJECT_ADDITION, placeholder: 'e.g., sunglasses, hat, decorative elements' },
  { label: 'Change Mood', template: PROMPT_TEMPLATES.MOOD_CHANGE, placeholder: 'e.g., dramatic, peaceful, energetic, vintage' },
]
