# Corlena AI Canvas — Professional Image Editing with Gemini + WASM

## Story

Professional, Figma‑level interfaces are notoriously hard to build on the web. Infinite canvas math, sub‑pixel zoom/pan across high‑DPR screens, eight precise resize handles, hit‑testing that never jitters, and 60fps interactions under real workloads—most tools compromise somewhere. I wanted the full experience in the browser without the compromises, so I built Corlena from the ground up: a React UI toolkit and a Rust/WASM engine that work together like a native editor. I designed the entire canvas system, authored the library, and open‑sourced it for this hackathon—then integrated Gemini so ideas can start with a prompt and end as editable layers.

## Project Description

Corlena is a professional, Figma‑inspired canvas editor with AI‑assisted image generation and a WebAssembly engine for high‑performance interactions. It’s both a product (Corlena AI Canvas) and a reusable open‑source toolkit (the `corlena` UI library + `@corlena/wasm` engine) intended to be the foundation for serious, web‑based design tools.

What this is going to be:
- A production‑quality canvas and layer system you can drop into apps.
- An AI‑aware editor that turns prompts into editable layers.
- A WASM‑accelerated engine for smooth transforms, hit‑testing, and image ops.
- A well‑documented, open‑source base teams can extend and ship.

## Competition Submission Details
<!--  -->
- Title: Corlena AI Canvas — Professional Image Editing with Gemini + WASM
- Tracks: Overall Track, Special Technology Prize — Fal
- Stack: Next.js 15, TypeScript, Tailwind, custom WASM engine

## Why It’s Different

- Infinite canvas with a professional feel: world‑space pan/zoom (0.1×–10×), all 8 resize handles, precise selection and drag with no cursor jump.
- AI that fits the workflow: Gemini 2.5 Flash generates images that land as real layers, not one‑off blobs.
- WASM‑first performance: frame updates, constraints, and image resizing run in WebAssembly; JS orchestrates, not grinds.
- Design system polish: clean visual hierarchy, responsive cursors, generous hit areas, and clear selection states.

## Core Features

- AI generation: Prompt → generate image → auto‑insert as a manipulatable layer with status/feedback and robust error handling.
- Layer management: Thumbnails, visibility, lock/unlock, export individual layers or the full canvas.
- Pro interactions: Smooth drag anywhere on the object; 8 resize handles with proper anchoring and priority; deterministic transforms.
- Infinite workspace: Grid, culling, and state persistence for large compositions.

## Architecture Overview

- UI layer (React/Next.js): Declarative components and hooks (`useCanvasViewport`, `useCanvasInteractions`) focus on rendering + orchestration.
- Engine layer (WASM): Scene graph updates, hit‑testing, constraints, and image operations handled in tight loops with predictable memory.
- Boundary: Batched calls (`upsert_nodes`, `apply_pointers`, `process_frame`) minimize JS↔WASM chatter and GC churn.

Example snippets

Canvas viewport zoom
```typescript
const handleWheel = useCallback((e: React.WheelEvent) => {
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const centerX = e.clientX - rect.left
  const centerY = e.clientY - rect.top
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  zoomBy(zoomFactor, centerX, centerY)
}, [zoomBy])
```

AI response processing
```typescript
const parts = candidates[0]?.content?.parts || []
for (const part of parts) {
  if (part.inlineData?.data) return part.inlineData.data // Base64 image
}
```

Interaction state wiring
```typescript
const interactions = useCanvasInteractions({
  onSelect: (id) => onSelectedLayerChange?.(id),
  onDrag: (id, pos) => updateLayerTransform(id, pos),
  onResize: (id, size) => updateLayerTransform(id, size)
})
```

## Performance: Why Corlena Feels Fast

- WASM‑first core: `process_frame(dt)` advances state in linear, cache‑friendly loops.
- Batched updates: `upsert_nodes(...)` and `apply_pointers(...)` collapse many small updates into one call.
- Zero‑copy paths: Typed arrays move pixel data with minimal conversion (`store_image`, `resize_image_mode`).
- Viewport math in‑engine: `set_view_params(scale, panX, panY, pixelRatio)` keeps transforms/culling precise across DPRs.
- Deterministic pipeline: Inputs → constraints → update → render avoids layout thrash and keeps 60fps stable.
- GPU‑friendly composition: DOM work stays lean; heavy math and hit‑testing happen off the main layout path.

## WASM Engine Details

- Input application layer: `apply_pointers` merges pointer deltas in O(k) per frame.
- Constraint solver: `set_constraints` enforces bounds/snap without JS round‑trips.
- Image processing hooks: `store_image`, `resize_image`, `resize_image_mode` provide fast downsampling and mode control.
- Reset/reuse: `init(capacity)` and `reset()` keep allocations predictable.
- View control: `set_view` / `set_view_params` deliver sub‑pixel zoom/pan accuracy.

## Design & Open Source

- I designed the full canvas system: viewport, pro‑grade drag/resize (all 8 handles), no‑jump dragging, and clear selections.
- I built the `corlena` library and the `@corlena/wasm` engine and open‑sourced both for the hackathon.
- Documentation includes ADRs, usage guides, and examples to accelerate adoption.

## ADRs (Linked)

- ADR‑0010 — Canvas Interaction System Architecture: https://github.com/justrach/corlena/blob/justrach/gemini-hackathon/docs/adr/0010-canvas-interaction-system.md
- ADR‑0011 — Figma‑Inspired UI Design System: https://github.com/justrach/corlena/blob/justrach/gemini-hackathon/docs/adr/0011-figma-inspired-ui-design.md
- ADR‑0012 — Gemini AI Integration Patterns: https://github.com/justrach/corlena/blob/justrach/gemini-hackathon/docs/adr/0012-gemini-ai-integration-patterns.md

If you prefer GitHub Issue links, share the corresponding Issue IDs and I’ll switch these to the Issues instead of ADR files.

## Demo Scenarios

1) AI Generation: Prompt → generate → auto‑added to canvas as a layer.  
2) Pro Editing: Select → drag anywhere → resize via any handle → export.  
3) Infinite Canvas: Pan/zoom for large scenes with stable performance.  
4) Layer Panel: Toggle visibility/locking → export single or combined.

## Roadmap

- Multi‑selection and group transforms
- Undo/Redo with history
- Real‑time collaboration
- Multiple AI providers
- Exports: SVG, PDF, vector flows

## Real‑World Impact

- Design prototyping: rapid ideation with AI‑generated assets
- Content creation: social + marketing graphics
- Education: interactive design learning environments
- Collaboration: foundation for multi‑user tools

## Competition Relevance

- Innovation: first‑class AI integrated with professional canvas tools
- Technical excellence: production‑ready code and WASM‑accelerated performance
- Market potential: open‑source base for pro‑grade web design apps

---

Built with ❤️ using Next.js, TypeScript, and Google Gemini AI.

---

## Submission Links (Copy-Friendly)

URL
https://corlena-gemini-hackathon.vercel.app

TITLE *
Live Demo — Corlena AI Canvas

DESCRIPTION (OPTIONAL)
Hosted demo showcasing Gemini integration, infinite canvas, and pro interactions.

URL
https://github.com/justrach/corlena/tree/justrach/gemini-hackathon

TITLE *
GitHub — Corlena Monorepo (Hackathon branch)

DESCRIPTION (OPTIONAL)
Full source for canvas UI, Gemini app, and WASM engine with docs.

URL
https://www.npmjs.com/package/corlena

TITLE *
NPM — corlena (Canvas UI Toolkit)

DESCRIPTION (OPTIONAL)
Reusable React/Next.js components and hooks powering the editor.

URL
https://github.com/justrach/corlena/tree/justrach/gemini-hackathon/packages/wasm

TITLE *
Source — @corlena/wasm (Engine)

DESCRIPTION (OPTIONAL)
WASM engine powering fast transforms, resizing, and frame updates.
