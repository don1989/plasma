import { describe, it, expect } from 'vitest';
import { rowFlowLayout } from '../../src/layout/row-flow.js';
import type { SlotRect } from '../../src/types/page-plan.js';

const canvas = { w: 1600, h: 2264 };
const margin = 60, gutter = 24;

function overlaps(a: SlotRect, b: SlotRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('rowFlowLayout', () => {
  it('gives a wide panel a full-width row and pairs portraits', () => {
    const slots = rowFlowLayout(
      [{ panelNumber: 1, aspectRatio: '16:9' }, { panelNumber: 2, aspectRatio: '3:4' }, { panelNumber: 3, aspectRatio: '1:1' }],
      { canvas, margin, gutter, emphasisPanel: 1, isSplash: false },
    );
    expect(slots.map((s) => s.panelNumber)).toEqual([1, 2, 3]);
    expect(slots[0]!.w).toBe(canvas.w - 2 * margin);
    expect(slots[1]!.y).toBe(slots[2]!.y);               // same row
    expect(slots[1]!.x + slots[1]!.w + gutter).toBe(slots[2]!.x);
    expect(slots[0]!.y + slots[0]!.h + gutter).toBe(slots[1]!.y);
  });

  it('never overlaps and fits inside the margins', () => {
    const panels = [1, 2, 3, 4, 5, 6].map((n) => ({ panelNumber: n, aspectRatio: n % 2 ? '3:4' : '1:1' } as const));
    const slots = rowFlowLayout(panels, { canvas, margin, gutter, emphasisPanel: 4, isSplash: false });
    for (const a of slots) {
      expect(a.x).toBeGreaterThanOrEqual(margin);
      expect(a.x + a.w).toBeLessThanOrEqual(canvas.w - margin + 1);
      expect(a.y + a.h).toBeLessThanOrEqual(canvas.h - margin + 1);
      for (const b of slots) if (a !== b) expect(overlaps(a, b)).toBe(false);
    }
    const last = slots[slots.length - 1]!;
    expect(last.y + last.h).toBeGreaterThanOrEqual(canvas.h - margin - 1); // fills the page
  });

  it('gives the emphasis row more height', () => {
    const base = [{ panelNumber: 1, aspectRatio: '3:4' }, { panelNumber: 2, aspectRatio: '3:4' }, { panelNumber: 3, aspectRatio: '3:4' }, { panelNumber: 4, aspectRatio: '3:4' }] as const;
    const a = rowFlowLayout([...base], { canvas, margin, gutter, emphasisPanel: 1, isSplash: false });
    const b = rowFlowLayout([...base], { canvas, margin, gutter, emphasisPanel: 3, isSplash: false });
    expect(a[0]!.h).toBeGreaterThan(a[2]!.h);
    expect(b[2]!.h).toBeGreaterThan(b[0]!.h);
  });

  it('splash pages get one full slot', () => {
    const slots = rowFlowLayout([{ panelNumber: 1, aspectRatio: '3:4' }], { canvas, margin, gutter, emphasisPanel: 1, isSplash: true });
    expect(slots).toHaveLength(1);
    expect(slots[0]!.h).toBe(canvas.h - 2 * margin);
  });

  it('leftover portrait panel takes a full row', () => {
    const slots = rowFlowLayout(
      [{ panelNumber: 1, aspectRatio: '3:4' }, { panelNumber: 2, aspectRatio: '3:4' }, { panelNumber: 3, aspectRatio: '3:4' }],
      { canvas, margin, gutter, emphasisPanel: 3, isSplash: false },
    );
    expect(slots[2]!.w).toBe(canvas.w - 2 * margin);
  });
});
