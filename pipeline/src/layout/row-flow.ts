/**
 * Row-flow page layout. Panels keep script order (left→right, top→bottom).
 * Wide panels take a full-width row; two consecutive portrait/square panels
 * share a row; a leftover portrait takes a full row. Row heights come from
 * weights, with the emphasis panel's row enlarged.
 */
import type { AspectRatio, SlotRect } from '../types/page-plan.js';

export interface LayoutPanel { panelNumber: number; aspectRatio: AspectRatio }
export interface LayoutOptions {
  canvas: { w: number; h: number };
  margin: number;
  gutter: number;
  emphasisPanel: number;
  isSplash: boolean;
}

interface Row { panels: LayoutPanel[]; weight: number }

const WIDE: ReadonlySet<AspectRatio> = new Set(['16:9', '4:3']);
const WEIGHT_WIDE = 1.0;
const WEIGHT_PORTRAIT = 1.3;
const EMPHASIS_MULT = 1.25;
const MAX_FLOW_PANELS = 7;

function buildRows(panels: LayoutPanel[], emphasisPanel: number): Row[] {
  const rows: Row[] = [];
  let i = 0;
  const forcePairs = panels.length > MAX_FLOW_PANELS;
  while (i < panels.length) {
    const p = panels[i]!;
    if (!forcePairs && WIDE.has(p.aspectRatio)) {
      rows.push({ panels: [p], weight: WEIGHT_WIDE });
      i += 1;
      continue;
    }
    const q = panels[i + 1];
    if (q && (forcePairs || !WIDE.has(q.aspectRatio))) {
      rows.push({ panels: [p, q], weight: WEIGHT_PORTRAIT });
      i += 2;
    } else {
      rows.push({ panels: [p], weight: WEIGHT_PORTRAIT });
      i += 1;
    }
  }
  for (const row of rows) {
    if (row.panels.some((p) => p.panelNumber === emphasisPanel)) row.weight *= EMPHASIS_MULT;
  }
  return rows;
}

export function rowFlowLayout(panels: LayoutPanel[], opts: LayoutOptions): SlotRect[] {
  const innerW = opts.canvas.w - 2 * opts.margin;
  const innerH = opts.canvas.h - 2 * opts.margin;
  if (panels.length === 0) return [];
  if (opts.isSplash || panels.length === 1) {
    return [{ panelNumber: panels[0]!.panelNumber, x: opts.margin, y: opts.margin, w: innerW, h: innerH }];
  }

  const rows = buildRows(panels, opts.emphasisPanel);
  const totalWeight = rows.reduce((n, r) => n + r.weight, 0);
  const usableH = innerH - opts.gutter * (rows.length - 1);

  const slots: SlotRect[] = [];
  let y = opts.margin;
  rows.forEach((row, idx) => {
    const isLast = idx === rows.length - 1;
    const h = isLast
      ? opts.canvas.h - opts.margin - y            // absorb rounding so the page fills exactly
      : Math.floor((usableH * row.weight) / totalWeight);
    const n = row.panels.length;
    const w = Math.floor((innerW - opts.gutter * (n - 1)) / n);
    row.panels.forEach((p, col) => {
      const isLastCol = col === n - 1;
      const x = opts.margin + col * (w + opts.gutter);
      slots.push({ panelNumber: p.panelNumber, x, y, w: isLastCol ? opts.canvas.w - opts.margin - x : w, h });
    });
    y += h + opts.gutter;
  });
  return slots;
}
