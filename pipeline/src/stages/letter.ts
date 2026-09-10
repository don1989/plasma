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
import type { Rect } from '../overlay/placement.js';
import type { PanelPlan, SlotRect } from '../types/page-plan.js';
import { placeBalloons } from '../overlay/placement.js';
import { generateBalloonShapeSvg } from '../overlay/balloon.js';
import { renderText } from '../overlay/text-measure.js';
import { renderSfx } from '../overlay/sfx.js';
import { letterFont } from '../overlay/fonts.js';

// sharp's macOS libvips ships Pango with a CoreText backend that ignores `fontfile`;
// the fontconfig backend honours it (and is Pango's only backend on Linux). Must be
// set before the first text or SVG render creates the process-wide font map.
process.env.PANGOCAIRO_BACKEND ??= 'fc';

export interface LetterOptions { chapter: number; pages?: number[]; dryRun?: boolean }

const INSET = 24;
const SPACING = 12;
const PAD = { x: 18, y: 16 };
/** An ellipse must be this much larger than the text box it encloses (wider than tall reads as a manga balloon). */
const ELLIPSE_FACTOR = { x: 1.4, y: 1.4 };

function fontSizeFor(slotWidth: number): number {
  return Math.max(18, Math.min(34, Math.round(slotWidth / 28)));
}

type RenderedText = { png: Buffer; width: number; height: number };

/** Keep a trailing em dash on the word it interrupts ("a qu—"), never alone on a line. */
function letteringText(line: string): string {
  return line.replace(/(\S)\u2014/g, '$1\u2060\u2014');
}

/** Balloon body size that encloses a rendered text box. */
function bodySize(text: RenderedText, type: 'speech' | 'thought' | 'narration'): { width: number; height: number } {
  const f = type === 'narration' ? { x: 1, y: 1 } : ELLIPSE_FACTOR;
  return { width: Math.ceil(text.width * f.x) + 2 * PAD.x, height: Math.ceil(text.height * f.y) + 2 * PAD.y };
}

/**
 * Face boxes of the approved version, mapped from source-image space into the
 * slot after compose's cover-fit + centre crop (with the 4 px frame border).
 */
export function faceRectsForSlot(panel: PanelPlan, slot: SlotRect, border = 4): Rect[] {
  const v = panel.versions.find((x) => x.version === panel.approvedVersion);
  if (!v?.faces?.length || !v.imageSize) return [];
  const innerW = slot.w - 2 * border, innerH = slot.h - 2 * border;
  const scale = Math.max(innerW / v.imageSize.w, innerH / v.imageSize.h);
  const drawnW = v.imageSize.w * scale, drawnH = v.imageSize.h * scale;
  const offX = slot.x + border - (drawnW - innerW) / 2;
  const offY = slot.y + border - (drawnH - innerH) / 2;
  return v.faces.map((f) => ({
    x: offX + f.x * drawnW, y: offY + f.y * drawnH, w: f.w * drawnW, h: f.h * drawnH,
  }));
}

export async function letterPage(pageFile: string, page: PagePlan): Promise<Buffer> {
  const font = letterFont();
  const layers: OverlayOptions[] = [];

  for (const slot of page.layout.slots) {
    const panel = page.panels.find((p) => p.panelNumber === slot.panelNumber);
    if (!panel) continue;
    const size = fontSizeFor(slot.w);

    if (panel.dialogue.length > 0) {
      // Text is rendered once per line inside the measure callback and reused when compositing.
      const rendered = new Map<string, RenderedText>();
      const types = new Map(panel.dialogue.map((d) => [d.line, d.type]));
      const balloons = await placeBalloons({
        slot, dialogue: panel.dialogue, speakerSides: panel.speakerSides, inset: INSET, spacing: SPACING,
        overrides: panel.balloonOverrides,
        avoid: faceRectsForSlot(panel, slot),
        measure: async (text, maxWidth) => {
          const type = types.get(text) ?? 'speech';
          // Wrap narrowly enough that the enclosing body still fits within maxWidth.
          const wrapWidth = Math.floor((maxWidth - 2 * PAD.x) / (type === 'narration' ? 1 : ELLIPSE_FACTOR.x));
          const t = await renderText(letteringText(text), { family: font.family, fontfile: font.fontfile, size, maxWidth: wrapWidth });
          rendered.set(text, t);
          return bodySize(t, type);
        },
      });
      for (const b of balloons) {
        const t = rendered.get(b.text)!;
        const x = Math.round(b.x), y = Math.round(b.y);
        layers.push({ input: generateBalloonShapeSvg(b.w, b.h, b.type, b.tail), left: x, top: y });
        layers.push({ input: t.png, left: Math.round(x + (b.w - t.width) / 2), top: Math.round(y + (b.h - t.height) / 2) });
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
