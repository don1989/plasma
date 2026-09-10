import { describe, it, expect, afterEach } from 'vitest';
import {
  buildChapterPlan, mergeChapterPlan, planPath, loadChapterPlan, saveChapterPlan, findPanel, approvedFile,
} from '../../src/planning/page-plan.js';
import type { Chapter } from '../../src/types/manga.js';
import { CharacterRegistry } from '../../src/characters/registry.js';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Every temp dir made during a test is removed afterwards.
const tempDirs: string[] = [];
async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

// The registry loads YAML from a directory; build a tiny one per test run.
async function fixtureRegistry(): Promise<CharacterRegistry> {
  const dir = await tempDir('chars-');
  await writeFile(path.join(dir, 'spyke-tinwall.yaml'),
    'id: spyke-tinwall\nname: Spyke Tinwall\naliases: ["Spyke", "SPYKE"]\nfingerprint: "Spyke canon fingerprint text here"\n');
  await writeFile(path.join(dir, 'punks.yaml'),
    'id: punks\nname: Punks\naliases: ["PUNK 1", "PUNK 2", "Punks"]\nfingerprint: "Punks canon fingerprint text here"\n');
  const registry = new CharacterRegistry();
  await registry.loadAll(dir);
  return registry;
}

const chapter: Chapter = {
  chapterNumber: 1, title: 'T', themeBeat: '', estimatedPages: 1, characters: [], locations: [],
  pages: [{
    pageNumber: 3, isSplash: false, isDoubleSpread: false,
    panels: [
      { panelNumber: 1, shotType: 'Medium', action: 'Spyke walks away.', dialogue: [{ character: 'PUNK 1', line: 'Hey.', type: 'speech' }], sfx: '', notes: '', tags: [] },
      { panelNumber: 2, shotType: 'Close-up', action: "Spyke's eyes.", dialogue: [], sfx: '', notes: 'Minimal.', tags: [] },
      { panelNumber: 3, shotType: 'Wide', action: 'The punks fan out. Spyke draws.', dialogue: [
        { character: 'PUNK 1', line: 'Q', type: 'speech' }, { character: 'SPYKE', line: 'Get lost!', type: 'speech' }], sfx: 'WHOOM', notes: 'The beat.', tags: [] },
    ],
  }],
} as Chapter;

const version1 = { version: 1, file: 'raw/runway-muse/ch01_p03_pn1_v1.png', model: 'muse_image', requestId: 'r', timestamp: 't', notes: '' };

describe('buildChapterPlan', () => {
  it('derives panels, aspect, speakers and slots', async () => {
    const registry = await fixtureRegistry();
    const plan = buildChapterPlan(chapter, registry, 'STYLE');
    const page = plan.pages[0]!;
    expect(page.panels.map((p) => p.aspectRatio)).toEqual(['3:4', '1:1', '16:9']);
    // extractCharactersFromPanel lists dialogue speakers before action-text matches.
    expect(page.panels[0]!.characterIds).toEqual(['punks', 'spyke-tinwall']);
    expect(page.panels[2]!.speakerSides).toEqual({ 'PUNK 1': 'left', SPYKE: 'right' });
    expect(page.layout.slots.map((s) => s.panelNumber)).toEqual([1, 2, 3]);
    expect(page.panels[2]!.prompt).toContain('STYLE');
    expect(page.panels[2]!.approvedVersion).toBeNull();
  });
});

describe('mergeChapterPlan', () => {
  it('keeps versions and approvals when the prompt is unchanged, resets when it changed', async () => {
    const registry = await fixtureRegistry();
    const fresh = buildChapterPlan(chapter, registry, 'STYLE');
    const existing = structuredClone(fresh);
    existing.pages[0]!.panels[0]!.versions = [version1];
    existing.pages[0]!.panels[0]!.approvedVersion = 1;
    existing.pages[0]!.panels[1]!.versions = [version1];
    existing.pages[0]!.panels[1]!.approvedVersion = 1;
    existing.pages[0]!.panels[1]!.promptHash = 'stale';

    const merged = mergeChapterPlan(fresh, existing);
    expect(merged.pages[0]!.panels[0]!.approvedVersion).toBe(1);
    expect(merged.pages[0]!.panels[0]!.versions).toHaveLength(1);
    expect(merged.pages[0]!.panels[1]!.approvedVersion).toBeNull();
    expect(merged.pages[0]!.panels[1]!.versions).toHaveLength(1); // history kept, approval reset
  });
});

describe('plan file I/O', () => {
  it('planPath joins pages.json onto the given root', async () => {
    const root = await tempDir('plan-');
    expect(planPath(1, root)).toBe(path.join(root, 'pages.json'));
  });

  it('save then load round-trips the plan', async () => {
    const root = await tempDir('plan-');
    const plan = buildChapterPlan(chapter, await fixtureRegistry(), 'STYLE');
    const file = await saveChapterPlan(plan, root);
    expect(file).toBe(planPath(1, root));
    expect(existsSync(file)).toBe(true);
    expect(await loadChapterPlan(1, root)).toEqual(plan);
  });

  it('load returns null when the file is missing', async () => {
    const root = await tempDir('plan-');
    expect(await loadChapterPlan(1, root)).toBeNull();
  });

  it('load throws a descriptive error on malformed JSON', async () => {
    const root = await tempDir('plan-');
    const file = planPath(1, root);
    await writeFile(file, '{ not json', 'utf-8');
    await expect(loadChapterPlan(1, root)).rejects.toThrow(`Invalid pages.json at ${file}: `);
  });

  it('load throws a descriptive error on schema-invalid JSON', async () => {
    const root = await tempDir('plan-');
    const file = planPath(1, root);
    await writeFile(file, JSON.stringify({ chapterNumber: 1 }), 'utf-8');
    await expect(loadChapterPlan(1, root)).rejects.toThrow(`Invalid pages.json at ${file}: `);
  });
});

describe('findPanel', () => {
  it('returns the matching panel, or undefined for an unknown page or panel', async () => {
    const plan = buildChapterPlan(chapter, await fixtureRegistry(), 'STYLE');
    expect(findPanel(plan, 3, 2)?.panelNumber).toBe(2);
    expect(findPanel(plan, 3, 9)).toBeUndefined();
    expect(findPanel(plan, 9, 1)).toBeUndefined();
  });
});

describe('approvedFile', () => {
  it('returns null when nothing is approved', async () => {
    const root = await tempDir('plan-');
    const plan = buildChapterPlan(chapter, await fixtureRegistry(), 'STYLE');
    expect(approvedFile(plan, plan.pages[0]!.panels[0]!, root)).toBeNull();
  });

  it('joins the approved version file onto the root', async () => {
    const root = await tempDir('plan-');
    const plan = buildChapterPlan(chapter, await fixtureRegistry(), 'STYLE');
    const panel = plan.pages[0]!.panels[0]!;
    panel.versions = [version1];
    panel.approvedVersion = 1;
    expect(approvedFile(plan, panel, root)).toBe(path.join(root, version1.file));
  });

  it('returns null when the approved version is not in versions', async () => {
    const root = await tempDir('plan-');
    const plan = buildChapterPlan(chapter, await fixtureRegistry(), 'STYLE');
    const panel = plan.pages[0]!.panels[0]!;
    panel.versions = [version1];
    panel.approvedVersion = 2;
    expect(approvedFile(plan, panel, root)).toBeNull();
  });
});
