# ADR 0005 – IG Composer Page UX (Text Overlay, Live Edit, Scaling)

- Status: Accepted
- Date: 2025-08-23
- Authors: Corlena Team

## Context
We introduced an Instagram-style vertical canvas page at `/ig` to compose images and text overlays, and export the result as an image. The MVP initially supported adding text, basic editing, dragging, and export. We refined the UX to address editing glitches, add live preview while typing, and support intuitive scaling on both touch and desktop.

## Goals
- Smooth IG-like composition on a 9:16 canvas:
  - Upload one or more images and position them.
  - Add multiple text overlays; edit inline via a floating input.
  - Live canvas preview while typing.
  - Scale images and text via touch pinch or desktop trackpad gestures.
  - Export to PNG with DPR-aware rendering.
- Keep the implementation simple (Canvas 2D + DOM input overlay) and testable.

## Decision
Implement the IG Composer page at `apps/my-app/src/routes/ig/+page.svelte` with:
- Canvas render loop that draws images and text every frame.
- Text overlay model stored in the page state (Svelte), not WASM, for MVP simplicity and export fidelity.
- Floating input for inline editing that tracks the text node position and font metrics.
- Live preview: while editing, the canvas renders `editingValue` so the user sees changes immediately.
- Interactions:
  - Drag text and images with single-pointer drag.
  - Pinch-to-zoom (two-finger) to scale text or the image under the pinch center; anchor at pinch centroid.
  - Desktop scaling via Ctrl/Meta + wheel over the target; anchor at cursor.
  - Robust pointer handling with pointer capture plus `pointercancel`/`pointerleave` resets.
- Export via `canvas.toBlob()` to PNG.
- DX toolbar: A-/A+ font size buttons and a color picker acting on the selected/editing text node.

## Why this works
- Canvas-only rendering ensures export parity and avoids CSS/DOM mismatch between edit overlay and final output.
- Live preview improves confidence and reduces commit/undo churn.
- Using pointer events with capture simplifies drag state and cross-device behavior.
- Pinch + wheel scaling mirror common native gestures on mobile and trackpads.

## Implementation Details
- File: `apps/my-app/src/routes/ig/+page.svelte`
  - State: arrays `imgs`, `texts`, `editingId`, `editingValue`, drag/pinch tracking.
  - Editing:
    - `startEdit()` sets `editingId`, initializes `editingValue`, and focuses/selects once.
    - `positionInputOverNode()` measures with current `editingValue` for accurate input sizing/positioning.
    - Document-level `pointerdown` capture commits and hides the input when clicking outside.
  - Rendering:
    - While editing, `compose()` draws `editingValue` instead of the stale saved text.
    - Selection bbox reflects the currently displayed text and font metrics.
  - Gestures:
    - Two-finger pinch scales target under pinch center (text preferred over images).
    - Ctrl/Meta + wheel scales target under cursor on desktop.
  - DX Toolbar:
    - A-/A+ adjust font size; color input sets text color for the selected/editing node.
  - Export: `canvas.toBlob()` with DPR-aware transform ensures crisp output.

## Alternatives Considered
- DOM text elements over the canvas: easier for editing, but complicates export parity and layering.
- Pushing text overlay state into WASM: potentially useful later for unified transforms and performance, but unnecessary for MVP and increases complexity.
- WebGL/WebGPU: overkill for current scope and adds setup burden.

## Risks
- Cross-browser differences in pointer events and wheel+gesture synthesis (especially macOS/iOS Safari).
- Font metrics (ascent/descent) vary across platforms; bbox is approximate.
- Future multiline and rich text features will need more complex measurement/wrapping logic.

## Acceptance Criteria
- Add text, edit inline with live preview, and drag to reposition on `/ig`.
- Scale text and images via two-finger pinch on touch and Ctrl/Meta + wheel on desktop.
- Export to PNG with visual parity.
- Basic styling adjustments available via toolbar (font size, color).

## Follow-ups / Future Work
- Text: multiline, alignment controls, font family/weight selectors, shadows/background pill.
- Transform: rotate and handle-based transforms (per ADR 0003 Phase 2).
- Z-order management for multiple texts/images.
- Optional: move text overlay model to WASM for performance once features stabilize.
