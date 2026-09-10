/**
 * Panels stage: one image per panel from pages.json.
 * The generator and downloader are injected so tests never touch the network.
 * Provider code (fal/Runway SDKs) is only loaded inside runPanels, keeping the
 * generatePanels core free of it.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StageResult } from '../types/pipeline.js';
import type { ChapterPlan, PanelPlan, PagePlan } from '../types/page-plan.js';
import { PATHS } from '../config/paths.js';
import { loadEnvFile } from '../utils/env.js';
import { loadChapterPlan, saveChapterPlan } from '../planning/page-plan.js';
import { loadCharacterReferences } from '../generation/references.js';
import { loadLocationReferences } from '../planning/scenes.js';
import { resolveModel, buildRefBindings, type ModelSpec } from '../generation/models.js';

export interface RefGroup { label: string; count: number }
export interface GenerateRequest { prompt: string; aspectRatio: string; refs: string[]; refGroups: RefGroup[] }
export interface GenerateResponse { imageUrls: string[]; requestId: string; model: { alias: string; endpoint: string } }

export interface PanelSelection { pages?: number[]; panel?: number; redo?: boolean }

export interface GeneratePanelsDeps extends PanelSelection {
  chapterRoot: string;
  modelAlias: string;
  /** Reference image paths/URLs for the panel's characters, plus one binding group per character (in the same order). */
  refsFor: (characterIds: string[], locationId?: string) => Promise<{ refs: string[]; groups: RefGroup[] }>;
  generate: (req: GenerateRequest) => Promise<GenerateResponse>;
  download: (url: string, dest: string) => Promise<void>;
  /** Called after each panel's version is recorded, so a killed run never orphans paid-for images. */
  persist?: (plan: ChapterPlan) => Promise<void>;
  /** Optional face detector; result is stored on the version for face-aware lettering. */
  detectFaces?: (file: string) => Promise<{ faces: Array<{ x: number; y: number; w: number; h: number }>; imageSize: { w: number; h: number } }>;
  notes: string;
  log?: (msg: string) => void;
}

export function panelFileName(chapter: number, page: number, panel: number, version: number): string {
  return `ch${String(chapter).padStart(2, '0')}_p${String(page).padStart(2, '0')}_pn${panel}_v${version}.png`;
}

/**
 * The panels a run would generate: unapproved ones (or all with `redo`), narrowed by
 * `pages` and `panel`. Shared by the core loop and the dry-run listing so they cannot drift.
 */
export function selectPanels(plan: ChapterPlan, sel: PanelSelection): Array<{ page: PagePlan; panel: PanelPlan }> {
  const out: Array<{ page: PagePlan; panel: PanelPlan }> = [];
  for (const page of plan.pages) {
    if (sel.pages && !sel.pages.includes(page.pageNumber)) continue;
    for (const panel of page.panels) {
      if (sel.panel != null && panel.panelNumber !== sel.panel) continue;
      if (sel.redo !== true && panel.approvedVersion != null) continue;
      out.push({ page, panel });
    }
  }
  return out;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Core: mutates the plan in place, writes images + logs, returns per-panel errors. */
export async function generatePanels(plan: ChapterPlan, deps: GeneratePanelsDeps): Promise<{ outputFiles: string[]; errors: string[] }> {
  const outputFiles: string[] = [];
  const errors: string[] = [];
  const log = deps.log ?? (() => {});
  const rawDir = path.join(deps.chapterRoot, 'raw', deps.modelAlias);
  await mkdir(rawDir, { recursive: true });

  for (const { page, panel } of selectPanels(plan, deps)) {
    const version = panel.versions.reduce((n, v) => Math.max(n, v.version), 0) + 1;
    const file = panelFileName(plan.chapterNumber, page.pageNumber, panel.panelNumber, version);
    const rel = path.posix.join('raw', deps.modelAlias, file);
    try {
      const { refs, groups } = await deps.refsFor(panel.characterIds, panel.locationId);
      const res = await deps.generate({ prompt: panel.prompt, aspectRatio: panel.aspectRatio, refs, refGroups: groups });
      if (res.imageUrls.length === 0) throw new Error('no images returned');
      const dest = path.join(deps.chapterRoot, rel);
      await deps.download(res.imageUrls[0]!, dest);
      let vision: { faces: Array<{ x: number; y: number; w: number; h: number }>; imageSize: { w: number; h: number } } | undefined;
      if (deps.detectFaces) {
        try { vision = await deps.detectFaces(dest); } catch (e) { log(`[panels] face detection failed for ${file}: ${errorMessage(e)}`); }
      }
      const entry = { version, file: rel, model: res.model.endpoint, requestId: res.requestId, timestamp: new Date().toISOString(), notes: deps.notes, ...(vision ? { faces: vision.faces, imageSize: vision.imageSize } : {}) };
      // Sidecar first: a failed log write must not leave a phantom version in the plan.
      await writeFile(`${dest}.log.json`, JSON.stringify({ ...entry, page: page.pageNumber, panel: panel.panelNumber, prompt: panel.prompt, refs }, null, 2));
      panel.versions.push(entry);
      if (panel.approvedVersion == null) panel.approvedVersion = version;
      if (deps.persist) await deps.persist(plan);
      outputFiles.push(dest);
      log(`[panels] page ${page.pageNumber} panel ${panel.panelNumber} → ${file}`);
    } catch (e) {
      const msg = errorMessage(e);
      errors.push(`page ${page.pageNumber} panel ${panel.panelNumber}: ${msg}`);
      log(`[panels] page ${page.pageNumber} panel ${panel.panelNumber}: ERROR ${msg}`);
    }
  }
  return { outputFiles, errors };
}

export interface PanelStageOptions extends PanelSelection {
  /** Skip the Gemini face pass (default: run it when GEMINI_API_KEY is set). */
  noFaces?: boolean; chapter: number; model?: string; notes?: string; verbose?: boolean; dryRun?: boolean }

/** CLI runner: wires real providers into generatePanels. */
export async function runPanels(options: PanelStageOptions): Promise<StageResult> {
  const start = Date.now();
  const env = loadEnvFile(`${PATHS.pipelineRoot}/.env`);
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;

  const plan = await loadChapterPlan(options.chapter);
  if (!plan) return { stage: 'panels', success: false, outputFiles: [], errors: [`pages.json not found. Run: pnpm dev plan -c ${options.chapter}`], duration: Date.now() - start };

  let model: ModelSpec;
  try { model = resolveModel(options.model); }
  catch (e) { return { stage: 'panels', success: false, outputFiles: [], errors: [errorMessage(e)], duration: Date.now() - start }; }

  if (options.dryRun) {
    const todo = selectPanels(plan, options).map(({ page, panel }) => `p${page.pageNumber}/${panel.panelNumber}`);
    console.log(`[panels] dry run via ${model.endpoint}: ${todo.length} panel(s): ${todo.join(' ')}`);
    return { stage: 'panels', success: true, outputFiles: [], errors: [], duration: Date.now() - start };
  }

  // Loaded lazily so dry runs and tests never load the provider SDKs.
  const { configureProvider, generateImage, downloadAndSave, uploadToFal } = await import('../generation/kling-client.js');
  try { configureProvider(model); }
  catch (e) { return { stage: 'panels', success: false, outputFiles: [], errors: [errorMessage(e)], duration: Date.now() - start }; }

  const chapterRoot = PATHS.chapterOutput(options.chapter).root;
  const refCache = new Map<string, string[]>();
  const refsFor = async (ids: string[], locationId?: string) => {
    const refs: string[] = [];
    const groups: RefGroup[] = [];
    let budget = model.maxRefs;
    const perChar = ids.length ? Math.max(1, Math.floor(budget / ids.length)) : 0;
    for (const id of ids) {
      if (!refCache.has(id)) {
        const local = await loadCharacterReferences(id);
        if (local.length === 0) console.warn(`  Warning: no reference images for ${id}`);
        refCache.set(id, model.provider === 'runway' ? local : await Promise.all(local.map(uploadToFal)));
      }
      const take = refCache.get(id)!.slice(0, Math.min(perChar, budget));
      if (take.length > 0) { refs.push(...take); groups.push({ label: id, count: take.length }); budget -= take.length; }
    }
    if (locationId) {
      const locRefs = (await loadLocationReferences(locationId)).slice(0, Math.min(2, budget));
      if (locRefs.length > 0) { refs.push(...(model.provider === 'runway' ? locRefs : await Promise.all(locRefs.map(uploadToFal)))); groups.push({ label: `the setting (${locationId})`, count: locRefs.length }); budget -= locRefs.length; }
    }
    return { refs, groups };
  };

  const { outputFiles, errors } = await generatePanels(plan, {
    chapterRoot, modelAlias: model.alias, refsFor, notes: options.notes ?? '', pages: options.pages, panel: options.panel, redo: options.redo,
    log: (m) => console.log(m),
    persist: async (p) => { await saveChapterPlan(p); },
    detectFaces: (!options.noFaces && process.env['GEMINI_API_KEY'])
      ? async (file) => { const { detectFaces } = await import('../generation/vision.js'); return detectFaces(file, process.env['GEMINI_API_KEY']!); }
      : undefined,
    generate: async (req) => {
      const bindings = req.refGroups.length ? buildRefBindings(model, req.refGroups) + ' ' : '';
      const r = await generateImage({ model: model.alias, prompt: bindings + req.prompt, imageUrls: req.refs, aspectRatio: req.aspectRatio, resolution: '2K' });
      return { imageUrls: r.imageUrls, requestId: r.requestId, model: { alias: r.model.alias, endpoint: r.model.endpoint } };
    },
    download: downloadAndSave,
  });
  await saveChapterPlan(plan);
  return { stage: 'panels', success: errors.length === 0, outputFiles, errors, duration: Date.now() - start };
}

/** Backfill face boxes on approved versions that lack them (one Gemini call per panel). */
export async function runFaces(options: { chapter: number; pages?: number[]; redo?: boolean }): Promise<StageResult> {
  const start = Date.now();
  const env = loadEnvFile(`${PATHS.pipelineRoot}/.env`);
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) return { stage: 'faces', success: false, outputFiles: [], errors: ['GEMINI_API_KEY is not set'], duration: Date.now() - start };
  const plan = await loadChapterPlan(options.chapter);
  if (!plan) return { stage: 'faces', success: false, outputFiles: [], errors: [`pages.json not found. Run: pnpm dev plan -c ${options.chapter}`], duration: Date.now() - start };
  const { detectFaces } = await import('../generation/vision.js');
  const root = PATHS.chapterOutput(options.chapter).root;
  const errors: string[] = [];
  let done = 0;
  for (const page of plan.pages.filter((p) => !options.pages || options.pages.includes(p.pageNumber))) {
    for (const panel of page.panels) {
      const v = panel.versions.find((x) => x.version === panel.approvedVersion);
      if (!v || (v.faces && !options.redo)) continue;
      try {
        const r = await detectFaces(path.join(root, v.file), apiKey);
        v.faces = r.faces; v.imageSize = r.imageSize; done++;
        console.log(`[faces] page ${page.pageNumber} panel ${panel.panelNumber}: ${r.faces.length} face(s)`);
        await saveChapterPlan(plan);
      } catch (e) { errors.push(`page ${page.pageNumber} panel ${panel.panelNumber}: ${errorMessage(e)}`); }
    }
  }
  console.log(`[faces] updated ${done} panel(s)`);
  return { stage: 'faces', success: errors.length === 0, outputFiles: [], errors, duration: Date.now() - start };
}
