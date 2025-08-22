# ADR 0004: Text Overlay (Instagram-style) and Canvas Export to Blob

- Status: Accepted
- Date: 2025-08-23
- Authors: Corlena Team

## Context
Users want to add styled text overlays to images/canvas like Instagram stories: add text, edit inline, drag to position, scale/rotate, and export the final composition as an image. Current demos (`/`, `/canvas`, `/wasm`, `/igcanvas`) focus on draggable squares and image overlay transforms, with recent work stabilizing pinch/resample anchoring and adding unit-testable geometry utilities.

## Goals
- Add text overlays with a simple UX: tap/click to add text, type/edit, drag to move.
- Basic styling: font family, size, weight, color, shadow/background pill, alignment.
- Transform: pinch/drag to scale/rotate; keyboard nudge; snap to centerlines.
- Layering: text above image overlay, multiple texts supported, reorder (MVP: add-on-top only).
- Export: provide `toBlob()` API for the composed canvas respecting DPR and quality.
- Keep MVP in JS/Canvas; consider WASM participation later (layout/metrics at scale).

## Non-Goals (MVP)
- Rich text (mixed styles within a single text node).
- Text wrap around arbitrary shapes; curved text; stickers; animations.
- Server-side rendering/export.

## Options Considered
1. HTML/Svelte text elements over canvas (DOM overlay)
   - Pros: native input/editing, accessibility, easy styling.
   - Cons: mismatch when exporting canvas (need DOM-to-canvas rasterization); libs like html2canvas introduce complexity.
2. Pure Canvas text rendering (2D context)
   - Pros: single source of truth, consistent export; good perf; simple code path.
   - Cons: editing requires custom input handling; font loading/metrics quirks; accessibility work needed.
3. WebGL text (SDF glyphs)
   - Pros: highest perf/quality for many texts; effects.
   - Cons: heavy; overkill for MVP.

## Decision
- Use option 2 (Canvas 2D) for MVP.
- Represent each text overlay as a model: `{ id, text, x, y, angle, scale, fontFamily, fontSize, fontWeight, color, align, shadow?, bg? }`.
- Render during the main draw loop alongside the image overlay.
- Inline text editing via a floating HTML input positioned over the text's screen-space bounds during edit mode; commit to model on blur/enter.
- Transforms use existing gesture plumbing; reuse rounding/anchoring patterns from ADR-0001/0003 to avoid jitter.
- Export via `HTMLCanvasElement.toBlob({ type: 'image/png' | 'image/jpeg', quality? })` with devicePixelRatio handling.

## Implications
- Requires a text hit-test and bounding box computation for selection/drag.
- Font loading must be awaited before measuring/painting text.
- DPR-aware layout to prevent post-export shifts.
- Accessibility: provide labels, keyboard editing/nudge as follow-up tasks.

## Risks
- Cross-platform font differences; metrics and wrapping vary.
- Input caret/selection UX complexity.
- Performance if we support many texts with effects.

## Acceptance Criteria
- Add, edit, and drag a text overlay on `/ig` demo.
- Change font family/size/weight/color.
- Pinch/gesture to scale and rotate a text node.
- Export the full canvas to a Blob and download/share it; visual parity with on-screen.
- Unit tests for text layout math (bounds under transform), and export DPR handling.

## Migration / Rollout Plan
- Feature-flag the text overlay layer (off by default in demos).
- Start with a single text node MVP; then support multiple nodes.
- Add telemetry/logging hooks (manual, for now) to catch UX issues.

## References
- ADR-0001: Drag/Grab, Offset, Scale
- ADR-0002: Image Overlay Resize (WASM)
- ADR-0003: Overlay Transforms (Bilinear)
