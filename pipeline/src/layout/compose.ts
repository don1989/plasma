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

const PLACEHOLDER = { r: 200, g: 200, b: 200 };

function labelSvg(text: string, w: number, h: number): Buffer {
  const size = Math.max(16, Math.floor(w / 14));
  return Buffer.from(
    `<svg width="${w}" height="${h}"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="sans-serif" font-size="${size}" fill="#555">${text}</text></svg>`);
}

/** Compose approved panel images into a white page. Returns a PNG buffer. */
export async function composePage(input: ComposeInput): Promise<Buffer> {
  const border = input.borderPx ?? 4;
  const layers: OverlayOptions[] = [];
  for (const slot of input.slots) {
    const file = input.panelFiles[slot.panelNumber] ?? null;
    // Black frame
    layers.push({
      input: await sharp({ create: { width: slot.w, height: slot.h, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer(),
      left: slot.x, top: slot.y,
    });
    const innerW = slot.w - 2 * border, innerH = slot.h - 2 * border;
    if (file) {
      layers.push({
        input: await sharp(file).resize(innerW, innerH, { fit: 'cover', position: 'centre' }).png().toBuffer(),
        left: slot.x + border, top: slot.y + border,
      });
    } else {
      layers.push({
        input: await sharp({ create: { width: innerW, height: innerH, channels: 3, background: PLACEHOLDER } }).png().toBuffer(),
        left: slot.x + border, top: slot.y + border,
      });
      const label = input.missingLabel?.(slot.panelNumber) ?? `MISSING panel ${slot.panelNumber}`;
      layers.push({ input: labelSvg(label, innerW, innerH), left: slot.x + border, top: slot.y + border });
    }
  }
  return sharp({ create: { width: input.canvas.w, height: input.canvas.h, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite(layers)
    .png()
    .toBuffer();
}
