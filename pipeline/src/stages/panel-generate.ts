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
import { resolveModel, buildRefBindings, type ModelSpec } from '../generation/models.js';

export interface RefGroup { label: string; count: number }
export interface GenerateRequest { prompt: string; aspectRatio: string; refs: string[]; refGroups: RefGroup[] }
export interface GenerateResponse { imageUrls: string[]; requestId: string; model: { alias: string; endpoint: string } }

export interface GeneratePanelsDeps {
  chapterRoot: string;
  modelAlias: string;
  /** Reference image paths/URLs for the panel's characters, plus one binding group per character (in the same order). */
  refsFor: (characterIds: string[]) => Promise<{ refs: string[]; groups: RefGroup[] }>;
  generate: (req: GenerateRequest) => Promise<GenerateResponse>;
  download: (url: string, dest: string) => Promise<void>;
  notes: string;
  pages?: number[];
  panel?: number;
  redo?: boolean;
  log?: (msg: string) => void;
}

export function panelFileName(chapter: number, page: number, panel: number, version: number): string {
  return `ch${String(chapter).padStart(2, '0')}_p${String(page).padStart(2, '0')}_pn${panel}_v${version}.png`;
}

function shouldGenerate(panel: PanelPlan, deps: GeneratePanelsDeps): boolean {
  if (deps.panel != null && panel.panelNumber !== deps.panel) return false;
  return deps.redo === true || panel.approvedVersion == null;
}

/** Core: mutates the plan in place, writes images + logs, returns per-panel errors. */
export async function generatePanels(plan: ChapterPlan, deps: GeneratePanelsDeps): Promise<{ outputFiles: string[]; errors: string[] }> {
  const outputFiles: string[] = [];
  const errors: string[] = [];
  const log = deps.log ?? (() => {});
  const rawDir = path.join(deps.chapterRoot, 'raw', deps.modelAlias);
  await mkdir(rawDir, { recursive: true });

  const pages: PagePlan[] = plan.pages.filter((p) => !deps.pages || deps.pages.includes(p.pageNumber));
  for (const page of pages) {
    for (const panel of page.panels) {
      if (!shouldGenerate(panel, deps)) continue;
      const version = panel.versions.reduce((n, v) => Math.max(n, v.version), 0) + 1;
      const file = panelFileName(plan.chapterNumber, page.pageNumber, panel.panelNumber, version);
      const rel = path.posix.join('raw', deps.modelAlias, file);
      try {
        const { refs, groups } = await deps.refsFor(panel.characterIds);
        const res = await deps.generate({ prompt: panel.prompt, aspectRatio: panel.aspectRatio, refs, refGroups: groups });
        if (res.imageUrls.length === 0) throw new Error('no images returned');
        const dest = path.join(deps.chapterRoot, rel);
        await deps.download(res.imageUrls[0]!, dest);
        const entry = { version, file: rel, model: res.model.endpoint, requestId: res.requestId, timestamp: new Date().toISOString(), notes: deps.notes };
        panel.versions.push(entry);
        if (panel.approvedVersion == null) panel.approvedVersion = version;
        await writeFile(`${dest}.log.json`, JSON.stringify({ ...entry, page: page.pageNumber, panel: panel.panelNumber, prompt: panel.prompt, refs }, null, 2));
        outputFiles.push(dest);
        log(`[panels] page ${page.pageNumber} panel ${panel.panelNumber} → ${file}`);
      } catch (e) {
        errors.push(`page ${page.pageNumber} panel ${panel.panelNumber}: ${(e as Error).message}`);
        log(`[panels] page ${page.pageNumber} panel ${panel.panelNumber}: ERROR ${(e as Error).message}`);
      }
    }
  }
  return { outputFiles, errors };
}

export interface PanelStageOptions { chapter: number; pages?: number[]; panel?: number; model?: string; redo?: boolean; notes?: string; verbose?: boolean; dryRun?: boolean }

/** CLI runner: wires real providers into generatePanels. */
export async function runPanels(options: PanelStageOptions): Promise<StageResult> {
  const start = Date.now();
  const env = loadEnvFile(`${PATHS.pipelineRoot}/.env`);
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;

  const plan = await loadChapterPlan(options.chapter);
  if (!plan) return { stage: 'panels', success: false, outputFiles: [], errors: [`pages.json not found. Run: pnpm dev plan -c ${options.chapter}`], duration: Date.now() - start };

  let model: ModelSpec;
  try { model = resolveModel(options.model); }
  catch (e) { return { stage: 'panels', success: false, outputFiles: [], errors: [(e as Error).message], duration: Date.now() - start }; }

  if (options.dryRun) {
    const todo = plan.pages.filter((p) => !options.pages || options.pages.includes(p.pageNumber))
      .flatMap((p) => p.panels.filter((q) => (options.panel == null || q.panelNumber === options.panel) && (options.redo || q.approvedVersion == null)).map((q) => `p${p.pageNumber}/${q.panelNumber}`));
    console.log(`[panels] dry run via ${model.endpoint}: ${todo.length} panel(s): ${todo.join(' ')}`);
    return { stage: 'panels', success: true, outputFiles: [], errors: [], duration: Date.now() - start };
  }

  // Provider SDKs are loaded only on a real run so the pure core stays offline-testable.
  const { configureProvider, generateImage, downloadAndSave, uploadToFal } = await import('../generation/kling-client.js');
  try { configureProvider(model); }
  catch (e) { return { stage: 'panels', success: false, outputFiles: [], errors: [(e as Error).message], duration: Date.now() - start }; }

  const chapterRoot = PATHS.chapterOutput(options.chapter).root;
  const refCache = new Map<string, string[]>();
  const refsFor = async (ids: string[]) => {
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
    return { refs, groups };
  };

  const { outputFiles, errors } = await generatePanels(plan, {
    chapterRoot, modelAlias: model.alias, refsFor, notes: options.notes ?? '', pages: options.pages, panel: options.panel, redo: options.redo,
    log: (m) => console.log(m),
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
