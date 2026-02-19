/**
 * Vertical panel stacking for Webtoon strip assembly.
 *
 * Takes an ordered array of panel images (with metadata about splash/
 * double-spread pages) and composites them into a single tall vertical
 * strip with configurable gutters between panels.
 */

import sharp from 'sharp';
import type { PanelMetadata, AssemblyResult, AssemblyConfig } from '../types/overlay.js';
import { WEBTOON_CONFIG } from '../types/overlay.js';

/** Maximum recommended strip height before warning (78+ strips). */
const MAX_RECOMMENDED_HEIGHT = 100_000;

/**
 * Assemble an ordered list of panel images into a single vertical strip.
 *
 * Each panel is resized to the configured width (800px default) preserving
 * aspect ratio. Panels are stacked vertically with black gutters between them.
 *
 * - Double-spread panels: resized to target width, resulting in a shorter panel
 * - Splash panels: resized to target width, preserving their taller aspect ratio
 * - Standard panels: resized to target width, preserving aspect ratio
 *
 * @param panels - Ordered array of panel metadata (must include file paths)
 * @param config - Assembly configuration (defaults to WEBTOON_CONFIG)
 * @returns The composited strip buffer, total height, and panel count
 */
export async function assembleVerticalStrip(
  panels: PanelMetadata[],
  config: AssemblyConfig = WEBTOON_CONFIG,
): Promise<AssemblyResult> {
  if (panels.length === 0) {
    // Return a minimal 1px transparent strip for empty input
    const emptyBuffer = await sharp({
      create: {
        width: config.width,
        height: 1,
        channels: 4,
        background: config.gutterColor,
      },
    })
      .png()
      .toBuffer();

    return { stripBuffer: emptyBuffer, totalHeight: 1, panelCount: 0 };
  }

  // Resize each panel and calculate its scaled height
  const resizedPanels: Array<{ buffer: Buffer; scaledHeight: number }> = [];

  for (const panel of panels) {
    // All panel types (standard, splash, double-spread) get the same resize:
    // fit to target width, preserving aspect ratio.
    // The difference is in the source dimensions:
    //   - double-spread: wider source -> shorter result
    //   - splash: taller source -> taller result
    //   - standard: normal proportions
    const resizedBuffer = await sharp(panel.path)
      .resize(config.width, null, { fit: 'inside' })
      .png()
      .toBuffer();

    // Calculate the scaled height from original dimensions
    const scaledHeight = Math.round(
      panel.height * (config.width / panel.width),
    );

    resizedPanels.push({ buffer: resizedBuffer, scaledHeight });
  }

  // Calculate total strip height
  const panelHeightSum = resizedPanels.reduce(
    (sum, p) => sum + p.scaledHeight,
    0,
  );
  const totalGutterHeight =
    (resizedPanels.length - 1) * config.gutterHeight;
  const totalHeight = panelHeightSum + totalGutterHeight;

  if (totalHeight > MAX_RECOMMENDED_HEIGHT) {
    console.warn(
      `[strip-builder] Warning: total strip height ${totalHeight}px exceeds ${MAX_RECOMMENDED_HEIGHT}px ` +
        `(would produce ${Math.ceil(totalHeight / config.sliceHeight)}+ strips)`,
    );
  }

  // Create blank canvas with gutter color background
  const canvas = sharp({
    create: {
      width: config.width,
      height: totalHeight,
      channels: 4,
      background: config.gutterColor,
    },
  });

  // Build composite operations — place each panel at cumulative Y offset
  const composites: sharp.OverlayOptions[] = [];
  let yOffset = 0;

  for (const panel of resizedPanels) {
    composites.push({
      input: panel.buffer,
      top: yOffset,
      left: 0,
    });
    yOffset += panel.scaledHeight + config.gutterHeight;
  }

  const stripBuffer = await canvas
    .composite(composites)
    .png()
    .toBuffer();

  return {
    stripBuffer,
    totalHeight,
    panelCount: panels.length,
  };
}
