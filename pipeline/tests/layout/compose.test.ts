import { describe, it, expect, afterEach } from 'vitest';
import sharp from 'sharp';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { composePage } from '../../src/layout/compose.js';

const RED = { r: 255, g: 0, b: 0 };
const GREY = [200, 200, 200];

async function tile(dir: string, name: string, w: number, h: number, rgb: { r: number; g: number; b: number }) {
  const file = path.join(dir, name);
  await writeFile(file, await sharp({ create: { width: w, height: h, channels: 3, background: rgb } }).png().toBuffer());
  return file;
}

async function px(img: Buffer, x: number, y: number): Promise<number[]> {
  const { data } = await sharp(img).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  return [data[0], data[1], data[2]];
}

/** Count pixels in a region whose RGB differs from `rgb`. */
async function countNot(img: Buffer, region: { left: number; top: number; width: number; height: number }, rgb: number[]): Promise<number> {
  const { data, info } = await sharp(img).extract(region).raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] !== rgb[0] || data[i + 1] !== rgb[1] || data[i + 2] !== rgb[2]) n++;
  }
  return n;
}

// Slot 1: 360x150 at (20,20) → inner 352x142 at (24,24), centre (200,95).
// Slot 2: 360x390 at (20,190) → inner 352x382 at (24,194), centre (200,385).
const CANVAS = { w: 400, h: 600 };
const SLOTS = [
  { panelNumber: 1, x: 20, y: 20, w: 360, h: 150 },
  { panelNumber: 2, x: 20, y: 190, w: 360, h: 390 },
];

describe('composePage', () => {
  let dir: string;
  afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

  it('places each panel in its slot and fills missing slots with a placeholder', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'compose-'));
    const red = await tile(dir, 'a.png', 160, 90, RED); // 16:9 into a wider slot → cover crops top/bottom
    const out = await composePage({ canvas: CANVAS, slots: SLOTS, panelFiles: { 1: red, 2: null }, missingLabel: (n) => `MISSING ${n}` });

    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(600);

    expect(await px(out, 200, 95)).toEqual([255, 0, 0]);   // centre of slot 1 is red
    expect(await px(out, 25, 95)).toEqual([255, 0, 0]);    // inner-left edge is red too: cover, not contain
    expect(await px(out, 20, 20)).toEqual([0, 0, 0]);      // 4 px black frame at the slot corner
    expect(await px(out, 5, 5)).toEqual([255, 255, 255]);  // margin is white

    // Missing slot 2: grey away from the label, and the label actually renders in the centre band.
    expect(await px(out, 200, 300)).toEqual(GREY);
    expect(await countNot(out, { left: 24, top: 365, width: 352, height: 40 }, GREY)).toBeGreaterThan(0);
  });

  it('cover-crops a portrait tile into a wide slot instead of letterboxing it', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'compose-'));
    const tall = await tile(dir, 'tall.png', 90, 160, RED); // narrower than the 360x150 slot
    const out = await composePage({ canvas: CANVAS, slots: SLOTS, panelFiles: { 1: tall, 2: null } });

    expect(await px(out, 25, 95)).toEqual([255, 0, 0]);    // inner-left edge filled
    expect(await px(out, 374, 95)).toEqual([255, 0, 0]);   // inner-right edge filled
    expect(await px(out, 200, 25)).toEqual([255, 0, 0]);   // inner-top edge filled
  });

  it('throws when a slot is smaller than its border', async () => {
    await expect(composePage({
      canvas: CANVAS,
      slots: [{ panelNumber: 3, x: 0, y: 0, w: 6, h: 100 }],
      panelFiles: {},
    })).rejects.toThrow('slot for panel 3 is smaller than its border');
  });
});
