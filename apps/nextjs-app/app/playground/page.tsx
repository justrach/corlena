"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "corlena/react";
import { Button } from "../../components/ui/button";

function intersects(a: DOMRect, b: DOMRect) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function ParticleCompare({ onUsed }: { onUsed: () => void }) {
  const jsCanvas = useRef<HTMLCanvasElement | null>(null);
  const wasmCanvas = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [jsCount, setJsCount] = useState(800);
  const [wasmCount, setWasmCount] = useState(4000);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(performance.now());
  const jsState = useRef<{ x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array } | null>(null);
  const wasmReadyRef = useRef(false);
  const wasmRef = useRef<any>(null);
  // Perf telemetry (FPS derived from step+draw time per side)
  const [jsFps, setJsFps] = useState(0);
  const [wasmFps, setWasmFps] = useState(0);
  const [speedText, setSpeedText] = useState<string>("—");
  const [jsPts, setJsPts] = useState(0);
  const [wasmPts, setWasmPts] = useState(0);
  const jsMsEma = useRef(0);
  const wasmMsEma = useRef(0);
  const lastStat = useRef(performance.now());
  // Lifetime preset for WASM seeding
  const [lifePreset, setLifePreset] = useState<number>(1e9);
  const jsPtsRef = useRef(0);
  const wasmPtsRef = useRef(0);

  const initJs = (w: number, h: number, n: number) => {
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const vx = new Float32Array(n);
    const vy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = Math.random() * w;
      y[i] = Math.random() * h;
      vx[i] = (Math.random() - 0.5) * 100;
      vy[i] = (Math.random() - 0.5) * 100;
    }
    jsState.current = { x, y, vx, vy };
  };

  const stepJs = (dt: number, w: number, h: number) => {
    const s = jsState.current!;
    const g = 200; // gravity
    for (let i = 0; i < s.x.length; i++) {
      s.vy[i] += g * dt;
      s.x[i] += s.vx[i] * dt;
      s.y[i] += s.vy[i] * dt;
      if (s.x[i] < 0) { s.x[i] = 0; s.vx[i] *= -0.9; }
      if (s.x[i] > w) { s.x[i] = w; s.vx[i] *= -0.9; }
      if (s.y[i] < 0) { s.y[i] = 0; s.vy[i] *= -0.9; }
      if (s.y[i] > h) { s.y[i] = h; s.vy[i] *= -0.9; }
    }
  };

  const drawPoints = (ctx: CanvasRenderingContext2D, pts: ArrayLike<number>, pair: boolean) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    if (pair) {
      // WASM particle buffer stride = 6: [x, y, vx, vy, r, life]
      for (let i = 0; i + 1 < pts.length; i += 6) {
        const x = pts[i], y = pts[i + 1];
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    } else {
      const s = jsState.current!;
      const n = s?.x?.length || 0;
      for (let i = 0; i < n; i++) ctx.fillRect(s.x[i] - 1, s.y[i] - 1, 2, 2);
    }
  };

  useEffect(() => {
    if (!running) return;
    let canceled = false;
    const loop = async (t: number) => {
      if (canceled) return;
      const dt = Math.min(0.05, (t - lastRef.current) / 1000);
      lastRef.current = t;
      // JS side
      const jsc = jsCanvas.current!;
      const jctx = jsc.getContext('2d')!;
      const jsT0 = performance.now();
      stepJs(dt, jsc.width, jsc.height);
      drawPoints(jctx, [] as any, false);
      const jsMs = performance.now() - jsT0;
      jsMsEma.current = jsMsEma.current ? (jsMsEma.current * 0.9 + jsMs * 0.1) : jsMs;
      jsPtsRef.current = jsState.current?.x.length || 0;

      // WASM side (imported once and cached)
      const wcanvas = wasmCanvas.current!;
      const wctx = wcanvas.getContext('2d')!;
      try {
        if (!wasmRef.current) {
          wasmRef.current = await import('corlena/wasm');
        }
        const wasm = wasmRef.current;
        const ready = Boolean(wasm?.isReady?.());
        wasmReadyRef.current = ready;
        if (ready) {
          const wasmT0 = performance.now();
          const out = wasm.processFrame?.({ dt });
          const arr: Float32Array = out?.particles || new Float32Array(0);
          if (arr.length > 0) {
            drawPoints(wctx, arr, true);
            onUsed();
          } else {
            // No particles => clear to avoid accumulating alpha to black
            wctx.clearRect(0, 0, wcanvas.width, wcanvas.height);
          }
          const wasmMs = performance.now() - wasmT0;
          wasmMsEma.current = wasmMsEma.current ? (wasmMsEma.current * 0.9 + wasmMs * 0.1) : wasmMs;
          wasmPtsRef.current = Math.floor(arr.length / 6);
        } else {
          // WASM not ready => clear
          wctx.clearRect(0, 0, wcanvas.width, wcanvas.height);
        }
      } catch {
        // no-op if wasm unavailable
      }

      // Publish perf stats at ~3Hz to limit rerenders
      if (t - lastStat.current > 300) {
        const j = jsMsEma.current || 0;
        const w = wasmMsEma.current || 0;
        if (j > 0) setJsFps(Math.max(0, Math.min(1000, 1000 / j)));
        if (w > 0) setWasmFps(Math.max(0, Math.min(1000, 1000 / w)));
        setJsPts(jsPtsRef.current);
        setWasmPts(wasmPtsRef.current);
        // Compute relative speed: positive means WASM faster
        if (j > 0 && w > 0) {
          const jsF = 1000 / j;
          const wasmF = 1000 / w;
          if (jsF > 0) {
            const pct = ((wasmF - jsF) / jsF) * 100;
            const abs = Math.abs(pct).toFixed(0);
            setSpeedText(pct >= 0 ? `WASM +${abs}% vs JS` : `JS +${abs}% vs WASM`);
          }
        }
        lastStat.current = t;
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame((t) => { lastRef.current = t; loop(t); });
    return () => { canceled = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running, onUsed]);

  async function reseedWasm(n: number, life: number, W: number, H: number) {
    try {
      if (!wasmRef.current) wasmRef.current = await import('corlena/wasm');
      const wasm = wasmRef.current;
      if (typeof wasm.init === 'function' && !wasm.isReady?.()) {
        await wasm.init(4096);
      }
      if (wasm.spawnParticles) {
        const seed: number[] = [];
        for (let i = 0; i < n; i++) {
          const x = Math.random() * W, y = Math.random() * H;
          const vx = (Math.random() - 0.5) * 100, vy = (Math.random() - 0.5) * 100;
          const r = 1.0;
          seed.push(x, y, vx, vy, r, life);
        }
        wasm.clearParticles?.();
        wasm.setConstraints?.(new Float32Array([0, 0, W, H, 1, 1, 0, 0.999]));
        wasm.setViewParams?.(1, 0, 0, 1);
        wasm.setParticleParams?.(new Float32Array([0, 200, 1.0, 0.9]));
        wasm.spawnParticles(seed);
        onUsed();
      }
    } catch {}
  }

  const onPresetCount = useCallback(async (n: number) => {
    setJsCount(n);
    setWasmCount(n);
    const W = jsCanvas.current?.width || 360;
    const H = jsCanvas.current?.height || 240;
    if (running) {
      initJs(W, H, n);
      try { const jctx = jsCanvas.current!.getContext('2d')!; drawPoints(jctx, [] as any, false); } catch {}
      await reseedWasm(n, lifePreset, W, H);
    }
  }, [running, lifePreset]);

  const onPresetLife = useCallback(async (life: number) => {
    setLifePreset(life);
    const W = jsCanvas.current?.width || 360;
    const H = jsCanvas.current?.height || 240;
    if (running) {
      // Reseed JS as well (life concept not used in JS, but we reset for parity)
      initJs(W, H, jsCount);
      try { const jctx = jsCanvas.current!.getContext('2d')!; drawPoints(jctx, [] as any, false); } catch {}
      await reseedWasm(wasmCount, life, W, H);
    }
  }, [running, wasmCount, jsCount]);

  const onStart = async () => {
    const W = 360, H = 240;
    // size canvases
    if (jsCanvas.current) { jsCanvas.current.width = W; jsCanvas.current.height = H; }
    if (wasmCanvas.current) { wasmCanvas.current.width = W; wasmCanvas.current.height = H; }
    initJs(W, H, jsCount);
    // Draw initial JS frame immediately
    try {
      const jctx = jsCanvas.current!.getContext('2d')!;
      drawPoints(jctx, [] as any, false);
    } catch {}
    // Try to seed WASM particles (import/init once)
    try {
      if (!wasmRef.current) wasmRef.current = await import('corlena/wasm');
      const wasm = wasmRef.current;
      if (typeof wasm.init === 'function' && !wasm.isReady?.()) {
        await wasm.init(4096);
      }
      if (wasm.spawnParticles) {
        await reseedWasm(wasmCount, lifePreset, W, H);
        // Try an initial draw via processFrame(0)
        const wctx = wasmCanvas.current!.getContext('2d')!;
        const out = wasm.processFrame?.({ dt: 0 });
        const arr: Float32Array = out?.particles || new Float32Array(0);
        if (arr.length) drawPoints(wctx, arr, true);
      }
    } catch {}
    setRunning(true);
  };

  const onStop = () => {
    setRunning(false);
    try { wasmRef.current?.clearParticles?.(); } catch {}
    // Clear canvases so no static remains
    try {
      const jctx = jsCanvas.current?.getContext('2d');
      if (jctx) { jctx.clearRect(0, 0, jctx.canvas.width, jctx.canvas.height); }
      const wctx = wasmCanvas.current?.getContext('2d');
      if (wctx) { wctx.clearRect(0, 0, wctx.canvas.width, wctx.canvas.height); }
    } catch {}
  };

  return (
    <div
      className="rounded-xl border p-4 md:p-5 relative overflow-hidden"
      style={{ overscrollBehavior: 'contain', background: '#FFFDF7', borderColor: '#BFE2F5' }}
    >
      <h2 className="font-semibold mb-2 text-[#0D1217]">Particles — JS vs WASM</h2>
      <div className="flex items-center gap-3 mb-3 text-sm">
        <label className="flex items-center gap-2">JS Particles
          <input
            type="number"
            className="rounded px-2 py-1 w-24 bg-white"
            style={{ borderColor: '#BFE2F5', borderWidth: 1, color: '#0D1217' }}
            value={jsCount} min={100} max={100000} step={100}
            onChange={(e) => setJsCount(Math.max(100, Math.min(100000, Number(e.target.value)||0)))}
          />
        </label>
        <label className="flex items-center gap-2">WASM Particles
          <input
            type="number"
            className="rounded px-2 py-1 w-24 bg-white"
            style={{ borderColor: '#BFE2F5', borderWidth: 1, color: '#0D1217' }}
            value={wasmCount} min={100} max={100000} step={500}
            onChange={(e) => setWasmCount(Math.max(100, Math.min(100000, Number(e.target.value)||0)))}
          />
        </label>
        {!running ? (
          <Button onClick={onStart} className="shadow-sm" style={{ background: '#0D1217', color: '#FFFDF7' }}>Start</Button>
        ) : (
          <Button variant="outline" onClick={onStop} className="shadow-sm" style={{ borderColor: '#BFE2F5', color: '#0D1217', background: '#FFFDF7' }}>Stop</Button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs" style={{ color: '#0D1217B3' }}>Presets:</span>
          <Button variant="outline" size="sm" className="shadow-sm" style={{ borderColor: '#BFE2F5', color: '#0D1217', background: '#FFFDF7' }} onClick={() => onPresetCount(100)}>100</Button>
          <Button variant="outline" size="sm" className="shadow-sm" style={{ borderColor: '#BFE2F5', color: '#0D1217', background: '#FFFDF7' }} onClick={() => onPresetCount(100000)}>100,000</Button>
          <Button variant="outline" size="sm" className="shadow-sm" style={{ borderColor: '#BFE2F5', color: '#0D1217', background: '#FFFDF7' }} onClick={() => onPresetLife(1e9)}>10^9 life</Button>
          <span
            className="ml-2 inline-flex items-center rounded-full px-2 h-6 text-[11px] font-medium"
            style={{ background: '#FFE3A3', color: '#0D1217', border: '1px solid rgba(13,18,23,0.10)' }}
          >
            {speedText}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: '#0D1217B3' }}>
            <span>JS‑only</span>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 h-6 text-[11px] font-medium"
                style={{ background: '#AEE6FF', color: '#0D1217', border: '1px solid rgba(13,18,23,0.10)' }}
              >
                {Math.round(jsFps)} FPS
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 h-6 text-[11px] font-medium"
                style={{ background: '#AEE6FF', color: '#0D1217', border: '1px solid rgba(13,18,23,0.10)' }}
              >
                {jsPts.toLocaleString()} pts
              </span>
            </div>
          </div>
          <canvas ref={jsCanvas} className="rounded bg-white" style={{ borderColor: '#BFE2F5', borderWidth: 1, borderStyle: 'solid' }} />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: '#0D1217B3' }}>
            <span>WASM (if available)</span>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 h-6 text-[11px] font-medium"
                style={{ background: '#AEE6FF', color: '#0D1217', border: '1px solid rgba(13,18,23,0.10)' }}
              >
                {Math.round(wasmFps)} FPS
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 h-6 text-[11px] font-medium"
                style={{ background: '#AEE6FF', color: '#0D1217', border: '1px solid rgba(13,18,23,0.10)' }}
              >
                {wasmPts.toLocaleString()} pts
              </span>
            </div>
          </div>
          <canvas ref={wasmCanvas} className="rounded bg-white" style={{ borderColor: '#BFE2F5', borderWidth: 1, borderStyle: 'solid' }} />
        </div>
      </div>
    </div>
  );
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
    <div className="font-sans min-h-screen p-8 sm:p-16" style={{ background: '#FFFDF7' }}>
      <main className="mx-auto max-w-[1100px] flex flex-col gap-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: '#0D1217' }}>Playground</h1>
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 h-8 text-sm"
              style={{
                background: (wasmReady && wasmUsed) ? '#AEE6FF' : '#FFCCD5',
                color: '#0D1217',
                border: '1px solid rgba(13,18,23,0.10)'
              }}
            >
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#0D1217' }} />
              {(wasmReady && wasmUsed) ? "WASM Active" : "JS Only"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onInitWasm} disabled={initializing} className="shadow-sm" style={{ background: '#0D1217', color: '#FFFDF7' }}>
              {initializing ? "Initializing WASM…" : "Init WASM"}
            </Button>
            <a href="/">
              <Button variant="outline" className="shadow-sm" style={{ borderColor: '#BFE2F5', color: '#0D1217', background: '#FFFDF7' }}>← Back</Button>
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

        <section>
          <ParticleCompare onUsed={() => setWasmUsed(true)} />
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
    <div className="rounded-lg border p-4 min-h-[320px] relative overflow-hidden" style={{ overscrollBehavior: "contain", background: '#FFFDF7', borderColor: '#BFE2F5' }}>
      <h2 className="font-semibold mb-2" style={{ color: '#0D1217' }}>Droppable</h2>
      <p className="text-sm mb-3" style={{ color: '#0D1217B3' }}>Drag the tag into the dropzone.</p>
      <div
        ref={zoneRef}
        className="absolute right-6 bottom-6 h-28 w-40 rounded-md border text-sm grid place-items-center transition-colors"
        style={{
          borderColor: (over || dropped) ? '#AEE6FF' : '#BFE2F5',
          background: (over || dropped) ? '#AEE6FF' : '#FFFDF7',
          color: '#0D1217'
        }}
      >
        Drop here
      </div>
      <div
        ref={dragRef}
        {...drag.bind}
        onPointerUp={onDrop}
        className="rounded-md px-3 py-2 select-none shadow inline-block"
        style={{ ...(drag.bind as any).style, position: "absolute", left: drag.x, top: drag.y, background: '#0D1217', color: '#FFFDF7' }}
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
        // Prevent parent draggable from starting while resizing
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as any).setPointerCapture?.(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY };
        orig.current = box;
      };
      const onPointerMove = (e: React.PointerEvent) => {
        if (e.buttons === 0) return;
        e.preventDefault();
        e.stopPropagation();
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
      const onPointerUp = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try { (e.currentTarget as any).releasePointerCapture?.(e.pointerId); } catch {}
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
          onPointerUp={onPointerUp}
          className="absolute w-4 h-4 rounded-sm"
          style={{ ...pos, position: "absolute", touchAction: "none", userSelect: "none", background: '#0D1217' }}
        />
      );
    };
  }, [box]);

  const drag = useDraggable({
    initial: { x: box.x, y: box.y },
    onMove: (p) => setBox((b) => ({ ...b, x: p.x, y: p.y })),
  });

  return (
    <div ref={stageRef} className="rounded-lg border p-4 min-h-[320px] relative overflow-hidden" style={{ overscrollBehavior: "contain", background: '#FFFDF7', borderColor: '#BFE2F5' }}>
      <h2 className="font-semibold mb-2" style={{ color: '#0D1217' }}>Multi‑handle Resizer</h2>
      <p className="text-sm mb-3" style={{ color: '#0D1217B3' }}>Drag the box or resize from any corner.</p>

      <div
        {...drag.bind}
        className="absolute rounded-md select-none shadow grid place-items-center border"
        style={{ ...(drag.bind as any).style, left: box.x, top: box.y, width: box.w, height: box.h, background: 'linear-gradient(135deg, #FFF8CC, #BFE2F5)', borderColor: '#BFE2F5' }}
      >
        <span className="text-sm" style={{ color: '#0D1217' }}>Drag or resize</span>
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
    <div className="rounded-lg border p-4 relative overflow-hidden" style={{ background: '#FFFDF7', borderColor: '#BFE2F5' }}>
      <h2 className="font-semibold mb-2" style={{ color: '#0D1217' }}>Pinch / Wheel Zoom</h2>
      <p className="text-sm mb-3" style={{ color: '#0D1217B3' }}>Use two‑finger pinch (touch) or Ctrl/⌘ + wheel (mouse).</p>
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
          className="absolute left-0 top-0 origin-top-left w-[320px] h-[320px] rounded-md bg-[url('/next.svg')] bg-no-repeat bg-center bg-contain border"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, borderColor: '#BFE2F5' }}
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
    <div className="rounded-lg border p-4 relative overflow-hidden" style={{ overscrollBehavior: 'contain', background: '#FFFDF7', borderColor: '#BFE2F5' }}>
      <h2 className="font-semibold mb-2" style={{ color: '#0D1217' }}>Image Resizer (WASM)</h2>
      <p className="text-sm mb-3" style={{ color: '#0D1217B3' }}>Rasterizes <code>next.svg</code> to RGBA, stores in WASM, and resizes with bilinear.</p>
      <div className="flex items-center gap-2 mb-3">
        <Button onClick={onResize} className="shadow-sm" style={{ background: '#0D1217', color: '#FFFDF7' }}>Resize with WASM</Button>
        <span className="text-sm" style={{ color: '#0D1217B3' }}>{status}</span>
      </div>
      <div className="flex gap-6">
        <div>
          <div className="text-xs mb-1" style={{ color: '#0D1217B3' }}>Input</div>
          <canvas ref={inRef} className="border rounded" style={{ borderColor: '#BFE2F5' }} />
        </div>
        <div>
          <div className="text-xs mb-1" style={{ color: '#0D1217B3' }}>Output</div>
          <canvas ref={outRef} className="border rounded" style={{ borderColor: '#BFE2F5' }} />
        </div>
      </div>
    </div>
  );
}
