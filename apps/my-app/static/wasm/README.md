# @corlena/wasm (stub)

Build:

- Prereq: install Rust + wasm-pack
- Build: wasm-pack build --target web --release -d ./pkg

Exports function `process_frame(dt, pointers, nodes, constraints)` returning `{ transforms, events }`.
