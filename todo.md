# Corlena TODO

- [x] Monorepo scaffold (workspaces, packages, demo)
- [x] Core `draggable` action (basic drag, grid, bounds: parent)
- [x] Interaction store `createGestureStore()` (minimal)
- [x] Global `configure()` (passive/rafStrategy/ios stub)
- [x] Demo app with configurable canvas size presets
- [x] Rust/WASM crate stub with `process_frame` boundary
- [x] Resizable action (edges/corners, min/max) — demo updated (text/image/video)
- [x] Droppable zones (enter/leave/over/drop)
- [x] iOS scroll lock polish (overscroll/rubber-banding)
- [ ] Inertia in JS (throw/decay)
- [ ] WASM: real snap/collision/inertia impl
- [ ] Autoscroll near edges
- [ ] Keyboard a11y + ARIA updates
- [ ] Docs site + Svelte REPL links
- [x] Unit tests: pinch/resample anchoring invariants (applyPinch, anchorResample)
- [x] Wire particles toggle on `/ig` and disable default on-tap bursts

## Text Overlay & Export (MVP)
- [ ] Add text overlay model and rendering in `/canvas`
- [ ] Inline edit input overlay positioned over text; commit on blur/enter
- [ ] Drag/scale/rotate gestures for text nodes
- [ ] Styling: font family, size, weight, color, align, optional shadow/bg pill
- [ ] Hit-testing and selection bounding box
- [ ] Z-order above image overlay (simple add-on-top flow)
- [x] Export canvas to Blob (PNG/JPEG) with DPR handling
- [ ] Download/share UX
- [ ] Font loading and metrics stability
- [ ] Unit tests: text bounds under transform; export DPR parity
- [ ] Feature flag toggle

---

## WASM Roadmap (scaling + state)

Goal: move heavy per-frame math and state into WASM while keeping DOM updates in JS. Start small (opt-in), measure, then expand.

### Build + Wiring
- [x] Add wasm-pack build: `wasm-pack build packages/wasm --target web --out-dir pkg`
- [x] Hook `packages/corlena/wasm/index.js` to load generated `.wasm` and delegate `processFrame`
- [x] Root scripts: `wasm:build`, `wasm:build:node`
- [ ] Add `watch:wasm`
- [x] Ensure type defs re-exported from `packages/corlena/wasm/index.d.ts`
 - [x] Fix `wasm:build:node` out-dir to crate-relative `pkg-node` (avoid nested path)

### Memory Layout + API Surface
- [ ] Define typed-array layout for nodes: `[id, x, y, w, h, vx, vy, flags] * N`
- [ ] Define constraints layout: `[aId, bId, type, k, rest] * M`
- [ ] Define pointers layout: `[id, x, y, pressure, buttons] * P`
- [ ] Expose init/reset: `init(capacity)`, `reset()`; store scene in linear memory
- [ ] View transform inputs: `set_view(zoom, panX, panY, pixelRatio)`
- [ ] Output ring buffers: `transforms{nodeId,x,y,angle,scaleX,scaleY}`, `events{type,a,b,data}`

### First Implementation (MVP)
- [ ] `process_frame(dt, pointers, nodes, constraints)` updates positions in world space
- [ ] Grid snapping and bounds clamping (parent/rect)
- [ ] Basic inertia (throw + exponential decay)
- [ ] Optional simple AABB collision with overlap events
- [ ] Batch outputs into preallocated `Float32Array`/`Int32Array`

### JS Integration (opt-in)
- [ ] Add `useWasm` path in `draggable` to delegate per-frame math to WASM
- [ ] Keep DOM transforms in JS; WASM only returns numbers
- [ ] Fallback to existing JS behavior if WASM unavailable
- [ ] Utilities to marshal stable typed arrays without reallocations

### Statefulness / "Engine" features
- [ ] Maintain persistent scene graph in WASM (nodes, velocities, constraints)
- [ ] Event ring buffer: collisions, drag start/end, drop enter/leave/over
- [ ] Snapshot/restore buffers for undo/redo
- [ ] Deterministic stepping: fixed tick with accumulator

### Scaling + Perf
- [x] Microbenchmarks: Node WASM particle step FPS (100/1k/5k/10k)
- [ ] Add JS-only baseline microbench to compare vs WASM
- [ ] Minimize JS<->WASM crossings; batch IO
- [ ] Optional Worker + SharedArrayBuffer plan (note: requires COOP/COEP)
- [ ] Pixel ratio + world/screen transforms live in WASM

### Testing + Demo
- [ ] Unit tests for memory layout and `process_frame` math
- [x] Rust unit tests: particle engine step (gravity, bounce, damping, lifetime)
- [x] JS tests: WASM wrapper fallback behavior and APIs
- [ ] Demo toggles: WASM on/off, node count slider, zoom/pan
- [ ] Visual correctness checks (snap/bounds/inertia)

## Docs
- [x] README: testing + benchmarks + link to `summary.md`
- [x] `summary.md`: architecture & workflow overview
- [ ] ADR: document image resize modes and API semantics (nearest/bilinear)
 - [x] `agent.md`: Node bench workflow and troubleshooting
 - [x] ADR-0006: Node WASM bench, build fix, and image resize tests

### Stretch
- [ ] Canvas/WebGL renderer path (OffscreenCanvas in Worker) for large scenes
- [ ] Multi-touch gestures (pinch zoom/rotate) with WASM world transforms
- [ ] Constraint solvers (distance, angle, springs) and IK
