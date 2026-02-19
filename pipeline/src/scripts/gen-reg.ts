/**
 * gen-reg.ts
 *
 * Generates regularization images for Spyke LoRA training via ComfyUI REST API.
 * Produces generic anime character images (no Spyke features) for class separation.
 *
 * Usage:
 *   tsx pipeline/src/scripts/gen-reg.ts --count 5    # Test run (5 images)
 *   tsx pipeline/src/scripts/gen-reg.ts --count 100  # Full run
 *   tsx pipeline/src/scripts/gen-reg.ts               # Default: 100 images
 *
 * Run from project root: /Users/dondemetrius/Code/plasma
 *
 * Requirements:
 *   - ComfyUI running at http://127.0.0.1:8188
 *   - AnythingXL_inkBase.safetensors loaded in ComfyUI models/checkpoints/
 *   - No new npm packages — uses Node.js built-in fetch + fs/crypto
 */

import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const COMFYUI_URL = 'http://127.0.0.1:8188';
const OUTPUT_DIR = 'dataset/spyke/reg/1_anime_character';
const COMFYUI_OUTPUT_DIR = `${process.env.HOME}/tools/ComfyUI/output`;
const DEFAULT_TARGET = 100;
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 120_000; // 2 minutes per image

const REG_PROMPT = [
  'anime character, 1boy, young man, generic fantasy warrior',
  'standing pose, full body, white background',
  'anime style, clean lineart, flat shading',
  'masterpiece, best quality',
].join(', ');

const REG_NEGATIVE = [
  'spyke_plasma_v1',
  'red bandana, white cloak',
  'ginger hair, red hair',
  'lowres, bad anatomy, bad hands, text, error, missing fingers',
  'extra digit, fewer digits, cropped, worst quality, low quality',
  'signature, watermark, username, blurry',
].join(', ');

// ---------------------------------------------------------------------------
// Workflow builder
// ---------------------------------------------------------------------------

function buildWorkflow(seed: number): Record<string, unknown> {
  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: "AnythingXL_inkBase.safetensors" },
    },
    "2": {
      class_type: "CLIPTextEncode",
      inputs: { text: REG_PROMPT, clip: ["1", 1] },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { text: REG_NEGATIVE, clip: ["1", 1] },
    },
    "4": {
      class_type: "EmptyLatentImage",
      inputs: { width: 512, height: 512, batch_size: 1 },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
        seed,
        steps: 20,
        cfg: 7,
        sampler_name: "euler_ancestral",
        scheduler: "normal",
        denoise: 1,
      },
    },
    "6": {
      class_type: "VAEDecode",
      inputs: { samples: ["5", 0], vae: ["1", 2] },
    },
    "7": {
      class_type: "SaveImage",
      inputs: { images: ["6", 0], filename_prefix: "comfy_reg" },
    },
  };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

async function generateOne(seed: number, destPath: string): Promise<void> {
  const clientId = randomUUID();
  const workflow = buildWorkflow(seed);

  // Submit job
  const promptRes = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });

  if (!promptRes.ok) {
    throw new Error(`prompt POST failed: ${promptRes.status} ${await promptRes.text()}`);
  }

  const { prompt_id } = (await promptRes.json()) as { prompt_id: string };

  // Poll history until done or timeout
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const histRes = await fetch(`${COMFYUI_URL}/history/${prompt_id}`);
    if (!histRes.ok) continue;

    const history = (await histRes.json()) as Record<string, {
      outputs: Record<string, { images: Array<{ filename: string; subfolder: string }> }>;
      status: { completed: boolean };
    }>;

    const entry = history[prompt_id];
    if (!entry?.status?.completed) continue;

    const images = entry.outputs['7']?.images;
    if (!images?.length) throw new Error('No output images in history');

    const img = images[0]!;
    const subfolder = img.subfolder ? `${img.subfolder}/` : '';
    const srcPath = resolve(COMFYUI_OUTPUT_DIR, subfolder, img.filename);
    await copyFile(srcPath, destPath);
    return;
  }

  throw new Error(`Timed out after ${TIMEOUT_MS / 1000}s`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const countArg = process.argv.indexOf('--count');
  const targetCount = countArg !== -1
    ? parseInt(process.argv[countArg + 1]!, 10)
    : DEFAULT_TARGET;

  if (isNaN(targetCount) || targetCount < 1) {
    console.error('Invalid --count value');
    process.exit(1);
  }

  const outputDir = resolve(process.cwd(), OUTPUT_DIR);
  await mkdir(outputDir, { recursive: true });

  // Count existing to support resume
  const existing = (await readdir(outputDir)).filter(f => f.endsWith('.png')).length;

  console.log(`\nRegularization image generator`);
  console.log(`Target: ${targetCount} | Existing: ${existing} | To generate: ${Math.max(0, targetCount - existing)}`);
  console.log(`Output: ${outputDir}\n`);

  if (existing >= targetCount) {
    console.log('Target already reached. Nothing to do.');
    return;
  }

  let saved = existing;
  let failed = 0;
  const startTime = Date.now();

  while (saved < targetCount) {
    const seed = Math.floor(Math.random() * 2 ** 32);
    const index = saved + 1;
    const filename = `reg_${String(index).padStart(3, '0')}.png`;
    const destPath = resolve(outputDir, filename);

    process.stdout.write(`  [${saved}/${targetCount}] ${filename} (seed=${seed})...`);

    try {
      await generateOne(seed, destPath);
      saved++;
      process.stdout.write(' ok\n');
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(` FAILED (${msg}) — skipping\n`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nDone: ${saved} reg images | ${failed} failures | ${elapsed}s elapsed`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
