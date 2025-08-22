import { describe, it, expect } from 'vitest';
import { applyPinch, anchorResampleAtPoint, anchorResampleAtCenter } from './geom';

describe('applyPinch', () => {
  it('anchors at centroid when downscaling', () => {
    const start = { x: 100, y: 50, scale: 1 };
    const c0 = { x: 200, y: 100 };
    const c = { x: 200, y: 100 };
    const newScale = 0.5;
    const p = applyPinch(start.x, start.y, start.scale, c0.x, c0.y, c.x, c.y, newScale);
    expect(p.x).toBeCloseTo(150, 6);
    expect(p.y).toBeCloseTo(75, 6);
  });

  it('upscale then downscale returns to start when centroid unchanged', () => {
    const start = { x: 100, y: 50, scale: 1 };
    const c0 = { x: 200, y: 100 };
    const c = { x: 200, y: 100 };
    const up = applyPinch(start.x, start.y, start.scale, c0.x, c0.y, c.x, c.y, 2);
    const back = applyPinch(up.x, up.y, 2, c0.x, c0.y, c.x, c.y, 1);
    expect(back.x).toBeCloseTo(start.x, 6);
    expect(back.y).toBeCloseTo(start.y, 6);
  });
});

describe('anchorResample', () => {
  it('preserves UV under explicit anchor point', () => {
    const x = 100, y = 50;
    const prevW = 400, prevH = 300;
    const ax = 150, ay = 100;
    const outW = 200, outH = 150;
    const p = anchorResampleAtPoint(x, y, prevW, prevH, outW, outH, ax, ay);

    const uPrev = (ax - x) / prevW;
    const vPrev = (ay - y) / prevH;
    const uNew = (ax - p.x) / outW;
    const vNew = (ay - p.y) / outH;

    expect(uNew).toBeCloseTo(uPrev, 6);
    expect(vNew).toBeCloseTo(vPrev, 6);
  });

  it('preserves center when anchoring center', () => {
    const x = 100, y = 50;
    const prevW = 400, prevH = 300;
    const outW = 200, outH = 150;
    const p = anchorResampleAtCenter(x, y, prevW, prevH, outW, outH);
    const cx0 = x + prevW / 2;
    const cy0 = y + prevH / 2;
    const cx1 = p.x + outW / 2;
    const cy1 = p.y + outH / 2;
    expect(cx1).toBeCloseTo(cx0, 6);
    expect(cy1).toBeCloseTo(cy0, 6);
  });
});
