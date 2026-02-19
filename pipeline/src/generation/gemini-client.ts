/**
 * Gemini API client wrapper for image generation.
 *
 * Provides a thin abstraction over the @google/genai SDK for generating
 * manga panel images. Includes API key validation, image extraction from
 * responses, and rate-limiting utilities.
 */

import { GoogleGenAI } from '@google/genai';
import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { DEFAULT_GEMINI_MODEL } from '../config/defaults.js';

/** Result of a Gemini image generation call. */
export interface GeminiImageResult {
  imageBuffer: Buffer;
  mimeType: string;
}

/**
 * Validate that a Gemini API key is present and non-empty.
 *
 * @param apiKey - The API key to validate (may be undefined)
 * @returns The trimmed, validated API key
 * @throws Error if the key is undefined or empty
 */
export function validateApiKey(apiKey: string | undefined): string {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'GEMINI_API_KEY is not set. Set it in pipeline/.env or as an environment variable. Get a key at https://aistudio.google.com',
    );
  }
  return apiKey.trim();
}

/**
 * Generate an image using the Gemini API.
 *
 * @param opts - Generation options
 * @returns The generated image buffer and MIME type
 * @throws Error if the API call fails or returns no image data
 */
export async function generateImage(opts: {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  apiKey: string;
}): Promise<GeminiImageResult> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });

  const response = await ai.models.generateContent({
    model: opts.model ?? DEFAULT_GEMINI_MODEL,
    contents: opts.prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  // Extract image from response parts
  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData?.data) {
        const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
        const mimeType = part.inlineData.mimeType ?? 'image/png';
        return { imageBuffer, mimeType };
      }
    }
  }

  throw new Error(
    'No image data in Gemini response. The model may not support image generation with the current API key tier.',
  );
}

/**
 * Generate an image using the Gemini API with a reference image for style/character consistency.
 * Sends the reference image alongside the text prompt so Gemini can use it as visual context.
 * Uses the File API for large images (>10MB) to avoid inline data limits.
 */
export async function generateImageWithReference(opts: {
  prompt: string;
  referenceImagePath: string;
  model?: string;
  apiKey: string;
}): Promise<GeminiImageResult> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const imageBuffer = await readFile(opts.referenceImagePath);
  const mimeType = getImageMimeType(opts.referenceImagePath);

  let imagePart: Record<string, unknown>;

  if (imageBuffer.byteLength > 10 * 1024 * 1024) {
    // Large image: upload via File API first
    const blob = new Blob([imageBuffer], { type: mimeType });
    const uploadResult = await ai.files.upload({ file: blob, config: { mimeType } });
    if (!uploadResult.uri) throw new Error('File upload failed: no URI returned');
    imagePart = { fileData: { fileUri: uploadResult.uri, mimeType } };
  } else {
    // Small image: send inline
    imagePart = { inlineData: { data: imageBuffer.toString('base64'), mimeType } };
  }

  const response = await ai.models.generateContent({
    model: opts.model ?? DEFAULT_GEMINI_MODEL,
    contents: [{ role: 'user', parts: [imagePart, { text: opts.prompt }] }],
    config: { responseModalities: ['TEXT', 'IMAGE'] },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData?.data) {
        return {
          imageBuffer: Buffer.from(part.inlineData.data, 'base64'),
          mimeType: part.inlineData.mimeType ?? 'image/png',
        };
      }
    }
  }

  throw new Error(
    'No image data in Gemini response. The model may not support image generation with the current API key tier.',
  );
}

function getImageMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return map[ext] ?? 'image/png';
}

/**
 * Save a generated image result to disk.
 *
 * @param result - The Gemini image result containing the buffer
 * @param destPath - Absolute path to write the image file
 */
export async function saveGeneratedImage(
  result: GeminiImageResult,
  destPath: string,
): Promise<void> {
  await writeFile(destPath, result.imageBuffer);
}

/**
 * Sleep for a specified duration. Used for rate limiting between API calls.
 *
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
