import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0f172a 0%, #111827 100%)",
          color: "white",
          padding: 64,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background:
                "linear-gradient(135deg, rgba(147,51,234,1) 0%, rgba(236,72,153,1) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            C×G
          </div>
          <div style={{ opacity: 0.9, fontSize: 24 }}>Corlena AI Canvas</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>
            Gemini + WASM Image Editing
          </div>
          <div style={{ fontSize: 28, opacity: 0.9, maxWidth: 900 }}>
            Figma‑grade canvas. Generate with Gemini 2.5 → edit as real layers on a Rust/WASM engine.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 24, opacity: 0.9 }}>gemini.corlena.dev</div>
          <div style={{ fontSize: 20, opacity: 0.7 }}>Next.js • TypeScript • Rust/WASM</div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

