/**
 * ComfyUI WebSocket + REST client for image generation jobs.
 *
 * CRITICAL ORDERING (GEN-02): WebSocket connection MUST be established
 * BEFORE the POST /prompt request is made. The WS connection carries the
 * client_id that ComfyUI uses to route status messages back to this client.
 * Reversing the order causes missed messages and broken completion detection.
 *
 * Completion is detected via: { type: 'executing', data: { node: null, prompt_id } }
 * NOT via 'execution_success' — that event fires before outputs are persisted
 * (ComfyUI issue #11540).
 */
import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import type { ComfyMessage, HistoryEntry } from './types.js';
import { slotFill } from './slot-fill.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMFYUI_URL = 'http://127.0.0.1:8188';
const COMFYUI_WS = 'ws://127.0.0.1:8188';
const TIMEOUT_MS = 90_000;
const SAVE_NODE_ID = '7'; // Must match SaveImage node ID in txt2img-lora.json
const COMFYUI_OUTPUT_DIR = path.join(
  process.env['HOME'] ?? '/Users/plasma',
  'tools',
  'ComfyUI',
  'output',
);

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface ComfyJobInput {
  promptText: string;
  negativePrompt?: string;
  seed: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  checkpointName?: string;
  destDir: string; // absolute path to raw/comfyui/ directory
  chapter: number;
  page: number;
  version: number;
}

export interface ComfyJobResult {
  promptId: string;
  imagePath: string; // absolute path to copied image in raw/comfyui/
  imageFile: string; // bare filename e.g. ch01_p001_v1.png
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Wait for ComfyUI to signal job completion via WebSocket.
 *
 * Resolves when we receive: { type: 'executing', data: { node: null, prompt_id } }
 * Rejects if timeout elapses before completion is signalled.
 */
function waitForCompletion(
  ws: WebSocket,
  promptId: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`ComfyUI job timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    const onMessage = (raw: Buffer | string): void => {
      let msg: ComfyMessage;
      try {
        msg = JSON.parse(raw.toString()) as ComfyMessage;
      } catch {
        // Non-JSON frames (ping/pong, binary) — ignore
        return;
      }

      if (msg.type === 'progress' && msg.data.value !== undefined && msg.data.max !== undefined) {
        console.log(`[comfyui-client] progress: ${msg.data.value}/${msg.data.max}`);
        return;
      }

      if (
        msg.type === 'executing' &&
        msg.data.node === null &&
        msg.data.prompt_id === promptId
      ) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve();
      }
    };

    ws.on('message', onMessage);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a generation job to ComfyUI.
 *
 * Implements the WS-before-POST ordering required by GEN-02:
 *   1. Open WebSocket (wait for 'open')
 *   2. POST /prompt (with client_id)
 *   3. Wait for completion via WebSocket ('executing' + node:null)
 *   4. Fetch image from /history
 *   5. Copy image to pipeline output directory
 *
 * All errors propagate — caller (router) is responsible for updating job state.
 */
export async function submitJob(input: ComfyJobInput): Promise<ComfyJobResult> {
  // STEP 0 — Load and slot-fill workflow template
  const templatePath = path.join(__dirname, 'workflows', 'txt2img-lora.json');
  const templateJson = readFileSync(templatePath, 'utf-8');
  const seed = input.seed ?? Math.floor(Math.random() * 2_147_483_647);

  // slotFill uses lowercase key names matching its internal token map
  const filledJson = slotFill(templateJson, {
    prompt_text: input.promptText,
    negative_prompt:
      input.negativePrompt ?? 'lowres, bad anatomy, bad hands, text, error, missing fingers',
    seed,
    lora_name: '', // Phase 7: no LoRA — Phase 9 wires this
    checkpoint_name: input.checkpointName ?? 'AnythingXL_inkBase.safetensors',
  });
  const workflow = JSON.parse(filledJson) as Record<string, unknown>;

  // STEP 1 — Generate client_id
  const clientId = randomUUID();

  // STEP 2 — Open WebSocket FIRST (CRITICAL — GEN-02)
  const ws = new WebSocket(`${COMFYUI_WS}/ws?clientId=${clientId}`);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => {
      console.log(`[comfyui-client] WS open, clientId=${clientId}`);
      resolve();
    });
    ws.once('error', reject);
  });

  // STEP 3 — POST workflow AFTER WS is open
  let promptId: string;
  try {
    const promptRes = await fetch(`${COMFYUI_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    });
    if (!promptRes.ok) {
      ws.close();
      throw new Error(`ComfyUI POST /prompt failed: ${promptRes.status} ${await promptRes.text()}`);
    }
    const json = (await promptRes.json()) as { prompt_id: string };
    promptId = json.prompt_id;
    console.log(`[comfyui-client] Job submitted, prompt_id=${promptId}`);
  } catch (err) {
    ws.close();
    throw err;
  }

  // STEP 4 — Wait for completion via WebSocket
  await waitForCompletion(ws, promptId, TIMEOUT_MS);
  ws.close();

  // STEP 5 — Retrieve image from history
  const histRes = await fetch(`${COMFYUI_URL}/history/${promptId}`);
  const history = (await histRes.json()) as Record<string, HistoryEntry>;
  const entry = history[promptId];
  const outputImages = entry?.outputs?.[SAVE_NODE_ID]?.images ?? [];
  if (outputImages.length === 0) {
    throw new Error(`No output images in ComfyUI history for prompt_id=${promptId}`);
  }
  const img = outputImages[0]!;
  const srcPath = path.join(COMFYUI_OUTPUT_DIR, img.subfolder, img.filename);

  // STEP 6 — Copy to pipeline output directory
  const { panelImageFilename } = await import('../generation/naming.js');
  const imageFile = panelImageFilename(input.chapter, input.page, input.version);
  const destPath = path.join(input.destDir, imageFile);
  await copyFile(srcPath, destPath);
  console.log(`[comfyui-client] Image saved: ${destPath}`);

  return { promptId, imagePath: destPath, imageFile };
}
