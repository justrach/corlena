# Corlena Canvas: Advanced Image Editing with AI Integration

## Project Overview

Corlena Canvas is a sophisticated web-based image editing application that combines the power of Google's Gemini AI for image generation with an intuitive, Figma-inspired canvas interface. Built on Next.js 15 with TypeScript, it provides professional-grade image manipulation tools in a modern web application.

## Key Features Implemented

### 🎨 Advanced Canvas Interaction System

We developed a comprehensive interaction system that rivals professional design tools:

**Drag & Drop Functionality:**
- Smooth dragging from any position on images (no more cursor jumping)
- Absolute positioning system with delta calculations
- Original transform state preservation during interactions

**Resize Handle System:**
- All 8 resize handles fully functional (4 corners + 4 edges)
- Tolerance-based detection (10px default) for improved grabbability
- Priority system: corners take precedence over edges when overlapping
- Proper anchoring based on which handle is used

**Selection Management:**
- Visual selection indicators with Figma-style purple accent borders
- White resize handles with purple borders for clear visibility
- Selection state synchronized between canvas and layer panel

### 🌍 Infinite Canvas with Viewport System

Implemented a professional viewport system enabling unlimited workspace:

**Pan & Zoom:**
- Infinite panning with mouse drag on empty areas
- Mouse wheel zoom (0.1x to 10x range) with proper center-point scaling
- Smart cursor states: `grab` → `grabbing` for intuitive feedback

**Performance Optimizations:**
- Grid rendering only draws visible portions (viewport culling)
- Zoom-aware line widths for consistent visual appearance
- Efficient coordinate transformation between screen and world space

**World Coordinate System:**
- All interactions work in world coordinates
- Seamless integration between viewport and object manipulation
- Proper hit detection at any zoom level

### 🤖 Gemini AI Integration

Robust integration with Google's Gemini 2.5 Flash model for image generation:

**Response Handling:**
- Comprehensive parsing of complex API response structures
- Flexible base64 data extraction from nested response parts
- Extensive error handling and user-friendly messaging
- Debug-friendly logging for response structure analysis

**Canvas Integration:**
- Generated images automatically added as canvas layers
- Proper image format handling (base64 and data URLs)
- Asynchronous workflow with loading states

### 🎯 Professional UI Design

Redesigned the interface following modern design tool principles:

**Clean Aesthetic:**
- White background with subtle gray accents
- Removed flashy gradients in favor of purposeful design
- Consistent spacing and typography hierarchy
- Professional blue accent colors

**Layer Management:**
- Compact layer panel with thumbnail previews
- Hover-revealed action buttons (visibility, lock/unlock)
- Clear selection indicators
- Export functionality for individual layers and full canvas

**Interaction Feedback:**
- Proper disabled states and loading indicators
- Smooth transitions and hover effects
- Consistent iconography using Lucide React

## Technical Architecture

### Hook-Based State Management

**`useCanvasInteractions`:**
- Centralized interaction logic separate from rendering
- State management for drag, resize, and selection
- Configurable tolerance and behavior settings

**`useCanvasViewport`:**
- Viewport state management (position, zoom)
- Coordinate transformation utilities
- Mouse event handling for pan/zoom operations

**`useCorlenaCanvas`:**
- Core canvas state management
- Layer operations (add, update, delete)
- Integration with WASM backend for performance

### Component Architecture

**Separation of Concerns:**
- `CanvasRenderer`: Pure rendering component with viewport integration
- `SimplePromptPanel`: AI generation and layer management UI
- `SelectionOverlay`: Visual feedback for selections (future extension point)

**Performance Considerations:**
- RequestAnimationFrame-based rendering loop
- Efficient image loading and caching
- Viewport culling for large canvases

## Development Insights

### Key Design Decisions

1. **Absolute Positioning Strategy**: Storing original transform state during interactions prevents cumulative errors and jumping behavior.

2. **World Coordinate System**: All interactions work in world space, making viewport transformations transparent to interaction logic.

3. **Tolerance-Based Detection**: Generous hit areas (10px tolerance) improve usability without compromising precision.

4. **Clean UI Philosophy**: Prioritizing functionality over visual flair creates a more professional, tool-focused experience.

### Challenges Overcome

**Interaction System Issues:**
- Fixed offset dragging that caused images to jump to cursor position
- Improved resize handle detection from poor grabbability to excellent UX
- Resolved coordinate system conflicts between viewport and interactions

**UI/UX Problems:**
- Replaced dark theme with flashy gradients with clean, professional design
- Improved visual hierarchy and consistency
- Better feedback systems for user actions

**API Integration:**
- Complex Gemini response structure parsing
- Robust error handling for various failure modes
- Flexible image format support

## Performance Metrics

### Rendering Optimizations
- Grid rendering scales from O(canvas_size) to O(viewport_size)
- Image caching reduces redundant loading
- Efficient transform calculations minimize computation overhead

### User Experience Improvements
- Resize handle detection improved from ~2px to 10px effective area
- Drag behavior eliminated cursor jumping entirely
- Zoom performance maintains 60fps on modern browsers

## Future Extension Points

### Canvas Features
- Multi-selection support
- Layer groups and organization
- Keyboard shortcuts and hotkeys
- Undo/redo system integration

### AI Integration
- Real-time collaborative editing
- More AI model support (DALL-E, Midjourney API)
- Batch processing and automation tools

### Export & Sharing
- Multiple export formats (SVG, PDF, WebP)
- Cloud storage integration
- Collaborative sharing features

## Architecture Diagrams

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Viewport      │────│  Canvas          │────│  Interaction    │
│   System        │    │  Renderer        │    │  System         │
│                 │    │                  │    │                 │
│ • Pan/Zoom      │    │ • World Coords   │    │ • Drag/Resize   │
│ • Coord Transform│    │ • Layer Drawing  │    │ • Selection     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │   Corlena        │
                    │   State          │
                    │                  │
                    │ • Layer Mgmt     │
                    │ • WASM Backend   │
                    └──────────────────┘
```

## Technology Stack

**Frontend:**
- Next.js 15 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Lucide React for icons

**AI Integration:**
- Google Gemini 2.5 Flash API
- Custom service layer for API abstraction

**State Management:**
- React hooks for component state
- Custom hooks for canvas operations
- WASM integration for performance-critical operations

## Code Quality & Documentation

### Architecture Decision Records (ADRs)
- ADR-0010: Canvas Interaction System Architecture
- ADR-0011: Figma-Inspired UI Design System  
- ADR-0012: Gemini AI Integration Patterns

### Testing Strategy
- Component-level testing for UI interactions
- Integration testing for AI API responses
- Performance testing for canvas operations

### Code Organization
- Clear separation between presentation and business logic
- Reusable hooks for complex state management
- Type-safe interfaces throughout the application

## Conclusion

This project successfully demonstrates advanced web canvas manipulation techniques combined with modern AI integration. The resulting application provides a professional-grade image editing experience that can serve as a foundation for more complex design tools.

The modular architecture, comprehensive interaction system, and clean UI design create a solid base for future enhancements while maintaining high performance and user experience standards.

---

*Built with ❤️ using Next.js, TypeScript, and Google Gemini AI*
