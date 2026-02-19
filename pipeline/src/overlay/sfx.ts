/**
 * SFX text rendering via Sharp Pango markup.
 *
 * Renders sound effect text as large colored text without
 * a balloon shape, for compositing onto panel images.
 */

import sharp from 'sharp';
import type { OverlayConfig } from '../types/overlay.js';

/**
 * Render SFX text as a PNG buffer.
 *
 * Uses Sharp Pango markup for styled text rendering with
 * the configured SFX font, size, and color.
 *
 * Returns an empty buffer if the text is empty or just an em dash.
 *
 * @param text - The SFX text to render
 * @param config - Overlay configuration with SFX font settings
 * @returns Promise resolving to a PNG buffer of the rendered text
 */
export async function renderSfx(
  text: string,
  config: OverlayConfig,
): Promise<Buffer> {
  // Skip empty or dash-only SFX
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed === '\u2014') {
    return Buffer.alloc(0);
  }

  const pangoMarkup = `<span font="${config.sfxFont} ${config.sfxFontSize}" foreground="${config.sfxColor}" letter_spacing="2048">${trimmed}</span>`;

  const buffer = await sharp({
    text: {
      text: pangoMarkup,
      font: config.sfxFont,
      dpi: config.dpi,
      rgba: true,
    },
  })
    .png()
    .toBuffer();

  return buffer;
}
