// tests/stages/panel-generate.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generatePanels, selectPanels, type GenerateResponse } from '../../src/stages/panel-generate.js';
import type { ChapterPlan, PagePlan, PanelPlan } from '../../src/types/page-plan.js';

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

function panel(overrides: Partial<PanelPlan> & { panelNumber: number }): PanelPlan {
  return {
    shotType: 'Medium', aspectRatio: '3:4', characterIds: [], speakerSides: {}, dialogue: [], sfx: '',
    prompt: `P${overrides.panelNumber}`, promptHash: `h${overrides.panelNumber}`, versions: [], approvedVersion: null,
    ...overrides,
  };
}

function page(pageNumber: number, panels: PanelPlan[]): PagePlan {
  return { pageNumber, isSplash: false, layout: { canvas: { w: 1600, h: 2264 }, slots: [] }, panels };
}

/** Page 3: panel 1 unapproved (Spyke), panel 2 approved at v1. */
function plan(extraPages: PagePlan[] = []): ChapterPlan {
  return { chapterNumber: 1, canvas: { w: 1600, h: 2264 }, pages: [page(3, [
    panel({ panelNumber: 1, characterIds: ['spyke-tinwall'] }),
    panel({ panelNumber: 2, shotType: 'Wide', aspectRatio: '16:9',
      versions: [{ version: 1, file: 'raw/x/ch01_p03_pn2_v1.png', model: 'm', requestId: 'r', timestamp: 't', notes: '' }], approvedVersion: 1 }),
  ]), ...extraPages] };
}

const okResponse: GenerateResponse = { imageUrls: ['http://x/img.png'], requestId: 'req-1', model: { alias: 'runway-muse', endpoint: 'muse_image' } };
const noRefs = async () => ({ refs: [], groups: [] });
const fakeDownload = async (_url: string, dest: string) => { await writeFile(dest, 'png'); };

describe('generatePanels', () => {
  it('generates only unapproved panels, records a version, and auto-approves the first one', async () => {
    const root = await tempDir('panels-');
    const generate = vi.fn(async () => okResponse);
    const download = vi.fn(fakeDownload);
    const p = plan();
    const result = await generatePanels(p, {
      chapterRoot: root, modelAlias: 'runway-muse', refsFor: async () => ({ refs: ['ref.png'], groups: [{ label: 'spyke-tinwall', count: 1 }] }),
      generate, download, notes: 'test',
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]![0]).toMatchObject({ prompt: 'P1', aspectRatio: '3:4', refs: ['ref.png'], refGroups: [{ label: 'spyke-tinwall', count: 1 }] });
    const target = p.pages[0]!.panels[0]!;
    expect(target.versions).toHaveLength(1);
    expect(target.versions[0]!.file).toBe('raw/runway-muse/ch01_p03_pn1_v1.png');
    expect(target.approvedVersion).toBe(1);
    expect(await readFile(path.join(root, target.versions[0]!.file), 'utf-8')).toBe('png');
    expect(result.errors).toEqual([]);
  });

  it('redo generates approved panels too but does not change the approval', async () => {
    const root = await tempDir('panels-');
    const p = plan();
    const generate = vi.fn(async () => okResponse);
    await generatePanels(p, { chapterRoot: root, modelAlias: 'runway-muse', refsFor: noRefs, generate, download: fakeDownload, redo: true, notes: '' });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(p.pages[0]!.panels[1]!.versions).toHaveLength(2);
    expect(p.pages[0]!.panels[1]!.approvedVersion).toBe(1);
  });

  it('records provider errors per panel and continues', async () => {
    const root = await tempDir('panels-');
    const p = plan();
    const generate = vi.fn(async () => { throw new Error('boom'); });
    const result = await generatePanels(p, { chapterRoot: root, modelAlias: 'runway-muse', refsFor: noRefs, generate, download: async () => {}, notes: '' });
    expect(result.errors).toEqual(['page 3 panel 1: boom']);
  });

  it('leaves a failed panel with no versions and no approval', async () => {
    const root = await tempDir('panels-');
    const p = plan();
    const generate = vi.fn(async () => { throw new Error('boom'); });
    await generatePanels(p, { chapterRoot: root, modelAlias: 'runway-muse', refsFor: noRefs, generate, download: async () => {}, notes: '' });
    expect(p.pages[0]!.panels[0]!.versions).toEqual([]);
    expect(p.pages[0]!.panels[0]!.approvedVersion).toBeNull();
  });

  it('calls persist once per generated panel with the plan', async () => {
    const root = await tempDir('panels-');
    const p = plan();
    const persist = vi.fn(async (_plan: ChapterPlan) => {});
    await generatePanels(p, { chapterRoot: root, modelAlias: 'runway-muse', refsFor: noRefs, generate: async () => okResponse, download: fakeDownload, persist, redo: true, notes: '' });
    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[0]![0]).toBe(p);
    // At first persist, panel 1 already carries its new version.
    expect(p.pages[0]!.panels[0]!.versions).toHaveLength(1);
  });

  it('does not call persist for a failed panel', async () => {
    const root = await tempDir('panels-');
    const persist = vi.fn(async () => {});
    await generatePanels(plan(), { chapterRoot: root, modelAlias: 'runway-muse', refsFor: noRefs, generate: async () => { throw new Error('boom'); }, download: async () => {}, persist, notes: '' });
    expect(persist).not.toHaveBeenCalled();
  });

  it('honours the pages filter', async () => {
    const root = await tempDir('panels-');
    const p = plan([page(4, [panel({ panelNumber: 1 })])]);
    const generate = vi.fn(async () => okResponse);
    await generatePanels(p, { chapterRoot: root, modelAlias: 'runway-muse', refsFor: noRefs, generate, download: fakeDownload, pages: [4], notes: '' });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(p.pages[0]!.panels[0]!.versions).toHaveLength(0);
    expect(p.pages[1]!.panels[0]!.versions[0]!.file).toBe('raw/runway-muse/ch01_p04_pn1_v1.png');
  });

  it('honours the panel filter', async () => {
    const root = await tempDir('panels-');
    const p = plan();
    const generate = vi.fn(async () => okResponse);
    await generatePanels(p, { chapterRoot: root, modelAlias: 'runway-muse', refsFor: noRefs, generate, download: fakeDownload, panel: 2, redo: true, notes: '' });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(p.pages[0]!.panels[0]!.versions).toHaveLength(0);
    expect(p.pages[0]!.panels[1]!.versions).toHaveLength(2);
  });

  it('numbers the next version after the highest existing one', async () => {
    const root = await tempDir('panels-');
    const p = plan();
    const v = (version: number) => ({ version, file: `raw/x/ch01_p03_pn1_v${version}.png`, model: 'm', requestId: 'r', timestamp: 't', notes: '' });
    p.pages[0]!.panels[0]!.versions = [v(1), v(3)];
    await generatePanels(p, { chapterRoot: root, modelAlias: 'runway-muse', refsFor: noRefs, generate: async () => okResponse, download: fakeDownload, notes: '' });
    const added = p.pages[0]!.panels[0]!.versions.at(-1)!;
    expect(added.version).toBe(4);
    expect(added.file).toBe('raw/runway-muse/ch01_p03_pn1_v4.png');
  });

  it("passes the panel's characterIds to refsFor", async () => {
    const root = await tempDir('panels-');
    const refsFor = vi.fn(noRefs);
    await generatePanels(plan(), { chapterRoot: root, modelAlias: 'runway-muse', refsFor, generate: async () => okResponse, download: fakeDownload, notes: '' });
    expect(refsFor).toHaveBeenCalledTimes(1);
    expect(refsFor).toHaveBeenCalledWith(['spyke-tinwall']);
  });
});

describe('selectPanels', () => {
  const p = plan([page(4, [panel({ panelNumber: 1 }), panel({ panelNumber: 2 })])]);
  const keys = (sel: Array<{ page: PagePlan; panel: PanelPlan }>) => sel.map((s) => `p${s.page.pageNumber}/${s.panel.panelNumber}`);

  it('skips approved panels by default', () => {
    expect(keys(selectPanels(p, {}))).toEqual(['p3/1', 'p4/1', 'p4/2']);
  });

  it('includes approved panels with redo', () => {
    expect(keys(selectPanels(p, { redo: true }))).toEqual(['p3/1', 'p3/2', 'p4/1', 'p4/2']);
  });

  it('filters by pages and panel', () => {
    expect(keys(selectPanels(p, { pages: [4] }))).toEqual(['p4/1', 'p4/2']);
    expect(keys(selectPanels(p, { panel: 2, redo: true }))).toEqual(['p3/2', 'p4/2']);
    expect(keys(selectPanels(p, { pages: [3], panel: 2 }))).toEqual([]);
  });
});
