# Phase 3: Image Generation Workflow - Research

**Researched:** 2026-02-19
**Domain:** Gemini image generation (manual + API), file organization, prompt-to-image traceability
**Confidence:** HIGH (manual workflow, naming, tracking) / MEDIUM (API workflow -- SDK is active but model landscape is shifting)

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IGEN-01 | Pipeline supports manual Gemini workflow (copy-paste prompts, organize downloaded images) | CLI `generate` subcommand with `--manual` mode: reads prompts from `output/ch-NN/prompts/`, displays them for copy-paste, then organizes user-downloaded images into `output/ch-NN/raw/` with correct naming convention. Includes an `import` subcommand to rename and move downloaded files. |
| IGEN-02 | Pipeline supports automated Gemini API workflow via SDK | `@google/genai` SDK (v1.41.0) replaces the deprecated `@google/generative-ai`. Use `ai.models.generateContent()` with `responseModalities: ['TEXT', 'IMAGE']` and model `gemini-2.5-flash-image` or `gemini-3-pro-image-preview`. Images returned as base64 in `part.inlineData.data`, decoded and saved to `output/ch-NN/raw/`. Requires paid tier API key (image generation is not available on free tier). |
| IGEN-03 | Panel images follow naming convention: ch01_p003_v1.png | Naming function: `ch${pad(chapter,2)}_p${pad(page,3)}_v${version}.png`. Version auto-incremented by scanning existing files in `raw/` directory. All stages downstream consume this naming convention. |
| IGEN-04 | Prompt-to-image tracking records which prompt produced which approved image | JSON manifest at `output/ch-NN/generation-log.json` recording: prompt file path, prompt text hash (SHA-256), image output path, model used, timestamp, version number, approval status. Updated atomically on each generation. Enables full traceability from any image back to its exact prompt. |

</phase_requirements>

## Summary

Phase 3 implements the `generate` stage -- the bridge between text prompts (produced by Phase 2) and raw panel images. It has two parallel workflows: a **manual workflow** where the user copy-pastes prompts into the Gemini web UI and imports the downloaded images, and an **automated workflow** where the CLI calls the Gemini API directly. Both workflows produce identically-named, identically-organized output files with full prompt-to-image traceability.

The critical SDK discovery is that `@google/generative-ai` (listed in the project's prior decisions) reached end-of-life on August 31, 2025 and no longer receives updates. The replacement is `@google/genai` (v1.41.0), Google's unified Gen AI SDK for TypeScript/JavaScript. This is a breaking change in package name and API surface -- the new SDK uses `new GoogleGenAI({apiKey})` initialization and `ai.models.generateContent()` instead of the old `getGenerativeModel()` pattern. Image generation uses `responseModalities: ['TEXT', 'IMAGE']` in the config object, and images are returned as base64-encoded PNG data in `part.inlineData.data`.

A second critical finding is that **Gemini API image generation is not available on the free tier**. The user's "Gemini Pro account" likely refers to a Google AI Pro subscription ($19.99/month), which provides access to image generation in the Gemini app but is distinct from API billing. To use the API for image generation (IGEN-02), the user must enable Cloud Billing on their Google Cloud project and set up a paid-tier API key through Google AI Studio. This confirms the blocker noted in STATE.md -- API access status must be verified before IGEN-02 can work. The manual workflow (IGEN-01) works regardless of API access.

**Primary recommendation:** Implement the manual workflow first (IGEN-01) as the foundation -- it requires zero API access and delivers immediate value. Layer the API workflow (IGEN-02) on top using the same file organization and tracking infrastructure. Use `@google/genai` (not the deprecated `@google/generative-ai`). Design the generation log (IGEN-04) to work identically for both manual and API workflows.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @google/genai | ^1.41.0 | Gemini API SDK for image generation | Official Google Gen AI SDK for TypeScript/JS. Replaces deprecated @google/generative-ai. Supports generateContent with IMAGE modality, generateImages for Imagen models. Active development (published weekly). |
| sharp | ^0.34.5 | Image validation and metadata reading | Already installed. Use for verifying downloaded images (dimensions, format) and reading EXIF data. Not for generation itself. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | ^16.4 | Load GEMINI_API_KEY from .env file | For API workflow only. Keeps API key out of code and git. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @google/genai | @google/generative-ai | Old SDK is EOL since Aug 2025. Do not use. |
| @google/genai | Vertex AI SDK (@google-cloud/vertexai) | Enterprise option requiring GCP project setup. Overkill for this project. @google/genai supports both AI Studio and Vertex AI. |
| dotenv | hardcoded env var | dotenv is cleaner for dev workflow. CI/CD can set env vars directly. |

**Installation:**
```bash
cd /Users/dondemetrius/Code/plasma/pipeline
pnpm add @google/genai
pnpm add -D dotenv
```

**SDK Migration Note:** Remove `@google/generative-ai` from package.json if present. It is deprecated and must not be used alongside `@google/genai`.

## Architecture Patterns

### Recommended Project Structure (Additions for Phase 3)

```
pipeline/
├── src/
│   ├── cli.ts                    # Existing -- expand generate subcommand with --manual/--api flags
│   ├── config/
│   │   ├── paths.ts              # Existing -- already has chapterOutput() with raw/ path
│   │   └── defaults.ts           # Existing -- add generation defaults (model, aspect ratio)
│   ├── types/
│   │   ├── index.ts              # Existing -- re-export new types
│   │   ├── pipeline.ts           # Existing -- may need GenerateOptions extending StageOptions
│   │   └── generation.ts         # NEW -- GenerationLogEntry, GenerationManifest, ImageNaming
│   ├── generation/               # NEW -- image generation domain
│   │   ├── naming.ts             # Panel image naming: ch01_p003_v1.png
│   │   ├── manifest.ts           # Generation log read/write/update
│   │   ├── gemini-client.ts      # @google/genai wrapper for image generation
│   │   └── image-import.ts       # Manual workflow: rename & organize downloaded images
│   ├── stages/
│   │   └── generate.ts           # Existing stub -- implement with both workflows
│   └── utils/
│       └── fs.ts                 # Existing -- add file hash utility
├── data/
│   └── config/
│       └── generation.yaml       # NEW -- generation config (model, aspect ratio, defaults)
├── .env.example                  # NEW -- template for GEMINI_API_KEY
└── package.json                  # Add @google/genai dependency
```

### Pattern 1: Dual-Mode Generate Stage (IGEN-01 + IGEN-02)

**What:** The generate stage supports two modes: `--manual` (user copy-pastes prompts) and `--api` (automated Gemini API calls). Both produce identical output.
**When to use:** Every time the generate stage runs.
**Why this approach:** The manual workflow is the proven path (user already does this). The API workflow is an upgrade that may depend on billing setup. Both must produce the same file structure and tracking data.

```typescript
// pipeline/src/stages/generate.ts
import type { StageOptions, StageResult } from '../types/pipeline.js';

export interface GenerateOptions extends StageOptions {
  mode: 'manual' | 'api';
  pages?: number[];      // Optional: generate specific pages only
  model?: string;        // Override default model
  aspectRatio?: string;  // Override default aspect ratio
}

export async function runGenerate(options: GenerateOptions): Promise<StageResult> {
  const startTime = Date.now();

  // 1. Load prompts from output/ch-NN/prompts/
  // 2. Load existing generation manifest (if any)
  // 3. Dispatch to manual or API workflow
  // 4. Update generation manifest with results
  // 5. Return stage result

  if (options.mode === 'manual') {
    return runManualWorkflow(options);
  } else {
    return runApiWorkflow(options);
  }
}
```

### Pattern 2: Panel Image Naming Convention (IGEN-03)

**What:** Deterministic naming function that produces `ch01_p003_v1.png` from chapter, page, and version numbers. Version auto-increments by scanning existing files.
**When to use:** Every time a panel image is created or imported.

```typescript
// pipeline/src/generation/naming.ts
import { readdirSync } from 'node:fs';
import path from 'node:path';

export interface PanelImageName {
  chapter: number;
  page: number;
  version: number;
  filename: string;
  extension: string;
}

/**
 * Generate a panel image filename.
 * Format: ch01_p003_v1.png
 */
export function panelImageFilename(
  chapter: number,
  page: number,
  version: number,
  ext: string = 'png',
): string {
  const ch = String(chapter).padStart(2, '0');
  const pg = String(page).padStart(3, '0');
  return `ch${ch}_p${pg}_v${version}.${ext}`;
}

/**
 * Parse a panel image filename back into components.
 * Returns null if the filename doesn't match the convention.
 */
export function parsePanelImageFilename(filename: string): PanelImageName | null {
  const match = filename.match(/^ch(\d{2})_p(\d{3})_v(\d+)\.(png|jpg|jpeg|webp)$/);
  if (!match) return null;
  return {
    chapter: parseInt(match[1]),
    page: parseInt(match[2]),
    version: parseInt(match[3]),
    filename,
    extension: match[4],
  };
}

/**
 * Find the next available version number for a chapter/page.
 * Scans the raw/ directory for existing files.
 */
export function nextVersion(rawDir: string, chapter: number, page: number): number {
  const prefix = `ch${String(chapter).padStart(2, '0')}_p${String(page).padStart(3, '0')}_v`;
  try {
    const files = readdirSync(rawDir);
    const versions = files
      .filter((f) => f.startsWith(prefix))
      .map((f) => {
        const parsed = parsePanelImageFilename(f);
        return parsed ? parsed.version : 0;
      });
    return versions.length > 0 ? Math.max(...versions) + 1 : 1;
  } catch {
    return 1; // Directory doesn't exist yet
  }
}
```

### Pattern 3: Generation Manifest / Prompt-to-Image Log (IGEN-04)

**What:** A JSON manifest file that records the full lineage of every generated image.
**When to use:** Updated on every image generation or import event.

```typescript
// pipeline/src/types/generation.ts
export interface GenerationLogEntry {
  /** Output image filename (e.g., ch01_p003_v1.png) */
  imageFile: string;
  /** Relative path to the prompt file that produced this image */
  promptFile: string;
  /** SHA-256 hash of the prompt text at generation time */
  promptHash: string;
  /** Gemini model used (or 'manual' for copy-paste workflow) */
  model: string;
  /** Generation timestamp (ISO 8601) */
  timestamp: string;
  /** Version number */
  version: number;
  /** Whether this version is the approved/selected one */
  approved: boolean;
  /** Optional notes (e.g., "eyes wrong color, regenerating") */
  notes?: string;
}

export interface GenerationManifest {
  /** Chapter number */
  chapter: number;
  /** Pipeline version that generated this manifest */
  pipelineVersion: string;
  /** All generation entries, ordered by timestamp */
  entries: GenerationLogEntry[];
}
```

```typescript
// pipeline/src/generation/manifest.ts
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { GenerationManifest, GenerationLogEntry } from '../types/generation.js';
import { PIPELINE_VERSION } from '../config/defaults.js';

/**
 * Compute SHA-256 hash of prompt text for traceability.
 */
export function hashPrompt(promptText: string): string {
  return createHash('sha256').update(promptText, 'utf-8').digest('hex');
}

/**
 * Load or create a generation manifest for a chapter.
 */
export async function loadManifest(chapterDir: string, chapter: number): Promise<GenerationManifest> {
  const manifestPath = path.join(chapterDir, 'generation-log.json');
  if (existsSync(manifestPath)) {
    const raw = await readFile(manifestPath, 'utf-8');
    return JSON.parse(raw) as GenerationManifest;
  }
  return {
    chapter,
    pipelineVersion: PIPELINE_VERSION,
    entries: [],
  };
}

/**
 * Save the generation manifest atomically.
 */
export async function saveManifest(chapterDir: string, manifest: GenerationManifest): Promise<void> {
  const manifestPath = path.join(chapterDir, 'generation-log.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Add an entry to the manifest and save.
 */
export async function addEntry(
  chapterDir: string,
  manifest: GenerationManifest,
  entry: GenerationLogEntry,
): Promise<void> {
  manifest.entries.push(entry);
  await saveManifest(chapterDir, manifest);
}
```

### Pattern 4: Manual Workflow -- Import Command (IGEN-01)

**What:** A CLI subcommand that takes user-downloaded Gemini images and organizes them into the pipeline's naming convention.
**When to use:** After the user generates images via Gemini web UI and downloads them.

```typescript
// pipeline/src/generation/image-import.ts

/**
 * Manual workflow import: take a downloaded image file, rename it
 * following the naming convention, move it to raw/, and record
 * in the generation manifest.
 *
 * Usage: plasma-pipeline generate --manual -c 1 --import ~/Downloads/image.png --page 3
 */
export async function importImage(opts: {
  sourcePath: string;
  chapter: number;
  page: number;
  rawDir: string;
  promptsDir: string;
  chapterDir: string;
}): Promise<{ destPath: string; entry: GenerationLogEntry }> {
  // 1. Determine next version number
  // 2. Copy file to raw/ with correct name
  // 3. Read the corresponding prompt for this page
  // 4. Hash the prompt text
  // 5. Create manifest entry with model='manual'
  // 6. Return entry for manifest update
}
```

### Pattern 5: API Workflow -- Gemini Client (IGEN-02)

**What:** A thin wrapper around `@google/genai` that handles image generation, base64 decoding, and file saving.
**When to use:** When running `generate --api`.

```typescript
// pipeline/src/generation/gemini-client.ts
import { GoogleGenAI } from '@google/genai';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface GeminiImageResult {
  imageBuffer: Buffer;
  mimeType: string;
}

export async function generateImage(opts: {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  apiKey: string;
}): Promise<GeminiImageResult> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });

  const response = await ai.models.generateContent({
    model: opts.model ?? 'gemini-2.5-flash-image',
    contents: opts.prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      // Note: imageConfig with aspectRatio may only be available
      // on certain models. Verify at runtime.
    },
  });

  // Extract image from response
  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) {
    throw new Error('No content in Gemini response');
  }

  for (const part of candidate.content.parts) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      return {
        imageBuffer: buffer,
        mimeType: part.inlineData.mimeType ?? 'image/png',
      };
    }
  }

  throw new Error('No image data in Gemini response');
}

/**
 * Save a generated image to the raw/ directory with proper naming.
 */
export async function saveGeneratedImage(
  result: GeminiImageResult,
  destPath: string,
): Promise<void> {
  await writeFile(destPath, result.imageBuffer);
}
```

### Pattern 6: CLI Command Structure

**What:** Expanded `generate` subcommand with mode flags and import capability.

```typescript
// Addition to cli.ts
program
  .command('generate')
  .description('Generate panel images using Gemini AI')
  .requiredOption('-c, --chapter <number>', 'Chapter number')
  .option('--manual', 'Manual workflow: display prompts for copy-paste')
  .option('--api', 'Automated workflow: call Gemini API directly')
  .option('--import <path>', 'Import a downloaded image for a specific page')
  .option('--page <number>', 'Page number (used with --import)')
  .option('--pages <range>', 'Page range to generate (e.g., "1-5" or "3,7,12")')
  .option('--model <name>', 'Gemini model override')
  .option('--approve <file>', 'Mark an image version as approved')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be done without doing it')
  .action(async (options) => { /* ... */ });
```

### Anti-Patterns to Avoid

- **Coupling manual and API workflows at the implementation level:** They share file organization and tracking (manifest), but the generation logic is completely separate. Do not create a single function that handles both.
- **Storing API keys in code or config files checked into git:** Use `.env` file with `.gitignore` entry. Provide `.env.example` as template.
- **Overwriting previous versions:** Never overwrite `ch01_p003_v1.png` with a new generation. Auto-increment to `v2`, `v3`, etc. The version history is valuable for comparison.
- **Making API workflow a prerequisite for manual workflow:** The manual workflow must be fully functional on its own. API workflow is an additive upgrade.
- **Ignoring rate limits in API workflow:** Gemini image generation has per-minute limits. Add configurable delay between requests and handle 429 errors with exponential backoff.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key management | Custom config loading | dotenv + process.env | Standard pattern, handles .env files and system env vars |
| Base64 image decoding | Custom decoder | Buffer.from(data, 'base64') | Node.js built-in, zero dependencies |
| Content hashing | Custom hash function | crypto.createHash('sha256') | Node.js built-in, cryptographically sound |
| Image format validation | Pixel-level checks | sharp.metadata() | Already installed, reads dimensions/format/color space in <1ms |
| HTTP retry with backoff | Custom retry loop | Simple helper with configurable delay | For Gemini API rate limits. Keep it simple -- exponential backoff with max 3 retries. No need for a retry library for a single API call pattern. |
| File watching for manual import | Custom fs.watch setup | Polling or explicit CLI import command | fs.watch is unreliable cross-platform. Explicit `--import` command is more predictable. |

**Key insight:** Phase 3 is primarily a **file organization and workflow orchestration** problem, not a complex image processing problem. The hard part is getting naming, versioning, and tracking right -- not the actual API calls or image manipulation.

## Common Pitfalls

### Pitfall 1: Using the Deprecated @google/generative-ai Package

**What goes wrong:** Code imports from `@google/generative-ai` which reached EOL August 31, 2025. The old package's `getGenerativeModel()` API does not support `responseModalities` for image generation.
**Why it happens:** The project's prior decisions document `@google/generative-ai` as the planned SDK. Multiple online tutorials still reference it.
**How to avoid:** Install `@google/genai` (note: no "generative-" prefix). Use the new initialization pattern: `new GoogleGenAI({apiKey})` and `ai.models.generateContent()`. Remove `@google/generative-ai` from package.json entirely.
**Warning signs:** Import errors, `getGenerativeModel is not a function`, or missing `responseModalities` option.

### Pitfall 2: Assuming Free Tier Supports Image Generation

**What goes wrong:** API calls fail with permission errors because image generation requires a paid-tier API key.
**Why it happens:** The user has a "Gemini Pro account" (likely the $19.99/month Google AI Pro subscription) which gives access to image generation in the Gemini web app. But the Gemini Developer API charges separately per image ($0.039-$0.24 each) and requires Cloud Billing setup.
**How to avoid:** The manual workflow (IGEN-01) works with any Gemini subscription. For API workflow (IGEN-02), document the billing setup steps clearly. Add a startup check that validates the API key has image generation permissions before batch-generating 28 pages.
**Warning signs:** 403/permission errors, "image generation not available for your account" messages.

### Pitfall 3: Not Handling Multi-Part Gemini Responses

**What goes wrong:** Code assumes the response contains exactly one image part. But Gemini returns multiple parts -- text parts and image parts interleaved.
**Why it happens:** The `generateContent` call with `responseModalities: ['TEXT', 'IMAGE']` always returns both text and image content.
**How to avoid:** Iterate over all `response.candidates[0].content.parts` and filter for parts with `inlineData`. Extract the first image part. Log or discard text parts.
**Warning signs:** "No image in response" errors when the image is actually there but in a different part index.

### Pitfall 4: Version Collisions in Concurrent or Interrupted Workflows

**What goes wrong:** Two simultaneous generation runs produce `ch01_p003_v2.png` at the same time, or an interrupted run leaves a partial file that blocks the next version.
**Why it happens:** Version numbering is based on directory scanning, which is not atomic.
**How to avoid:** Use file-system level checks: scan for next version, then create the file with `O_EXCL` (exclusive create) flag. If it fails, re-scan and retry. For the manifest, read-modify-write with a simple lock file for concurrent access protection.
**Warning signs:** Overwritten files, duplicate version numbers in the manifest.

### Pitfall 5: Prompt Text Mismatch Between Generation and Tracking

**What goes wrong:** The generation log records a prompt hash, but the prompt file has been regenerated since the image was created. The hash no longer matches, breaking traceability.
**Why it happens:** The user re-runs the `prompt` stage (Phase 2) which overwrites the prompt files, then checks the generation log.
**How to avoid:** Hash the prompt at generation time and store the hash in the manifest. The manifest records the prompt AS IT WAS when the image was generated, not a reference to a mutable file. Optionally, store the full prompt text in the manifest entry for absolute traceability (file sizes are small -- 2-5KB per prompt).
**Warning signs:** Mismatched hashes when auditing the generation log.

### Pitfall 6: Gemini Rate Limits Causing Batch Failures

**What goes wrong:** Generating all 28 pages of Chapter 1 in rapid succession hits rate limits. Requests after the limit return 429 errors and no images.
**Why it happens:** Gemini image generation has RPM (requests per minute) and IPM (images per minute) limits that vary by tier. Free tier is extremely limited; Tier 1 paid is ~150 RPM.
**How to avoid:** Add a configurable delay between API requests (default: 2 seconds). Implement exponential backoff on 429 responses. Support `--pages` flag to generate specific pages only, enabling incremental generation. Log progress so interrupted runs can resume.
**Warning signs:** Bursts of 429 errors, partially completed generation runs.

### Pitfall 7: Large Base64 Response Memory Pressure

**What goes wrong:** Generating multiple high-resolution images (2K-4K) accumulates base64 strings in memory, potentially causing Node.js heap exhaustion.
**Why it happens:** A 2K PNG image is ~4-8MB as base64. Generating 28 pages sequentially with careless variable handling could hold multiple responses in memory.
**How to avoid:** Process one page at a time: generate, decode, write to disk, release the response. Use streaming (`generateContentStream`) if available for large images. Never accumulate all responses before writing.
**Warning signs:** Increasing RSS memory, "JavaScript heap out of memory" errors on large chapters.

## Code Examples

Verified patterns from official documentation and API research:

### Gemini API Image Generation (Core Pattern)

```typescript
// Source: @google/genai official docs + ai.google.dev/gemini-api/docs/image-generation
import { GoogleGenAI } from '@google/genai';
import { writeFile } from 'node:fs/promises';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generatePanelImage(prompt: string, outputPath: string): Promise<void> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      // imageConfig is available for aspect ratio control:
      // imageConfig: { aspectRatio: '3:4' }
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      await writeFile(outputPath, buffer);
      return;
    }
  }

  throw new Error('No image data in Gemini response');
}
```

### Batch Generation with Rate Limiting

```typescript
// Source: Gemini rate limit documentation + Node.js patterns
async function generateChapter(opts: {
  chapter: number;
  promptsDir: string;
  rawDir: string;
  delayMs: number;
  apiKey: string;
  model: string;
}): Promise<GenerationLogEntry[]> {
  const entries: GenerationLogEntry[] = [];
  const promptFiles = await readdir(opts.promptsDir);
  const sorted = promptFiles.filter(f => f.endsWith('.txt')).sort();

  for (const file of sorted) {
    const pageMatch = file.match(/page-(\d+)\.txt/);
    if (!pageMatch) continue;
    const pageNum = parseInt(pageMatch[1]);

    const promptText = await readFile(path.join(opts.promptsDir, file), 'utf-8');
    const version = nextVersion(opts.rawDir, opts.chapter, pageNum);
    const filename = panelImageFilename(opts.chapter, pageNum, version);
    const destPath = path.join(opts.rawDir, filename);

    try {
      const result = await generateImage({
        prompt: promptText,
        model: opts.model,
        apiKey: opts.apiKey,
      });
      await saveGeneratedImage(result, destPath);

      entries.push({
        imageFile: filename,
        promptFile: `prompts/${file}`,
        promptHash: hashPrompt(promptText),
        model: opts.model,
        timestamp: new Date().toISOString(),
        version,
        approved: false,
      });

      console.log(`[generate] Page ${pageNum} -> ${filename}`);
    } catch (err) {
      console.error(`[generate] Page ${pageNum} failed: ${err}`);
      // Continue with remaining pages
    }

    // Rate limit delay
    await new Promise(resolve => setTimeout(resolve, opts.delayMs));
  }

  return entries;
}
```

### Manual Workflow -- Display Prompts and Import

```typescript
// Source: Project architecture patterns
async function runManualWorkflow(options: GenerateOptions): Promise<StageResult> {
  const chapterPaths = PATHS.chapterOutput(options.chapter);
  const promptsDir = chapterPaths.prompts;
  const rawDir = chapterPaths.raw;

  // If --import is specified, handle file import
  if (options.importPath && options.page) {
    await ensureDir(rawDir);
    const result = await importImage({
      sourcePath: options.importPath,
      chapter: options.chapter,
      page: options.page,
      rawDir,
      promptsDir,
      chapterDir: chapterPaths.root,
    });
    console.log(`[generate] Imported: ${result.destPath}`);
    return { /* ... */ };
  }

  // Otherwise, display prompts for copy-paste
  const promptFiles = await readdir(promptsDir);
  const sorted = promptFiles.filter(f => f.endsWith('.txt')).sort();

  for (const file of sorted) {
    const pageMatch = file.match(/page-(\d+)\.txt/);
    if (!pageMatch) continue;
    const pageNum = parseInt(pageMatch[1]);
    const promptText = await readFile(path.join(promptsDir, file), 'utf-8');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`PAGE ${pageNum} -- Copy the prompt below into Gemini:`);
    console.log('='.repeat(60));
    console.log(promptText);
    console.log('='.repeat(60));
    console.log(`After generating, import with:`);
    console.log(`  pnpm run stage:generate -- -c ${options.chapter} --manual --import <path> --page ${pageNum}`);
    console.log('');
  }

  return { /* ... */ };
}
```

### Image Validation After Import

```typescript
// Source: sharp documentation (already installed)
import sharp from 'sharp';

async function validateImage(imagePath: string): Promise<{
  valid: boolean;
  width: number;
  height: number;
  format: string;
  errors: string[];
}> {
  try {
    const metadata = await sharp(imagePath).metadata();
    const errors: string[] = [];

    if (!metadata.width || !metadata.height) {
      errors.push('Could not read image dimensions');
    }
    if (metadata.format && !['png', 'jpeg', 'webp'].includes(metadata.format)) {
      errors.push(`Unexpected format: ${metadata.format}. Expected png, jpeg, or webp.`);
    }

    return {
      valid: errors.length === 0,
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      format: metadata.format ?? 'unknown',
      errors,
    };
  } catch (err) {
    return {
      valid: false,
      width: 0,
      height: 0,
      format: 'unknown',
      errors: [`Failed to read image: ${err}`],
    };
  }
}
```

## Gemini Model Selection Guide

### Available Models for Image Generation

| Model ID | Codename | Speed | Resolution | Cost/Image | Best For |
|----------|----------|-------|-----------|------------|----------|
| gemini-2.5-flash-image | Nano Banana | ~3 sec | Up to 1K (1024x1024) | $0.039 | High-volume drafting, iteration |
| gemini-3-pro-image-preview | Nano Banana Pro | 8-12 sec | Up to 4K (4096x4096) | $0.134 (1K/2K), $0.24 (4K) | Final production, character consistency |

### Recommendation for This Project

**For iteration/drafting:** Use `gemini-2.5-flash-image` (Nano Banana). Fast, cheap, good enough for composition review. At $0.039/image, generating all 28 pages of Chapter 1 costs ~$1.09.

**For final production:** Use `gemini-3-pro-image-preview` (Nano Banana Pro). Supports reference images (up to 14 -- 5 humans, 6 objects) for character consistency. Higher quality text rendering if any SFX is baked in. At $0.134/image, final production of 28 pages costs ~$3.75.

**Aspect ratio for manga panels:** Use `3:4` or `2:3` for vertical manga pages (portrait orientation). The Webtoon target is 800px wide -- Gemini generates at higher resolution, then Sharp downscales in later phases.

### Deprecated Models -- Do Not Use

| Model | Status | Shutdown Date |
|-------|--------|---------------|
| gemini-2.0-flash-exp | Deprecated | March 31, 2026 |
| Any model via @google/generative-ai | EOL SDK | August 31, 2025 |

## Gemini 3 Pro Image -- Reference Images for Character Consistency

The `gemini-3-pro-image-preview` model supports reference images for maintaining character consistency across generations. This is directly relevant to the project's character fingerprint approach:

- **Up to 5 human reference images** for character consistency
- **Up to 6 object reference images** for detail preservation
- **Up to 14 total reference images** per request

**Workflow:** Generate character reference sheets first (using existing `character ref-sheet` CLI command), then pass those as reference images alongside text prompts for page generation. This could dramatically improve character consistency beyond text-only prompts.

**Note:** This is a v2 enhancement (ADVG-01 in requirements). Phase 3 focuses on text-to-image generation. But the architecture should not prevent adding reference images later.

## API Access Setup (Resolving STATE.md Blocker)

The blocker "Gemini API image generation access status is unknown" can be resolved:

### What "Gemini Pro Account" Likely Means

The user's "Gemini Pro account" is most likely the **Google AI Pro subscription** ($19.99/month). This gives:
- Access to image generation in the Gemini web app (for manual workflow)
- Access to premium models in Google AI Studio
- **Does NOT automatically include API billing for programmatic access**

### Steps to Enable API Image Generation

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Navigate to Dashboard > Usage and Billing > Billing tab
3. Click "Set up Billing" to link a Cloud Billing account
4. Google provides $300 in free credits for new Cloud Billing accounts
5. After billing is set up, create an API key: "Get API Key" > "Create API Key"
6. Store the API key in `pipeline/.env` as `GEMINI_API_KEY=your-key-here`

### Cost Estimate for Chapter 1

| Model | Pages | Cost/Image | Total |
|-------|-------|-----------|-------|
| gemini-2.5-flash-image | 28 | $0.039 | $1.09 |
| gemini-3-pro-image-preview (1K) | 28 | $0.134 | $3.75 |
| gemini-3-pro-image-preview (4K) | 28 | $0.24 | $6.72 |
| Multiple iterations (3x Flash) | 84 | $0.039 | $3.28 |

With $300 in free credits, the user can generate thousands of images before any real cost.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @google/generative-ai SDK | @google/genai SDK | Aug 2025 (EOL) | Must use new SDK; different API surface |
| gemini-2.0-flash-exp for images | gemini-2.5-flash-image / gemini-3-pro-image-preview | Late 2025 | Better quality, official image generation models |
| No native image generation in Gemini | Native multimodal output (Nano Banana) | Mar 2025 | Text-to-image via generateContent, not separate Imagen API |
| Separate Imagen API for images | Unified generateContent with responseModalities | 2025 | Single API call returns text + images together |
| Manual download + manual rename | CLI import command with auto-naming | This phase | Eliminates manual file management errors |

**Key evolution:** Gemini image generation went from experimental (gemini-2.0-flash-exp) to production-ready (gemini-2.5-flash-image, gemini-3-pro-image-preview) in 2025. The unified `generateContent` API with `responseModalities` means image generation is just another output modality, not a separate service.

## Open Questions

1. **User's Exact Gemini Account Status**
   - What we know: User has a "Gemini Pro account" and can generate images in the web UI
   - What's unclear: Whether they have Cloud Billing set up for API access, or only the consumer subscription
   - Recommendation: Manual workflow (IGEN-01) works regardless. For API workflow (IGEN-02), include clear setup instructions and a validation step that tests the API key before batch generation
   - Impact: LOW -- manual workflow is the primary first-class path

2. **Optimal Aspect Ratio for Manga Pages**
   - What we know: Webtoon format is 800px wide vertical scroll. Gemini supports 2:3, 3:4, 9:16 and others
   - What's unclear: Which aspect ratio produces the best manga page composition in Gemini
   - Recommendation: Default to `3:4` (portrait) for standard pages, `1:1` for splash pages, `16:9` for double-spread panoramas. Make aspect ratio configurable per page type in generation config. Test with a few pages before batch generation.

3. **One Image Per Page vs One Image Per Panel**
   - What we know: The existing prompts generate one image per PAGE (containing multiple panels). This matches the Phase 2 output: one prompt file per page.
   - What's unclear: Whether Gemini generates better results with full-page multi-panel prompts vs individual panel prompts
   - Recommendation: Stay with one-image-per-page to match the existing prompt structure. The prompts already include multi-panel layout instructions. This is how the manual workflow already works.

4. **Image Quality Validation Criteria**
   - What we know: Sharp can read metadata (dimensions, format, color space)
   - What's unclear: What constitutes a "valid" generated image beyond basic format checks. Character consistency is a human judgment call.
   - Recommendation: Automated validation checks format, minimum dimensions, and file size (reject tiny/corrupt files). Character consistency remains a manual QC step using the checklist from Phase 2 (CHAR-02). The `--approve` flag in the CLI marks human-verified images.

5. **Prompt Text Storage in Manifest**
   - What we know: Storing only a hash is space-efficient but loses the prompt text if files change
   - What's unclear: Whether to store full prompt text in the manifest JSON
   - Recommendation: Store both: the hash (for quick comparison) and the full prompt text (for absolute traceability). At 2-5KB per prompt and 28 pages per chapter, the manifest would be ~100KB -- negligible.

## Sources

### Primary (HIGH confidence)
- [Gemini API Image Generation docs](https://ai.google.dev/gemini-api/docs/image-generation) -- Model IDs, responseModalities, output format, aspect ratios, reference images
- [@google/genai npm package](https://www.npmjs.com/package/@google/genai) -- v1.41.0, last published Feb 2026, official Google Gen AI SDK
- [googleapis/js-genai GitHub](https://github.com/googleapis/js-genai) -- TypeScript SDK source, API surface, generateContent pattern
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) -- Per-image costs, free tier limitations, paid tier requirements
- [Gemini 3 Pro Image docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image) -- Reference image support, 4K output, thinking mode

### Secondary (MEDIUM confidence)
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits) -- IPM concept, tier-based limits (exact numbers require AI Studio dashboard)
- [Google prompting tips for Gemini image generation](https://developers.googleblog.com/en/how-to-prompt-gemini-2-5-flash-image-generation-for-the-best-results/) -- Character consistency strategies, aspect ratio handling, iterative editing
- [Raymond Camden: Gemini Image Generation Updates](https://www.raymondcamden.com/2025/03/14/generative-images-with-gemini-new-updates) -- Working code examples, gotchas (no explicit size control, dual text+image output)
- [Character consistency with Nano Banana](https://aifacefy.com/blog/detail/How-to-Generate-Consistent-Characters-with-Nano-Banana-Gemini-2-5-Flash-f04e03416688/) -- Character DNA approach, feature reinforcement techniques

### Tertiary (LOW confidence)
- Rate limit exact numbers vary by account tier and change frequently -- verify in AI Studio dashboard
- Gemini 3 Pro Image is in "preview" status -- API may change before GA release

## Metadata

**Confidence breakdown:**
- Manual workflow (IGEN-01): HIGH -- File organization, naming convention, and import tooling are straightforward filesystem operations. No external API dependencies.
- API workflow (IGEN-02): MEDIUM -- SDK is verified and active (@google/genai v1.41.0), API patterns confirmed from multiple sources. However: billing/access requirement adds a setup dependency, model landscape is evolving (gemini-3-pro-image is still in preview), and exact rate limits require dashboard verification.
- Naming convention (IGEN-03): HIGH -- Pattern is simple, deterministic, and already specified in project decisions. Zero ambiguity.
- Tracking/manifest (IGEN-04): HIGH -- JSON manifest with prompt hashing is a standard provenance pattern. No external dependencies.
- SDK migration: HIGH -- @google/generative-ai is confirmed EOL. @google/genai is the verified replacement with different API surface.

**Research date:** 2026-02-19
**Valid until:** 2026-03-05 (Gemini model landscape is evolving; verify model availability and pricing before implementation)
