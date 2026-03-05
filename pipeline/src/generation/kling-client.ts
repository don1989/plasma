/**
 * Kling AI image generation via fal.ai.
 *
 * Uses the @fal-ai/client SDK to access Kling models through fal.ai's
 * pay-per-use API instead of the official Kling API ($2,100/mo minimum).
 *
 * Supports:
 * - Text-only generation (backgrounds, establishing shots)
 * - Single-reference generation (one character ref)
 * - Multi-reference generation (up to 10 refs via Kling O1)
 * - Auto-polling for task completion (handled by fal.subscribe)
 * - Local file upload via fal.storage.upload()
 */

import { fal } from '@fal-ai/client';
import { readFile } from 'node:fs/promises';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateImageOptions {
  /** Text prompt describing the panel. */
  prompt: string;
  /** Aspect ratio (default: 3:4 for portrait manga panels). */
  aspectRatio?: string;
  /** Number of images to generate (1-9, default: 1). */
  count?: number;
  /** Resolution: '1K' or '2K' (default: '1K'). */
  resolution?: string;
}

export interface ReferenceImageOptions extends GenerateImageOptions {
  /** Path or URL to a single reference image. */
  referenceImage: string;
  /** How closely to match the reference (0-1, default: 0.8). */
  fidelity?: number;
}

export interface MultiRefOptions {
  /** Text prompt with @Image1, @Image2 placeholders for references. */
  prompt: string;
  /** Array of reference image URLs (up to 10). Must be publicly accessible URLs. */
  imageUrls: string[];
  /** Aspect ratio (default: 3:4). */
  aspectRatio?: string;
  /** Number of images to generate (1-9, default: 1). */
  count?: number;
  /** Resolution: '1K' or '2K' (default: '1K'). */
  resolution?: string;
}

export interface KlingGenerationResult {
  /** URL(s) of generated images. */
  imageUrls: string[];
  /** Request ID for tracking. */
  requestId: string;
}

// ---------------------------------------------------------------------------
// fal.ai response types
// ---------------------------------------------------------------------------

interface FalImage {
  url: string;
  content_type?: string;
}

interface FalKlingResult {
  images: FalImage[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** fal.ai model ID for Kling O1 (multi-reference image generation). */
const FAL_KLING_O1 = 'fal-ai/kling-image/o1';

type KlingAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9' | 'auto';
type KlingResolution = '1K' | '2K';

/**
 * Configure fal.ai credentials from environment.
 * Must be called before any generation functions.
 */
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

/**
 * Upload a local file to fal.ai storage and return a public URL.
 * Caches uploads within a session to avoid re-uploading the same file.
 */
const uploadCache = new Map<string, string>();

export async function uploadToFal(localPath: string): Promise<string> {
  // If it's already a URL, return as-is
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
// Generation functions
// ---------------------------------------------------------------------------

/**
 * Generate a manga panel image using Kling AI via fal.ai (no reference image).
 */
export async function generatePanel(
  options: GenerateImageOptions,
): Promise<KlingGenerationResult> {
  const result = await fal.subscribe(FAL_KLING_O1, {
    input: {
      prompt: options.prompt,
      image_urls: [],
      aspect_ratio: (options.aspectRatio ?? '3:4') as KlingAspectRatio,
      num_images: options.count ?? 1,
      resolution: (options.resolution ?? '1K') as KlingResolution,
    },
  });

  const data = result.data as FalKlingResult;
  return {
    imageUrls: (data.images ?? []).map((img) => img.url),
    requestId: result.requestId,
  };
}

/**
 * Generate a manga panel with a single character reference image.
 * Uploads the local reference file to fal.ai storage first.
 */
export async function generatePanelWithReference(
  options: ReferenceImageOptions,
): Promise<KlingGenerationResult> {
  const imageUrl = await uploadToFal(options.referenceImage);

  const result = await fal.subscribe(FAL_KLING_O1, {
    input: {
      prompt: `@Image1 ${options.prompt}`,
      image_urls: [imageUrl],
      aspect_ratio: (options.aspectRatio ?? '3:4') as KlingAspectRatio,
      num_images: options.count ?? 1,
      resolution: (options.resolution ?? '1K') as KlingResolution,
    },
  });

  const data = result.data as FalKlingResult;
  return {
    imageUrls: (data.images ?? []).map((img) => img.url),
    requestId: result.requestId,
  };
}

/**
 * Generate a manga panel with multiple character reference images.
 * Uses Kling O1 via fal.ai for multi-reference consistency.
 *
 * Prompt must include @Image1, @Image2 etc. placeholders
 * to reference the provided images.
 */
export async function generatePanelMultiRef(
  options: MultiRefOptions,
): Promise<KlingGenerationResult> {
  if (options.imageUrls.length === 0) {
    throw new Error('At least one reference image URL is required for multi-ref generation');
  }
  if (options.imageUrls.length > 10) {
    throw new Error('Kling O1 supports a maximum of 10 reference images');
  }

  const result = await fal.subscribe(FAL_KLING_O1, {
    input: {
      prompt: options.prompt,
      image_urls: options.imageUrls,
      aspect_ratio: (options.aspectRatio ?? '3:4') as KlingAspectRatio,
      num_images: options.count ?? 1,
      resolution: (options.resolution ?? '1K') as KlingResolution,
    },
  });

  const data = result.data as FalKlingResult;
  return {
    imageUrls: (data.images ?? []).map((img) => img.url),
    requestId: result.requestId,
  };
}

/**
 * Download a generated image from URL and save to disk.
 */
export async function downloadAndSave(
  imageUrl: string,
  outputPath: string,
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);
}
