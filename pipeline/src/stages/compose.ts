/** Compose stage: approved panels from pages.json → output/ch-NN/pages/chNN_pPP.png */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { StageResult } from '../types/pipeline.js';
import { PATHS } from '../config/paths.js';
import { loadChapterPlan, approvedFile } from '../planning/page-plan.js';
import { composePage } from '../layout/compose.js';

export interface ComposeOptions { chapter: number; pages?: number[]; verbose?: boolean; dryRun?: boolean }

export function pageFileName(chapter: number, page: number): string {
  return `ch${String(chapter).padStart(2, '0')}_p${String(page).padStart(2, '0')}.png`;
}

export async function runCompose(options: ComposeOptions): Promise<StageResult> {
  const start = Date.now();
  const plan = await loadChapterPlan(options.chapter);
  if (!plan) {
    return { stage: 'compose', success: false, outputFiles: [], duration: Date.now() - start,
      errors: [`pages.json not found for chapter ${options.chapter}. Run: pnpm dev plan -c ${options.chapter}`] };
  }
  const outDir = PATHS.chapterOutput(options.chapter).pages;
  await mkdir(outDir, { recursive: true });
  const outputFiles: string[] = [];
  const errors: string[] = [];
  const pages = plan.pages.filter((p) => !options.pages || options.pages.includes(p.pageNumber));

  for (const page of pages) {
    const panelFiles: Record<number, string | null> = {};
    let missing = 0;
    for (const panel of page.panels) {
      const f = approvedFile(plan, panel);
      panelFiles[panel.panelNumber] = f;
      if (!f) missing++;
    }
    const out = path.join(outDir, pageFileName(options.chapter, page.pageNumber));
    if (options.dryRun) { console.log(`[compose] page ${page.pageNumber}: ${page.panels.length - missing}/${page.panels.length} approved → ${out}`); continue; }
    try {
      const buf = await composePage({
        canvas: page.layout.canvas, slots: page.layout.slots, panelFiles,
        missingLabel: (n) => `MISSING p${String(page.pageNumber).padStart(2, '0')} panel ${n}`,
      });
      await writeFile(out, buf);
      outputFiles.push(out);
      console.log(`[compose] page ${page.pageNumber}: ${page.panels.length - missing}/${page.panels.length} panels → ${path.basename(out)}${missing ? ` (${missing} missing)` : ''}`);
    } catch (e) {
      errors.push(`page ${page.pageNumber}: ${(e as Error).message}`);
    }
  }
  return { stage: 'compose', success: errors.length === 0, outputFiles, errors, duration: Date.now() - start };
}
