/** Tests for slot-aware balloon placement. */
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

  it('pins a balloon taller than the slot to the top inset and keeps it inside horizontally', async () => {
    const shortSlot = { panelNumber: 1, x: 100, y: 200, w: 800, h: 100 };
    const tall = async () => ({ width: 300, height: 200 });
    const out = await placeBalloons({ slot: shortSlot, dialogue: [
      { character: 'SPYKE', line: 'A very long speech', type: 'speech' }],
      speakerSides: { SPYKE: 'left' }, measure: tall, inset: 24, spacing: 12 });
    expect(out[0]!.y).toBe(shortSlot.y + 24);
    expect(out[0]!.x).toBeGreaterThanOrEqual(shortSlot.x);
    expect(out[0]!.x + out[0]!.w).toBeLessThanOrEqual(shortSlot.x + shortSlot.w);
  });

  it('never repeats a rectangle or overflows the slot when same-side balloons run out of room', async () => {
    const shortSlot = { panelNumber: 1, x: 100, y: 200, w: 800, h: 200 };
    const out = await placeBalloons({ slot: shortSlot, dialogue: [
      { character: 'SPYKE', line: 'One', type: 'speech' },
      { character: 'SPYKE', line: 'Two', type: 'speech' },
      { character: 'SPYKE', line: 'Three', type: 'speech' }],
      speakerSides: { SPYKE: 'left' }, measure: size, inset: 24, spacing: 12 });
    expect(out).toHaveLength(3);
    for (const b of out) {
      expect(b.y).toBeGreaterThanOrEqual(shortSlot.y);
      expect(b.y + b.h).toBeLessThanOrEqual(shortSlot.y + shortSlot.h);
    }
    for (let a = 0; a < out.length; a++) {
      for (let b = a + 1; b < out.length; b++) {
        const p = out[a]!, q = out[b]!;
        const overlap = p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
        expect(overlap, `balloons ${a} and ${b} overlap`).toBe(false);
      }
    }
  });
});

describe('placeBalloons face avoidance', () => {
  it('moves a balloon that would cover a face and keeps the speaker tail side', async () => {
    const face = { x: slot.x + 24, y: slot.y + 24, w: 300, h: 200 }; // where the left balloon would land
    const out = await placeBalloons({
      slot, dialogue: [{ character: 'SPYKE', line: 'Hi there', type: 'speech' }],
      speakerSides: { SPYKE: 'left' }, measure: size, inset: 24, spacing: 12, avoid: [face],
    });
    const b = out[0]!;
    const tailH = 30;
    const overlaps = b.x < face.x + face.w && face.x < b.x + b.w && b.y < face.y + face.h && face.y < b.y + b.h + tailH;
    expect(overlaps).toBe(false);
    expect(b.tail).toBe('left');
    expect(b.x).toBeGreaterThanOrEqual(slot.x);
    expect(b.x + b.w).toBeLessThanOrEqual(slot.x + slot.w);
  });
});
