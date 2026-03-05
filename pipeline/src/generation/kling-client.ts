/**
 * Kling AI API client for manga panel generation.
 *
 * Wraps the `kling-api` npm package to provide:
 * - Single-reference image generation (face/subject mode)
 * - Multi-reference omni image generation (up to 10 refs)
 * - Auto-polling for task completion
 * - Local file saving
 */

import { KlingAPI } from 'kling-api';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KlingConfig {
  accessKey: string;
  secretKey: string;
}

export interface GenerateImageOptions {
  /** Text prompt describing the panel. */
  prompt: string;
  /** Model name (default: kling-v2-1). */
  model?: string;
  /** Aspect ratio (default: 3:4 for portrait manga panels). */
  aspectRatio?: string;
  /** Number of images to generate (1-9, default: 1). */
  count?: number;
  /** Resolution: '1k' or '2k' (default: '1k'). */
  resolution?: string;
}

export interface ReferenceImageOptions extends GenerateImageOptions {
  /** Path or URL to a single reference image. */
  referenceImage: string;
  /** Reference type: 'subject' (whole character) or 'face'. */
  referenceType: 'subject' | 'face';
  /** How closely to match the reference (0-1, default: 0.8). */
  fidelity?: number;
}

export interface OmniImageOptions {
  /** Text prompt with <<<image_N>>> placeholders for references. */
  prompt: string;
  /** Array of reference image paths/URLs (up to 10). */
  images: string[];
  /** Model name (default: kling-image-o1). */
  model?: string;
  /** Aspect ratio (default: 3:4). */
  aspectRatio?: string;
}

export interface KlingGenerationResult {
  /** URL(s) of generated images. */
  imageUrls: string[];
  /** Task ID for tracking. */
  taskId: string;
  /** Raw task status. */
  status: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export function createKlingClient(config: KlingConfig): KlingAPI {
  return new KlingAPI({
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });
}

/**
 * Validate that Kling API credentials are present.
 */
export function validateKlingCredentials(): KlingConfig {
  const accessKey = process.env['KLING_ACCESS_KEY'];
  const secretKey = process.env['KLING_SECRET_KEY'];

  if (!accessKey || !secretKey) {
    throw new Error(
      'Missing Kling AI credentials. Set KLING_ACCESS_KEY and KLING_SECRET_KEY in your .env file.\n' +
      'Get your keys from: https://app.klingai.com/global/dev/document-api',
    );
  }

  return { accessKey, secretKey };
}

/**
 * Generate a manga panel image using Kling AI (no reference image).
 */
export async function generatePanel(
  api: KlingAPI,
  options: GenerateImageOptions,
): Promise<KlingGenerationResult> {
  const task = await api.generateImage({
    prompt: options.prompt,
    model_name: (options.model ?? 'kling-v2-1') as 'kling-v2-1',
    aspect_ratio: (options.aspectRatio ?? '3:4') as '3:4',
    n: options.count ?? 1,
  });

  const taskId = task.data.task_id;
  const result = await api.waitForImageResult(taskId);

  const images = result.data?.task_result?.images ?? [];
  return {
    imageUrls: images.map((img: { url: string }) => img.url),
    taskId,
    status: result.data?.task_status ?? 'unknown',
  };
}

/**
 * Generate a manga panel with a single character reference image.
 * Uses subject or face reference mode for character consistency.
 */
export async function generatePanelWithReference(
  api: KlingAPI,
  options: ReferenceImageOptions,
): Promise<KlingGenerationResult> {
  const task = await api.generateImage({
    prompt: options.prompt,
    model_name: (options.model ?? 'kling-v2-1') as 'kling-v2-1',
    aspect_ratio: (options.aspectRatio ?? '3:4') as '3:4',
    n: options.count ?? 1,
    image: options.referenceImage,
    image_reference: options.referenceType,
    image_fidelity: options.fidelity ?? 0.8,
  });

  const taskId = task.data.task_id;
  const result = await api.waitForImageResult(taskId);

  const images = result.data?.task_result?.images ?? [];
  return {
    imageUrls: images.map((img: { url: string }) => img.url),
    taskId,
    status: result.data?.task_status ?? 'unknown',
  };
}

/**
 * Generate a manga panel with multiple character reference images.
 * Uses Kling Omni Image for multi-reference consistency.
 *
 * Prompt must include <<<image_1>>>, <<<image_2>>> etc. placeholders
 * to reference the provided images.
 */
export async function generatePanelMultiRef(
  api: KlingAPI,
  options: OmniImageOptions,
): Promise<KlingGenerationResult> {
  if (options.images.length === 0) {
    throw new Error('At least one reference image is required for omni image generation');
  }
  if (options.images.length > 10) {
    throw new Error('Kling Omni Image supports a maximum of 10 reference images');
  }

  const task = await api.omniImage({
    prompt: options.prompt,
    model_name: 'kling-image-o1',
    image_list: options.images.map((image) => ({ image })),
    aspect_ratio: (options.aspectRatio ?? '3:4') as '3:4',
  });

  const taskId = task.data.task_id;
  const result = await api.waitForImageResult(taskId);

  const images = result.data?.task_result?.images ?? [];
  return {
    imageUrls: images.map((img: { url: string }) => img.url),
    taskId,
    status: result.data?.task_status ?? 'unknown',
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
