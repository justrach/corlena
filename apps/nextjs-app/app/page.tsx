"use client";
import { useEffect, useState } from "react";
import { Draggable, Resizable } from "corlena/react";
import { Button } from "../components/ui/button";

export default function Home() {
  const [wasmReady, setWasmReady] = useState(false);
  const [wasmUsed, setWasmUsed] = useState(false);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    let t: any;
    if (initializing) {
      t = setInterval(async () => {
        try {
          const wasm = await import("corlena/wasm");
          setWasmReady(Boolean((wasm as any).isReady?.()));
        } catch {}
      }, 400);
    }
    return () => clearInterval(t);
  }, [initializing]);

  async function onInitWasm() {
    setInitializing(true);
    try {
      const wasm = await import("corlena/wasm");
      await (wasm as any).init?.(256);
      const readyNow = Boolean((wasm as any).isReady?.());
      setWasmReady(readyNow);
      // Immediately make a harmless call so badge shows real usage
      if (readyNow && typeof (wasm as any).processFrame === 'function') {
        const out = (wasm as any).processFrame({ dt: 0 });
        if (out && out.transforms !== undefined) setWasmUsed(true);
      }
    } catch (e) {
      console.warn("WASM init failed (JS fallback will be used)", e);
      setWasmReady(false);
    } finally {
      setInitializing(false);
    }
  }

  async function onWasmSmoke() {
    try {
      const wasm = await import("corlena/wasm");
      if (typeof (wasm as any).init === 'function' && !(wasm as any).isReady?.()) {
        await (wasm as any).init(256);
      }
      // Call a real function so badge means "actually used"
      const out = (wasm as any).processFrame?.({ dt: 0 }) || { transforms: new Float32Array(0) };
      if (out && out.transforms !== undefined) {
        setWasmUsed(true);
        setWasmReady(Boolean((wasm as any).isReady?.()));
      }
    } catch (e) {
      console.warn("WASM smoke failed", e);
    }
  }

  return (
    <div className="font-sans min-h-screen p-8 sm:p-16">
      <main className="mx-auto max-w-[1100px] flex flex-col gap-8">
        <section className="flex flex-col items-center text-center gap-4">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">Corlena — Fast, iOS‑friendly Canvas UI</h1>
          <p className="text-black/70 max-w-[860px]">
            React + Svelte interactions with optional WebAssembly acceleration. Drag, resize, and gestures that feel natural on iOS Safari and low‑power devices.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={onInitWasm} disabled={initializing}>
              {initializing ? "Initializing WASM…" : "Init WASM"}
            </Button>
            <Button variant="outline" onClick={onWasmSmoke}>WASM Smoke</Button>
            <a href="/playground">
              <Button variant="outline">Playground</Button>
            </a>
            <a href="https://github.com/justrach/corlena" target="_blank" rel="noreferrer">
              <Button variant="outline">GitHub</Button>
            </a>
            <a href="https://www.npmjs.com/package/corlena" target="_blank" rel="noreferrer">
              <Button variant="ghost">npm</Button>
            </a>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 h-8 text-sm ${(wasmReady && wasmUsed) ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-rose-300 text-rose-700 bg-rose-50"}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${(wasmReady && wasmUsed) ? "bg-emerald-500" : "bg-rose-500"}`} />
              {(wasmReady && wasmUsed) ? "WASM Active" : "JS Only"}
            </span>
          </div>
        </section>

        <section className="flex justify-center">
          <div className="relative w-[880px] h-[420px] border border-black/10 rounded-lg bg-white/80 shadow-sm overflow-hidden" style={{ overscrollBehavior: "contain" }}>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
            <Draggable initial={{ x: 40, y: 48 }}>
              <div className="rounded-md bg-black text-white px-3 py-2 select-none shadow">Drag me</div>
            </Draggable>
            <Draggable initial={{ x: 160, y: 160 }}>
              <div className="rounded-md bg-emerald-600 text-white px-3 py-2 select-none shadow">Touch‑friendly</div>
            </Draggable>
            <Draggable initial={{ x: 320, y: 96 }}>
              <div className="rounded-md bg-indigo-600 text-white px-3 py-2 select-none shadow">iOS‑ready</div>
            </Draggable>
            <Resizable initial={{ w: 260, h: 160 }}>
              <div className="w-full h-full grid place-items-center bg-gradient-to-br from-emerald-100 to-emerald-300 select-none rounded-md">
                <span className="text-emerald-900">Resize me</span>
              </div>
            </Resizable>
            <Resizable initial={{ w: 180, h: 120 }}>
              <div className="w-full h-full grid place-items-center bg-gradient-to-br from-indigo-100 to-indigo-300 select-none rounded-md">
                <span className="text-indigo-900">Snappy</span>
              </div>
            </Resizable>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-[880px] mx-auto">
          <div className="rounded-lg border border-black/10 p-4 bg-white">
            <h3 className="font-semibold mb-2">Canvas‑first UX</h3>
            <p className="text-sm text-black/70">Drag/resize basics with touch ergonomics that work out of the box on iOS Safari.</p>
          </div>
          <div className="rounded-lg border border-black/10 p-4 bg-white">
            <h3 className="font-semibold mb-2">Optional WASM</h3>
            <p className="text-sm text-black/70">Switch on Rust/WebAssembly for heavy transforms. JS fallback always available.</p>
          </div>
          <div className="rounded-lg border border-black/10 p-4 bg-white">
            <h3 className="font-semibold mb-2">React + Svelte</h3>
            <p className="text-sm text-black/70">Use Svelte actions or React hooks/components via <code>corlena/react</code>.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
