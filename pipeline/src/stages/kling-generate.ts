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
 * Generated images are saved to output/ch-NN/raw/<model-alias>/
 */

import { existsSync } from 'node:fs';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import { PATHS } from '../config/paths.js';
import {
  configureProvider,
  uploadToFal,
  generateImage,
  downloadAndSave,
} from '../generation/kling-client.js';
import { resolveModel, buildRefBindings, type ModelSpec } from '../generation/models.js';
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
  /** Reference fidelity 0-1 (default: 0.8). Kept for log parity; not all models expose it. */
  fidelity?: number;
  /** Model alias or fal endpoint (default: registry default). */
  model?: string;
  /** Resolution string (default: '1K'). */
  resolution?: string;
  /** Deterministic seed where supported. */
  seed?: number;
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
  const promptFile = path.join(chapterPaths.prompts, `page-${String(page).padStart(2, '0')}.txt`);

  if (!existsSync(promptFile)) return null;
  return (await readFile(promptFile, 'utf-8')).trim();
}

/** Character IDs the prompt stage detected on a page (sidecar written next to the prompt). */
async function readPageCharacters(chapter: number, page: number): Promise<string[]> {
  const chapterPaths = PATHS.chapterOutput(chapter);
  const file = path.join(chapterPaths.prompts, `page-${String(page).padStart(2, '0')}.characters.json`);
  if (!existsSync(file)) return [];
  try {
    const ids = JSON.parse(await readFile(file, 'utf-8')) as unknown;
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
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
  let model: ModelSpec;
  try {
    model = resolveModel(options.model);
    if (!options.dryRun) configureProvider(model);
  } catch (e) {
    return { success: false, duration: Date.now() - start, outputFiles: [], errors: [(e as Error).message] };
  }

  const chapterPaths = PATHS.chapterOutput(options.chapter);
  const klingRawDir = chapterPaths.rawFor(model.alias);
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

  // Reference loading is per page: explicit --characters wins, otherwise the
  // prompt stage's sidecar says who is on the page. Uploads are cached.
  const refCache = new Map<string, string[]>();
  async function refsFor(charIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    for (const charId of charIds) {
      if (!refCache.has(charId)) {
        const refs = await loadCharacterReferences(charId);
        if (refs.length === 0) {
          console.warn(`  Warning: no reference images for ${charId} (text-only for this character)`);
          refCache.set(charId, []);
          continue;
        }
        if (options.dryRun || model.provider === 'runway') {
          refCache.set(charId, refs); // local paths; the client inlines or uploads as needed
        } else {
          if (options.verbose) console.log(`  Uploading ${refs.length} reference(s) for ${charId}...`);
          const urls: string[] = [];
          for (const refPath of refs) urls.push(await uploadToFal(refPath));
          refCache.set(charId, urls);
        }
      }
      const cached = refCache.get(charId)!;
      if (cached.length > 0) out.set(charId, cached);
    }
    return out;
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

    const pageChars = options.characters && options.characters.length > 0
      ? options.characters
      : await readPageCharacters(options.chapter, pageNum);
    const charRefUrls = await refsFor(pageChars);
    if (options.verbose) console.log(`  Characters: ${pageChars.join(', ') || 'none'}`);

    try {
      const refGroups = [...charRefUrls.entries()].map(([charId, urls]) => ({ label: charId, urls }));
      const totalRefs = refGroups.reduce((n, g) => n + g.urls.length, 0);
      const mode = refGroups.length > 1 ? 'multi-ref' : refGroups.length === 1 ? 'single-ref' : 'text-only';

      // Cap references at the model limit, spreading the budget across characters.
      let budget = model.maxRefs;
      const perChar = refGroups.length > 0 ? Math.max(1, Math.floor(budget / refGroups.length)) : 0;
      const imageUrls: string[] = [];
      const bindings: Array<{ label: string; count: number }> = [];
      for (const group of refGroups) {
        const take = group.urls.slice(0, Math.min(perChar, budget));
        imageUrls.push(...take);
        bindings.push({ label: group.label, count: take.length });
        budget -= take.length;
      }

      let fullPrompt = prompt;
      if (bindings.length > 0) {
        fullPrompt = `${buildRefBindings(model, bindings)} ${prompt}`;
      }

      console.log(`  Mode: ${mode} (${imageUrls.length}/${totalRefs} refs) via ${model.endpoint}`);

      const result = await generateImage({
        model: model.alias,
        prompt: fullPrompt,
        imageUrls,
        aspectRatio: options.aspectRatio,
        resolution: options.resolution,
        seed: options.seed,
      });

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
        model: result.model.endpoint,
        mode,
        characterRefs: [...charRefUrls.keys()],
        prompt: fullPrompt,
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
