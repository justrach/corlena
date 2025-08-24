"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  init as wasmInit,
  isReady as wasmIsReady,
  setConstraints as wasmSetConstraints,
  setParticleParams as wasmSetParticleParams,
  processFrame as wasmProcessFrame,
  spawnParticles as wasmSpawnParticles,
  clearParticles as wasmClearParticles,
} from "corlena/wasm";

// Image layer model
type ImgLayer = { id: number; img: HTMLImageElement; x: number; y: number; w: number; h: number };
// Text overlay model
interface TextNode {
  id: number;
  text: string;
  x: number; // CSS px in canvas logical units
  y: number;
  fontFamily: string;
  fontSize: number; // px
  fontWeight: number | string;
  color: string;
  align: CanvasTextAlign;
}

type Pointer = { x: number; y: number };

type MetricsExt = TextMetrics & {
  actualBoundingBoxAscent?: number;
  actualBoundingBoxDescent?: number;
};

function getAscentDescent(m: TextMetrics, fontSize: number): { ascent: number; descent: number } {
  const ext = m as MetricsExt;
  const ascent = ext.actualBoundingBoxAscent ?? fontSize * 0.8;
  const descent = ext.actualBoundingBoxDescent ?? fontSize * 0.2;
  return { ascent, descent };
}

export default function IGPage() {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number>(0);
  const pointersRef = useRef<Map<number, Pointer>>(new Map());

  // Local state
  const [imgs, setImgs] = useState<ImgLayer[]>([]);
  const [texts, setTexts] = useState<TextNode[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [draggingType, setDraggingType] = useState<"text" | "image" | null>(null);
  const [dragDX, setDragDX] = useState(0);
  const [dragDY, setDragDY] = useState(0);
  const [moved, setMoved] = useState(0);
  const [dropActive, setDropActive] = useState(false);
  const [particlesEnabled, setParticlesEnabled] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);
  const [hudInteracting, setHudInteracting] = useState(false);
  // Debug UI state
  const [pCount, setPCount] = useState(0);

  // Pinch state
  const pinchState = useRef({
    active: false,
    startDist: 0,
    startCenter: { x: 0, y: 0 },
    targetType: null as null | "text" | "image",
    targetId: null as number | null,
    // text
    startFontSize: 0,
    startTextX: 0,
    startTextY: 0,
    // image
    startImg: { w: 0, h: 0, x: 0, y: 0, relX: 0, relY: 0 },
  });

  // Other refs
  const nextIdRef = useRef(1);
  const lastTimeRef = useRef(0);
  const particleBufRef = useRef<Float32Array>(new Float32Array(0));
  const interactingRef = useRef(false);
  const justOpenedRef = useRef(false);
  const logFrameRef = useRef(0);

  // Selection helpers and overlay positioning (defined early to avoid TDZ issues)
  const getSelectedText = useCallback((): TextNode | null => {
    if (editingId != null) return texts.find((t) => t.id === editingId) || null;
    if (draggingType === "text" && draggingId != null) return texts.find((t) => t.id === draggingId) || null;
    return texts.length ? texts[texts.length - 1] : null;
  }, [draggingId, draggingType, editingId, texts]);

  const positionInputOverNode = useCallback(() => {
    const input = inputRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!input || !canvas || editingId == null || !ctx) return;
    const T = texts.find((t) => t.id === editingId);
    if (!T) return;
    ctx.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
    ctx.textAlign = T.align;
    const measureText = (editingValue ?? T.text) || " ";
    const metrics = ctx.measureText(measureText);
    const width = Math.max(60, metrics.width + 16);
    const { ascent, descent } = getAscentDescent(metrics, T.fontSize);
    const height = ascent + descent;
    let left = T.x;
    if (T.align === "center") left = T.x - width / 2;
    else if (T.align === "right" || T.align === "end") left = T.x - width;
    const top = T.y - ascent;
    const rect = canvas.getBoundingClientRect();
    input.style.display = "block";
    input.style.position = "fixed";
    input.style.left = `${Math.round(rect.left + left - 8)}px`;
    input.style.top = `${Math.round(rect.top + top - 8)}px`;
    input.style.width = `${Math.round(width + 16)}px`;
    input.style.height = `${Math.round(height + 16)}px`;
    input.style.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
    input.style.color = "transparent";
    input.style.setProperty("-webkit-text-fill-color", "transparent");
    input.style.caretColor = T.color;
    if (input.value !== editingValue) input.value = editingValue;
    if (justOpenedRef.current) {
      input.focus();
      input.select();
      justOpenedRef.current = false;
    }
  }, [editingId, editingValue, texts]);

  const positionHud = useCallback(() => {
    const hud = hudRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!hud || !canvas) return;
    const sel = getSelectedText();
    if (editingId == null || !sel || !ctx) { hud.style.display = "none"; return; }
    ctx.font = `${sel.fontWeight} ${sel.fontSize}px ${sel.fontFamily}`;
    ctx.textAlign = sel.align;
    const m = ctx.measureText((sel.id === editingId ? editingValue : sel.text) || " ");
    const width = Math.max(1, m.width);
    const { ascent } = getAscentDescent(m, sel.fontSize);
    const leftBase = sel.align === "center" ? sel.x - width / 2 : (sel.align === "right" || sel.align === "end" ? sel.x - width : sel.x);
    const topBase = sel.y - ascent;
    const rect = canvas.getBoundingClientRect();
    const hudX = Math.max(6, Math.min(rect.left + leftBase + width / 2 - 48, rect.right - 96 - 6));
    const hudY = rect.top + topBase - 40;
    hud.style.display = "flex";
    hud.style.position = "fixed";
    hud.style.left = `${Math.round(hudX)}px`;
    hud.style.top = `${Math.round(hudY)}px`;
  }, [editingId, editingValue, getSelectedText]);

  const canvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { wCss: 0, hCss: 0, dpr: 1 };
    const dpr = Math.max(1, (window.devicePixelRatio || 1));
    const wCss = canvas.clientWidth;
    const hCss = canvas.clientHeight;
    return { wCss, hCss, dpr };
  }, []);

  // Compose once on content change for immediate feedback
  useEffect(() => { compose(); }, [imgs, texts]);

  // Respond to particles toggle: spawn a small burst for visibility; clear on disable
  useEffect(() => {
    if (!wasmReady) return;
    if (particlesEnabled) {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const cx = rect ? rect.width / 2 : 180;
      const cy = rect ? rect.height * 0.25 : 120;
      const N = 30;
      const data = new Float32Array(N * 6);
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const speed = 150 + Math.random() * 150;
        const vx = Math.cos(ang) * speed;
        const vy = Math.sin(ang) * speed;
        const base = i * 6;
        data[base + 0] = cx;
        data[base + 1] = cy;
        data[base + 2] = vx;
        data[base + 3] = vy;
        data[base + 4] = 2 + Math.random() * 2.5;
        data[base + 5] = 1 + Math.random() * 0.8;
      }
      try { wasmSpawnParticles(data); } catch {}
    } else {
      try { wasmClearParticles(); } catch {}
    }
  }, [particlesEnabled, wasmReady]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const { wCss, hCss, dpr } = canvasSize();
    canvas.width = Math.floor(wCss * dpr);
    canvas.height = Math.floor(hCss * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Reposition overlays
    if (editingId != null) positionInputOverNode();
    positionHud();
    if (wasmReady) {
      wasmSetConstraints(new Float32Array([0, 0, wCss, hCss, 1, 1, 0, 0.999]));
    }
  }, [canvasSize, editingId, wasmReady, positionHud, positionInputOverNode]);

  const compose = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    // Images
    for (const L of imgs) {
      try { ctx.drawImage(L.img, L.x, L.y, L.w, L.h); } catch {}
    }
    // Particles
    const particleBuf = particleBufRef.current;
    if (particlesEnabled && particleBuf && particleBuf.length >= 6) {
      const stride = 6;
      ctx.save();
      ctx.fillStyle = "#fff";
      for (let i = 0; i < particleBuf.length; i += stride) {
        const x = particleBuf[i + 0];
        const y = particleBuf[i + 1];
        const r = Math.max(0.5, particleBuf[i + 4]);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // Texts
    for (const T of texts) {
      ctx.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
      ctx.textAlign = T.align;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = T.color;
      const x = T.x;
      const y = T.y;
      const displayText = T.id === editingId ? editingValue : T.text;
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 4;
      ctx.lineWidth = 2;
      ctx.fillText(displayText, x, y);
      ctx.shadowBlur = 0;

      if (T.id === editingId || T.id === draggingId) {
        const metrics = ctx.measureText(displayText || " ");
        const width = metrics.width;
        const { ascent, descent } = getAscentDescent(metrics, T.fontSize);
        const height = ascent + descent;
        let left = x;
        if (T.align === "center") left = x - width / 2;
        else if (T.align === "right" || T.align === "end") left = x - width;
        const top = y - ascent;
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.strokeRect(left - 6, top - 6, width + 12, height + 12);
      }
    }
    // Debug overlay
    ctx.save();
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#9AE6B4";
    const pc = (particleBufRef.current.length / 6) | 0;
    ctx.fillText(`imgs:${imgs.length} texts:${texts.length} p:${pc}`, 6, 14);
    ctx.restore();
  }, [imgs, texts, editingId, editingValue, draggingId, particlesEnabled]);

  const loop = useCallback(() => {
    const now = performance.now();
    const last = lastTimeRef.current;
    const dt = last ? Math.min(0.032, (now - last) / 1000) : 0;
    lastTimeRef.current = now;
    if (wasmReady && particlesEnabled) {
      const out = wasmProcessFrame({ dt: Number(dt) });
      particleBufRef.current = out.particles || new Float32Array(0);
    } else {
      particleBufRef.current = new Float32Array(0);
    }
    compose();
    // Debug: log particles roughly once per second and update UI count
    logFrameRef.current++;
    if (logFrameRef.current % 60 === 0) {
      // eslint-disable-next-line no-console
      console.log("loop: particles=", (particleBufRef.current.length / 6) | 0, "wasmReady=", wasmReady, "enabled=", particlesEnabled);
    }
    if (logFrameRef.current % 20 === 0) setPCount((particleBufRef.current.length / 6) | 0);
    rafRef.current = requestAnimationFrame(loop);
  }, [compose, particlesEnabled, wasmReady]);

  // Ensure RAF picks up latest closure changes (imgs/texts/flags)
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = canvas.getContext("2d");
    const onResize = () => resize();
    resize();
    window.addEventListener("resize", onResize);

    // Prevent document-level drag/drop navigation
    const onWinDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    const onWinDrop = (e: DragEvent) => { e.preventDefault(); };
    window.addEventListener("dragover", onWinDragOver);
    window.addEventListener("drop", onWinDrop);

    // Commit edit when clicking outside input/HUD
    const onDocPointerDown = (e: PointerEvent) => {
      if (editingId == null) return;
      const path = (e.composedPath && e.composedPath()) || [];
      if (inputRef.current && (path as EventTarget[]).includes(inputRef.current)) return;
      if (hudRef.current && (path as EventTarget[]).includes(hudRef.current)) return;
      stopEdit(true);
    };
    window.addEventListener("pointerdown", onDocPointerDown, true);

    // Init WASM physics after mount
    (async () => {
      try {
        await wasmInit(512);
        const ok = wasmIsReady();
        setWasmReady(ok);
        // eslint-disable-next-line no-console
        console.log("wasm init ok:", ok);
        if (ok) {
          const { wCss, hCss } = canvasSize();
          wasmSetConstraints(new Float32Array([0, 0, wCss, hCss, 1, 1, 0, 0.999]));
          // gravityX, gravityY, damping, restitution
          wasmSetParticleParams(new Float32Array([0, 900, 0.995, 0.6]));
        }
      } catch {}
    })();

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("dragover", onWinDragOver);
      window.removeEventListener("drop", onWinDrop);
      window.removeEventListener("pointerdown", onDocPointerDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // moved earlier

  const updateSelectedText = useCallback(
    (mut: (t: TextNode) => TextNode) => {
      const sel = getSelectedText();
      if (!sel) return;
      setTexts((prev) => prev.map((t) => (t.id === sel.id ? mut(t) : t)));
      if (editingId === sel.id) positionInputOverNode();
      positionHud();
    },
    [editingId, getSelectedText, positionHud, positionInputOverNode]
  );

  const adjustFont = useCallback((delta: number) => {
    updateSelectedText((t) => ({ ...t, fontSize: Math.max(0.1, t.fontSize + delta) }));
  }, [updateSelectedText]);

  const setColor = useCallback((color: string) => {
    updateSelectedText((t) => ({ ...t, color }));
  }, [updateSelectedText]);

  // moved earlier

  // moved earlier

  const addImagesFromFiles = useCallback(async (files: File[]) => {
    // eslint-disable-next-line no-console
    console.log("addImagesFromFiles:", files?.length || 0);
    for (const file of files) {
      if (!file || !file.type?.startsWith("image/")) continue;
      // Use FileReader to avoid any blob URL lifecycle issues
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(new Error("read failed"));
        fr.onload = () => resolve(String(fr.result || ""));
        fr.readAsDataURL(file);
      });
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = dataUrl;
      });
      const canvas = canvasRef.current;
      const frameW = canvas?.clientWidth || 360;
      const frameH = canvas?.clientHeight || 640;
      const scale = Math.min(frameW / img.naturalWidth, frameH / img.naturalHeight);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const x = Math.round((frameW - w) / 2);
      const y = Math.round((frameH - h) / 2);
      const id = nextIdRef.current++;
      setImgs((prev) => [...prev, { id, img, x, y, w, h }]);
      // eslint-disable-next-line no-console
      console.log("added image layer", { id, w, h, x, y });
    }
  }, []);

  const onUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    // eslint-disable-next-line no-console
    console.log("onUpload files:", files.length);
    await addImagesFromFiles(files);
    e.target.value = "";
  }, [addImagesFromFiles]);

  const startEdit = useCallback((node: TextNode) => {
    setEditingId(node.id);
    setEditingValue(node.text);
    justOpenedRef.current = true;
    queueMicrotask(positionInputOverNode);
    queueMicrotask(positionHud);
  }, [positionHud, positionInputOverNode]);

  const addText = useCallback(() => {
    const canvas = canvasRef.current;
    const frameW = canvas?.clientWidth || 360;
    const frameH = canvas?.clientHeight || 640;
    const node: TextNode = {
      id: nextIdRef.current++,
      text: "Tap to edit",
      x: Math.round(frameW / 2),
      y: Math.round(frameH / 2),
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
      fontSize: 28,
      fontWeight: 700,
      color: "#fff",
      align: "center",
    };
    setTexts((prev) => [...prev, node]);
    startEdit(node);
    queueMicrotask(positionHud);
  }, [positionHud, startEdit]);

  // moved earlier

  const stopEdit = useCallback((commit: boolean) => {
    setTexts((prev) => {
      if (editingId == null || !commit) return prev;
      return prev.map((t) => (t.id === editingId ? { ...t, text: editingValue } : t));
    });
    setEditingId(null);
    const input = inputRef.current;
    if (input) {
      input.style.display = "none";
      input.blur();
    }
    queueMicrotask(positionHud);
  }, [editingId, editingValue, positionHud]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    if (editingId != null) stopEdit(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMoved(0);
    setDraggingId(null);
    setDraggingType(null);

    // Track pointer for pinch
    pointersRef.current.set(e.pointerId, { x, y });
    interactingRef.current = true;

    // If two pointers active, start pinch
    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      pinchState.current.startCenter = { x: cx, y: cy };
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchState.current.startDist = Math.max(1, Math.hypot(dx, dy));
      // choose target at center (text on top of images)
      pinchState.current.targetType = null;
      pinchState.current.targetId = null;

      // hit test texts top-most
      for (let i = texts.length - 1; i >= 0; i--) {
        const T = texts[i];
        ctx.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
        ctx.textAlign = T.align;
        const m = ctx.measureText(T.text || " ");
        const width = Math.max(1, m.width);
        const { ascent, descent } = getAscentDescent(m, T.fontSize);
        const height = ascent + descent;
        let left = T.x;
        if (T.align === "center") left = T.x - width / 2;
        else if (T.align === "right" || T.align === "end") left = T.x - width;
        const top = T.y - ascent;
        if (cx >= left - 8 && cx <= left + width + 8 && cy >= top - 8 && cy <= top + height + 8) {
          pinchState.current.targetType = "text";
          pinchState.current.targetId = T.id;
          pinchState.current.startFontSize = T.fontSize;
          pinchState.current.startTextX = T.x;
          pinchState.current.startTextY = T.y;
          break;
        }
      }
      if (!pinchState.current.targetType) {
        // hit test images
        for (let i = imgs.length - 1; i >= 0; i--) {
          const L = imgs[i];
          if (cx >= L.x && cx <= L.x + L.w && cy >= L.y && cy <= L.y + L.h) {
            pinchState.current.targetType = "image";
            pinchState.current.targetId = L.id;
            pinchState.current.startImg = {
              w: L.w,
              h: L.h,
              x: L.x,
              y: L.y,
              relX: (cx - L.x) / Math.max(1, L.w),
              relY: (cy - L.y) / Math.max(1, L.h),
            };
            break;
          }
        }
      }
      // fallback: current dragging/editing text
      if (!pinchState.current.targetType) {
        if (draggingType === "text" && draggingId != null) {
          const t = texts.find((n) => n.id === draggingId);
          if (t) {
            pinchState.current.targetType = "text";
            pinchState.current.targetId = t.id;
            pinchState.current.startFontSize = t.fontSize;
            pinchState.current.startTextX = t.x;
            pinchState.current.startTextY = t.y;
          }
        } else if (editingId != null) {
          const t = texts.find((n) => n.id === editingId);
          if (t) {
            pinchState.current.targetType = "text";
            pinchState.current.targetId = t.id;
            pinchState.current.startFontSize = t.fontSize;
            pinchState.current.startTextX = t.x;
            pinchState.current.startTextY = t.y;
          }
        }
      }
      pinchState.current.active = !!pinchState.current.targetType;
      e.preventDefault();
      try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
      return;
    }

    // Prefer text hits first (top-most)
    for (let i = texts.length - 1; i >= 0; i--) {
      const T = texts[i];
      ctx.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
      ctx.textAlign = T.align;
      const m = ctx.measureText(T.text || " ");
      const width = Math.max(1, m.width);
      const { ascent, descent } = getAscentDescent(m, T.fontSize);
      const height = ascent + descent;
      let left = T.x;
      if (T.align === "center") left = T.x - width / 2;
      else if (T.align === "right" || T.align === "end") left = T.x - width;
      const top = T.y - ascent;
      if (x >= left - 8 && x <= left + width + 8 && y >= top - 8 && y <= top + height + 8) {
        setDraggingId(T.id);
        setDraggingType("text");
        setDragDX(x - T.x);
        setDragDY(y - T.y);
        e.preventDefault();
        try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
        return;
      }
    }
    // Hit-test images next
    for (let i = imgs.length - 1; i >= 0; i--) {
      const L = imgs[i];
      if (x >= L.x && x <= L.x + L.w && y >= L.y && y <= L.y + L.h) {
        setDraggingId(L.id);
        setDraggingType("image");
        setDragDX(x - L.x);
        setDragDY(y - L.y);
        e.preventDefault();
        try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
        return;
      }
    }
  }, [draggingId, draggingType, editingId, imgs, texts, stopEdit]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update tracked pointer
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x, y });
    }

    // Pinch
    if (pinchState.current.active && pointersRef.current.size >= 2 && pinchState.current.targetType && pinchState.current.targetId != null) {
      const pts = Array.from(pointersRef.current.values()).slice(0, 2);
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const scale = dist / Math.max(1, pinchState.current.startDist);

      if (pinchState.current.targetType === "text") {
        setTexts((prev) => prev.map((t) => {
          if (t.id !== pinchState.current.targetId) return t;
          const newSize = Math.max(0.1, pinchState.current.startFontSize * scale);
          const nx = cx;
          const ny = cy;
          return { ...t, fontSize: newSize, x: Math.round(nx), y: Math.round(ny) };
        }));
        positionHud();
      } else if (pinchState.current.targetType === "image") {
        setImgs((prev) => prev.map((L) => {
          if (L.id !== pinchState.current.targetId) return L;
          const newW = Math.max(16, Math.round(pinchState.current.startImg.w * scale));
          const newH = Math.max(16, Math.round(pinchState.current.startImg.h * scale));
          const nx = Math.round(cx - pinchState.current.startImg.relX * newW);
          const ny = Math.round(cy - pinchState.current.startImg.relY * newH);
          return { ...L, w: newW, h: newH, x: nx, y: ny };
        }));
      }
      e.preventDefault();
      return;
    }

    // Regular drag
    if (draggingId == null || !draggingType) return;
    setMoved((prev) => Math.max(prev, Math.hypot(x - (x - dragDX), y - (y - dragDY))));
    if (draggingType === "text") {
      setTexts((prev) => prev.map((t) => (t.id === draggingId ? { ...t, x: Math.round(x - dragDX), y: Math.round(y - dragDY) } : t)));
      positionHud();
    } else if (draggingType === "image") {
      setImgs((prev) => prev.map((L) => (L.id === draggingId ? { ...L, x: Math.round(x - dragDX), y: Math.round(y - dragDY) } : L)));
    }
  }, [dragDX, dragDY, draggingId, draggingType, positionHud]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const px = rect ? e.clientX - rect.left : 0;
    const py = rect ? e.clientY - rect.top : 0;

    // Remove from tracked pointers
    pointersRef.current.delete(e.pointerId);
    if (pinchState.current.active && pointersRef.current.size < 2) {
      pinchState.current.active = false; pinchState.current.targetType = null; pinchState.current.targetId = null;
    }

    if (draggingId != null && draggingType === "text") {
      if (moved < 4) {
        const t = texts.find((n) => n.id === draggingId);
        if (t) startEdit(t);
      }
    }
    setDraggingId(null);
    setDraggingType(null);
    setMoved(0);
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch {}
    positionHud();
    interactingRef.current = pointersRef.current.size > 0;

    if (particlesEnabled && wasmReady && rect) {
      const N = 24;
      const data = new Float32Array(N * 6);
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const speed = 250 + Math.random() * 250;
        const vx = Math.cos(ang) * speed + (Math.random() - 0.5) * 60;
        const vy = Math.sin(ang) * speed + (Math.random() - 0.5) * 60;
        const r = 2 + Math.random() * 2.5;
        const life = 1.2 + Math.random() * 0.6;
        const base = i * 6;
        data[base + 0] = px;
        data[base + 1] = py;
        data[base + 2] = vx;
        data[base + 3] = vy;
        data[base + 4] = r;
        data[base + 5] = life;
      }
      // eslint-disable-next-line no-console
      console.log("spawnParticles at:", { x: px, y: py }, "N=", N);
      try { wasmSpawnParticles(data); } catch (err) { console.error("spawnParticles error", err); }
    }
  }, [draggingId, draggingType, moved, particlesEnabled, startEdit, texts, wasmReady, positionHud]);

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pinchState.current.active && pointersRef.current.size < 2) {
      pinchState.current.active = false; pinchState.current.targetType = null; pinchState.current.targetId = null;
    }
    setDraggingId(null);
    setDraggingType(null);
    setMoved(0);
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch {}
    interactingRef.current = pointersRef.current.size > 0;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dz = -e.deltaY;
    const scale = Math.exp(dz * 0.0015);

    let handled = false;
    if (!handled && draggingType === "text" && draggingId != null) {
      setTexts((prev) => prev.map((t) => (t.id === draggingId ? { ...t, fontSize: Math.max(0.1, t.fontSize * scale), x: Math.round(x), y: Math.round(y) } : t)));
      handled = true;
    }
    if (!handled && editingId != null) {
      setTexts((prev) => prev.map((t) => (t.id === editingId ? { ...t, fontSize: Math.max(0.1, t.fontSize * scale), x: Math.round(x), y: Math.round(y) } : t)));
      handled = true;
    }
    if (!handled) {
      // text hit tests
      for (let i = texts.length - 1; i >= 0; i--) {
        const T = texts[i];
        ctx.font = `${T.fontWeight} ${T.fontSize}px ${T.fontFamily}`;
        ctx.textAlign = T.align;
        const m = ctx.measureText(T.text || " ");
        const width = Math.max(1, m.width);
        const { ascent, descent } = getAscentDescent(m, T.fontSize);
        const height = ascent + descent;
        let left = T.x;
        if (T.align === "center") left = T.x - width / 2;
        else if (T.align === "right" || T.align === "end") left = T.x - width;
        const top = T.y - ascent;
        if (x >= left - 8 && x <= left + width + 8 && y >= top - 8 && y <= top + height + 8) {
          const newSize = Math.max(0.1, T.fontSize * scale);
          setTexts((prev) => prev.map((t) => (t.id === T.id ? { ...t, fontSize: newSize, x: Math.round(x), y: Math.round(y) } : t)));
          handled = true;
          break;
        }
      }
    }
    if (!handled) {
      // images
      for (let i = imgs.length - 1; i >= 0; i--) {
        const L = imgs[i];
        if (x >= L.x && x <= L.x + L.w && y >= L.y && y <= L.y + L.h) {
          const relX = (x - L.x) / Math.max(1, L.w);
          const relY = (y - L.y) / Math.max(1, L.h);
          const newW = Math.max(16, Math.round(L.w * scale));
          const newH = Math.max(16, Math.round(L.h * scale));
          const nx = Math.round(x - relX * newW);
          const ny = Math.round(y - relY * newH);
          setImgs((prev) => prev.map((img) => (img.id === L.id ? { ...img, w: newW, h: newH, x: nx, y: ny } : img)));
          handled = true;
          break;
        }
      }
    }
    if (handled) {
      e.preventDefault();
      positionHud();
    }
  }, [draggingId, draggingType, editingId, imgs, positionHud, texts]);

  // Drag & drop overlay handlers on frame
  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropActive(true);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropActive(false);
  }, []);
  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropActive(false);
    const dt = e.dataTransfer;
    const files = dt?.files ? Array.from(dt.files) : [];
    if (files.length) await addImagesFromFiles(files);
  }, [addImagesFromFiles]);

  // Export PNG
  const exportBlob = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = "ig-canvas.png";
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, []);

  return (
    <div className="font-sans min-h-screen p-8 sm:p-16" style={{ background: '#FFFDF7' }}>
      <main className="mx-auto max-w-[1100px] flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: '#0D1217' }}>IG Composer</h1>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" accept="image/*" multiple onChange={onUpload} />
            <Button onClick={addText}>Add Text</Button>
            <Button variant="outline" onClick={exportBlob}>Export PNG</Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => adjustFont(-2)} title="Smaller">A-</Button>
              <Button variant="outline" onClick={() => adjustFont(+2)} title="Larger">A+</Button>
              <input
                type="color"
                onInput={(e) => setColor((e.target as HTMLInputElement).value)}
                onChange={(e) => setColor((e.target as HTMLInputElement).value)}
                title="Text color"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={particlesEnabled} onChange={(e) => setParticlesEnabled(e.target.checked)} />
                <span>Particles</span>
              </label>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 h-8 text-sm border`}
                style={{
                  background: (wasmReady && particlesEnabled) ? '#AEE6FF' : '#FFCCD5',
                  color: '#0D1217',
                  border: '1px solid rgba(13,18,23,0.10)'
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: (wasmReady && particlesEnabled) ? '#0EA5E9' : '#E11D48' }}
                />
                {(wasmReady && particlesEnabled) ? "WASM Active" : "JS Only"}
                <span className="text-xs opacity-60 ml-1">({pCount})</span>
              </span>
            </div>
            <span className="text-sm" style={{ color: '#0D1217B3' }}>9:16 canvas. Drag text to position. Click text to edit.</span>
          </div>
        </section>

        <section className="flex justify-start">
          <div
            ref={frameRef}
            role="region"
            aria-label="Canvas drop zone: drop images to add"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className="relative w-full max-w-[420px] rounded-lg overflow-hidden border"
            style={{ aspectRatio: '9 / 16', borderColor: '#BFE2F5', background: '#000', overscrollBehavior: 'contain', overscrollBehaviorY: 'contain' }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onPointerLeave={onPointerCancel}
              onWheel={onWheel}
              style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', background: '#000' }}
            />
            {dropActive && (
              <div className="absolute inset-0 grid place-items-center select-none" style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 600, letterSpacing: 0.3, pointerEvents: 'none', zIndex: 5 }}>
                Drop images to add
              </div>
            )}
          </div>
        </section>

        {/* Text input overlay */}
        <input
          ref={inputRef}
          className="edit-input"
          onBlur={() => {
            if (hudInteracting) { queueMicrotask(() => inputRef.current?.focus()); return; }
            stopEdit(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); stopEdit(true); }
            if (e.key === "Escape") { e.preventDefault(); stopEdit(false); }
          }}
          onInput={(e) => { const v = (e.target as HTMLInputElement).value; setEditingValue(v); positionInputOverNode(); positionHud(); }}
          style={{ position: "fixed", zIndex: 10, display: "none", padding: 8, borderRadius: 8, border: 0, background: "transparent", outline: "none" }}
        />

        {/* HUD overlay */}
        <div
          ref={hudRef}
          role="toolbar"
          aria-label="Text controls"
          onPointerDown={() => setHudInteracting(true)}
          onPointerUp={() => setHudInteracting(false)}
          onPointerCancel={() => setHudInteracting(false)}
          onPointerLeave={() => setHudInteracting(false)}
          style={{ position: "fixed", zIndex: 11, display: "none", gap: 6, alignItems: "center", padding: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(24,24,24,0.8)", backdropFilter: "blur(6px)" }}
        >
          <button onClick={() => adjustFont(-2)} title="Smaller">A-</button>
          <button onClick={() => adjustFont(+2)} title="Larger">A+</button>
          <input
            type="color"
            onTouchStart={() => setHudInteracting(true)}
            onMouseDown={() => setHudInteracting(true)}
            onClick={() => setHudInteracting(true)}
            onChange={(e) => setColor((e.target as HTMLInputElement).value)}
            style={{ width: 28, height: 28, padding: 0, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.6)", background: "transparent" }}
          />
        </div>
      </main>
    </div>
  );
}
