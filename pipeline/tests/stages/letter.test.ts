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
});
