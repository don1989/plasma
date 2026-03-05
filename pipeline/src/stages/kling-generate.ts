/**
 * Kling AI panel generation stage (via fal.ai).
 *
 * Generates manga panels using Kling AI through fal.ai's pay-per-use API
 * with character reference images for visual consistency. Supports three modes:
 *
 * 1. Single-ref: One character reference image
 * 2. Multi-ref: Multiple character references via Kling O1
 * 3. No-ref: Text-only generation (backgrounds, establishing shots)
 *
 * Generated images are saved to output/ch-NN/raw/kling/
 */

import { existsSync } from 'node:fs';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import { PATHS } from '../config/paths.js';
import {
  configureFal,
  uploadToFal,
  generatePanel,
  generatePanelWithReference,
  generatePanelMultiRef,
  downloadAndSave,
} from '../generation/kling-client.js';
import {
  loadCharacterReferences,
} from '../generation/references.js';
import { loadEnvFile } from '../utils/env.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KlingGenerateOptions {
  chapter: number;
  /** Page number to generate (single page). */
  page?: number;
  /** Page range to generate. */
  pages?: number[];
  /** Character IDs to include as references. */
  characters?: string[];
  /** Override aspect ratio. */
  aspectRatio?: string;
  /** Reference fidelity 0-1 (default: 0.8). */
  fidelity?: number;
  /** Custom prompt override (skip reading from prompts dir). */
  prompt?: string;
  /** Notes stored in generation log. */
  notes?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

export interface StageResult {
  success: boolean;
  duration: number;
  outputFiles: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Read a page prompt file from the prompts output directory.
 */
async function readPagePrompt(chapter: number, page: number): Promise<string | null> {
  const chapterPaths = PATHS.chapterOutput(chapter);
  const promptFile = path.join(chapterPaths.prompts, `page-${String(page).padStart(3, '0')}.txt`);

  if (!existsSync(promptFile)) return null;
  return (await readFile(promptFile, 'utf-8')).trim();
}

/**
 * Run the Kling AI generation stage via fal.ai.
 */
export async function runKlingGenerate(options: KlingGenerateOptions): Promise<StageResult> {
  const start = Date.now();
  const errors: string[] = [];
  const outputFiles: string[] = [];

  // Load env
  const env = loadEnvFile(`${PATHS.pipelineRoot}/.env`);
  for (const [k, v] of Object.entries(env)) {
    if (!process.env[k]) process.env[k] = v;
  }

  // Configure fal.ai credentials
  try {
    configureFal();
  } catch (e) {
    return { success: false, duration: Date.now() - start, outputFiles: [], errors: [(e as Error).message] };
  }

  const chapterPaths = PATHS.chapterOutput(options.chapter);
  const klingRawDir = path.join(chapterPaths.raw, 'kling');
  await mkdir(klingRawDir, { recursive: true });

  // Determine which pages to generate
  let pages: number[] = [];
  if (options.pages) {
    pages = options.pages;
  } else if (options.page) {
    pages = [options.page];
  } else {
    // Auto-detect from prompts directory
    if (existsSync(chapterPaths.prompts)) {
      const promptFiles = await readdir(chapterPaths.prompts);
      pages = promptFiles
        .filter((f) => f.startsWith('page-') && f.endsWith('.txt'))
        .map((f) => parseInt(f.replace('page-', '').replace('.txt', '')))
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);
    }
  }

  if (pages.length === 0) {
    return {
      success: false,
      duration: Date.now() - start,
      outputFiles: [],
      errors: ['No pages to generate. Provide --page, --pages, or run the prompt stage first.'],
    };
  }

  // Load character references and upload to fal.ai storage
  const charRefs = new Map<string, string[]>();
  const charRefUrls = new Map<string, string[]>();

  if (options.characters && options.characters.length > 0) {
    for (const charId of options.characters) {
      const refs = await loadCharacterReferences(charId);
      if (refs.length > 0) {
        charRefs.set(charId, refs);

        if (!options.dryRun) {
          // Upload reference images to fal.ai storage
          if (options.verbose) {
            console.log(`  Uploading ${refs.length} reference(s) for ${charId}...`);
          }
          const urls: string[] = [];
          for (const refPath of refs) {
            const url = await uploadToFal(refPath);
            urls.push(url);
          }
          charRefUrls.set(charId, urls);
          if (options.verbose) {
            console.log(`  Uploaded ${urls.length} reference(s) for ${charId}`);
          }
        }
      } else {
        console.warn(`  Warning: no reference images found for ${charId}`);
      }
    }
  }

  // Read style guide
  let stylePrefix = '';
  try {
    const styleRaw = await readFile(PATHS.styleGuide, 'utf-8');
    const styleData = parseYaml(styleRaw) as { kling_style_prefix?: string; style_prefix?: string };
    stylePrefix = styleData.kling_style_prefix ?? styleData.style_prefix ?? '';
  } catch {
    // No style guide — fine
  }

  // Generate each page
  for (const pageNum of pages) {
    const pageStr = String(pageNum).padStart(3, '0');
    const chStr = String(options.chapter).padStart(2, '0');

    // Determine output filename (auto-version)
    let version = 1;
    const existingFiles = existsSync(klingRawDir)
      ? (await readdir(klingRawDir)).filter((f) => f.startsWith(`ch${chStr}_p${pageStr}_v`))
      : [];
    if (existingFiles.length > 0) {
      const versions = existingFiles.map((f) => {
        const match = f.match(/_v(\d+)/);
        return match ? parseInt(match[1]!) : 0;
      });
      version = Math.max(...versions) + 1;
    }
    const outputFilename = `ch${chStr}_p${pageStr}_v${version}.png`;
    const outputPath = path.join(klingRawDir, outputFilename);

    // Build prompt
    let prompt = options.prompt ?? (await readPagePrompt(options.chapter, pageNum));
    if (!prompt) {
      errors.push(`No prompt found for page ${pageNum}`);
      continue;
    }

    // Prepend style prefix
    if (stylePrefix) {
      prompt = `${stylePrefix} ${prompt}`;
    }

    console.log(`\n[page ${pageNum}] Generating ${outputFilename}...`);
    if (options.verbose) {
      console.log(`  Prompt: ${prompt.slice(0, 120)}...`);
    }

    if (options.dryRun) {
      console.log(`  [dry-run] Would generate: ${outputPath}`);
      outputFiles.push(outputPath);
      continue;
    }

    try {
      let result;
      const mode = charRefUrls.size > 1 ? 'multi-ref' : charRefUrls.size === 1 ? 'single-ref' : 'text-only';

      if (charRefUrls.size > 1) {
        // Multi-reference: use Kling O1 with @Image syntax
        // Build prompt with @Image placeholders and collect uploaded URLs
        const imageUrls: string[] = [];
        let multiPrompt = prompt;
        let imageIndex = 1;
        for (const [charId, urls] of charRefUrls) {
          imageUrls.push(urls[0]!);
          multiPrompt += ` @Image${imageIndex} is ${charId}.`;
          imageIndex++;
        }

        console.log(`  Mode: multi-ref (${imageUrls.length} character references) via fal.ai`);

        result = await generatePanelMultiRef({
          prompt: multiPrompt,
          imageUrls,
          aspectRatio: options.aspectRatio,
        });
      } else if (charRefUrls.size === 1) {
        // Single reference
        const [, urls] = [...charRefUrls.entries()][0]!;
        console.log(`  Mode: single-ref via fal.ai`);

        result = await generatePanelWithReference({
          prompt,
          referenceImage: urls[0]!,
          aspectRatio: options.aspectRatio,
        });
      } else {
        // No reference: text-only
        console.log(`  Mode: text-only via fal.ai`);

        result = await generatePanel({
          prompt,
          aspectRatio: options.aspectRatio,
        });
      }

      // Download and save
      if (result.imageUrls.length > 0) {
        await downloadAndSave(result.imageUrls[0]!, outputPath);
        outputFiles.push(outputPath);
        console.log(`  Saved: ${outputFilename}`);
      } else {
        errors.push(`Page ${pageNum}: no images returned`);
      }

      // Save generation log
      const logPath = path.join(klingRawDir, `${outputFilename}.log.json`);
      await writeFile(logPath, JSON.stringify({
        page: pageNum,
        version,
        requestId: result.requestId,
        provider: 'fal.ai',
        model: 'fal-ai/kling-image/o1',
        mode,
        characterRefs: [...charRefs.keys()],
        prompt: prompt.slice(0, 500),
        notes: options.notes ?? '',
        timestamp: new Date().toISOString(),
      }, null, 2));

    } catch (e) {
      const msg = `Page ${pageNum}: ${(e as Error).message}`;
      errors.push(msg);
      console.error(`  Error: ${msg}`);
    }
  }

  return {
    success: errors.length === 0,
    duration: Date.now() - start,
    outputFiles,
    errors,
  };
}
