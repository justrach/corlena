# 0006 – Node WASM Benchmark, Build Fix, and Image Resize Tests

- Status: Accepted
- Date: 2025-08-23

## Context

We added a Node.js-based benchmark to measure the performance of the Rust WASM engine outside the browser. Initially, the `wasm:build:node` script wrote output into a nested directory (`packages/wasm/packages/wasm/pkg-node/`) causing the benchmark to fail with a module-not-found error. Meanwhile, we also introduced pure Rust image resize helpers (nearest and bilinear) with unit tests to validate resampling correctness independently of `wasm-bindgen` bindings.

## Decision

- Provide a Node-targeted WASM build output at `packages/wasm/pkg-node/`.
- Add a Node benchmark script that loads the Node-targeted bundle and measures avg `process_frame(dt)` time and estimated FPS for varying particle counts.
- Keep image resize helpers as pure Rust functions with unit tests to ensure algorithmic correctness, and use WASM exports for runtime integration.
- Update documentation (`README.md`, `summary.md`, `agent.md`) to include testing/benchmark instructions and troubleshooting.
- Fix root `package.json` `packageManager` to a full semver to satisfy tooling.

## Implementation

1. Build
   - Script fix in root `package.json`:
     - `wasm:build:node`: `wasm-pack build packages/wasm --target nodejs --out-dir pkg-node` (out-dir relative to crate).
   - Output path: `packages/wasm/pkg-node/`.

2. Benchmark
   - `scripts/bench/wasm-node-bench.mjs`
     - Imports `../../packages/wasm/pkg-node/corlena_wasm.js`
     - Runs multiple particle counts (100, 1k, 5k, 10k) and prints avg ms/step and estimated FPS.
   - NPM script: `bench:wasm:node`.

3. Rust Image Resize Helpers
   - `packages/wasm/src/lib.rs`
     - `resize_nearest_rgba(...)` and `resize_bilinear_rgba(...)` as internal pure functions.
     - Unit tests validate correctness for small inputs and shape conversions.
   - WASM-facing API already exposes `resize_image(...)` (nearest) and `resize_image_mode(..., mode)` where `mode` is 0=nearest, 1=bilinear.

4. Documentation
   - `README.md` — Added testing and benchmark instructions, and link to `summary.md`.
   - `summary.md` — Architecture/workflow overview; recent changes section for the Node bench and build fix.
   - `agent.md` — Bench workflow, Node build outputs, and troubleshooting for module resolution.

5. Misc
   - Fixed root `package.json` `packageManager` to `npm@10.0.0`.
   - Moved misplaced Rust tests into `#[cfg(test)] mod tests` to fix compilation.

## Results

- Build + bench now run end-to-end:
  - `npm run wasm:build:node`
  - `npm run bench:wasm:node`
- Example output:
  - `particles=100 -> ~0.004–0.006 ms/step (~220k FPS est)`
  - `particles=10_000 -> ~0.060–0.065 ms/step (~15–17k FPS est)`
- All tests pass via `npm test` (Rust + JS).

## Consequences

- Clear separation between web (`pkg/`) and Node (`pkg-node/`) bundles for ease of testing and local perf evaluation.
- Additional warnings for unused helpers in non-test builds are acceptable; can be gated with `#[cfg(test)]` if needed.
- Bench results provide a baseline; a JS-only microbench should be added for comparison.

## Alternatives Considered

- Keep original `--out-dir packages/wasm/pkg-node`: resulted in nested paths and module resolution failures.
- Browser-only benchmarks: harder to control and less reproducible across environments.
- GPU-based resampling: out of scope for now; higher complexity.

## Rollback

- Revert the `wasm:build:node` script change and remove the Node bench if not needed.

## Links

- File: `scripts/bench/wasm-node-bench.mjs`
- Engine: `packages/wasm/src/lib.rs`
- Wrapper: `packages/corlena/wasm/index.js`, `index.d.ts`
- Docs: `README.md`, `summary.md`, `agent.md`
