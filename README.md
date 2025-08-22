# Corlena Monorepo

Packages:
- packages/corlena: Svelte-native drag/resize/gesture actions + stores.
- packages/wasm: Optional Rust/WASM engine (stub) built with wasm-bindgen.
- apps/demo: Svelte + Vite demo with configurable canvas size.

Quick start:
1) Install deps
   npm install
2) (Optional) Build WASM
   npm run wasm:build
3) Run demo
   npm run dev

Notes:
- Library is Svelte-first via actions and stores; WASM boundary is typed-array based.
- iOS-friendly defaults: touch-action/user-select guards.
