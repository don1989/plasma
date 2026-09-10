// tests/stages/panel-generate.test.ts
import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generatePanels } from '../../src/stages/panel-generate.js';
import type { ChapterPlan } from '../../src/types/page-plan.js';

function plan(): ChapterPlan {
  return { chapterNumber: 1, canvas: { w: 1600, h: 2264 }, pages: [{
    pageNumber: 3, isSplash: false, layout: { canvas: { w: 1600, h: 2264 }, slots: [] },
    panels: [
      { panelNumber: 1, shotType: 'Medium', aspectRatio: '3:4', characterIds: ['spyke-tinwall'], speakerSides: {}, dialogue: [], sfx: '', prompt: 'P1', promptHash: 'h1', versions: [], approvedVersion: null },
      { panelNumber: 2, shotType: 'Wide', aspectRatio: '16:9', characterIds: [], speakerSides: {}, dialogue: [], sfx: '', prompt: 'P2', promptHash: 'h2',
        versions: [{ version: 1, file: 'raw/x/ch01_p03_pn2_v1.png', model: 'm', requestId: 'r', timestamp: 't', notes: '' }], approvedVersion: 1 },
    ],
  }] };
}

describe('generatePanels', () => {
  it('generates only unapproved panels, records a version, and auto-approves the first one', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'panels-'));
    const generate = vi.fn(async (req: { prompt: string; aspectRatio: string; refs: string[]; refGroups: Array<{ label: string; count: number }> }) => ({
      imageUrls: ['http://x/img.png'], requestId: 'req-1', model: { alias: 'runway-muse', endpoint: 'muse_image' },
    }));
    const download = vi.fn(async (_url: string, dest: string) => { await writeFile(dest, 'png'); });
    const p = plan();
    const result = await generatePanels(p, {
      chapterRoot: root, modelAlias: 'runway-muse', refsFor: async () => ({ refs: ['ref.png'], groups: [{ label: 'spyke-tinwall', count: 1 }] }),
      generate, download, notes: 'test',
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]![0]).toMatchObject({ prompt: 'P1', aspectRatio: '3:4', refs: ['ref.png'], refGroups: [{ label: 'spyke-tinwall', count: 1 }] });
    const panel = p.pages[0]!.panels[0]!;
    expect(panel.versions).toHaveLength(1);
    expect(panel.versions[0]!.file).toBe('raw/runway-muse/ch01_p03_pn1_v1.png');
    expect(panel.approvedVersion).toBe(1);
    expect(await readFile(path.join(root, panel.versions[0]!.file), 'utf-8')).toBe('png');
    expect(result.errors).toEqual([]);
  });

  it('redo generates approved panels too but does not change the approval', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'panels-'));
    const p = plan();
    const generate = vi.fn(async () => ({ imageUrls: ['u'], requestId: 'r', model: { alias: 'runway-muse', endpoint: 'muse_image' } }));
    await generatePanels(p, { chapterRoot: root, modelAlias: 'runway-muse', refsFor: async () => ({ refs: [], groups: [] }), generate, download: async (_u, d) => writeFile(d, 'x'), redo: true, notes: '' });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(p.pages[0]!.panels[1]!.versions).toHaveLength(2);
    expect(p.pages[0]!.panels[1]!.approvedVersion).toBe(1);
  });

  it('records provider errors per panel and continues', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'panels-'));
    const p = plan();
    const generate = vi.fn(async () => { throw new Error('boom'); });
    const result = await generatePanels(p, { chapterRoot: root, modelAlias: 'runway-muse', refsFor: async () => ({ refs: [], groups: [] }), generate, download: async () => {}, notes: '' });
    expect(result.errors).toEqual(['page 3 panel 1: boom']);
  });
});
