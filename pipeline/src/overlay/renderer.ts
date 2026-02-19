/**
 * Page overlay renderer — composites speech balloons and SFX onto panel images.
 *
 * Orchestrates balloon generation, text measurement, and SFX rendering
 * to produce a lettered PNG from a raw panel image and script data.
 */

import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import type { PageOverlayData, OverlayConfig, BalloonType } from '../types/overlay.js';
import { DEFAULT_OVERLAY_CONFIG } from '../types/overlay.js';
import { generateBalloonSvg } from './balloon.js';
import { calculateBalloonSize } from './text-measure.js';
import { renderSfx } from './sfx.js';

/**
 * Overlay dialogue balloons and SFX text onto a panel image.
 *
 * For each dialogue line:
 * 1. Auto-sizes the balloon to fit text
 * 2. Generates an SVG balloon (speech/thought/narration)
 * 3. Calculates placement using a zone-based heuristic
 *
 * For SFX text: renders as large styled text at the bottom of the image.
 *
 * @param imagePath - Path to the source panel image (from raw/)
 * @param overlayData - Dialogue lines and SFX data for this page
 * @param config - Optional overlay configuration (uses defaults if omitted)
 * @returns Promise resolving to a PNG buffer with all overlays composited
 */
export async function overlayPage(
  imagePath: string,
  overlayData: PageOverlayData,
  config: OverlayConfig = DEFAULT_OVERLAY_CONFIG,
): Promise<Buffer> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const imageWidth = metadata.width ?? 800;
  const imageHeight = metadata.height ?? 1200;

  const composites: OverlayOptions[] = [];

  // --- Dialogue balloons ---
  const lines = overlayData.dialogueLines;
  const panelCount = Math.max(overlayData.panelCount, 1);

  // Divide image into vertical zones by panel count
  const zoneHeight = Math.floor(imageHeight / panelCount);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const balloonType: BalloonType = line.type as BalloonType;

    // Calculate auto-sized balloon dimensions
    const { width: bw, height: bh } = await calculateBalloonSize(
      line.line,
      config,
    );

    // Generate SVG balloon buffer
    const svgBuffer = generateBalloonSvg(line.line, bw, bh, balloonType);

    // Placement heuristic: distribute across zones
    // Each dialogue line maps to a zone based on its index relative to panel count
    const zoneIndex = Math.min(
      Math.floor((i / Math.max(lines.length, 1)) * panelCount),
      panelCount - 1,
    );

    // Position within the zone: offset rightward for alternating lines
    const isEven = i % 2 === 0;
    const xPos = isEven
      ? Math.max(10, Math.floor(imageWidth * 0.05))
      : Math.max(10, Math.floor(imageWidth - bw - imageWidth * 0.05));

    // Place in the top portion of the zone
    const tailHeight = balloonType === 'speech' ? 30 : 0;
    const yPos = Math.max(
      5,
      zoneIndex * zoneHeight + Math.floor(zoneHeight * 0.1),
    );

    // Clamp to image bounds
    const clampedX = Math.min(xPos, Math.max(0, imageWidth - bw));
    const clampedY = Math.min(yPos, Math.max(0, imageHeight - bh - tailHeight));

    composites.push({
      input: svgBuffer,
      top: clampedY,
      left: clampedX,
    });
  }

  // --- SFX text ---
  if (overlayData.sfx) {
    const sfxBuffer = await renderSfx(overlayData.sfx, config);

    if (sfxBuffer.length > 0) {
      // Place SFX at bottom-center of the image
      const sfxMeta = await sharp(sfxBuffer).metadata();
      const sfxWidth = sfxMeta.width ?? 100;
      const sfxHeight = sfxMeta.height ?? 30;

      const sfxX = Math.max(0, Math.floor((imageWidth - sfxWidth) / 2));
      const sfxY = Math.max(0, imageHeight - sfxHeight - 20);

      composites.push({
        input: sfxBuffer,
        top: sfxY,
        left: sfxX,
      });
    }
  }

  // Composite all overlays onto the source image in one pass
  if (composites.length === 0) {
    // No overlays — return the raw image as-is
    return image.png().toBuffer();
  }

  return sharp(imagePath).composite(composites).png().toBuffer();
}
