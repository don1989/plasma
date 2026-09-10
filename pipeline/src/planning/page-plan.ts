/**
 * Chapter plan builder: turns a parsed Chapter into the panel-based page plan
 * (pages.json), and merges an existing plan's versions/approvals forward.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import type { Chapter, Panel } from '../types/manga.js';
import {
  ChapterPlanSchema, DEFAULT_CANVAS, PAGE_MARGIN, PAGE_GUTTER,
  type ChapterPlan, type PagePlan, type PanelPlan,
} from '../types/page-plan.js';
import type { CharacterRegistry } from '../characters/registry.js';
import { extractCharactersFromPanel } from '../templates/prompt-generator.js';
import { aspectForShot, assignSpeakerSides, pickEmphasisPanel } from './shot-rules.js';
import { rowFlowLayout } from '../layout/row-flow.js';
import { buildPanelPrompt } from './panel-prompt.js';
import { PATHS } from '../config/paths.js';

export function hashPrompt(prompt: string): string {
  return createHash('sha1').update(prompt).digest('hex').slice(0, 12);
}

function speakerNames(panel: Panel, registry: CharacterRegistry): Record<string, string> {
  const names: Record<string, string> = {};
  for (const d of panel.dialogue) {
    const c = registry.get(d.character);
    names[d.character] = c ? c.name : d.character.toLowerCase();
  }
  return names;
}

function buildPanel(panel: Panel, registry: CharacterRegistry, stylePrefix: string): PanelPlan {
  const { known } = extractCharactersFromPanel(panel, registry);
  const seen = new Set<string>();
  const fingerprints: Array<{ id: string; name: string; fingerprint: string }> = [];
  for (const name of known) {
    const c = registry.get(name);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    fingerprints.push({ id: c.id, name: c.name, fingerprint: c.fingerprint });
  }
  // Speaker keys that resolve to a character on the panel count as "on panel".
  const onPanelSpeakers = panel.dialogue
    .map((d) => d.character)
    .filter((k) => { const c = registry.get(k); return !!c && seen.has(c.id); });
  const speakerSides = assignSpeakerSides(panel.dialogue, onPanelSpeakers);
  const prompt = buildPanelPrompt({
    stylePrefix, action: panel.action, notes: panel.notes, shotType: panel.shotType,
    fingerprints, speakerSides, speakerNames: speakerNames(panel, registry),
  });
  return {
    panelNumber: panel.panelNumber,
    shotType: panel.shotType,
    aspectRatio: aspectForShot(panel.shotType),
    characterIds: fingerprints.map((f) => f.id),
    speakerSides,
    dialogue: panel.dialogue,
    sfx: panel.sfx.trim() === '—' ? '' : panel.sfx,
    prompt,
    promptHash: hashPrompt(prompt),
    versions: [],
    approvedVersion: null,
  };
}

export function buildChapterPlan(chapter: Chapter, registry: CharacterRegistry, stylePrefix: string): ChapterPlan {
  const pages: PagePlan[] = chapter.pages.map((page) => {
    const panels = page.panels.map((p) => buildPanel(p, registry, stylePrefix));
    const emphasis = pickEmphasisPanel(page.panels.map((p) => ({
      panelNumber: p.panelNumber, dialogueCount: p.dialogue.length, notes: p.notes,
    })));
    const slots = rowFlowLayout(
      panels.map((p) => ({ panelNumber: p.panelNumber, aspectRatio: p.aspectRatio })),
      { canvas: DEFAULT_CANVAS, margin: PAGE_MARGIN, gutter: PAGE_GUTTER, emphasisPanel: emphasis, isSplash: page.isSplash },
    );
    return { pageNumber: page.pageNumber, isSplash: page.isSplash, layout: { canvas: { ...DEFAULT_CANVAS }, slots }, panels };
  });
  return { chapterNumber: chapter.chapterNumber, canvas: { ...DEFAULT_CANVAS }, pages };
}

/** Carry versions forward; keep approval only if the prompt hash is unchanged. */
export function mergeChapterPlan(fresh: ChapterPlan, existing: ChapterPlan | null): ChapterPlan {
  if (!existing) return fresh;
  const byKey = new Map<string, PanelPlan>();
  for (const pg of existing.pages) for (const pn of pg.panels) byKey.set(`${pg.pageNumber}:${pn.panelNumber}`, pn);
  for (const pg of fresh.pages) {
    for (const pn of pg.panels) {
      const old = byKey.get(`${pg.pageNumber}:${pn.panelNumber}`);
      if (!old) continue;
      pn.versions = old.versions;
      pn.balloonOverrides = old.balloonOverrides;
      pn.approvedVersion = old.promptHash === pn.promptHash ? old.approvedVersion : null;
    }
  }
  return fresh;
}

export function planPath(chapter: number): string {
  return path.join(PATHS.chapterOutput(chapter).root, 'pages.json');
}

export async function loadChapterPlan(chapter: number): Promise<ChapterPlan | null> {
  const file = planPath(chapter);
  if (!existsSync(file)) return null;
  return ChapterPlanSchema.parse(JSON.parse(await readFile(file, 'utf-8')));
}

export async function saveChapterPlan(plan: ChapterPlan): Promise<string> {
  const file = planPath(plan.chapterNumber);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(ChapterPlanSchema.parse(plan), null, 2), 'utf-8');
  return file;
}

export function findPanel(plan: ChapterPlan, page: number, panel: number): PanelPlan | undefined {
  return plan.pages.find((p) => p.pageNumber === page)?.panels.find((q) => q.panelNumber === panel);
}

export function approvedFile(plan: ChapterPlan, panel: PanelPlan): string | null {
  if (panel.approvedVersion == null) return null;
  const v = panel.versions.find((x) => x.version === panel.approvedVersion);
  return v ? path.join(PATHS.chapterOutput(plan.chapterNumber).root, v.file) : null;
}
