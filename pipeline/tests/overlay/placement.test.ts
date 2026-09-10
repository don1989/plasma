// tests/overlay/placement.test.ts
import { describe, it, expect } from 'vitest';
import { placeBalloons } from '../../src/overlay/placement.js';

const slot = { panelNumber: 1, x: 100, y: 200, w: 800, h: 600 };
const size = async (text: string) => ({ width: Math.min(60 + text.length * 8, 360), height: 60 });

describe('placeBalloons', () => {
  it('puts the speaker-left balloon at top-left and speaker-right at top-right, inside the slot', async () => {
    const out = await placeBalloons({
      slot,
      dialogue: [{ character: 'SPYKE', line: 'Get lost!', type: 'speech' }, { character: 'PUNK 1', line: 'Hey', type: 'speech' }],
      speakerSides: { SPYKE: 'left', 'PUNK 1': 'right' },
      measure: size, inset: 24, spacing: 12,
    });
    expect(out).toHaveLength(2);
    expect(out[0]!.x).toBe(slot.x + 24);
    expect(out[0]!.y).toBe(slot.y + 24);
    expect(out[1]!.x + out[1]!.w).toBe(slot.x + slot.w - 24);
    for (const b of out) {
      expect(b.x).toBeGreaterThanOrEqual(slot.x);
      expect(b.x + b.w).toBeLessThanOrEqual(slot.x + slot.w);
      expect(b.y + b.h).toBeLessThanOrEqual(slot.y + slot.h);
    }
  });

  it('stacks repeated same-side balloons downward', async () => {
    const out = await placeBalloons({ slot, dialogue: [
      { character: 'SPYKE', line: 'One', type: 'speech' }, { character: 'SPYKE', line: 'Two', type: 'speech' }],
      speakerSides: { SPYKE: 'left' }, measure: size, inset: 24, spacing: 12 });
    expect(out[1]!.y).toBe(out[0]!.y + out[0]!.h + 12);
  });

  it('centres narration and off-panel speech at the top, and applies overrides', async () => {
    const out = await placeBalloons({ slot, dialogue: [
      { character: 'Narrator', line: 'Later.', type: 'narration' }, { character: 'INTERCOM', line: 'Attention', type: 'speech' }],
      speakerSides: {}, measure: size, inset: 24, spacing: 12, overrides: { 1: { dx: 10, dy: 5 } } });
    expect(Math.abs((out[0]!.x + out[0]!.w / 2) - (slot.x + slot.w / 2))).toBeLessThan(2);
    expect(out[1]!.tail).toBe('none');
    expect(out[1]!.x).toBe(Math.round(slot.x + (slot.w - out[1]!.w) / 2) + 10);
  });
});
