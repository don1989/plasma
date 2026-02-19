/**
 * Image import module for the manual Gemini workflow.
 *
 * Handles copying user-downloaded images into the pipeline's raw/
 * directory with correct naming and versioning, and building
 * generation log entries for traceability.
 */

import { existsSync } from 'node:fs';
import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import type { GenerationLogEntry } from '../types/generation.js';
import { panelImageFilename, nextVersion } from './naming.js';
import { hashPrompt, loadManifest, saveManifest } from './manifest.js';
import { ensureDir } from '../utils/fs.js';
import { parsePanelImageFilename } from './naming.js';

/**
 * Options for importing a manually-generated image.
 */
export interface ImportImageOptions {
  /** Path to the downloaded image file. */
  sourcePath: string;
  /** Chapter number. */
  chapter: number;
  /** Page number. */
  page: number;
  /** Output raw directory (e.g. output/ch-01/raw/). */
  rawDir: string;
  /** Output prompts directory (e.g. output/ch-01/prompts/). */
  promptsDir: string;
  /** Chapter output directory (e.g. output/ch-01/). */
  chapterDir: string;
  /** Optional notes about this generation. */
  notes?: string;
}

/**
 * Result of an image import operation.
 */
export interface ImportImageResult {
  /** Absolute path to the copied image in raw/. */
  destPath: string;
  /** Generation log entry to be recorded in the manifest. */
  entry: GenerationLogEntry;
}

/** Supported image formats for import. */
const SUPPORTED_FORMATS = new Set(['png', 'jpeg', 'webp']);

/**
 * Normalize a file extension for consistency.
 * Maps 'jpeg' to 'jpg', leaves others as-is.
 */
function normalizeExtension(ext: string): string {
  return ext === 'jpeg' ? 'jpg' : ext;
}

/**
 * Import a manually-downloaded image into the pipeline.
 *
 * Copies the source file to the raw/ directory with the correct
 * naming convention and version number. Does NOT delete the source.
 *
 * @param opts - Import options
 * @returns The destination path and a generation log entry
 * @throws Error if source file does not exist or is not a supported image format
 */
export async function importImage(opts: ImportImageOptions): Promise<ImportImageResult> {
  const { sourcePath, chapter, page, rawDir, promptsDir, chapterDir, notes } = opts;

  // 1. Validate source file exists
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  // 2. Validate source is a readable image
  const metadata = await sharp(sourcePath).metadata();
  const format = metadata.format;
  if (!format || !SUPPORTED_FORMATS.has(format)) {
    throw new Error(
      `Unsupported image format: ${format ?? 'unknown'}. Supported: ${[...SUPPORTED_FORMATS].join(', ')}`,
    );
  }

  // 3. Ensure raw/ directory exists
  await ensureDir(rawDir);

  // 4. Get next version number
  const version = nextVersion(rawDir, chapter, page);

  // 5. Build destination filename with normalized extension
  const ext = normalizeExtension(format);
  const filename = panelImageFilename(chapter, page, version, ext);
  const destPath = path.join(rawDir, filename);

  // 6. Copy (never move) the source file
  await copyFile(sourcePath, destPath);

  // 7. Read corresponding prompt file
  const promptFilename = `page-${String(page).padStart(2, '0')}.txt`;
  const promptPath = path.join(promptsDir, promptFilename);
  let promptText = '';

  if (existsSync(promptPath)) {
    promptText = await readFile(promptPath, 'utf-8');
  } else {
    console.warn(`[import] Warning: prompt file not found: ${promptFilename}`);
  }

  // 8. Hash the prompt text
  const promptHash = hashPrompt(promptText);

  // 9. Build generation log entry
  const promptFileRelative = promptText
    ? path.join('prompts', promptFilename)
    : '';

  const entry: GenerationLogEntry = {
    imageFile: filename,
    promptFile: promptFileRelative,
    promptHash,
    model: 'manual',
    timestamp: new Date().toISOString(),
    version,
    approved: false,
    ...(notes ? { notes } : {}),
    ...(promptText ? { promptText } : {}),
  };

  // 10. Return result
  return { destPath, entry };
}

/**
 * Options for approving an image version.
 */
export interface ApproveImageOptions {
  /** Image filename to approve (e.g. "ch01_p003_v1.png"). */
  imageFile: string;
  /** Chapter output directory. */
  chapterDir: string;
}

/**
 * Approve an image version in the generation manifest.
 *
 * Sets the specified image as approved and unapproves any other
 * versions of the same page (only one approved version per page).
 *
 * @param opts - Approval options
 * @throws Error if the image is not found in the manifest
 */
export async function approveImage(opts: ApproveImageOptions): Promise<void> {
  const { imageFile, chapterDir } = opts;

  // Parse the image filename to get the page number
  const parsed = parsePanelImageFilename(imageFile);
  if (!parsed) {
    throw new Error(`Invalid image filename format: ${imageFile}`);
  }

  // Load manifest
  const manifest = await loadManifest(chapterDir, parsed.chapter);

  // Find the target entry
  const targetEntry = manifest.entries.find((e) => e.imageFile === imageFile);
  if (!targetEntry) {
    throw new Error(`Image not found in manifest: ${imageFile}`);
  }

  // Unapprove all other versions of the same page
  for (const entry of manifest.entries) {
    const entryParsed = parsePanelImageFilename(entry.imageFile);
    if (entryParsed && entryParsed.page === parsed.page) {
      entry.approved = false;
    }
  }

  // Approve the target
  targetEntry.approved = true;

  // Save manifest
  await saveManifest(chapterDir, manifest);
}
