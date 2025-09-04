# Corlena Roadmap

## 🎨 Drawing System - COMPLETED ✅
- [x] WASM drawing functions integration
- [x] React DrawingCanvas component
- [x] Svelte DrawingCanvas component
- [x] Pressure-sensitive input support
- [x] Real-time path rendering
- [x] Integration with IG Composer pages
- [x] Continuous stroke drawing (fixed closure issues)

## 📱 Canvas UI Toolkit - COMPLETED ✅
- [x] SceneProvider with WASM physics engine
- [x] DomLayer and DomNode components
- [x] Multi-touch gesture support (pinch, drag, rotate)
- [x] Text editing with live preview
- [x] Image upload and manipulation
- [x] Particle effects system
- [x] Export to PNG functionality

## 🗄️ State Persistence System - PLANNED 🔮
**High Priority** - Comprehensive save/load system for canvas compositions

### Database Architecture
- **PostgreSQL backend** with JSONB storage for compositions
- **User management** (authentication, profiles, workspaces)
- **Composition sharing** and collaboration permissions
- **Version history** and undo/redo across sessions

### Data Structure
```typescript
interface CanvasComposition {
  version: string;
  canvas: { width: number; height: number; background: string };
  drawPaths: DrawPath[];
  textLayers: TextNode[];
  imageLayers: { id: number; url: string; x: number; y: number; w: number; h: number }[];
  settings: { particlesEnabled: boolean; [key: string]: any };
}
```

### Features
- **Cross-device synchronization** - Work on phone, continue on desktop
- **Real-time collaboration** - Multiple users editing simultaneously
- **Template system** - Save and share popular design templates
- **Portfolio galleries** - Showcase user compositions
- **Export integrations** - Direct sharing to social media platforms

### Implementation Steps
1. Set up PostgreSQL database with composition schema
2. Create REST API endpoints for CRUD operations
3. Add user authentication system (email/OAuth)
4. Build save/load UI components in React and Svelte
5. Integrate image storage (S3/CDN) for uploaded assets
6. Implement real-time collaboration with WebSockets
7. Add template marketplace and sharing features

### Technical Considerations
- **Performance** - Efficient JSONB queries and indexing
- **Scalability** - Horizontal scaling for user base growth
- **Security** - Proper access controls and data validation
- **Backup** - Automated composition backups and recovery
- **Analytics** - Usage tracking for feature optimization

## 🚀 Performance Optimizations - FUTURE
- [ ] WebGL rendering backend option
- [ ] WASM memory pool optimization
- [ ] Lazy loading for large compositions
- [ ] Background sync for offline editing
- [ ] Progressive image loading

## 🎯 User Experience Enhancements - FUTURE  
- [ ] Keyboard shortcuts and hotkeys
- [ ] Advanced brush engine with textures
- [ ] Layer management system
- [ ] Animation timeline support
- [ ] Voice commands integration
- [ ] AR/VR canvas editing modes

## 🔧 Developer Experience - FUTURE
- [ ] Comprehensive API documentation
- [ ] Component playground and examples
- [ ] TypeScript definitions completion
- [ ] Testing suite expansion
- [ ] CI/CD pipeline optimization
