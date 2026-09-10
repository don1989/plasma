/**
 * Plan stage: script.json + character registry → output/ch-NN/pages.json.
 * Re-running keeps existing versions and approvals for unchanged prompts.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { StageOptions, StageResult } from '../types/pipeline.js';
import type { Chapter } from '../types/manga.js';
import { PATHS } from '../config/paths.js';
import { loadCharacterRegistry } from '../characters/registry.js';
import { loadStyleGuide } from '../templates/prompt-generator.js';
import { buildChapterPlan, mergeChapterPlan, loadChapterPlan, saveChapterPlan } from '../planning/page-plan.js';

export async function runPlan(options: StageOptions): Promise<StageResult> {
  const start = Date.now();
  const scriptPath = path.join(PATHS.chapterOutput(options.chapter).root, 'script.json');
  if (!existsSync(scriptPath)) {
    return { stage: 'plan', success: false, outputFiles: [], duration: Date.now() - start,
      errors: [`script.json not found: ${scriptPath}. Run: pnpm stage:script -- -c ${options.chapter}`] };
  }
  const chapter = JSON.parse(await readFile(scriptPath, 'utf-8')) as Chapter;
  const registry = await loadCharacterRegistry();
  const style = loadStyleGuide(PATHS.styleGuide);
  const fresh = buildChapterPlan(chapter, registry, style.stylePrefix);
  const merged = mergeChapterPlan(fresh, await loadChapterPlan(options.chapter));

  if (options.verbose) {
    for (const pg of merged.pages) {
      const desc = pg.panels.map((p) => `${p.panelNumber}:${p.aspectRatio}`).join(' ');
      console.log(`[plan] page ${String(pg.pageNumber).padStart(2, '0')}: ${pg.panels.length} panels  ${desc}`);
    }
  }
  if (options.dryRun) {
    console.log(`[plan] dry run: would write ${merged.pages.length} pages`);
    return { stage: 'plan', success: true, outputFiles: [], errors: [], duration: Date.now() - start };
  }
  const file = await saveChapterPlan(merged);
  console.log(`[plan] wrote ${file} (${merged.pages.length} pages, ${merged.pages.reduce((n, p) => n + p.panels.length, 0)} panels)`);
  return { stage: 'plan', success: true, outputFiles: [file], errors: [], duration: Date.now() - start };
}
