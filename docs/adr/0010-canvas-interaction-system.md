# ADR-0010: Canvas Interaction System Architecture

## Status
Accepted

## Context
The Corlena canvas needed a robust interaction system to handle image selection, dragging, and resizing. The initial implementation had issues with:
- Offset dragging causing images to jump to cursor position
- Poor resize handle detection and grabbability
- Tight coupling between interaction logic and rendering components

## Decision
We implemented a dedicated `useCanvasInteractions` hook that centralizes all interaction logic:

### Key Design Decisions:
1. **Absolute Positioning Strategy**: Store original transform state at interaction start and calculate deltas from absolute mouse positions
2. **Tolerance-Based Handle Detection**: Use configurable tolerance zones around resize handles for better UX
3. **Priority-Based Interaction**: Corner handles take priority over edge handles when overlapping
4. **Separation of Concerns**: Interaction logic separate from rendering logic

### Implementation Details:
- `findResizeHandle()` with configurable tolerance (default 10px)
- Original transform snapshot during drag start
- Smooth transform updates using deltas from starting position
- Support for all 8 resize handles (4 corners + 4 edges)

## Consequences

### Positive:
- Smooth drag behavior from any position on image
- All 8 resize handles are functional and easily grabbable  
- Clean separation between interaction and rendering logic
- Extensible system for future interaction types

### Negative:
- Additional complexity in state management
- Performance considerations with frequent transform updates
- Learning curve for developers unfamiliar with the interaction patterns

## Implementation Notes
The system uses a combination of mouse position tracking, transform state management, and collision detection to provide intuitive canvas interactions similar to professional design tools like Figma.
