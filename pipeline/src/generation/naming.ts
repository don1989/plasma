/**
 * Panel image naming convention utilities.
 *
 * Naming format: ch{NN}_p{NNN}_v{N}.{ext}
 * Example: ch01_p003_v1.png
 */

import { readdirSync, existsSync } from 'node:fs';
import type { PanelImageName } from '../types/generation.js';

/** Regex for parsing panel image filenames. */
const PANEL_FILENAME_RE = /^ch(\d{2})_p(\d{3})_v(\d+)\.(png|jpg|jpeg|webp)$/;

/**
 * Generate a panel image filename from its components.
 *
 * @param chapter - Chapter number (padded to 2 digits)
 * @param page - Page number (padded to 3 digits)
 * @param version - Version number
 * @param ext - File extension (default: 'png')
 * @returns Formatted filename string
 */
export function panelImageFilename(
  chapter: number,
  page: number,
  version: number,
  ext: string = 'png',
): string {
  const ch = String(chapter).padStart(2, '0');
  const pg = String(page).padStart(3, '0');
  return `ch${ch}_p${pg}_v${version}.${ext}`;
}

/**
 * Parse a panel image filename into its components.
 *
 * @param filename - Filename to parse (e.g. 'ch01_p003_v1.png')
 * @returns Parsed components or null if filename doesn't match the convention
 */
export function parsePanelImageFilename(filename: string): PanelImageName | null {
  const match = PANEL_FILENAME_RE.exec(filename);
  if (!match) return null;

  const [, chStr, pgStr, verStr, ext] = match;
  return {
    chapter: Number(chStr),
    page: Number(pgStr),
    version: Number(verStr),
    filename,
    extension: ext!,
  };
}

/**
 * Determine the next version number for a panel image by scanning existing files.
 *
 * Finds all existing versions for the given chapter+page prefix in the directory,
 * returns max(version) + 1. Returns 1 if the directory doesn't exist or has no matches.
 *
 * @param rawDir - Directory to scan for existing panel images
 * @param chapter - Chapter number
 * @param page - Page number
 * @returns Next version number to use
 */
export function nextVersion(rawDir: string, chapter: number, page: number): number {
  if (!existsSync(rawDir)) return 1;

  const prefix = `ch${String(chapter).padStart(2, '0')}_p${String(page).padStart(3, '0')}_v`;
  let maxVersion = 0;

  try {
    const files = readdirSync(rawDir);
    for (const file of files) {
      if (file.startsWith(prefix)) {
        const parsed = parsePanelImageFilename(file);
        if (parsed && parsed.version > maxVersion) {
          maxVersion = parsed.version;
        }
      }
    }
  } catch {
    return 1;
  }

  return maxVersion + 1;
}
