/**
 * Kling AI panel generation stage.
 *
 * Generates manga panels using Kling AI with character reference images
 * for visual consistency. Supports three modes:
 *
 * 1. Single-ref: One character reference image (subject/face mode)
 * 2. Multi-ref: Multiple character references via Kling Omni Image
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
  createKlingClient,
  validateKlingCredentials,
  generatePanel,
  generatePanelWithReference,
  generatePanelMultiRef,
  downloadAndSave,
} from '../generation/kling-client.js';
import {
  loadCharacterReferences,
  buildMultiRefPrompt,
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
  /** Override model name. */
  model?: string;
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
 * Run the Kling AI generation stage.
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

  // Validate credentials
  let credentials;
  try {
    credentials = validateKlingCredentials();
  } catch (e) {
    return { success: false, duration: Date.now() - start, outputFiles: [], errors: [(e as Error).message] };
  }

  const api = createKlingClient(credentials);
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

  // Load character references
  const charRefs = new Map<string, string[]>();
  if (options.characters && options.characters.length > 0) {
    for (const charId of options.characters) {
      const refs = await loadCharacterReferences(charId);
      if (refs.length > 0) {
        charRefs.set(charId, refs);
        if (options.verbose) {
          console.log(`  Loaded ${refs.length} reference(s) for ${charId}`);
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
    const styleData = parseYaml(styleRaw) as { style_prefix?: string };
    stylePrefix = styleData.style_prefix ?? '';
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

      if (charRefs.size > 1) {
        // Multi-reference: use Kling Omni Image
        const { prompt: multiPrompt, images } = buildMultiRefPrompt(prompt, charRefs);
        console.log(`  Mode: multi-ref (${images.length} character references)`);

        result = await generatePanelMultiRef(api, {
          prompt: multiPrompt,
          images,
          model: options.model,
          aspectRatio: options.aspectRatio,
        });
      } else if (charRefs.size === 1) {
        // Single reference: use subject mode
        const [, refs] = [...charRefs.entries()][0]!;
        console.log(`  Mode: single-ref (subject)`);

        result = await generatePanelWithReference(api, {
          prompt,
          referenceImage: refs[0]!,
          referenceType: 'subject',
          fidelity: options.fidelity ?? 0.8,
          model: options.model,
          aspectRatio: options.aspectRatio,
        });
      } else {
        // No reference: text-only
        console.log(`  Mode: text-only (no character references)`);

        result = await generatePanel(api, {
          prompt,
          model: options.model,
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
        taskId: result.taskId,
        model: options.model ?? (charRefs.size > 1 ? 'kling-image-o1' : 'kling-v2-1'),
        mode: charRefs.size > 1 ? 'multi-ref' : charRefs.size === 1 ? 'single-ref' : 'text-only',
        characterRefs: [...charRefs.keys()],
        fidelity: options.fidelity ?? 0.8,
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
