/** Review stage: contact sheet of every version per panel → output/ch-NN/review/chNN_pPP.png; approve: pick the winner. */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { StageResult } from '../types/pipeline.js';
import type { ChapterPlan, PagePlan } from '../types/page-plan.js';
import { PATHS } from '../config/paths.js';
import { loadChapterPlan, saveChapterPlan, findPanel, pageFileName } from '../planning/page-plan.js';

export interface ReviewOptions { chapter: number; pages?: number[] }
export interface ApproveOptions { chapter: number; page: number; panel: number; version: number }

const PAD = 12;
const LABEL_H = 28;
const DEFAULT_THUMB_WIDTH = 320;

interface Layer { input: Buffer; left: number; top: number }

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c);
}

function label(text: string, w: number, approved: boolean): Buffer {
  const bg = approved ? '#2e7d32' : '#333';
  return Buffer.from(
    `<svg width="${w}" height="${LABEL_H}"><rect width="${w}" height="${LABEL_H}" fill="${bg}"/>` +
    `<text x="8" y="19" font-family="sans-serif" font-size="16" fill="#fff">${escapeXml(text)}${approved ? ' ✓' : ''}</text></svg>`,
  );
}

/** One row per panel; each version as a thumbnail with a label, the approved one highlighted. `chapterRoot` resolves version files. */
export async function renderContactSheet(plan: ChapterPlan, page: PagePlan, chapterRoot: string, opts: { thumbWidth?: number } = {}): Promise<Buffer> {
  const tw = opts.thumbWidth ?? DEFAULT_THUMB_WIDTH;
  const rows: Array<{ h: number; layers: Layer[] }> = [];
  let maxCols = 1;
  for (const panel of page.panels) {
    const layers: Layer[] = [];
    let rowH = LABEL_H;
    maxCols = Math.max(maxCols, panel.versions.length);
    if (panel.versions.length === 0) {
      layers.push({ input: label(`panel ${panel.panelNumber}: no versions`, tw, false), left: PAD, top: 0 });
    }
    for (const [i, v] of panel.versions.entries()) {
      const file = path.join(chapterRoot, v.file);
      const x = PAD + i * (tw + PAD);
      const exists = existsSync(file);
      layers.push({ input: label(`panel ${panel.panelNumber}  v${v.version}${exists ? '' : ' (missing)'}`, tw, v.version === panel.approvedVersion), left: x, top: 0 });
      if (exists) {
        const thumb = await sharp(file).resize(tw, undefined, { fit: 'inside' }).png().toBuffer();
        const th = (await sharp(thumb).metadata()).height ?? 0;
        layers.push({ input: thumb, left: x, top: LABEL_H });
        rowH = Math.max(rowH, LABEL_H + th);
      }
    }
    rows.push({ h: rowH, layers });
  }
  const width = PAD + maxCols * (tw + PAD);
  const height = rows.reduce((n, r) => n + r.h + PAD, PAD);
  const all: Layer[] = [];
  let y = PAD;
  for (const r of rows) {
    for (const l of r.layers) all.push({ ...l, top: l.top + y });
    y += r.h + PAD;
  }
  return sharp({ create: { width, height, channels: 3, background: { r: 245, g: 245, b: 245 } } }).composite(all).png().toBuffer();
}

/** Mutates the plan; throws if the panel or version does not exist. */
export function approvePanel(plan: ChapterPlan, page: number, panel: number, version: number): void {
  const p = findPanel(plan, page, panel);
  if (!p) throw new Error(`page ${page} panel ${panel} not in plan`);
  if (!p.versions.some((v) => v.version === version)) throw new Error(`page ${page} panel ${panel} has no version ${version}`);
  p.approvedVersion = version;
}

export async function runReview(options: ReviewOptions): Promise<StageResult> {
  const start = Date.now();
  const plan = await loadChapterPlan(options.chapter);
  if (!plan) {
    return { stage: 'review', success: false, outputFiles: [], duration: Date.now() - start,
      errors: [`pages.json not found for chapter ${options.chapter}. Run: pnpm dev plan -c ${options.chapter}`] };
  }
  const paths = PATHS.chapterOutput(options.chapter);
  await mkdir(paths.review, { recursive: true });
  const outputFiles: string[] = [];
  const pages = plan.pages.filter((p) => !options.pages || options.pages.includes(p.pageNumber));
  for (const page of pages) {
    const out = path.join(paths.review, pageFileName(options.chapter, page.pageNumber));
    await writeFile(out, await renderContactSheet(plan, page, paths.root));
    outputFiles.push(out);
    const versions = page.panels.reduce((n, p) => n + p.versions.length, 0);
    console.log(`[review] page ${page.pageNumber}: ${page.panels.length} panels, ${versions} versions → ${path.basename(out)}`);
  }
  return { stage: 'review', success: true, outputFiles, errors: [], duration: Date.now() - start };
}

export async function runApprove(options: ApproveOptions): Promise<StageResult> {
  const start = Date.now();
  const plan = await loadChapterPlan(options.chapter);
  if (!plan) {
    return { stage: 'approve', success: false, outputFiles: [], duration: Date.now() - start,
      errors: [`pages.json not found for chapter ${options.chapter}. Run: pnpm dev plan -c ${options.chapter}`] };
  }
  try {
    approvePanel(plan, options.page, options.panel, options.version);
  } catch (e) {
    return { stage: 'approve', success: false, outputFiles: [], errors: [(e as Error).message], duration: Date.now() - start };
  }
  const file = await saveChapterPlan(plan);
  console.log(`[approve] page ${options.page} panel ${options.panel} → v${options.version}`);
  return { stage: 'approve', success: true, outputFiles: [file], errors: [], duration: Date.now() - start };
}
