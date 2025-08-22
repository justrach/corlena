# ADR 0001: Fix drag "hop" via grab offset, skip snapping during drag, and scale conversion

- Status: Accepted
- Date: 2025-08-22

## Context

Users observed that clicking a draggable square caused it to "hop" to a different position before dragging. Root causes:

- The engine set node position directly to the pointer coordinates on press without preserving the pointer-to-node offset (grab offset). This snaps the node’s top-left to the pointer on press.
- Grid snapping applied on every frame, including while dragging, created additional jumps when the pointer position was between grid cells.
- In the WASM path, pointer coordinates were in screen space while engine state is in world space; without converting by the current view scale, zoom introduced an additional mismatch.

## Decision

- Introduce per-node drag state in the engine (grab offset and grabbing flag) and apply pointer input as `pointer + grab_offset` while the pointer is down.
- Skip grid snapping while a node is actively grabbed; resume snapping after release.
- Convert pointer coordinates by the current view scale (`set_view(scale)`) in the WASM engine so pointer input matches world space under zoom.
- Mirror the same grab-offset behavior in the JS fallback demo to keep parity when WASM is unavailable.

## Why this works

- Preserving the initial `grab_dx/dy` prevents any discontinuity at the moment of press; the node remains under the grabbed point.
- Deferring grid snapping until after release removes mid-drag quantization jumps while preserving the feature when not interacting.
- Scale conversion aligns coordinate spaces, eliminating jumps under visual zoom.

## Implementation

- File: `packages/wasm/src/lib.rs`
  - `struct Node` now includes `grabbing: bool`, `grab_dx: f32`, `grab_dy: f32`.
  - `apply_pointers()`:
    - On press-start, capture `grab_dx = node.x - pointer.x`, `grab_dy = node.y - pointer.y`.
    - While held, set `node.x = pointer.x + grab_dx`, `node.y = pointer.y + grab_dy`; zero velocity.
    - Convert incoming pointer coords by `scale` from `set_view(scale)`.
  - `step()`:
    - Skip grid snapping if `n.grabbing` is true; always clamp to bounds.
  - `set_constraints()`:
    - Fixed index type mismatch (`Float32Array::get_index` requires `u32`).

- File: `apps/my-app/src/lib/index.ts`
  - DOM demo (`startWasmDemo`):
    - Recompute container rect on pointerdown.
    - Capture `grabDX/grabDY` and apply `pointer + offset` while dragging in JS fallback.
  - Canvas demo (`startCanvasDemo`):
    - Capture `cGrabDX/cGrabDY` on pointerdown; apply in JS fallback while dragging.

- Deployment:
  - Rebuilt WASM (`npm run -w @corlena/wasm build`) and copied `packages/wasm/pkg/*` to `apps/my-app/static/wasm/` for the dynamic loader to resolve `/wasm/corlena_wasm.js`.

## Consequences

- Pros:
  - Stable press-to-drag with no jump.
  - Behavior consistent across JS fallback and WASM engine.
  - Correct under view scaling/zoom.
- Cons:
  - Slightly more per-node state in the engine.
  - Grid snapping occurs after release rather than continuously during drag (intentional for UX).

## Alternatives considered

- Keep snapping during drag: rejected due to poor UX (visible "stickiness").
- Apply grab offset only in JS: rejected since WASM path should be authoritative and consistent.
- Ignore scale and compensate only in UI: rejected; coupling UI scale and engine inputs is fragile.

## Migration/Compatibility

- Public API unchanged. Consumers using the WASM path should call `setView(scale)` when the visual scale changes.
- JS fallback behavior remains, but with improved UX (no hop) even without WASM.

## Risks and mitigations

- If `setView(scale)` is not updated when the UI scale changes, pointer mapping may drift under zoom. Mitigation: ensure callers update view scale alongside UI changes.
- Multi-pointer interactions are not yet handled; current design assumes a single active pointer per node id. Future work may extend pointer handling.

## Related files/functions

- `packages/wasm/src/lib.rs` — `Node`, `apply_pointers()`, `step()`, `set_view()`, `set_constraints()`.
- `apps/my-app/src/lib/index.ts` — `startWasmDemo()`, `startCanvasDemo()`.
- `apps/my-app/static/wasm/` — deployed WASM pkg used by loader `packages/corlena/wasm/index.js`.
