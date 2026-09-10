/**
 * Page composer: cover-fits approved panel images into their layout slots on a
 * white page, framing each slot in black. Slots with no approved image get a
 * grey placeholder with a MISSING label so the layout can be judged before any
 * generation is paid for.
 */
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import type { SlotRect } from '../types/page-plan.js';

export interface ComposeInput {
  canvas: { w: number; h: number };
  slots: SlotRect[];
  /** Approved image path per panel number, or null when nothing is approved. */
  panelFiles: Record<number, string | null>;
  missingLabel?: (panelNumber: number) => string;
  borderPx?: number;
}

const PLACEHOLDER_GREY = { r: 200, g: 200, b: 200, alpha: 1 };
const FRAME_BLACK = { r: 0, g: 0, b: 0, alpha: 1 };
const PAGE_WHITE = { r: 255, g: 255, b: 255 };

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Solid rectangle layer built by sharp at composite time (no intermediate PNG). */
function rect(w: number, h: number, background: { r: number; g: number; b: number; alpha: number }, left: number, top: number): OverlayOptions {
  return { input: { create: { width: w, height: h, channels: 4, background } }, left, top };
}

function labelSvg(text: string, w: number, h: number): Buffer {
  const size = Math.max(16, Math.floor(w / 14));
  return Buffer.from(
    `<svg width="${w}" height="${h}"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="sans-serif" font-size="${size}" fill="#555">${escapeXml(text)}</text></svg>`);
}

/** Compose approved panel images into a white page. Returns a PNG buffer. */
export async function composePage(input: ComposeInput): Promise<Buffer> {
  const border = input.borderPx ?? 4;
  const layers: OverlayOptions[] = [];
  for (const slot of input.slots) {
    const innerW = slot.w - 2 * border, innerH = slot.h - 2 * border;
    if (innerW <= 0 || innerH <= 0) throw new Error(`slot for panel ${slot.panelNumber} is smaller than its border`);
    const file = input.panelFiles[slot.panelNumber] ?? null;
    const innerX = slot.x + border, innerY = slot.y + border;

    layers.push(rect(slot.w, slot.h, FRAME_BLACK, slot.x, slot.y));
    if (file) {
      layers.push({
        input: await sharp(file).resize(innerW, innerH, { fit: 'cover', position: 'centre' }).png().toBuffer(),
        left: innerX, top: innerY,
      });
    } else {
      layers.push(rect(innerW, innerH, PLACEHOLDER_GREY, innerX, innerY));
      const label = input.missingLabel?.(slot.panelNumber) ?? `MISSING panel ${slot.panelNumber}`;
      layers.push({ input: labelSvg(label, innerW, innerH), left: innerX, top: innerY });
    }
  }
  return sharp({ create: { width: input.canvas.w, height: input.canvas.h, channels: 3, background: PAGE_WHITE } })
    .composite(layers)
    .png()
    .toBuffer();
}
