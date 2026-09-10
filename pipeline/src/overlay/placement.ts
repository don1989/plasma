/** Balloon placement inside a known panel rectangle. Pure: measurement is injected. */
import type { SlotRect, DialogueLinePlan } from '../types/page-plan.js';

export interface PlacedBalloon {
  index: number;
  text: string;
  type: 'speech' | 'thought' | 'narration';
  x: number; y: number; w: number; h: number;
  tail: 'left' | 'right' | 'none';
}

export interface PlacementInput {
  slot: SlotRect;
  dialogue: DialogueLinePlan[];
  speakerSides: Record<string, 'left' | 'right'>;
  /** Returns balloon body size (already including padding) for a line, given max width. */
  measure: (text: string, maxWidth: number) => Promise<{ width: number; height: number }>;
  inset: number;
  spacing: number;
  overrides?: Record<string, { dx: number; dy: number }>;
}

export async function placeBalloons(i: PlacementInput): Promise<PlacedBalloon[]> {
  const { slot } = i;
  const maxW = Math.min(Math.floor(slot.w * 0.45), 420);
  const cursor = { left: slot.y + i.inset, right: slot.y + i.inset, centre: slot.y + i.inset };
  const placed: PlacedBalloon[] = [];

  for (let idx = 0; idx < i.dialogue.length; idx++) {
    const d = i.dialogue[idx]!;
    const side: 'left' | 'right' | 'centre' = d.type === 'narration' ? 'centre' : (i.speakerSides[d.character] ?? 'centre');
    const width = side === 'centre' && d.type === 'narration' ? Math.min(Math.floor(slot.w * 0.6), 560) : maxW;
    const m = await i.measure(d.line, width);
    const w = Math.min(m.width, width);
    const h = m.height;

    let x: number;
    if (side === 'left') x = slot.x + i.inset;
    else if (side === 'right') x = slot.x + slot.w - i.inset - w;
    else x = Math.round(slot.x + (slot.w - w) / 2);

    let y = cursor[side];
    // Keep inside the slot vertically; if it would overflow, pin to the bottom inset.
    y = Math.min(y, slot.y + slot.h - i.inset - h);
    cursor[side] = y + h + i.spacing;

    const o = i.overrides?.[String(idx)];
    if (o) { x += o.dx; y += o.dy; }

    placed.push({ index: idx, text: d.line, type: d.type, x, y, w, h, tail: side === 'centre' ? 'none' : side });
  }
  return placed;
}
