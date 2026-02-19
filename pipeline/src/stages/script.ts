import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { StageOptions, StageResult } from '../types/pipeline.js';
import { PATHS } from '../config/paths.js';
import { assertSourceDir, ensureDir } from '../utils/fs.js';
import {
  parseChapterScript,
  validateChapter,
} from '../parsers/script-parser.js';

/**
 * Script stage: parse a chapter markdown script into validated JSON.
 *
 * Reads 03_manga/chapter-NN-script.md, parses it into a Chapter object,
 * validates against ChapterSchema, and writes output/ch-NN/script.json.
 */
export async function runScript(options: StageOptions): Promise<StageResult> {
  const startTime = Date.now();

  // Verify source directory is readable
  assertSourceDir(PATHS.manga, 'Manga');

  // Build paths
  const chapterNum = String(options.chapter).padStart(2, '0');
  const scriptFile = path.join(
    PATHS.manga,
    `chapter-${chapterNum}-script.md`
  );
  const chapterPaths = PATHS.chapterOutput(options.chapter);
  const outputFile = path.join(chapterPaths.root, 'script.json');

  // Check script file exists
  if (!existsSync(scriptFile)) {
    return {
      stage: 'script',
      success: false,
      outputFiles: [],
      errors: [`Script file not found: ${scriptFile}`],
      duration: Date.now() - startTime,
    };
  }

  // Read and parse
  const markdown = await readFile(scriptFile, 'utf-8');
  const chapter = parseChapterScript(markdown);

  // Validate
  const validation = validateChapter(chapter);

  if (options.verbose) {
    const totalPanels = chapter.pages.reduce(
      (sum, p) => sum + p.panels.length,
      0
    );
    console.log(`[script] Chapter ${options.chapter}: "${chapter.title}"`);
    console.log(`[script]   Pages: ${chapter.pages.length}`);
    console.log(`[script]   Total panels: ${totalPanels}`);
    console.log(`[script]   Characters: ${chapter.characters.join(', ')}`);
    if (validation.warnings.length > 0) {
      console.log(`[script]   Warnings:`);
      for (const w of validation.warnings) {
        console.log(`[script]     - ${w}`);
      }
    }
  }

  if (!validation.valid) {
    const errorMsgs = validation.errors.map((e) => e.message);
    return {
      stage: 'script',
      success: false,
      outputFiles: [],
      errors: errorMsgs,
      duration: Date.now() - startTime,
    };
  }

  // Write JSON output (unless dry run)
  if (!options.dryRun) {
    await ensureDir(chapterPaths.root);
    await writeFile(outputFile, JSON.stringify(chapter, null, 2), 'utf-8');
  }

  if (options.verbose) {
    if (options.dryRun) {
      console.log(`[script]   Dry run -- skipped writing ${outputFile}`);
    } else {
      console.log(`[script]   Output: ${outputFile}`);
    }
  }

  return {
    stage: 'script',
    success: true,
    outputFiles: options.dryRun ? [] : [outputFile],
    errors: [],
    duration: Date.now() - startTime,
  };
}
