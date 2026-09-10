// tests/stages/letter.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import sharp from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { letterPage } from '../../src/stages/letter.js';
import type { PagePlan } from '../../src/types/page-plan.js';

describe('letterPage', () => {
  let dir: string;
  afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

  it('draws a balloon inside the speaking panel and leaves silent panels untouched', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'letter-'));
    const pageFile = path.join(dir, 'page.png');
    await sharp({ create: { width: 400, height: 600, channels: 3, background: { r: 0, g: 0, b: 255 } } }).png().toFile(pageFile);
    const page: PagePlan = {
      pageNumber: 1, isSplash: false,
      layout: { canvas: { w: 400, h: 600 }, slots: [
        { panelNumber: 1, x: 20, y: 20, w: 360, h: 260 }, { panelNumber: 2, x: 20, y: 300, w: 360, h: 280 }] },
      panels: [
        { panelNumber: 1, shotType: 'Medium', aspectRatio: '3:4', characterIds: [], speakerSides: { SPYKE: 'left' },
          dialogue: [{ character: 'SPYKE', line: 'Hi', type: 'speech' }], sfx: '', prompt: 'p', promptHash: 'h', versions: [], approvedVersion: null },
        { panelNumber: 2, shotType: 'Medium', aspectRatio: '3:4', characterIds: [], speakerSides: {}, dialogue: [], sfx: '', prompt: 'p', promptHash: 'h', versions: [], approvedVersion: null },
      ],
    };
    const out = await letterPage(pageFile, page);
    const px = async (x: number, y: number) => {
      const { data } = await sharp(out).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
      return [data[0], data[1], data[2]];
    };
    expect(await px(60, 60)).toEqual([255, 255, 255]);   // inside the balloon (white fill)
    expect(await px(200, 450)).toEqual([0, 0, 255]);     // silent panel unchanged
  });

  it('wraps a long line so the balloon stays inside the slot', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'letter-'));
    const pageFile = path.join(dir, 'page.png');
    await sharp({ create: { width: 400, height: 600, channels: 3, background: { r: 0, g: 0, b: 255 } } }).png().toFile(pageFile);
    const slot = { panelNumber: 1, x: 20, y: 20, w: 360, h: 560 };
    const line = 'Is that just for show, or do you actually know how to use that thing on your back?';
    const page: PagePlan = {
      pageNumber: 1, isSplash: false,
      layout: { canvas: { w: 400, h: 600 }, slots: [slot] },
      panels: [
        { panelNumber: 1, shotType: 'Medium', aspectRatio: '3:4', characterIds: [], speakerSides: { 'PUNK 1': 'left' },
          dialogue: [{ character: 'PUNK 1', line, type: 'speech' }], sfx: '', prompt: 'p', promptHash: 'h', versions: [], approvedVersion: null },
      ],
    };
    const out = await letterPage(pageFile, page);
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
    // Find the balloon's vertical extent: first and last non-blue rows inside the slot at the balloon's left inset.
    const rows: number[] = [];
    for (let y = slot.y; y < slot.y + slot.h; y++) if (px(60, y)[2] !== 255 || px(60, y)[0] === 255) rows.push(y);
    expect(rows.length).toBeGreaterThan(40); // multi-line text → tall balloon
    const midRow = rows[Math.floor(rows.length / 2)]!;
    expect(px(slot.x + slot.w - 5, midRow)).toEqual([0, 0, 255]); // right inner edge of the slot untouched
    expect(px(slot.x + 24 + 12, midRow)).toEqual([255, 255, 255]); // inside the balloon, in the padding left of the text
    expect(px(slot.x + 24 + 12, slot.y + 24 + 4)).toEqual([0, 0, 255]); // ellipse corner is not filled: still page colour
  });
});
