/**
 * Character reference image management.
 *
 * Manages reference images stored on disk for each character.
 * Reference images are used by Kling AI for character consistency
 * across manga panels — replacing the old prompt fingerprint system.
 *
 * Storage: pipeline/data/characters/<character-id>/references/
 */

import { readdir, stat, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PATHS } from '../config/paths.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CharacterReference {
  /** Character ID (e.g., 'spyke-tinwall'). */
  characterId: string;
  /** Absolute paths to reference images on disk. */
  imagePaths: string[];
}

export interface ReferenceManifest {
  /** All characters with reference images. */
  characters: CharacterReference[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * Get the reference images directory for a character.
 */
export function getReferencePath(characterId: string): string {
  return path.join(PATHS.characterData, characterId, 'references');
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Load all reference images for a specific character.
 * Returns empty array if no references exist yet.
 */
export async function loadCharacterReferences(
  characterId: string,
): Promise<string[]> {
  const refDir = getReferencePath(characterId);

  if (!existsSync(refDir)) {
    return [];
  }

  const files = await readdir(refDir);
  const imageFiles = files
    .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort(); // Deterministic order

  return imageFiles.map((f) => path.join(refDir, f));
}

/**
 * Load reference images for all characters that have them.
 */
export async function loadAllReferences(): Promise<ReferenceManifest> {
  const characters: CharacterReference[] = [];

  if (!existsSync(PATHS.characterData)) {
    return { characters };
  }

  const entries = await readdir(PATHS.characterData);

  for (const entry of entries) {
    const entryPath = path.join(PATHS.characterData, entry);
    const entryStat = await stat(entryPath);

    if (entryStat.isDirectory()) {
      const images = await loadCharacterReferences(entry);
      if (images.length > 0) {
        characters.push({ characterId: entry, imagePaths: images });
      }
    }
  }

  return { characters };
}

/**
 * Add a reference image for a character.
 * Copies the source image into the character's references directory.
 */
export async function addReference(
  characterId: string,
  sourcePath: string,
  label?: string,
): Promise<string> {
  const refDir = getReferencePath(characterId);
  await mkdir(refDir, { recursive: true });

  const ext = path.extname(sourcePath);
  const baseName = label
    ? `${label}${ext}`
    : `ref-${Date.now()}${ext}`;
  const destPath = path.join(refDir, baseName);

  await copyFile(sourcePath, destPath);
  return destPath;
}

/**
 * Get the primary (first) reference image for a character.
 * Used for single-reference generation mode.
 */
export async function getPrimaryReference(
  characterId: string,
): Promise<string | null> {
  const refs = await loadCharacterReferences(characterId);
  return refs.length > 0 ? refs[0]! : null;
}

/**
 * Build a multi-reference prompt with @Image1, @Image2 placeholders
 * for each character's reference images (fal.ai / Kling O1 syntax).
 *
 * @param basePrompt - The panel description prompt
 * @param characterRefs - Map of character name to their reference image paths
 * @returns The prompt with @Image placeholders, and the ordered image array
 */
export function buildMultiRefPrompt(
  basePrompt: string,
  characterRefs: Map<string, string[]>,
): { prompt: string; images: string[] } {
  const images: string[] = [];
  let prompt = basePrompt;

  let imageIndex = 1;
  for (const [characterName, refs] of characterRefs) {
    // Use the first reference for each character
    if (refs.length > 0) {
      images.push(refs[0]!);
      // Append character reference instruction to prompt
      prompt += ` @Image${imageIndex} is ${characterName}.`;
      imageIndex++;
    }
  }

  return { prompt, images };
}
