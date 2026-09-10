// tests/stages/review.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import sharp from 'sharp';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderContactSheet, approvePanel } from '../../src/stages/review.js';
import type { ChapterPlan } from '../../src/types/page-plan.js';

// Every temp dir made during a test is removed afterwards.
const tempDirs: string[] = [];
async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
});

/** Write a small solid PNG at `root/rel` and return `rel` (the plan stores chapter-relative paths). */
async function writePng(root: string, rel: string): Promise<string> {
  await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .png().toFile(path.join(root, rel));
  return rel;
}

describe('review', () => {
  it('renders one row per panel with every version, and approve updates the plan', async () => {
    const root = await tempDir('review-');
    await mkdir(path.join(root, 'raw/m'), { recursive: true });
    const plan: ChapterPlan = { chapterNumber: 1, canvas: { w: 1600, h: 2264 }, pages: [{
      pageNumber: 2, isSplash: false, layout: { canvas: { w: 1600, h: 2264 }, slots: [] },
      panels: [{ panelNumber: 1, shotType: 'Medium', aspectRatio: '3:4', characterIds: [], speakerSides: {}, dialogue: [], sfx: '', prompt: 'p', promptHash: 'h',
        versions: [
          { version: 1, file: await writePng(root, 'raw/m/a.png'), model: 'm', requestId: 'r', timestamp: 't', notes: '' },
          { version: 2, file: await writePng(root, 'raw/m/b.png'), model: 'm', requestId: 'r', timestamp: 't', notes: '' },
        ], approvedVersion: 1 }],
    }] };
    const buf = await renderContactSheet(plan, plan.pages[0]!, root, { thumbWidth: 100 });
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBeGreaterThanOrEqual(2 * 100);
    expect(meta.height).toBeGreaterThan(48);

    approvePanel(plan, 2, 1, 2);
    expect(plan.pages[0]!.panels[0]!.approvedVersion).toBe(2);
    expect(() => approvePanel(plan, 2, 1, 9)).toThrow(/version 9/);
  });
});
