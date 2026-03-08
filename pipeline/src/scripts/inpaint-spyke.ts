/**
 * Inpaint specific areas of the Spyke v3 front standing reference image.
 * Uses fal.ai FLUX.1 [pro] Fill to fix targeted regions without regenerating.
 *
 * Usage: npx tsx pipeline/src/scripts/inpaint-spyke.ts
 */

import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fal } from '@fal-ai/client';
import sharp from 'sharp';
import { loadEnvFile } from '../utils/env.js';
import { PATHS } from '../config/paths.js';

// Load .env
const env = loadEnvFile(path.join(PATHS.pipelineRoot, '.env'));
process.env['FAL_KEY'] = env['FAL_KEY'];
fal.config({ credentials: env['FAL_KEY']! });

const REPO_ROOT = path.resolve(PATHS.pipelineRoot, '..');
const SOURCE_IMAGE = path.join(REPO_ROOT, '03_manga/concept/characters/spyke_tinwall/references/spyke_front_standing_v3.png');
const OUTPUT_DIR = path.join(REPO_ROOT, '03_manga/concept/characters/spyke_tinwall/references/inpainted');

// ---------------------------------------------------------------------------
// Mask regions — white = area to edit, black = keep
// Coordinates estimated from the 880x1168 image
// ---------------------------------------------------------------------------

interface InpaintJob {
  label: string;
  /** Rectangular mask regions (x, y, width, height) — can overlap */
  masks: Array<{ x: number; y: number; w: number; h: number }>;
  /** What to replace the masked area with */
  prompt: string;
}

const JOBS: InpaintJob[] = [
  {
    label: 'fix_shoulder_strap',
    masks: [
      // The diagonal strap — wider coverage from right shoulder across chest to left hip
      { x: 250, y: 200, w: 280, h: 380 },
    ],
    prompt: 'A black short-sleeved t-shirt with subtle red trim details on the sleeves and collar, white sleeveless cloak open at the front draped over shoulders. Clean chest area with no strap, no belt, no cross-body strap. Anime art style, character reference sheet, white background.',
  },
  {
    label: 'fix_right_arm',
    masks: [
      // The right arm bracer area (viewer's left side) — shifted right onto the arm
      { x: 150, y: 360, w: 130, h: 160 },
    ],
    prompt: 'A bare male forearm with only a small red fingerless glove on the hand, no bracer, no wrist armor, no forearm guard, just skin and a short red fingerless glove. Arm hanging relaxed at side. Anime art style, matching skin tone.',
  },
  {
    label: 'fix_right_knee',
    masks: [
      // The right knee pauldron (viewer's left leg) — shifted down to actual knee area
      { x: 300, y: 820, w: 120, h: 120 },
    ],
    prompt: 'Black pants fabric covering the knee, no knee armor, no knee pad, no metal pauldron, just plain black pants over the knee. Anime art style.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createMask(
  width: number,
  height: number,
  regions: Array<{ x: number; y: number; w: number; h: number }>,
  outputPath: string,
): Promise<string> {
  // Start with a black image (keep everything)
  let image = sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).png();

  // Composite white rectangles for each mask region
  const overlays = regions.map((r) => ({
    input: Buffer.from(
      `<svg width="${r.w}" height="${r.h}"><rect x="0" y="0" width="${r.w}" height="${r.h}" fill="white"/></svg>`,
    ),
    left: r.x,
    top: r.y,
  }));

  const buffer = await image.composite(overlays).toBuffer();
  await writeFile(outputPath, buffer);
  return outputPath;
}

async function uploadToFal(localPath: string): Promise<string> {
  const buffer = await readFile(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  const blob = new Blob([buffer], { type: mimeType });
  const file = new File([blob], path.basename(localPath), { type: mimeType });
  return await fal.storage.upload(file);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Get image dimensions
  const meta = await sharp(SOURCE_IMAGE).metadata();
  const width = meta.width!;
  const height = meta.height!;
  console.log(`Source image: ${width}x${height}`);

  // Upload source image once
  console.log('Uploading source image to fal.ai...');
  const sourceUrl = await uploadToFal(SOURCE_IMAGE);
  console.log('Uploaded.\n');

  // Process each job sequentially, chaining outputs
  let currentImageUrl = sourceUrl;
  let currentImagePath = SOURCE_IMAGE;

  for (const job of JOBS) {
    console.log(`\nInpainting: ${job.label}...`);

    // Create mask
    const maskPath = path.join(OUTPUT_DIR, `mask_${job.label}.png`);
    await createMask(width, height, job.masks, maskPath);
    console.log(`  Mask saved: ${maskPath}`);

    // Upload mask
    const maskUrl = await uploadToFal(maskPath);

    // If we're chaining (not the first job), upload the previous output
    if (currentImagePath !== SOURCE_IMAGE) {
      currentImageUrl = await uploadToFal(currentImagePath);
    }

    // Call FLUX.1 [pro] Fill
    const result = await fal.subscribe('fal-ai/flux-pro/v1/fill', {
      input: {
        prompt: job.prompt,
        image_url: currentImageUrl,
        mask_url: maskUrl,
        output_format: 'png',
        safety_tolerance: '6',
      },
    });

    const data = result.data as any;
    if (data.images && data.images.length > 0) {
      const outputPath = path.join(OUTPUT_DIR, `spyke_${job.label}.png`);
      const response = await fetch(data.images[0].url);
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(outputPath, buffer);
      console.log(`  Saved: ${outputPath}`);

      // Chain: use this output as input for next job
      currentImagePath = outputPath;
    } else {
      console.log(`  No images returned for ${job.label}`);
    }
  }

  // Save the final chained result
  if (currentImagePath !== SOURCE_IMAGE) {
    const finalPath = path.join(OUTPUT_DIR, 'spyke_front_standing_final.png');
    const buffer = await readFile(currentImagePath);
    await writeFile(finalPath, buffer);
    console.log(`\nFinal result: ${finalPath}`);
  }

  console.log('\nDone!');
}

main();
