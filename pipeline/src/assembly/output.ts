/**
 * Output configuration and format helpers for Webtoon Canvas assembly.
 *
 * Re-exports config from types and provides filename formatting
 * and dimension validation utilities.
 */

export { WEBTOON_CONFIG } from '../types/overlay.js';
export type { AssemblyConfig } from '../types/overlay.js';

/**
 * Format an output filename for a Webtoon strip.
 *
 * @param chapter - Chapter number (zero-padded to 2 digits)
 * @param stripIndex - Strip index (zero-padded to 3 digits, 1-based)
 * @param format - Output format ('jpeg' or 'png')
 * @returns Formatted filename, e.g. 'ch01_strip_001.jpg'
 */
export function formatOutputFilename(
  chapter: number,
  stripIndex: number,
  format: 'jpeg' | 'png',
): string {
  const ch = String(chapter).padStart(2, '0');
  const idx = String(stripIndex).padStart(3, '0');
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  return `ch${ch}_strip_${idx}.${ext}`;
}

/** Result of validating strip dimensions. */
export interface DimensionValidation {
  valid: boolean;
  warnings: string[];
}

/**
 * Validate that a strip's dimensions meet Webtoon Canvas requirements.
 *
 * @param width - Strip width in pixels
 * @param height - Strip height in pixels
 * @returns Validation result with any warnings
 */
export function validateStripDimensions(
  width: number,
  height: number,
): DimensionValidation {
  const warnings: string[] = [];

  if (width !== 800) {
    warnings.push(`Strip width is ${width}px, expected 800px`);
  }

  if (height > 1280) {
    warnings.push(`Strip height ${height}px exceeds 1280px maximum`);
  }

  // Rough estimate: width * height * 3 bytes per pixel (RGB)
  // 2MB = 2 * 1024 * 1024 = 2_097_152 bytes
  const estimatedBytes = width * height * 3;
  if (estimatedBytes > 2_097_152) {
    warnings.push(
      `Estimated uncompressed size ${(estimatedBytes / 1_048_576).toFixed(1)}MB may produce a file exceeding 2MB`,
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
