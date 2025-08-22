// Geometry utils for pinch and resample anchoring. Pure and unit-testable.

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Pinch application anchored at centroid C: P = s_eff * (P0 - C0) + C
export function applyPinch(
  startX: number,
  startY: number,
  startScale: number,
  startCX: number,
  startCY: number,
  curCX: number,
  curCY: number,
  newScale: number
): { x: number; y: number } {
  const sEff = newScale / (startScale || 1);
  return {
    x: sEff * (startX - startCX) + curCX,
    y: sEff * (startY - startCY) + curCY,
  };
}

// Anchor a resize at an explicit point (ax, ay). Keeps the same UV under the anchor.
export function anchorResampleAtPoint(
  x: number,
  y: number,
  prevW: number,
  prevH: number,
  outW: number,
  outH: number,
  ax: number,
  ay: number
): { x: number; y: number } {
  if (prevW <= 0 || prevH <= 0) return { x, y };
  const u = (ax - x) / prevW;
  const v = (ay - y) / prevH;
  return {
    x: ax - u * outW,
    y: ay - v * outH,
  };
}

// Anchor a resize to preserve the visual center.
export function anchorResampleAtCenter(
  x: number,
  y: number,
  prevW: number,
  prevH: number,
  outW: number,
  outH: number
): { x: number; y: number } {
  const cx = x + prevW / 2;
  const cy = y + prevH / 2;
  return {
    x: cx - outW / 2,
    y: cy - outH / 2,
  };
}
