/** Letter stage: composed page + pages.json slots → balloons and SFX in the right panels. */
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StageResult } from '../types/pipeline.js';
import type { PagePlan } from '../types/page-plan.js';
import { DEFAULT_OVERLAY_CONFIG } from '../types/overlay.js';
import { PATHS } from '../config/paths.js';
import { loadChapterPlan, pageFileName } from '../planning/page-plan.js';
import { placeBalloons } from '../overlay/placement.js';
import { generateBalloonSvg } from '../overlay/balloon.js';
import { measureText } from '../overlay/text-measure.js';
import { renderSfx } from '../overlay/sfx.js';
import { letterFont } from '../overlay/fonts.js';

// sharp's macOS libvips ships Pango with a CoreText backend that ignores `fontfile`;
// the fontconfig backend honours it (and is Pango's only backend on Linux). Must be
// set before the first text or SVG render creates the process-wide font map.
process.env.PANGOCAIRO_BACKEND ??= 'fc';

export interface LetterOptions { chapter: number; pages?: number[]; dryRun?: boolean }

const INSET = 24;
const SPACING = 12;
const PAD = { x: 22, y: 16 };

function fontSizeFor(slotWidth: number): number {
  return Math.max(18, Math.min(34, Math.round(slotWidth / 28)));
}

export async function letterPage(pageFile: string, page: PagePlan): Promise<Buffer> {
  const font = letterFont();
  const layers: OverlayOptions[] = [];

  for (const slot of page.layout.slots) {
    const panel = page.panels.find((p) => p.panelNumber === slot.panelNumber);
    if (!panel) continue;
    const size = fontSizeFor(slot.w);

    if (panel.dialogue.length > 0) {
      const balloons = await placeBalloons({
        slot, dialogue: panel.dialogue, speakerSides: panel.speakerSides, inset: INSET, spacing: SPACING,
        overrides: panel.balloonOverrides,
        measure: async (text, maxWidth) => {
          const m = await measureText(text, font.family, size, maxWidth - 2 * PAD.x, DEFAULT_OVERLAY_CONFIG.dpi, font.fontfile);
          return { width: m.width + 2 * PAD.x, height: m.height + 2 * PAD.y };
        },
      });
      for (const b of balloons) {
        layers.push({ input: generateBalloonSvg(b.text, b.w, b.h, b.type, { family: font.family, size }, b.tail), left: Math.round(b.x), top: Math.round(b.y) });
      }
    }

    if (panel.sfx.trim()) {
      const sfx = await renderSfx(panel.sfx, { ...DEFAULT_OVERLAY_CONFIG, sfxFontSize: Math.round(size * 1.6) });
      if (sfx.length > 0) {
        const m = await sharp(sfx).metadata();
        layers.push({ input: sfx, left: Math.round(slot.x + (slot.w - (m.width ?? 0)) / 2), top: Math.round(slot.y + slot.h - (m.height ?? 0) - INSET) });
      }
    }
  }
  const img = sharp(pageFile);
  return layers.length ? img.composite(layers).png().toBuffer() : img.png().toBuffer();
}

export async function runLetter(options: LetterOptions): Promise<StageResult> {
  const start = Date.now();
  const plan = await loadChapterPlan(options.chapter);
  if (!plan) return { stage: 'letter', success: false, outputFiles: [], errors: [`pages.json not found. Run: pnpm dev plan -c ${options.chapter}`], duration: Date.now() - start };
  const paths = PATHS.chapterOutput(options.chapter);
  await mkdir(paths.lettered, { recursive: true });
  const outputFiles: string[] = [];
  const errors: string[] = [];
  for (const page of plan.pages.filter((p) => !options.pages || options.pages.includes(p.pageNumber))) {
    const name = pageFileName(options.chapter, page.pageNumber);
    const src = path.join(paths.pages, name);
    if (!existsSync(src)) { errors.push(`page ${page.pageNumber}: composed page missing (${src}); run compose first`); continue; }
    const out = path.join(paths.lettered, name);
    if (options.dryRun) { console.log(`[letter] page ${page.pageNumber}: ${page.panels.reduce((n, p) => n + p.dialogue.length, 0)} balloons → ${out}`); continue; }
    try { await writeFile(out, await letterPage(src, page)); outputFiles.push(out); console.log(`[letter] ${name}`); }
    catch (e) { errors.push(`page ${page.pageNumber}: ${(e as Error).message}`); }
  }
  return { stage: 'letter', success: errors.length === 0, outputFiles, errors, duration: Date.now() - start };
}
