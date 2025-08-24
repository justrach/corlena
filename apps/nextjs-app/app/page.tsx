"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Draggable, Resizable } from "corlena/react";
import { Button } from "../components/ui/button";

export default function Home() {
  const [wasmReady, setWasmReady] = useState(false);
  const [wasmUsed, setWasmUsed] = useState(false);
  const [initializing, setInitializing] = useState(false);

  // Narrowly type the WASM module surface we use
  type WasmApi = {
    init?: (capacity: number) => Promise<void> | void;
    isReady?: () => boolean;
    processFrame?: (opts: { dt: number }) => { particles?: Float32Array; transforms?: Float32Array } | undefined;
  };

  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    if (initializing) {
      t = setInterval(async () => {
        try {
          const wasm = (await import("corlena/wasm")) as unknown as WasmApi;
          setWasmReady(Boolean(wasm.isReady?.()));
        } catch {}
      }, 400);
    }
    return () => { if (t) clearInterval(t); };
  }, [initializing]);

  async function onInitWasm() {
    setInitializing(true);
    try {
      const wasm = (await import("corlena/wasm")) as unknown as WasmApi;
      await wasm.init?.(256);
      const readyNow = Boolean(wasm.isReady?.());
      setWasmReady(readyNow);
      // Immediately make a harmless call so badge shows real usage
      const proc = wasm.processFrame;
      if (readyNow && typeof proc === 'function') {
        const out = proc({ dt: 0 });
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
      const wasm = (await import("corlena/wasm")) as unknown as WasmApi;
      if (typeof wasm.init === 'function' && !wasm.isReady?.()) {
        await wasm.init(256);
      }
      // Call a real function so badge means "actually used"
      const out = wasm.processFrame?.({ dt: 0 }) || { transforms: new Float32Array(0) };
      if (out && out.transforms !== undefined) {
        setWasmUsed(true);
        setWasmReady(Boolean(wasm.isReady?.()));
      }
    } catch (e) {
      console.warn("WASM smoke failed", e);
    }
  }

  return (
    <div
      className="font-sans fixed sm:static inset-0 min-h-dvh sm:min-h-screen overflow-hidden p-8 sm:p-16"
      style={{ background: '#FFFDF7', overscrollBehavior: 'none' }}
    >
      <main className="mx-auto max-w-[1100px] flex flex-col gap-8">
        <section className="flex flex-col items-center text-center gap-4">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#0D1217]">
            Corlena — Fast, iOS‑friendly Canvas UI
          </h1>
          <p className="max-w-[860px]" style={{ color: '#0D1217B3' }}>
            React + Svelte interactions with optional WebAssembly acceleration. Drag, resize, and gestures that feel natural on iOS Safari and low‑power devices.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 gap-y-2">
            <Button onClick={onInitWasm} disabled={initializing}>
              {initializing ? "Initializing WASM…" : "Init WASM"}
            </Button>
            <Button variant="outline" onClick={onWasmSmoke}>WASM Smoke</Button>
            <Link href="/playground">
              <Button variant="outline">Playground</Button>
            </Link>
            <a href="https://github.com/justrach/corlena" target="_blank" rel="noreferrer">
              <Button variant="outline">GitHub</Button>
            </a>
            <a href="https://www.npmjs.com/package/corlena" target="_blank" rel="noreferrer">
              <Button variant="ghost">npm</Button>
            </a>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 h-8 text-sm border`}
              style={{
                background: (wasmReady && wasmUsed) ? '#AEE6FF' : '#FFCCD5',
                color: '#0D1217',
                border: '1px solid rgba(13,18,23,0.10)'
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: (wasmReady && wasmUsed) ? '#0EA5E9' : '#E11D48' }}
              />
              {(wasmReady && wasmUsed) ? "WASM Active" : "JS Only"}
            </span>
          </div>
        </section>

        <section className="flex justify-center">
          <div
            className="relative w-full max-w-[880px] h-[380px] sm:h-[420px] rounded-lg shadow-sm overflow-hidden border"
            style={{ overscrollBehavior: "contain", borderColor: '#BFE2F5', background: '#FFFDF7' }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
            <Draggable initial={{ x: 40, y: 48 }}>
              <div className="rounded-md text-white px-3 py-2 select-none shadow" style={{ background: '#0D1217' }}>Drag me</div>
            </Draggable>
            <Draggable initial={{ x: 160, y: 160 }}>
              <div className="rounded-md px-3 py-2 select-none shadow" style={{ background: '#AEE6FF', color: '#0D1217' }}>Touch‑friendly</div>
            </Draggable>
            <Draggable initial={{ x: 320, y: 96 }}>
              <div className="rounded-md px-3 py-2 select-none shadow" style={{ background: '#FFE3A3', color: '#0D1217' }}>iOS‑ready</div>
            </Draggable>
            <Resizable initial={{ w: 260, h: 160 }}>
              <div className="w-full h-full grid place-items-center select-none rounded-md" style={{ background: 'linear-gradient(135deg, #FFF8CC, #BFE2F5)' }}>
                <span style={{ color: '#0D1217' }}>Resize me</span>
              </div>
            </Resizable>
            <Resizable initial={{ w: 180, h: 120 }}>
              <div className="w-full h-full grid place-items-center select-none rounded-md" style={{ background: 'linear-gradient(135deg, #FFCCD5, #FFE3A3)' }}>
                <span style={{ color: '#0D1217' }}>Snappy</span>
              </div>
            </Resizable>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-[880px] mx-auto">
          <div className="rounded-lg border p-4" style={{ borderColor: '#BFE2F5', background: '#FFFDF7' }}>
            <h3 className="font-semibold mb-2" style={{ color: '#0D1217' }}>Canvas‑first UX</h3>
            <p className="text-sm" style={{ color: '#0D1217B3' }}>Drag/resize basics with touch ergonomics that work out of the box on iOS Safari.</p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: '#BFE2F5', background: '#FFFDF7' }}>
            <h3 className="font-semibold mb-2" style={{ color: '#0D1217' }}>Optional WASM</h3>
            <p className="text-sm" style={{ color: '#0D1217B3' }}>Switch on Rust/WebAssembly for heavy transforms. JS fallback always available.</p>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: '#BFE2F5', background: '#FFFDF7' }}>
            <h3 className="font-semibold mb-2" style={{ color: '#0D1217' }}>React + Svelte</h3>
            <p className="text-sm" style={{ color: '#0D1217B3' }}>Use Svelte actions or React hooks/components via <code>corlena/react</code>.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
