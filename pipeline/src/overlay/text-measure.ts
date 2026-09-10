/**
 * Text measurement via Sharp Pango for auto-sizing balloons.
 *
 * Uses Sharp's text rendering engine to measure the bounding box
 * of text content at the specified font and size.
 */

import sharp from 'sharp';
import type { OverlayConfig } from '../types/overlay.js';

/**
 * Measure the rendered dimensions of text using Sharp Pango.
 *
 * @param text - The text content to measure
 * @param font - Font family name
 * @param fontSize - Font size in points
 * @param maxWidth - Maximum width before wrapping
 * @param dpi - DPI for rendering (default: 150)
 * @param fontfile - Optional path to a font file; needed for bundled fonts Pango
 *   cannot find by family name (only installed fonts are discoverable)
 * @returns Promise resolving to width and height in pixels
 */
export async function measureText(
  text: string,
  font: string,
  fontSize: number,
  maxWidth: number,
  dpi: number = 150,
  fontfile?: string,
): Promise<{ width: number; height: number }> {
  const pangoMarkup = `<span font="${font} ${fontSize}">${text}</span>`;

  const { info } = await sharp({
    text: {
      text: pangoMarkup,
      dpi,
      rgba: true,
      width: maxWidth,
      wrap: 'word' as const,
      ...(fontfile ? { fontfile } : {}),
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });

  return { width: info.width, height: info.height };
}

/**
 * Calculate balloon dimensions for a given text string.
 *
 * Measures the text, adds padding, and clamps to maxBalloonWidth.
 *
 * @param text - The dialogue text
 * @param config - Overlay configuration with padding and max width
 * @returns Promise resolving to balloon width and height in pixels
 */
export async function calculateBalloonSize(
  text: string,
  config: OverlayConfig,
): Promise<{ width: number; height: number }> {
  const measured = await measureText(
    text,
    config.font,
    config.fontSize,
    config.maxBalloonWidth - 2 * config.balloonPadding.x,
    config.dpi,
  );

  const width = Math.min(
    measured.width + 2 * config.balloonPadding.x,
    config.maxBalloonWidth,
  );
  const height = measured.height + 2 * config.balloonPadding.y;

  return { width, height };
}

export interface RenderTextOptions {
  family: string;
  fontfile?: string;
  /** Font size in CSS px (rendered at 72 dpi). */
  size: number;
  /** Word-wrap width in px. */
  maxWidth: number;
  align?: 'left' | 'centre' | 'right';
}

/**
 * Render text to a transparent RGBA PNG with Pango doing the wrapping and shaping.
 *
 * Rendered at 72 dpi so `size` is in px and matches SVG font sizes elsewhere.
 */
export async function renderText(
  text: string,
  { family, fontfile, size, maxWidth, align = 'centre' }: RenderTextOptions,
): Promise<{ png: Buffer; width: number; height: number }> {
  const { data, info } = await sharp({
    text: {
      text: `<span font="${family} ${size}">${escapePango(text)}</span>`,
      dpi: 72,
      rgba: true,
      width: maxWidth,
      wrap: 'word',
      align,
      ...(fontfile ? { fontfile } : {}),
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { png: data, width: info.width, height: info.height };
}

function escapePango(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
