/** Compose stage: approved panels from pages.json → output/ch-NN/pages/chNN_pPP.png */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { StageResult } from '../types/pipeline.js';
import { PATHS } from '../config/paths.js';
import { loadChapterPlan, approvedFile, pageFileName } from '../planning/page-plan.js';
import { composePage } from '../layout/compose.js';

export interface ComposeOptions { chapter: number; pages?: number[]; verbose?: boolean; dryRun?: boolean }

export async function runCompose(options: ComposeOptions): Promise<StageResult> {
  const start = Date.now();
  const plan = await loadChapterPlan(options.chapter);
  if (!plan) {
    return { stage: 'compose', success: false, outputFiles: [], duration: Date.now() - start,
      errors: [`pages.json not found for chapter ${options.chapter}. Run: pnpm dev plan -c ${options.chapter}`] };
  }
  const outDir = PATHS.chapterOutput(options.chapter).pages;
  const outputFiles: string[] = [];
  const errors: string[] = [];
  const pages = plan.pages.filter((p) => !options.pages || options.pages.includes(p.pageNumber));
  let totalMissing = 0;

  if (!options.dryRun) await mkdir(outDir, { recursive: true });
  for (const page of pages) {
    const panelFiles: Record<number, string | null> = {};
    let missing = 0;
    for (const panel of page.panels) {
      const f = approvedFile(plan, panel);
      panelFiles[panel.panelNumber] = f;
      if (!f) missing++;
    }
    totalMissing += missing;
    const out = path.join(outDir, pageFileName(options.chapter, page.pageNumber));
    const summary = `[compose] page ${page.pageNumber}: ${page.panels.length - missing}/${page.panels.length} panels → ${path.basename(out)}${missing ? ` (${missing} missing)` : ''}`;
    if (options.dryRun) { if (options.verbose) console.log(summary); continue; }
    try {
      const buf = await composePage({
        canvas: page.layout.canvas, slots: page.layout.slots, panelFiles,
        missingLabel: (n) => `MISSING p${String(page.pageNumber).padStart(2, '0')} panel ${n}`,
      });
      await writeFile(out, buf);
      outputFiles.push(out);
      if (options.verbose) console.log(summary);
    } catch (e) {
      errors.push(`page ${page.pageNumber}: ${(e as Error).message}`);
    }
  }
  const missingNote = totalMissing ? `, ${totalMissing} panels missing` : '';
  if (options.dryRun) console.log(`[compose] dry run: would write ${pages.length} pages to ${outDir}${missingNote}`);
  else console.log(`[compose] wrote ${outputFiles.length}/${pages.length} pages to ${outDir}${missingNote}`);
  return { stage: 'compose', success: errors.length === 0, outputFiles, errors, duration: Date.now() - start };
}
