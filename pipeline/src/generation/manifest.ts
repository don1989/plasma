/**
 * Generation manifest module for tracking prompt-to-image mappings.
 *
 * Manages a per-chapter generation-log.json file that records every
 * image generation attempt with prompt hashes for traceability.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GenerationLogEntry, GenerationManifest } from '../types/generation.js';
import { PIPELINE_VERSION } from '../config/defaults.js';
import { parsePanelImageFilename } from './naming.js';

/** Manifest filename within a chapter directory. */
const MANIFEST_FILENAME = 'generation-log.json';

/**
 * Compute a SHA-256 hash of the prompt text for traceability.
 *
 * @param promptText - The full prompt text to hash
 * @returns 64-character lowercase hex string
 */
export function hashPrompt(promptText: string): string {
  return createHash('sha256').update(promptText, 'utf-8').digest('hex');
}

/**
 * Load the generation manifest for a chapter.
 *
 * Returns an empty manifest with the current pipeline version
 * if the file does not exist.
 *
 * @param chapterDir - Path to the chapter output directory
 * @param chapter - Chapter number
 * @returns The loaded or default manifest
 */
export async function loadManifest(
  chapterDir: string,
  chapter: number,
): Promise<GenerationManifest> {
  const filePath = join(chapterDir, MANIFEST_FILENAME);

  if (!existsSync(filePath)) {
    return {
      chapter,
      pipelineVersion: PIPELINE_VERSION,
      entries: [],
    };
  }

  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as GenerationManifest;
}

/**
 * Save the generation manifest to disk.
 *
 * Writes JSON with 2-space indentation for readability.
 *
 * @param chapterDir - Path to the chapter output directory
 * @param manifest - The manifest to save
 */
export async function saveManifest(
  chapterDir: string,
  manifest: GenerationManifest,
): Promise<void> {
  const filePath = join(chapterDir, MANIFEST_FILENAME);
  await writeFile(filePath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Add a generation log entry to the manifest and persist to disk.
 *
 * Mutates the manifest in place and saves atomically.
 *
 * @param chapterDir - Path to the chapter output directory
 * @param manifest - The manifest to append to (mutated in place)
 * @param entry - The new entry to add
 */
export async function addEntry(
  chapterDir: string,
  manifest: GenerationManifest,
  entry: GenerationLogEntry,
): Promise<void> {
  manifest.entries.push(entry);
  await saveManifest(chapterDir, manifest);
}

/**
 * Find the approved entry for a specific page.
 *
 * If multiple entries are approved for the same page, returns the
 * one with the latest timestamp.
 *
 * @param manifest - The manifest to search
 * @param page - Page number to find
 * @returns The approved entry, or undefined if none found
 */
export function getApprovedEntry(
  manifest: GenerationManifest,
  page: number,
): GenerationLogEntry | undefined {
  const approvedForPage = manifest.entries.filter((entry) => {
    if (!entry.approved) return false;
    const parsed = parsePanelImageFilename(entry.imageFile);
    return parsed !== null && parsed.page === page;
  });

  if (approvedForPage.length === 0) return undefined;

  // Return the latest by timestamp
  return approvedForPage.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )[0];
}
