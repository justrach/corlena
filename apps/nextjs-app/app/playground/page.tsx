"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "corlena/react";
import { Button } from "../../components/ui/button";

function intersects(a: DOMRect, b: DOMRect) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export default function Playground() {
  const [wasmReady, setWasmReady] = useState(false);
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
      setWasmReady(Boolean((wasm as any).isReady?.()));
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
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 h-8 text-sm ${wasmReady ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-rose-300 text-rose-700 bg-rose-50"}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${wasmReady ? "bg-emerald-500" : "bg-rose-500"}`} />
              {wasmReady ? "WASM Enabled" : "JS Fallback"}
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
    <div className="rounded-lg border border-black/10 p-4 bg-white min-h-[320px] relative overflow-hidden">
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
        style={{ position: "absolute", left: drag.x, top: drag.y, touchAction: "none", userSelect: "none", cursor: "grab" }}
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
    <div ref={stageRef} className="rounded-lg border border-black/10 p-4 bg-white min-h-[320px] relative overflow-hidden">
      <h2 className="font-semibold mb-2">Multi‑handle Resizer</h2>
      <p className="text-sm text-black/70 mb-3">Drag the box or resize from any corner.</p>

      <div
        className="absolute rounded-md bg-gradient-to-br from-indigo-100 to-indigo-300 select-none shadow grid place-items-center border border-indigo-200"
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        {...drag.bind}
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
  const start = useRef({ scale: 1, offset: { x: 0, y: 0 }, center: { x: 0, y: 0 }, dist: 1 });

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
    if (touches.current.size === 2) {
      const [a, b] = Array.from(touches.current.values());
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      start.current = {
        scale,
        offset,
        center: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size === 2) {
      const [a, b] = Array.from(touches.current.values());
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const cNow = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const ns = clampScale((start.current.scale * dist) / Math.max(1e-6, start.current.dist));
      // Keep the start centroid stable during pinch
      const p = start.current.center;
      const s = start.current.scale;
      setScale(ns);
      setOffset({ x: p.x - (ns / s) * (p.x - start.current.offset.x), y: p.y - (ns / s) * (p.y - start.current.offset.y) });
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
        style={{ touchAction: "none" }}
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
