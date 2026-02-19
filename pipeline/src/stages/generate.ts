/**
 * Generate stage: orchestrates image generation via manual or API workflow.
 *
 * Manual mode (first-class path):
 * - Displays prompts for copy-paste into Gemini web UI
 * - Imports downloaded images with correct naming/versioning
 * - Approves image versions in the manifest
 *
 * API mode (automated):
 * - Calls Gemini API directly for batch image generation
 * - Rate-limits requests with configurable delay and exponential backoff
 * - Records all generations in the same manifest as manual imports
 */

import type { StageOptions, StageResult } from '../types/pipeline.js';
import type { GenerationLogEntry } from '../types/generation.js';
import { PATHS } from '../config/paths.js';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { importImage, approveImage } from '../generation/image-import.js';
import { loadManifest, addEntry, hashPrompt } from '../generation/manifest.js';
import { panelImageFilename, nextVersion } from '../generation/naming.js';
import { ensureDir } from '../utils/fs.js';
import {
  validateApiKey,
  generateImage,
  saveGeneratedImage,
  sleep,
} from '../generation/gemini-client.js';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_RATE_LIMIT_DELAY_MS,
} from '../config/defaults.js';

/**
 * Load environment variables from a .env file without adding dotenv as a dependency.
 *
 * Parses KEY=value pairs, skipping comments and empty lines.
 * Returns an empty object if the file doesn't exist.
 *
 * @param envPath - Absolute path to the .env file
 * @returns Parsed key-value pairs
 */
function loadEnvFile(envPath: string): Record<string, string> {
  if (!existsSync(envPath)) return {};

  const content = readFileSync(envPath, 'utf-8');
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) {
      result[key] = value;
    }
  }

  return result;
}

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

  // --- API mode (automated Gemini generation) ---
  if (mode === 'api') {
    // 1. Load prompt files (before API key check so dry-run works without key)
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

    // Dry run: show what would be generated without making API calls
    if (options.dryRun) {
      const modelName = options.model ?? DEFAULT_GEMINI_MODEL;
      console.log(`[generate] Dry run: would generate ${filteredFiles.length} page(s) using ${modelName}`);
      for (const file of filteredFiles) {
        const match = /page-(\d+)\.txt$/.exec(file);
        const pageNum = match ? Number(match[1]) : 0;
        const version = nextVersion(chapterPaths.raw, options.chapter, pageNum);
        const filename = panelImageFilename(options.chapter, pageNum, version);
        console.log(`[generate]   Page ${pageNum} -> ${filename}`);
      }
      return {
        stage: 'generate',
        success: true,
        outputFiles: [],
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    // 2. Load API key from environment or .env file
    let apiKey: string;
    try {
      const envKey = process.env['GEMINI_API_KEY'] ?? loadEnvFile(path.join(PATHS.pipelineRoot, '.env'))['GEMINI_API_KEY'];
      apiKey = validateApiKey(envKey);
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

    // 3. Load existing manifest
    const manifest = await loadManifest(chapterPaths.root, options.chapter);

    // 4. Ensure raw/ directory exists
    await ensureDir(chapterPaths.raw);

    // 5. Batch generate with rate limiting
    const outputFiles: string[] = [];
    const errors: string[] = [];
    let delay = DEFAULT_RATE_LIMIT_DELAY_MS;

    for (let i = 0; i < filteredFiles.length; i++) {
      const file = filteredFiles[i]!;
      const match = /page-(\d+)\.txt$/.exec(file);
      const pageNum = match ? Number(match[1]) : 0;

      let retries = 0;
      const maxRetries = 2;
      let succeeded = false;

      while (!succeeded && retries <= maxRetries) {
        try {
          // Read prompt text
          const promptText = await readFile(
            path.join(promptsDir, file),
            'utf-8',
          );

          // Determine version and filename
          const version = nextVersion(
            chapterPaths.raw,
            options.chapter,
            pageNum,
          );
          const filename = panelImageFilename(
            options.chapter,
            pageNum,
            version,
          );
          const destPath = path.join(chapterPaths.raw, filename);

          console.log(
            `[generate] Page ${pageNum} (v${version}) -- calling Gemini API...`,
          );

          // Call Gemini API
          const result = await generateImage({
            prompt: promptText,
            model: options.model,
            apiKey,
          });

          // Save image
          await saveGeneratedImage(result, destPath);

          // Build manifest entry
          const promptFilename = `page-${String(pageNum).padStart(2, '0')}.txt`;
          const entry: GenerationLogEntry = {
            imageFile: filename,
            promptFile: path.join('prompts', promptFilename),
            promptHash: hashPrompt(promptText),
            model: options.model ?? DEFAULT_GEMINI_MODEL,
            timestamp: new Date().toISOString(),
            version,
            approved: false,
            promptText,
          };

          // Record in manifest
          await addEntry(chapterPaths.root, manifest, entry);

          console.log(
            `[generate] Page ${pageNum} -> ${filename} (${result.mimeType})`,
          );

          outputFiles.push(destPath);
          succeeded = true;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);

          // Rate limit error: exponential backoff and retry
          if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
            retries++;
            if (retries <= maxRetries) {
              delay = delay * 2;
              console.warn(
                `[generate] Rate limited on page ${pageNum}. Retrying in ${delay}ms (attempt ${retries}/${maxRetries})...`,
              );
              await sleep(delay);
              continue;
            }
            console.error(
              `[generate] Rate limited on page ${pageNum} after ${maxRetries} retries. Skipping.`,
            );
            errors.push(`Page ${pageNum}: rate limited after retries`);
            break;
          }

          // Permission/billing error: abort remaining pages
          if (msg.includes('permission') || msg.includes('403')) {
            console.error(
              `[generate] API access error on page ${pageNum}: ${msg}`,
            );
            console.error(
              '[generate] This is likely a billing issue. Enable Cloud Billing at https://aistudio.google.com',
            );
            errors.push(`Page ${pageNum}: ${msg}`);
            // Return early -- retrying won't help
            const chNum = String(options.chapter).padStart(2, '0');
            console.log(
              `\n[generate] Aborted: ${outputFiles.length}/${filteredFiles.length} pages generated before access error`,
            );
            return {
              stage: 'generate',
              success: false,
              outputFiles,
              errors,
              duration: Date.now() - startTime,
            };
          }

          // Other error: log and continue to next page
          console.error(
            `[generate] Error on page ${pageNum}: ${msg}`,
          );
          errors.push(`Page ${pageNum}: ${msg}`);
          break;
        }
      }

      // Rate limiting delay between requests (skip after last image)
      if (succeeded && i < filteredFiles.length - 1) {
        await sleep(delay);
      }
    }

    // 6. Summary
    const chNum = String(options.chapter).padStart(2, '0');
    const failed = filteredFiles.length - outputFiles.length;
    console.log(
      `\n[generate] Complete: ${outputFiles.length}/${filteredFiles.length} pages generated, ${failed} failed`,
    );
    console.log(`[generate] Images saved to: output/ch-${chNum}/raw/`);
    console.log(
      `[generate] Manifest updated: output/ch-${chNum}/generation-log.json`,
    );

    return {
      stage: 'generate',
      success: errors.length === 0,
      outputFiles,
      errors,
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
