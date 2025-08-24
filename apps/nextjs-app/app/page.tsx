"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Draggable, Resizable } from "corlena/react";
import { Button } from "../components/ui/button";

export default function Home() {
  const [showDemo, setShowDemo] = useState(true);
  const [wasmReady, setWasmReady] = useState(false);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    let t: any;
    // poll readiness briefly if init is in progress
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
      setWasmReady(Boolean((wasm as any).isReady?.()));
    } catch (e) {
      console.warn("WASM init failed (JS fallback will be used)", e);
      setWasmReady(false);
    } finally {
      setInitializing(false);
    }
  }
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
          <li className="mb-2 tracking-[-.01em]">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] font-mono font-semibold px-1 py-0.5 rounded">
              app/page.tsx
            </code>
            .
          </li>
          <li className="tracking-[-.01em]">
            Save and see your changes instantly.
          </li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={onInitWasm} disabled={initializing}>
            {initializing ? "Initializing WASM…" : "Init WASM"}
          </Button>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 h-8 text-sm ${wasmReady ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-rose-300 text-rose-700 bg-rose-50"}`}>
            <span className={`inline-block w-2 h-2 rounded-full ${wasmReady ? "bg-emerald-500" : "bg-rose-500"}`} />
            {wasmReady ? "WASM Enabled" : "JS Fallback"}
          </span>
        </div>

        {showDemo && (
          <div className="relative w-[880px] h-[420px] border border-black/10 rounded-lg bg-white/80 shadow-sm overflow-hidden">
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
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-[880px]">
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
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
