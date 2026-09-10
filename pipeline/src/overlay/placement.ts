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

type Side = 'left' | 'right' | 'centre';

/**
 * Lay out dialogue balloons inside a slot, in dialogue order.
 *
 * Speaker-side balloons start at the top inset on their side and stack
 * downward; narration and unknown speakers are centred. Placement is
 * best-effort when a slot is too short for its dialogue: a balloon that no
 * longer fits below the previous one on its side moves to the other side if
 * that has room, else to the centre column, and otherwise is pinned to the
 * bottom inset. A single balloon taller than the slot is pinned to the top
 * inset. Balloons never advance a column's cursor past the bottom inset, so a
 * pinned balloon cannot be repeated on the identical rectangle.
 */
export async function placeBalloons(i: PlacementInput): Promise<PlacedBalloon[]> {
  const { slot } = i;
  const maxW = Math.min(Math.floor(slot.w * 0.45), 420);
  const top = slot.y + i.inset;
  const bottom = slot.y + slot.h - i.inset;
  const cursor: Record<Side, number> = { left: top, right: top, centre: top };
  const placed: PlacedBalloon[] = [];

  for (let idx = 0; idx < i.dialogue.length; idx++) {
    const d = i.dialogue[idx]!;
    let side: Side = d.type === 'narration' ? 'centre' : (i.speakerSides[d.character] ?? 'centre');
    const width = side === 'centre' && d.type === 'narration' ? Math.min(Math.floor(slot.w * 0.6), 560) : maxW;
    const m = await i.measure(d.line, width);
    const w = Math.min(m.width, width);
    const h = m.height;

    // If this column has no room left, fall back to another column that does.
    const fits = (s: Side): boolean => cursor[s] + h <= bottom;
    if (!fits(side) && side !== 'centre') {
      const other: Side = side === 'left' ? 'right' : 'left';
      if (fits(other)) side = other;
      else if (fits('centre')) side = 'centre';
    }

    let x: number;
    if (side === 'left') x = slot.x + i.inset;
    else if (side === 'right') x = slot.x + slot.w - i.inset - w;
    else x = Math.round(slot.x + (slot.w - w) / 2);

    // Pin to the bottom inset on overflow; a balloon taller than the slot pins to the top.
    let y = Math.max(Math.min(cursor[side], bottom - h), top);
    cursor[side] = Math.min(y + h + i.spacing, bottom);

    const o = i.overrides?.[String(idx)];
    if (o) { x += o.dx; y += o.dy; }

    placed.push({ index: idx, text: d.line, type: d.type, x, y, w, h, tail: side === 'centre' ? 'none' : side });
  }
  return placed;
}
