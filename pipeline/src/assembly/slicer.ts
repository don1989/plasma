/**
 * Webtoon strip slicer.
 *
 * Takes a tall vertical strip buffer and slices it into 800x1280px
 * (or configured dimensions) individual strip images, suitable for
 * upload to Webtoon Canvas.
 */

import sharp from 'sharp';
import path from 'node:path';
import type { AssemblyConfig } from '../types/overlay.js';
import { WEBTOON_CONFIG } from '../types/overlay.js';
import { formatOutputFilename } from './output.js';

/**
 * Slice a tall vertical strip into Webtoon-sized strip images.
 *
 * The strip is divided into slices of `config.sliceHeight` pixels
 * (default 1280). The last slice may be shorter if the total height
 * is not evenly divisible.
 *
 * Each slice is saved to the output directory with the naming convention
 * `ch01_strip_001.jpg` (or .png depending on format config).
 *
 * @param stripBuffer - The tall vertical strip as a PNG buffer
 * @param outputDir - Directory to write strip images to
 * @param chapter - Chapter number for filename formatting
 * @param config - Assembly configuration (defaults to WEBTOON_CONFIG)
 * @returns Array of absolute paths to written strip files
 */
export async function sliceForWebtoon(
  stripBuffer: Buffer,
  outputDir: string,
  chapter: number,
  config: AssemblyConfig = WEBTOON_CONFIG,
): Promise<string[]> {
  const metadata = await sharp(stripBuffer).metadata();
  const totalHeight = metadata.height ?? 0;
  const totalWidth = metadata.width ?? config.width;

  if (totalHeight === 0) {
    console.warn('[slicer] Strip buffer has zero height, no slices to produce');
    return [];
  }

  const outputPaths: string[] = [];
  let stripIndex = 1;

  for (let top = 0; top < totalHeight; top += config.sliceHeight) {
    const sliceHeight = Math.min(config.sliceHeight, totalHeight - top);

    let pipeline = sharp(stripBuffer).extract({
      left: 0,
      top,
      width: totalWidth,
      height: sliceHeight,
    });

    if (config.format === 'jpeg') {
      pipeline = pipeline.jpeg({
        quality: config.jpegQuality,
        mozjpeg: true,
      });
    } else {
      pipeline = pipeline.png();
    }

    const filename = formatOutputFilename(chapter, stripIndex, config.format);
    const outputPath = path.join(outputDir, filename);

    await pipeline.toFile(outputPath);
    outputPaths.push(outputPath);
    stripIndex++;
  }

  return outputPaths;
}
