/**
 * Assembly stage: stacks lettered panel images vertically, handles splash
 * pages and double-spreads, and slices the result into 800x1280px
 * Webtoon Canvas-compatible JPEG strips.
 *
 * Reads from lettered/, writes to webtoon/. Never modifies upstream outputs.
 */

import sharp from 'sharp';
import type { StageResult } from '../types/pipeline.js';
import type { Chapter } from '../types/manga.js';
import type { AssemblyConfig, PanelMetadata } from '../types/overlay.js';
import { WEBTOON_CONFIG } from '../types/overlay.js';
import { PATHS } from '../config/paths.js';
import { ensureDir } from '../utils/fs.js';
import { parsePanelImageFilename } from '../generation/naming.js';
import { assembleVerticalStrip } from '../assembly/strip-builder.js';
import { sliceForWebtoon } from '../assembly/slicer.js';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/** Options for the assemble stage. */
export interface AssembleOptions {
  chapter: number;
  verbose?: boolean;
  dryRun?: boolean;
  /** Override assembly configuration (merged with WEBTOON_CONFIG defaults). */
  configOverride?: Partial<AssemblyConfig>;
}

/**
 * Run the assembly stage for a chapter.
 *
 * Reads lettered panel images, stacks them vertically with gutters,
 * and slices the result into Webtoon-sized strips.
 *
 * @param options - Assembly options including chapter number
 * @returns Stage result with output file paths and status
 */
export async function runAssemble(
  options: AssembleOptions,
): Promise<StageResult> {
  const startTime = Date.now();
  const chapterPaths = PATHS.chapterOutput(options.chapter);
  const chNum = String(options.chapter).padStart(2, '0');
  const errors: string[] = [];

  // Merge config overrides with defaults
  const config: AssemblyConfig = {
    ...WEBTOON_CONFIG,
    ...options.configOverride,
  };

  // 1. Read script.json for page metadata (splash/double-spread flags)
  const scriptPath = path.join(chapterPaths.root, 'script.json');
  if (!existsSync(scriptPath)) {
    return {
      stage: 'assemble',
      success: false,
      outputFiles: [],
      errors: [
        `script.json not found: ${scriptPath}. Run the script stage first.`,
      ],
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
      stage: 'assemble',
      success: false,
      outputFiles: [],
      errors: [`Failed to parse script.json: ${msg}`],
      duration: Date.now() - startTime,
    };
  }

  // 2. Read lettered directory
  const letteredDir = chapterPaths.lettered;
  if (!existsSync(letteredDir)) {
    return {
      stage: 'assemble',
      success: false,
      outputFiles: [],
      errors: [
        `No lettered images found. Run overlay stage first. Missing: ${letteredDir}`,
      ],
      duration: Date.now() - startTime,
    };
  }

  let allFiles: string[];
  try {
    allFiles = await readdir(letteredDir);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      stage: 'assemble',
      success: false,
      outputFiles: [],
      errors: [`Failed to read lettered directory: ${msg}`],
      duration: Date.now() - startTime,
    };
  }

  // Filter for image files and sort by filename (maintains page order)
  const imageFiles = allFiles
    .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
    .sort();

  if (imageFiles.length === 0) {
    return {
      stage: 'assemble',
      success: false,
      outputFiles: [],
      errors: [
        `No lettered images found. Run overlay stage first. Empty: ${letteredDir}`,
      ],
      duration: Date.now() - startTime,
    };
  }

  if (options.verbose) {
    console.log(
      `[assemble] Found ${imageFiles.length} lettered image(s) for chapter ${chNum}`,
    );
  }

  // 3. Build PanelMetadata for each lettered image
  const panels: PanelMetadata[] = [];

  for (const filename of imageFiles) {
    const filePath = path.join(letteredDir, filename);

    // Extract page number from filename
    const parsed = parsePanelImageFilename(filename);
    let pageNumber = 0;
    if (parsed) {
      pageNumber = parsed.page;
    } else {
      // Fallback: try to extract page number from any _pNNN_ pattern
      const match = /_p(\d{3})_/.exec(filename);
      if (match?.[1]) {
        pageNumber = Number(match[1]);
      }
    }

    // Look up page in chapter data for splash/double-spread flags
    const chapterPage = chapter.pages.find(
      (p) => p.pageNumber === pageNumber,
    );
    const isSplash = chapterPage?.isSplash ?? false;
    const isDoubleSpread = chapterPage?.isDoubleSpread ?? false;

    // Read image dimensions
    let width = 0;
    let height = 0;
    try {
      const meta = await sharp(filePath).metadata();
      width = meta.width ?? 0;
      height = meta.height ?? 0;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to read metadata for ${filename}: ${msg}`);
      continue;
    }

    if (options.verbose) {
      const typeLabel = isDoubleSpread
        ? ' (double-spread)'
        : isSplash
          ? ' (splash)'
          : '';
      console.log(
        `[assemble] Panel ${pageNumber}: ${width}x${height}${typeLabel}`,
      );
    }

    panels.push({
      path: filePath,
      width,
      height,
      pageNumber,
      isSplash,
      isDoubleSpread,
    });
  }

  if (panels.length === 0) {
    return {
      stage: 'assemble',
      success: false,
      outputFiles: [],
      errors: ['No valid panel images could be read from lettered/'],
      duration: Date.now() - startTime,
    };
  }

  // 4. Dry-run: report dimensions and exit
  if (options.dryRun) {
    // Estimate total strip height
    let estimatedHeight = 0;
    for (const panel of panels) {
      const scaledHeight = Math.round(
        panel.height * (config.width / panel.width),
      );
      estimatedHeight += scaledHeight;
    }
    estimatedHeight += (panels.length - 1) * config.gutterHeight;
    const estimatedSlices = Math.ceil(estimatedHeight / config.sliceHeight);

    console.log(`[assemble] Dry run for chapter ${chNum}:`);
    console.log(`  Panels: ${panels.length}`);
    console.log(`  Estimated strip height: ${estimatedHeight}px`);
    console.log(`  Estimated slices: ${estimatedSlices}`);
    console.log(`  Output format: ${config.format} (quality: ${config.jpegQuality})`);
    console.log(`  Gutter: ${config.gutterHeight}px`);

    return {
      stage: 'assemble',
      success: true,
      outputFiles: [],
      errors,
      duration: Date.now() - startTime,
    };
  }

  // 5. Assemble vertical strip
  console.log(
    `[assemble] Assembling ${panels.length} panel(s) into vertical strip...`,
  );

  let stripResult;
  try {
    stripResult = await assembleVerticalStrip(panels, config);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      stage: 'assemble',
      success: false,
      outputFiles: [],
      errors: [`Strip assembly failed: ${msg}`],
      duration: Date.now() - startTime,
    };
  }

  if (options.verbose) {
    console.log(
      `[assemble] Strip assembled: ${config.width}x${stripResult.totalHeight}px ` +
        `(${stripResult.panelCount} panels)`,
    );
  }

  // 6. Ensure webtoon/ directory exists and slice
  const webtoonDir = chapterPaths.webtoon;
  await ensureDir(webtoonDir);

  let outputPaths: string[];
  try {
    outputPaths = await sliceForWebtoon(
      stripResult.stripBuffer,
      webtoonDir,
      options.chapter,
      config,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      stage: 'assemble',
      success: false,
      outputFiles: [],
      errors: [`Strip slicing failed: ${msg}`],
      duration: Date.now() - startTime,
    };
  }

  // 7. Summary
  console.log(`[assemble] Complete for chapter ${chNum}:`);
  console.log(`  Panels assembled: ${stripResult.panelCount}`);
  console.log(`  Total strip height: ${stripResult.totalHeight}px`);
  console.log(`  Output slices: ${outputPaths.length}`);
  console.log(`  Format: ${config.format} (quality: ${config.jpegQuality})`);

  return {
    stage: 'assemble',
    success: errors.length === 0,
    outputFiles: outputPaths,
    errors,
    duration: Date.now() - startTime,
  };
}
