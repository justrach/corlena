// Dev-console shim to import the WASM wrapper from the app root.
// Usage in browser DevTools:
//   const wasm = await import('/src/wasm-wrapper.js');
//   window.__CORLENA_WASM_URL__ = '/wasm/corlena_wasm.js';
//   await wasm.init(8);
//   ...

export * from 'corlena/wasm';
