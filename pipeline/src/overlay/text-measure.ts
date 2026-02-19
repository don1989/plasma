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
 * @returns Promise resolving to width and height in pixels
 */
export async function measureText(
  text: string,
  font: string,
  fontSize: number,
  maxWidth: number,
  dpi: number = 150,
): Promise<{ width: number; height: number }> {
  const pangoMarkup = `<span font="${font} ${fontSize}">${text}</span>`;

  const { info } = await sharp({
    text: {
      text: pangoMarkup,
      dpi,
      rgba: true,
      width: maxWidth,
      wrap: 'word' as const,
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
