This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Corlena × Gemini - AI-Powered Collaborative Canvas

> **Hackathon Demo**: A Figma-like canvas experience powered by Gemini 2.5 Flash Image Generation

Built with **Corlena** (gesture-based canvas interactions) + **Gemini AI** (natural language image generation and editing).

## 🚀 Features

### Core Canvas
- **Drag & Drop**: Upload images directly to the canvas
- **Gesture Controls**: Drag, resize, and manipulate layers with Corlena's smooth interactions
- **Layer Management**: Full layer system with visibility, locking, and z-index control
- **Zoom & Pan**: Navigate large canvases with keyboard shortcuts
- **Export**: Download your canvas as high-quality PNG

### AI-Powered Editing
- **Text-to-Image**: Generate images from natural language prompts
- **Image Editing**: Select a layer and prompt to modify it ("make it blue", "add sunglasses")
- **Style Transfer**: Transform images with artistic styles
- **Smart Presets**: Quick actions for common editing tasks
- **Iterative Refinement**: Edit and re-edit in conversational turns

### Professional UX
- **Real-time Preview**: See changes as they happen
- **Undo/Redo**: Full history management
- **Keyboard Shortcuts**: Pro-level efficiency
- **Responsive Design**: Works on desktop and tablet

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Canvas**: Corlena (React bindings for gesture interactions)
- **AI**: Gemini 2.5 Flash Image Generation API
- **State**: Zustand for layer management
- **Styling**: Tailwind CSS + shadcn/ui
- **Icons**: Lucide React

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ 
- Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 2. Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp env.example .env.local
# Edit .env.local and add your Gemini API key
```

### 3. Development

```bash
# Start the development server
npm run dev

# Open http://localhost:3000
```

### 4. Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🎮 How to Use

### Getting Started
1. **Upload an image**: Drag & drop or click "Upload" in the side panel
2. **Generate with AI**: Type a prompt and click "Generate" to create new content
3. **Edit existing layers**: Select a layer, then use prompts to modify it
4. **Organize layers**: Use the layer panel to show/hide, lock, or delete layers
5. **Export your work**: Click "Export" to download as PNG

### Keyboard Shortcuts
- `⌘/Ctrl + 0`: Reset zoom and pan
- `⌘/Ctrl + =`: Zoom in
- `⌘/Ctrl + -`: Zoom out
- `Delete/Backspace`: Delete selected layer
- `Enter`: Submit prompt (when focused on input)

### Pro Tips
- **Descriptive prompts work best**: "A red sports car in a snowy mountain landscape" vs "car snow"
- **Use editing mode**: Select a layer first, then prompt to edit that specific element
- **Leverage presets**: Click "Quick Presets" for common operations
- **Layer organization**: Use the layer panel to manage complex compositions

## 🔧 API Configuration

### Environment Variables

```bash
# Required: Gemini API Key
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here

# Optional: For production deployment
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### API Endpoints

- `POST /api/gemini/generate` - Generate or edit images with Gemini
- `POST /api/upload` - Upload and process image files

## 🏗️ Architecture

### Component Structure
```
app/
├── page.tsx                 # Main application layout
├── api/
│   ├── gemini/generate/     # Gemini AI proxy endpoint
│   └── upload/              # File upload handler
components/
├── canvas-viewport.tsx      # Main canvas with Corlena integration
├── canvas-layer.tsx         # Individual draggable/resizable layers
├── prompt-panel.tsx         # AI controls and layer management
└── ui/                      # shadcn/ui components
lib/
├── store.ts                 # Zustand layer management
├── gemini.ts                # Gemini AI service
└── utils.ts                 # Canvas utilities
```

### Data Flow
1. User uploads image or enters prompt
2. `PromptPanel` calls API endpoints
3. `CanvasStore` manages layer state
4. `CanvasViewport` renders layers with Corlena
5. User interacts with layers via gesture controls

## 📈 Roadmap

### Phase 1: Hackathon Demo (Current)
- ✅ Basic canvas with layer management
- ✅ Gemini integration for generation/editing
- ✅ Upload and export functionality
- ✅ Professional UI/UX

### Phase 2: Collaboration
- 🔄 Real-time multi-user editing
- 🔄 Project sharing and permalinks
- 🔄 Version history and branching
- 🔄 Comments and annotations

### Phase 3: Advanced AI
- 🔄 Consistency IDs for character/object persistence
- 🔄 Advanced composition and fusion modes
- 🔄 Batch operations and workflows
- 🔄 Custom model fine-tuning

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Deploy to Vercel
npx vercel

# Set environment variables in Vercel dashboard
```

### Docker

```bash
# Build Docker image
docker build -t corlena-gemini .

# Run container
docker run -p 3000:3000 -e NEXT_PUBLIC_GEMINI_API_KEY=your_key corlena-gemini
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- **Corlena**: Gesture-based canvas interactions
- **Gemini**: Advanced AI image generation
- **Next.js**: React framework for production
- **Tailwind**: Utility-first CSS framework
- **shadcn/ui**: Beautiful UI components

---

**Built for Hackathons** • **Powered by AI** • **Designed for Creators**
