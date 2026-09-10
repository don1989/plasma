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
import { findScene, type SceneEntry, type Location } from './scenes.js';
import { PATHS } from '../config/paths.js';

export function hashPanelPrompt(prompt: string): string {
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

export interface SceneContext { scenes: SceneEntry[]; locations: Map<string, Location>; locationsWithRefs: Set<string> }
const NO_SCENES: SceneContext = { scenes: [], locations: new Map(), locationsWithRefs: new Set() };

function buildPanel(panel: Panel, registry: CharacterRegistry, stylePrefix: string, pageNumber: number, ctx: SceneContext): PanelPlan {
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
  const scene = findScene(ctx.scenes, pageNumber, panel.panelNumber);
  const location = scene ? ctx.locations.get(scene.locationId) : undefined;
  const prompt = buildPanelPrompt({
    stylePrefix, action: panel.action, notes: panel.notes, shotType: panel.shotType,
    fingerprints, speakerSides, speakerNames: speakerNames(panel, registry),
    setting: location?.setting, hasLocationRef: !!scene && ctx.locationsWithRefs.has(scene.locationId),
  });
  return {
    panelNumber: panel.panelNumber,
    shotType: panel.shotType,
    aspectRatio: aspectForShot(panel.shotType),
    characterIds: fingerprints.map((f) => f.id),
    ...(scene ? { locationId: scene.locationId } : {}),
    speakerSides,
    dialogue: panel.dialogue,
    sfx: panel.sfx,
    prompt,
    promptHash: hashPanelPrompt(prompt),
    versions: [],
    approvedVersion: null,
  };
}

export function buildChapterPlan(chapter: Chapter, registry: CharacterRegistry, stylePrefix: string, ctx: SceneContext = NO_SCENES): ChapterPlan {
  const pages: PagePlan[] = chapter.pages.map((page) => {
    const panels = page.panels.map((p) => buildPanel(p, registry, stylePrefix, page.pageNumber, ctx));
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

/** Carry versions forward; keep approval only if the prompt hash is unchanged. Mutates and returns `fresh`. */
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

/** `outputRoot` defaults to the chapter's output directory (`output/ch-NN`). */
export function planPath(chapter: number, outputRoot?: string): string {
  return path.join(outputRoot ?? PATHS.chapterOutput(chapter).root, 'pages.json');
}

/** Composed/lettered page file name, e.g. ch01_p03.png. */
export function pageFileName(chapter: number, page: number): string {
  return `ch${String(chapter).padStart(2, '0')}_p${String(page).padStart(2, '0')}.png`;
}

export async function loadChapterPlan(chapter: number, outputRoot?: string): Promise<ChapterPlan | null> {
  const file = planPath(chapter, outputRoot);
  if (!existsSync(file)) return null;
  const raw = await readFile(file, 'utf-8');
  try {
    return ChapterPlanSchema.parse(JSON.parse(raw));
  } catch (e) {
    throw new Error(`Invalid pages.json at ${file}: ${(e as Error).message}`);
  }
}

export async function saveChapterPlan(plan: ChapterPlan, outputRoot?: string): Promise<string> {
  const file = planPath(plan.chapterNumber, outputRoot);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(ChapterPlanSchema.parse(plan), null, 2), 'utf-8');
  return file;
}

export function findPanel(plan: ChapterPlan, page: number, panel: number): PanelPlan | undefined {
  return plan.pages.find((p) => p.pageNumber === page)?.panels.find((q) => q.panelNumber === panel);
}

export function approvedFile(plan: ChapterPlan, panel: PanelPlan, outputRoot?: string): string | null {
  if (panel.approvedVersion == null) return null;
  const v = panel.versions.find((x) => x.version === panel.approvedVersion);
  return v ? path.join(outputRoot ?? PATHS.chapterOutput(plan.chapterNumber).root, v.file) : null;
}
