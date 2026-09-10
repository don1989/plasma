import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { composePage } from '../../src/layout/compose.js';

async function tile(dir: string, name: string, w: number, h: number, rgb: { r: number; g: number; b: number }) {
  const file = path.join(dir, name);
  await writeFile(file, await sharp({ create: { width: w, height: h, channels: 3, background: rgb } }).png().toBuffer());
  return file;
}

describe('composePage', () => {
  it('places each panel in its slot and fills missing slots with a placeholder', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'compose-'));
    const red = await tile(dir, 'a.png', 160, 90, { r: 255, g: 0, b: 0 });   // 16:9 into a wider slot → cover crop
    const out = await composePage({
      canvas: { w: 400, h: 600 },
      slots: [
        { panelNumber: 1, x: 20, y: 20, w: 360, h: 150 },
        { panelNumber: 2, x: 20, y: 190, w: 360, h: 390 },
      ],
      panelFiles: { 1: red, 2: null },
      missingLabel: (n) => `MISSING ${n}`,
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(600);
    const px = async (x: number, y: number) => {
      const { data } = await sharp(out).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
      return [data[0], data[1], data[2]];
    };
    expect(await px(200, 95)).toEqual([255, 0, 0]);       // centre of slot 1 is red
    // Inside missing slot 2, above the MISSING label that sits at the slot centre: placeholder grey
    expect(await px(200, 300)).toEqual([200, 200, 200]);
    expect(await px(5, 5)).toEqual([255, 255, 255]);      // margin is white
  });
});
