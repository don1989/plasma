/**
 * Overlay stage: composites speech balloons, thought bubbles, narration boxes,
 * and SFX text onto approved panel images.
 *
 * Reads script.json + generation-log.json, finds approved raw images,
 * and produces lettered PNG files in the lettered/ directory.
 */

import type { StageResult } from '../types/pipeline.js';
import type { Chapter } from '../types/manga.js';
import type { PageOverlayData } from '../types/overlay.js';
import { PATHS } from '../config/paths.js';
import { existsSync } from 'node:fs';
import { readFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { loadManifest, getApprovedEntry } from '../generation/manifest.js';
import { overlayPage } from '../overlay/renderer.js';
import { ensureDir } from '../utils/fs.js';

/**
 * Options for the overlay stage, extending base stage options
 * with page filtering support.
 */
export interface OverlayOptions {
  chapter: number;
  verbose?: boolean;
  dryRun?: boolean;
  /** Overlay a single page. */
  page?: number;
  /** Overlay specific pages. */
  pages?: number[];
}

/**
 * Run the overlay stage for a chapter.
 *
 * @param options - Overlay options including chapter number and page filters
 * @returns Stage result with output file paths and status
 */
export async function runOverlay(options: OverlayOptions): Promise<StageResult> {
  const startTime = Date.now();
  const chapterPaths = PATHS.chapterOutput(options.chapter);
  const chNum = String(options.chapter).padStart(2, '0');
  const outputFiles: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Read script.json
  const scriptPath = path.join(chapterPaths.root, 'script.json');
  if (!existsSync(scriptPath)) {
    return {
      stage: 'overlay',
      success: false,
      outputFiles: [],
      errors: [`script.json not found: ${scriptPath}. Run the script stage first.`],
      duration: Date.now() - startTime,
    };
  }

  let chapter: Chapter;
  try {
    const raw = await readFile(scriptPath, 'utf-8');
    chapter = JSON.parse(raw) as Chapter;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      stage: 'overlay',
      success: false,
      outputFiles: [],
      errors: [`Failed to parse script.json: ${msg}`],
      duration: Date.now() - startTime,
    };
  }

  // 2. Load generation manifest
  const manifest = await loadManifest(chapterPaths.root, options.chapter);

  // 3. Ensure lettered/ directory exists
  await ensureDir(chapterPaths.lettered);

  // 4. Determine which pages to process
  let pagesToProcess = chapter.pages;

  if (options.page != null) {
    pagesToProcess = chapter.pages.filter((p) => p.pageNumber === options.page);
    if (pagesToProcess.length === 0) {
      return {
        stage: 'overlay',
        success: false,
        outputFiles: [],
        errors: [`Page ${options.page} not found in script.json`],
        duration: Date.now() - startTime,
      };
    }
  } else if (options.pages && options.pages.length > 0) {
    pagesToProcess = chapter.pages.filter((p) =>
      options.pages!.includes(p.pageNumber),
    );
  }

  if (options.verbose) {
    console.log(
      `[overlay] Processing ${pagesToProcess.length} page(s) for chapter ${chNum}`,
    );
  }

  // 5. Process each page
  for (const page of pagesToProcess) {
    // Find approved image for this page
    const approvedEntry = getApprovedEntry(manifest, page.pageNumber);

    if (!approvedEntry) {
      const msg = `Page ${page.pageNumber}: no approved image found, skipping`;
      warnings.push(msg);
      if (options.verbose) {
        console.log(`[overlay] ${msg}`);
      }
      continue;
    }

    const rawImagePath = path.join(chapterPaths.raw, approvedEntry.imageFile);
    if (!existsSync(rawImagePath)) {
      const msg = `Page ${page.pageNumber}: approved image file not found: ${approvedEntry.imageFile}`;
      warnings.push(msg);
      if (options.verbose) {
        console.log(`[overlay] ${msg}`);
      }
      continue;
    }

    // Build output filename (same base name as raw, in lettered/)
    const outputFilename = approvedEntry.imageFile;
    const outputPath = path.join(chapterPaths.lettered, outputFilename);

    // Flatten dialogue lines from all panels
    const dialogueLines = page.panels.flatMap((panel) => panel.dialogue);

    // Combine SFX from all panels
    const sfxParts = page.panels
      .map((panel) => panel.sfx)
      .filter((s) => s && s.trim() !== '' && s.trim() !== '\u2014');
    const combinedSfx = sfxParts.join(' ');

    // Build overlay data
    const overlayData: PageOverlayData = {
      pageNumber: page.pageNumber,
      panelCount: page.panels.length,
      dialogueLines,
      sfx: combinedSfx,
      isSplash: page.isSplash,
      isDoubleSpread: page.isDoubleSpread,
    };

    // Check if page has any overlays to apply
    const hasDialogue = dialogueLines.length > 0;
    const hasSfx = combinedSfx.length > 0;

    if (options.dryRun) {
      const overlayDesc = hasDialogue || hasSfx
        ? `${dialogueLines.length} balloon(s)${hasSfx ? ' + SFX' : ''}`
        : 'passthrough (no dialogue/SFX)';
      console.log(
        `[overlay] Page ${page.pageNumber}: ${overlayDesc} -> ${outputFilename}`,
      );
      outputFiles.push(outputPath);
      continue;
    }

    try {
      if (!hasDialogue && !hasSfx) {
        // Passthrough: copy raw image directly to lettered/
        await copyFile(rawImagePath, outputPath);
        if (options.verbose) {
          console.log(
            `[overlay] Page ${page.pageNumber}: passthrough (no dialogue/SFX) -> ${outputFilename}`,
          );
        }
      } else {
        // Composite overlays onto the image
        const letteredBuffer = await overlayPage(rawImagePath, overlayData);
        const { writeFile } = await import('node:fs/promises');
        await writeFile(outputPath, letteredBuffer);
        if (options.verbose) {
          console.log(
            `[overlay] Page ${page.pageNumber}: ${dialogueLines.length} balloon(s)${hasSfx ? ' + SFX' : ''} -> ${outputFilename}`,
          );
        }
      }
      outputFiles.push(outputPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Page ${page.pageNumber}: ${msg}`);
      console.error(`[overlay] Error on page ${page.pageNumber}: ${msg}`);
    }
  }

  // 6. Summary
  const skipped = warnings.length;
  const processed = outputFiles.length;
  console.log(
    `[overlay] Complete: ${processed} page(s) processed, ${skipped} skipped, ${errors.length} error(s)`,
  );
  if (warnings.length > 0 && options.verbose) {
    for (const w of warnings) {
      console.log(`[overlay] Warning: ${w}`);
    }
  }

  return {
    stage: 'overlay',
    success: errors.length === 0,
    outputFiles,
    errors,
    duration: Date.now() - startTime,
  };
}
