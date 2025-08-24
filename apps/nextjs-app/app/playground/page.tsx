"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "corlena/react";
import { Button } from "../../components/ui/button";

function intersects(a: DOMRect, b: DOMRect) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export default function Playground() {
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
      // Immediately perform a trivial call so the badge reflects real usage
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

  return (
    <div className="font-sans min-h-screen p-8 sm:p-16">
      <main className="mx-auto max-w-[1100px] flex flex-col gap-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Playground</h1>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 h-8 text-sm ${(wasmReady && wasmUsed) ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-rose-300 text-rose-700 bg-rose-50"}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${(wasmReady && wasmUsed) ? "bg-emerald-500" : "bg-rose-500"}`} />
              {(wasmReady && wasmUsed) ? "WASM Active" : "JS Only"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onInitWasm} disabled={initializing}>
              {initializing ? "Initializing WASM…" : "Init WASM"}
            </Button>
            <a href="/">
              <Button variant="outline">← Back</Button>
            </a>
          </div>
        </header>

        <section className="grid gap-8 md:grid-cols-2">
          <DroppableDemo />
          <MultiHandleResizeDemo />
        </section>

        <section>
          <PinchZoomDemo />
        </section>

        <section>
          <ImageResizerWasm onUsed={() => setWasmUsed(true)} />
        </section>
      </main>
    </div>
  );
}

function DroppableDemo() {
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<HTMLDivElement | null>(null);
  const [over, setOver] = useState(false);
  const [dropped, setDropped] = useState(false);

  const onMove = useCallback(() => {
    const z = zoneRef.current?.getBoundingClientRect();
    const d = dragRef.current?.getBoundingClientRect();
    if (!z || !d) return;
    setOver(intersects(z, d));
  }, []);

  const drag = useDraggable({ initial: { x: 24, y: 48 }, onMove: () => onMove() });

  const onDrop = useCallback(() => {
    setDropped((v) => over || v);
  }, [over]);

  return (
    <div className="rounded-lg border border-black/10 p-4 bg-white min-h-[320px] relative overflow-hidden" style={{ overscrollBehavior: "contain" }}>
      <h2 className="font-semibold mb-2">Droppable</h2>
      <p className="text-sm text-black/70 mb-3">Drag the tag into the dropzone.</p>
      <div
        ref={zoneRef}
        className={`absolute right-6 bottom-6 h-28 w-40 rounded-md border text-sm grid place-items-center transition-colors ${
          (over || dropped) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-black/10 bg-white text-black/70"
        }`}
      >
        Drop here
      </div>
      <div
        ref={dragRef}
        {...drag.bind}
        onPointerUp={onDrop}
        className="rounded-md bg-black text-white px-3 py-2 select-none shadow inline-block"
        style={{ ...(drag.bind as any).style, position: "absolute", left: drag.x, top: drag.y }}
      >
        Drag me
      </div>
    </div>
  );
}

function MultiHandleResizeDemo() {
  const [box, setBox] = useState({ x: 24, y: 48, w: 260, h: 160 });
  const stageRef = useRef<HTMLDivElement | null>(null);

  const Handle = useMemo(() => {
    return function Handle({ dir }: { dir: "br" | "tr" | "bl" | "tl" }) {
      const start = useRef({ x: 0, y: 0 });
      const orig = useRef(box);
      const onPointerDown = (e: React.PointerEvent) => {
        (e.currentTarget as any).setPointerCapture?.(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY };
        orig.current = box;
      };
      const onPointerMove = (e: React.PointerEvent) => {
        if (e.buttons === 0) return;
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        let { x, y, w, h } = orig.current;
        if (dir.includes("r")) w = Math.max(1, orig.current.w + dx);
        if (dir.includes("l")) {
          const nx = orig.current.x + dx;
          const nw = Math.max(1, orig.current.w - dx);
          if (nw > 1) { x = nx; w = nw; }
        }
        if (dir.includes("b")) h = Math.max(1, orig.current.h + dy);
        if (dir.includes("t")) {
          const ny = orig.current.y + dy;
          const nh = Math.max(1, orig.current.h - dy);
          if (nh > 1) { y = ny; h = nh; }
        }
        setBox({ x, y, w, h });
      };
      const pos = {
        tl: { left: box.x - 6, top: box.y - 6, cursor: "nwse-resize" },
        tr: { left: box.x + box.w - 8, top: box.y - 6, cursor: "nesw-resize" },
        bl: { left: box.x - 6, top: box.y + box.h - 8, cursor: "nesw-resize" },
        br: { left: box.x + box.w - 8, top: box.y + box.h - 8, cursor: "nwse-resize" },
      }[dir];
      return (
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          className="absolute w-4 h-4 bg-black/70 rounded-sm"
          style={{ ...pos, position: "absolute", touchAction: "none" }}
        />
      );
    };
  }, [box]);

  const drag = useDraggable({
    initial: { x: box.x, y: box.y },
    onMove: (p) => setBox((b) => ({ ...b, x: p.x, y: p.y })),
  });

  return (
    <div ref={stageRef} className="rounded-lg border border-black/10 p-4 bg-white min-h-[320px] relative overflow-hidden" style={{ overscrollBehavior: "contain" }}>
      <h2 className="font-semibold mb-2">Multi‑handle Resizer</h2>
      <p className="text-sm text-black/70 mb-3">Drag the box or resize from any corner.</p>

      <div
        {...drag.bind}
        className="absolute rounded-md bg-gradient-to-br from-indigo-100 to-indigo-300 select-none shadow grid place-items-center border border-indigo-200"
        style={{ ...(drag.bind as any).style, left: box.x, top: box.y, width: box.w, height: box.h }}
      >
        <span className="text-indigo-900 text-sm">Drag or resize</span>
      </div>
      <Handle dir="tl" />
      <Handle dir="tr" />
      <Handle dir="bl" />
      <Handle dir="br" />
    </div>
  );
}

function PinchZoomDemo() {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef({ scale: 1, offset: { x: 0, y: 0 }, center: { x: 0, y: 0 }, dist: 1, panStart: { x: 0, y: 0 } });

  const clampScale = (s: number) => Math.max(0.2, Math.min(8, s));

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = Math.exp(-e.deltaY / 300);
    setScale((s) => {
      const ns = clampScale(s * factor);
      setOffset((o) => ({ x: p.x - (ns / s) * (p.x - o.x), y: p.y - (ns / s) * (p.y - o.y) }));
      return ns;
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (touches.current.size === 2) {
      const [a, b] = Array.from(touches.current.values());
      start.current = {
        scale,
        offset,
        center: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        panStart: { x: 0, y: 0 },
      };
    } else if (touches.current.size === 1) {
      start.current.panStart = { x: e.clientX - rect.left - offset.x, y: e.clientY - rect.top - offset.y };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size === 2) {
      const [a, b] = Array.from(touches.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const ns = clampScale((start.current.scale * dist) / Math.max(1e-6, start.current.dist));
      // Keep the start centroid stable during pinch
      const p = start.current.center;
      const s = start.current.scale;
      setScale(ns);
      setOffset({ x: p.x - (ns / s) * (p.x - start.current.offset.x), y: p.y - (ns / s) * (p.y - start.current.offset.y) });
    } else if (touches.current.size === 1) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setOffset({ x: x - start.current.panStart.x, y: y - start.current.panStart.y });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId);
  };

  return (
    <div className="rounded-lg border border-black/10 p-4 bg-white relative overflow-hidden">
      <h2 className="font-semibold mb-2">Pinch / Wheel Zoom</h2>
      <p className="text-sm text-black/70 mb-3">Use two‑finger pinch (touch) or Ctrl/⌘ + wheel (mouse).</p>
      <div
        className="relative h-[380px] rounded-md bg-white overflow-hidden"
        style={{ touchAction: "none", overscrollBehavior: "contain" }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute left-0 top-0 origin-top-left w-[320px] h-[320px] rounded-md bg-[url('/next.svg')] bg-no-repeat bg-center bg-contain border border-black/10"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
      </div>
    </div>
  );
}

function ImageResizerWasm({ onUsed }: { onUsed: () => void }) {
  const inRef = useRef<HTMLCanvasElement | null>(null);
  const outRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<string>("Idle");

  const loadAndDraw = useCallback(async () => {
    return new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 320;
        const h = img.naturalHeight || 320;
        const c = inRef.current!;
        c.width = w; c.height = h;
        const ctx = c.getContext('2d')!;
        ctx.clearRect(0,0,w,h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ w, h });
      };
      img.onerror = (e) => reject(e);
      img.src = '/next.svg';
    });
  }, []);

  const onResize = useCallback(async () => {
    try {
      setStatus('Loading image…');
      const { w, h } = await loadAndDraw();
      const ctx = inRef.current!.getContext('2d')!;
      const src = ctx.getImageData(0, 0, w, h);
      setStatus('Initializing WASM…');
      const wasm = await import('corlena/wasm');
      if (typeof (wasm as any).init === 'function' && !(wasm as any).isReady?.()) {
        await (wasm as any).init(256);
      }
      setStatus('Storing image…');
      const ok = (wasm as any).storeImage?.(1, src.data, w, h);
      const outW = Math.max(1, Math.floor(w * 0.5));
      const outH = Math.max(1, Math.floor(h * 0.5));
      setStatus('Resizing…');
      const out = (wasm as any).resizeImageMode?.(1, outW, outH, 1);
      if (ok && out && out.length === outW * outH * 4) {
        const o = outRef.current!;
        o.width = outW; o.height = outH;
        const octx = o.getContext('2d')!;
        const imgData = new ImageData(new Uint8ClampedArray(out), outW, outH);
        octx.putImageData(imgData, 0, 0);
        setStatus('Done (WASM)');
        onUsed();
      } else {
        setStatus('WASM unavailable (JS Only)');
      }
    } catch (e) {
      console.warn(e);
      setStatus('Error');
    }
  }, [loadAndDraw, onUsed]);

  return (
    <div className="rounded-lg border border-black/10 p-4 bg-white relative overflow-hidden" style={{ overscrollBehavior: 'contain' }}>
      <h2 className="font-semibold mb-2">Image Resizer (WASM)</h2>
      <p className="text-sm text-black/70 mb-3">Rasterizes <code>next.svg</code> to RGBA, stores in WASM, and resizes with bilinear.</p>
      <div className="flex items-center gap-2 mb-3">
        <Button onClick={onResize}>Resize with WASM</Button>
        <span className="text-sm text-black/60">{status}</span>
      </div>
      <div className="flex gap-6">
        <div>
          <div className="text-xs text-black/60 mb-1">Input</div>
          <canvas ref={inRef} className="border border-black/10 rounded" />
        </div>
        <div>
          <div className="text-xs text-black/60 mb-1">Output</div>
          <canvas ref={outRef} className="border border-black/10 rounded" />
        </div>
      </div>
    </div>
  );
}
