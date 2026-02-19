/**
 * Prompt stage: generate Gemini-optimized art prompts from parsed script data.
 *
 * Reads script.json (from the script stage) + character YAML files + style
 * guide config + Nunjucks templates, and writes one prompt text file per page
 * to output/ch-NN/prompts/.
 *
 * Requires the script stage to have been run first (script.json must exist).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import type { StageOptions, StageResult } from '../types/pipeline.js';
import type { Chapter } from '../types/manga.js';
import { PATHS } from '../config/paths.js';
import { assertSourceDir } from '../utils/fs.js';
import { ensureDir } from '../utils/fs.js';
import { loadCharacterRegistry } from '../characters/registry.js';
import {
  generateChapterPrompts,
  loadStyleGuide,
} from '../templates/prompt-generator.js';

export async function runPrompt(options: StageOptions): Promise<StageResult> {
  const startTime = Date.now();

  // Verify source directories are readable
  assertSourceDir(PATHS.manga, 'Manga');

  // Build paths
  const chapterPaths = PATHS.chapterOutput(options.chapter);
  const scriptJsonPath = path.join(chapterPaths.root, 'script.json');
  const promptsDir = chapterPaths.prompts;

  // 1. Read script.json (produced by script stage)
  if (!existsSync(scriptJsonPath)) {
    return {
      stage: 'prompt',
      success: false,
      outputFiles: [],
      errors: [
        `Script JSON not found: ${scriptJsonPath}. Run the script stage first: pnpm run stage:script -- -c ${options.chapter}`,
      ],
      duration: Date.now() - startTime,
    };
  }

  const scriptRaw = await readFile(scriptJsonPath, 'utf-8');
  const chapter: Chapter = JSON.parse(scriptRaw) as Chapter;

  // 2. Load character registry
  const registry = await loadCharacterRegistry();

  // 3. Load style guide (both style_prefix and setting)
  const styleGuide = loadStyleGuide(PATHS.styleGuide);

  if (options.verbose) {
    console.log(`[prompt] Chapter ${options.chapter}: "${chapter.title}"`);
    console.log(`[prompt]   Pages: ${chapter.pages.length}`);
    console.log(`[prompt]   Characters in registry: ${registry.size}`);
    console.log(`[prompt]   Style prefix: "${styleGuide.stylePrefix.slice(0, 50)}..."`);
    console.log(`[prompt]   Setting: "${styleGuide.setting}"`);
  }

  // 4. Generate prompts
  const prompts = generateChapterPrompts({
    chapter,
    registry,
    stylePrefix: styleGuide.stylePrefix,
    setting: styleGuide.setting,
    templateDir: PATHS.templates,
  });

  // 5. Write prompt files (unless dry run)
  const outputFiles: string[] = [];
  const unknownWarnings: string[] = [];

  if (!options.dryRun) {
    await ensureDir(promptsDir);
  }

  for (const gp of prompts) {
    const pageNum = String(gp.pageNumber).padStart(2, '0');
    const filePath = path.join(promptsDir, `page-${pageNum}.txt`);

    if (!options.dryRun) {
      await writeFile(filePath, gp.prompt, 'utf-8');
      outputFiles.push(filePath);
    }

    // Track unknown characters
    if (gp.charactersUnknown.length > 0) {
      unknownWarnings.push(
        `Page ${gp.pageNumber}: unknown characters: ${gp.charactersUnknown.join(', ')}`,
      );
    }

    if (options.verbose) {
      const charList = gp.charactersIncluded.length > 0
        ? gp.charactersIncluded.join(', ')
        : 'none';
      console.log(
        `[prompt]   Page ${pageNum}: ${gp.charactersIncluded.length} characters (${charList})${gp.charactersUnknown.length > 0 ? ` [unknown: ${gp.charactersUnknown.join(', ')}]` : ''}`,
      );
    }
  }

  // 6. Log summary
  const totalCharsIncluded = new Set(
    prompts.flatMap((p) => p.charactersIncluded),
  ).size;

  if (options.verbose) {
    console.log(`[prompt]   Total prompts: ${prompts.length}`);
    console.log(`[prompt]   Unique characters included: ${totalCharsIncluded}`);
    if (unknownWarnings.length > 0) {
      console.log(`[prompt]   Warnings:`);
      for (const w of unknownWarnings) {
        console.log(`[prompt]     - ${w}`);
      }
    }
    if (options.dryRun) {
      console.log(`[prompt]   Dry run -- skipped writing files`);
    } else {
      console.log(`[prompt]   Output directory: ${promptsDir}`);
    }
  } else if (unknownWarnings.length > 0) {
    // Even without verbose, show unknown character warnings
    for (const w of unknownWarnings) {
      console.warn(`[prompt] Warning: ${w}`);
    }
  }

  return {
    stage: 'prompt',
    success: true,
    outputFiles,
    errors: [],
    duration: Date.now() - startTime,
  };
}
