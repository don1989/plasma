import { describe, it, expect } from 'vitest';
import { buildChapterPlan, mergeChapterPlan } from '../../src/planning/page-plan.js';
import type { Chapter } from '../../src/types/manga.js';
import { CharacterRegistry } from '../../src/characters/registry.js';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The registry loads YAML from a directory; build a tiny one per test run.
async function fixtureRegistry(): Promise<CharacterRegistry> {
  const dir = await mkdtemp(path.join(tmpdir(), 'chars-'));
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
    const v = { version: 1, file: 'raw/runway-muse/ch01_p03_pn1_v1.png', model: 'muse_image', requestId: 'r', timestamp: 't', notes: '' };
    existing.pages[0]!.panels[0]!.versions = [v];
    existing.pages[0]!.panels[0]!.approvedVersion = 1;
    existing.pages[0]!.panels[1]!.versions = [v];
    existing.pages[0]!.panels[1]!.approvedVersion = 1;
    existing.pages[0]!.panels[1]!.promptHash = 'stale';

    const merged = mergeChapterPlan(fresh, existing);
    expect(merged.pages[0]!.panels[0]!.approvedVersion).toBe(1);
    expect(merged.pages[0]!.panels[0]!.versions).toHaveLength(1);
    expect(merged.pages[0]!.panels[1]!.approvedVersion).toBeNull();
    expect(merged.pages[0]!.panels[1]!.versions).toHaveLength(1); // history kept, approval reset
  });
});
