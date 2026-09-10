/**
 * fal.ai image generation client.
 *
 * Originally Kling-only; now a thin wrapper over any model in the registry
 * (`models.ts`). Handles credentials, reference upload, request shaping per
 * model, and download of results.
 */

import { fal } from '@fal-ai/client';
import RunwayML, { TaskFailedError } from '@runwayml/sdk';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { resolveModel, runwayTag, RUNWAY_RATIOS, type ModelSpec } from './models.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  /** Text prompt. Reference bindings should already be appended. */
  prompt: string;
  /** Reference image URLs (already uploaded) or local paths. May be empty. */
  imageUrls?: string[];
  /** Model alias or endpoint (default: registry default). */
  model?: string;
  /** Aspect ratio (default: 3:4 for portrait manga panels). */
  aspectRatio?: string;
  /** Number of images to generate (default: 1). */
  count?: number;
  /** Resolution string (default: '1K'). */
  resolution?: string;
  /** Deterministic seed, where the model supports it. */
  seed?: number;
}

export interface GenerationResult {
  imageUrls: string[];
  requestId: string;
  model: ModelSpec;
}

/** @deprecated use GenerationResult */
export type KlingGenerationResult = GenerationResult;

interface FalImage {
  url: string;
  content_type?: string;
}

interface FalImageResult {
  images: FalImage[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export function configureFal(): void {
  const key = process.env['FAL_KEY'];
  if (!key) {
    throw new Error(
      'Missing fal.ai API key. Set FAL_KEY in your .env file.\n' +
      'Get your key from: https://fal.ai/dashboard/keys',
    );
  }
  fal.config({ credentials: key });
}

let runway: RunwayML | null = null;

export function configureRunway(): RunwayML {
  const key = process.env['RUNWAYML_API_SECRET'];
  if (!key) {
    throw new Error(
      'Missing Runway API key. Set RUNWAYML_API_SECRET in your .env file.\n' +
      'Get your key from: https://dev.runwayml.com',
    );
  }
  runway ??= new RunwayML({ apiKey: key });
  return runway;
}

/** Configure whichever provider the model needs. fal is also configured when a key is present (used for uploads). */
export function configureProvider(model: ModelSpec): void {
  if (model.provider === 'runway') {
    configureRunway();
    if (process.env['FAL_KEY']) fal.config({ credentials: process.env['FAL_KEY'] });
  } else {
    configureFal();
  }
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

const uploadCache = new Map<string, string>();

export async function uploadToFal(localPath: string): Promise<string> {
  if (localPath.startsWith('http://') || localPath.startsWith('https://')) {
    return localPath;
  }
  const cached = uploadCache.get(localPath);
  if (cached) return cached;

  const buffer = await readFile(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png'
    : ext === '.webp' ? 'image/webp'
    : 'image/jpeg';

  const blob = new Blob([buffer], { type: mimeType });
  const file = new File([blob], path.basename(localPath), { type: mimeType });
  const url = await fal.storage.upload(file);

  uploadCache.set(localPath, url);
  return url;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Shape the request body for a given model. Each endpoint has its own schema.
 */
function buildInput(model: ModelSpec, options: GenerateOptions, imageUrls: string[]): Record<string, unknown> {
  const aspect = options.aspectRatio ?? '3:4';
  const resolution = options.resolution ?? '1K';
  if (!model.resolutions.includes(resolution)) {
    throw new Error(`${model.alias} does not support resolution "${resolution}" (supports ${model.resolutions.join(', ')})`);
  }

  switch (model.alias) {
    case 'kling-o1':
      return {
        prompt: options.prompt,
        image_urls: imageUrls,
        aspect_ratio: aspect,
        num_images: options.count ?? 1,
        resolution,
      };
    case 'nano-banana-pro':
    case 'nano-banana-2':
      return {
        prompt: options.prompt,
        image_urls: imageUrls,
        aspect_ratio: aspect,
        num_images: options.count ?? 1,
        resolution,
        output_format: 'png',
        ...(options.seed !== undefined ? { seed: options.seed } : {}),
      };
    default:
      throw new Error(`No input builder for model ${model.alias}`);
  }
}

const RUNWAY_DATA_URI_LIMIT = 1.5 * 1024 * 1024;

/**
 * Runway accepts https URLs or data URIs. Several multi-MB data URIs in one
 * request trip its body-size limit (413), so prefer a fal storage URL when a
 * key is available and only inline small files.
 */
async function toRunwayUri(ref: string): Promise<string> {
  if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('data:')) return ref;
  if (process.env['FAL_KEY']) return uploadToFal(ref);
  const size = (await stat(ref)).size;
  if (size <= RUNWAY_DATA_URI_LIMIT) {
    const ext = path.extname(ref).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${(await readFile(ref)).toString('base64')}`;
  }
  throw new Error(`Reference ${path.basename(ref)} is too large to inline for Runway and FAL_KEY is not set for upload`);
}

async function generateViaRunway(model: ModelSpec, options: GenerateOptions, refs: string[]): Promise<GenerationResult> {
  const client = configureRunway();
  const aspect = options.aspectRatio ?? '3:4';
  const family = model.endpoint.startsWith('muse') ? 'muse' : 'gen4';
  const ratio = RUNWAY_RATIOS[family]?.[aspect];
  if (!ratio) {
    throw new Error(`${model.alias} has no ratio mapping for aspect ${aspect} (known: ${Object.keys(RUNWAY_RATIOS[family] ?? {}).join(', ')})`);
  }
  if (model.endpoint === 'gen4_image_turbo' && refs.length === 0) {
    throw new Error('gen4_image_turbo requires at least one reference image');
  }

  const referenceImages = [];
  for (let i = 0; i < refs.length; i++) {
    const uri = await toRunwayUri(refs[i]!);
    referenceImages.push(model.refSyntax === 'runway-tag' ? { uri, tag: runwayTag(i + 1) } : { uri });
  }

  const body = {
    model: model.endpoint,
    promptText: options.prompt,
    ratio,
    ...(referenceImages.length > 0 ? { referenceImages } : {}),
    ...(options.seed !== undefined && family === 'gen4' ? { seed: options.seed } : {}),
    ...(family === 'muse' ? { outputCount: options.count ?? 1, outputFormat: 'png' } : {}),
  } as Parameters<typeof client.textToImage.create>[0];

  let task;
  try {
    task = await client.textToImage.create(body).waitForTaskOutput();
  } catch (e) {
    if (e instanceof TaskFailedError) {
      const d = e.taskDetails as { failure?: string; failureCode?: string };
      throw new Error(`Runway task failed: ${d.failure ?? 'no reason given'} (${d.failureCode ?? 'no code'})`);
    }
    throw e;
  }
  return {
    imageUrls: task.output ?? [],
    requestId: task.id,
    model,
  };
}

/**
 * Generate one or more images. Local reference paths are uploaded first.
 */
export async function generateImage(options: GenerateOptions): Promise<GenerationResult> {
  const model = resolveModel(options.model);
  const refs = options.imageUrls ?? [];
  if (refs.length > model.maxRefs) {
    throw new Error(`${model.alias} supports at most ${model.maxRefs} reference images (got ${refs.length})`);
  }
  if (model.maxPromptChars && options.prompt.length > model.maxPromptChars) {
    throw new Error(`${model.alias} caps prompts at ${model.maxPromptChars} characters; this prompt is ${options.prompt.length}. Trim it (the style prefix and reference bindings count).`);
  }
  if (model.provider === 'runway') {
    return generateViaRunway(model, options, refs);
  }
  if (refs.length === 0 && model.refSyntax === 'natural') {
    // The fal edit endpoints require at least one image. Fall back to Kling for text-only.
    return generateImage({ ...options, model: 'kling-o1' });
  }

  const imageUrls: string[] = [];
  for (const ref of refs) imageUrls.push(await uploadToFal(ref));

  const result = await fal.subscribe(model.endpoint, {
    input: buildInput(model, options, imageUrls),
  });

  const data = result.data as FalImageResult;
  return {
    imageUrls: (data.images ?? []).map((img) => img.url),
    requestId: result.requestId,
    model,
  };
}

// ---------------------------------------------------------------------------
// Backwards-compatible wrappers (older call sites)
// ---------------------------------------------------------------------------

export async function generatePanel(options: GenerateOptions): Promise<GenerationResult> {
  return generateImage({ ...options, imageUrls: [] });
}

export async function generatePanelWithReference(
  options: GenerateOptions & { referenceImage: string },
): Promise<GenerationResult> {
  const model = resolveModel(options.model);
  const prompt = model.refSyntax === 'at-image' ? `@Image1 ${options.prompt}` : options.prompt;
  return generateImage({ ...options, prompt, imageUrls: [options.referenceImage] });
}

export async function generatePanelMultiRef(
  options: GenerateOptions & { imageUrls: string[] },
): Promise<GenerationResult> {
  if (options.imageUrls.length === 0) {
    throw new Error('At least one reference image URL is required for multi-ref generation');
  }
  return generateImage(options);
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export async function downloadAndSave(imageUrl: string, outputPath: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);
}
