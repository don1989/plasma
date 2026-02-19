/**
 * Generate stage: orchestrates image generation via manual or API workflow.
 *
 * Manual mode (first-class path):
 * - Displays prompts for copy-paste into Gemini web UI
 * - Imports downloaded images with correct naming/versioning
 * - Approves image versions in the manifest
 *
 * API mode (planned for 03-03):
 * - Calls Gemini API directly for automated generation
 */

import type { StageOptions, StageResult } from '../types/pipeline.js';
import { PATHS } from '../config/paths.js';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { importImage, approveImage } from '../generation/image-import.js';
import { loadManifest, addEntry } from '../generation/manifest.js';

/**
 * Options for the generate stage, extending base stage options.
 */
export interface GenerateOptions extends StageOptions {
  /** Workflow mode: manual (copy-paste) or api (automated). Defaults to 'manual'. */
  mode?: 'manual' | 'api';
  /** Path to a downloaded image to import (use with --page). */
  importPath?: string;
  /** Page number for single-page operations. */
  page?: number;
  /** Array of page numbers to filter prompt display. */
  pages?: number[];
  /** Gemini model override. */
  model?: string;
  /** Image filename to approve (e.g. ch01_p003_v1.png). */
  approve?: string;
  /** Notes for this generation (stored in manifest). */
  notes?: string;
}

/**
 * Run the generate stage.
 *
 * @param options - Generation options
 * @returns Stage result with output file paths and status
 */
export async function runGenerate(options: GenerateOptions): Promise<StageResult> {
  const startTime = Date.now();
  const mode = options.mode ?? 'manual';
  const chapterPaths = PATHS.chapterOutput(options.chapter);

  // --- Approve mode ---
  if (options.approve) {
    try {
      await approveImage({
        imageFile: options.approve,
        chapterDir: chapterPaths.root,
      });
      console.log(`[generate] Approved: ${options.approve}`);
      return {
        stage: 'generate',
        success: true,
        outputFiles: [],
        errors: [],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        stage: 'generate',
        success: false,
        outputFiles: [],
        errors: [msg],
        duration: Date.now() - startTime,
      };
    }
  }

  // --- Manual mode ---
  if (mode === 'manual') {
    // Import a single image
    if (options.importPath && options.page != null) {
      try {
        const result = await importImage({
          sourcePath: options.importPath,
          chapter: options.chapter,
          page: options.page,
          rawDir: chapterPaths.raw,
          promptsDir: chapterPaths.prompts,
          chapterDir: chapterPaths.root,
          notes: options.notes,
        });

        // Record in manifest
        const manifest = await loadManifest(chapterPaths.root, options.chapter);
        await addEntry(chapterPaths.root, manifest, result.entry);

        console.log(
          `[generate] Imported: ${result.entry.imageFile} -> ${path.relative(process.cwd(), chapterPaths.raw)}/`,
        );

        return {
          stage: 'generate',
          success: true,
          outputFiles: [result.destPath],
          errors: [],
          duration: Date.now() - startTime,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          stage: 'generate',
          success: false,
          outputFiles: [],
          errors: [msg],
          duration: Date.now() - startTime,
        };
      }
    }

    // Display prompts for copy-paste
    const promptsDir = chapterPaths.prompts;
    if (!existsSync(promptsDir)) {
      return {
        stage: 'generate',
        success: false,
        outputFiles: [],
        errors: [
          `Prompts directory not found: ${promptsDir}. Run the prompt stage first.`,
        ],
        duration: Date.now() - startTime,
      };
    }

    // Read all prompt files, sorted naturally
    const promptFiles = readdirSync(promptsDir)
      .filter((f) => f.endsWith('.txt'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (promptFiles.length === 0) {
      return {
        stage: 'generate',
        success: false,
        outputFiles: [],
        errors: ['No prompt files found in prompts directory.'],
        duration: Date.now() - startTime,
      };
    }

    // Filter by page range if specified
    const filteredFiles = options.pages
      ? promptFiles.filter((f) => {
          const match = /page-(\d+)\.txt$/.exec(f);
          if (!match) return false;
          return options.pages!.includes(Number(match[1]));
        })
      : promptFiles;

    const chNum = String(options.chapter).padStart(2, '0');
    const separator = '='.repeat(60);

    for (const file of filteredFiles) {
      const match = /page-(\d+)\.txt$/.exec(file);
      const pageNum = match ? Number(match[1]) : 0;
      const promptText = await readFile(path.join(promptsDir, file), 'utf-8');

      console.log('');
      console.log(separator);
      console.log(`PAGE ${pageNum} -- Copy the prompt below into Gemini:`);
      console.log(separator);
      console.log(promptText);
      console.log(separator);
      console.log(
        `After generating, import with:\n  pnpm stage:generate -- --manual -c ${options.chapter} --import <downloaded-image-path> --page ${pageNum}`,
      );
    }

    console.log(
      `\n[generate] Displayed ${filteredFiles.length} prompt(s) for chapter ${chNum}.`,
    );

    return {
      stage: 'generate',
      success: true,
      outputFiles: [],
      errors: [],
      duration: Date.now() - startTime,
    };
  }

  // --- API mode (not yet implemented) ---
  if (mode === 'api') {
    console.log(
      '[generate] API mode not yet implemented. Use --manual for now.',
    );
    return {
      stage: 'generate',
      success: true,
      outputFiles: [],
      errors: [],
      duration: Date.now() - startTime,
    };
  }

  // Fallback (should not be reached)
  return {
    stage: 'generate',
    success: false,
    outputFiles: [],
    errors: ['Unknown generate mode. Use --manual or --api.'],
    duration: Date.now() - startTime,
  };
}
