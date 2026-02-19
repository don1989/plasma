/**
 * Express router for the ComfyUI bridge service.
 *
 * Endpoints:
 *   GET  /health          — Probe ComfyUI reachability
 *   POST /jobs            — Submit a generation job
 *   GET  /jobs/:id        — Poll job status
 *   POST /loras/train     — 501 stub (Phase 9)
 *   GET  /loras/:id/status — 501 stub (Phase 9)
 */
import { Router } from 'express';
import { z } from 'zod';
import { createJob, getJob } from './job-store.js';
import { slotFill } from './slot-fill.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = path.join(__dirname, 'workflows');
const COMFYUI_URL = 'http://127.0.0.1:8188';
const DEFAULT_CHECKPOINT = 'AnythingXL_inkBase.safetensors';
const DEFAULT_NEGATIVE = 'lowres, bad anatomy, bad hands, text, error, missing fingers';
const DEFAULT_STEPS = 20;
const DEFAULT_CFG = 7;
const DEFAULT_SAMPLER = 'euler_ancestral';
const DEFAULT_SCHEDULER = 'normal';

// ---------------------------------------------------------------------------
// Zod validation schema for POST /jobs (GEN-03)
// ---------------------------------------------------------------------------

export const jobRequestSchema = z.object({
  prompt_text: z.string().min(1),
  negative_prompt: z.string().optional(),
  seed: z.number().int().optional(),
  steps: z.number().int().min(1).max(150).optional(),
  cfg: z.number().min(1).max(30).optional(),
  sampler: z.string().optional(),
  scheduler: z.string().optional(),
  resolution: z.object({
    width: z.number().int().min(1),
    height: z.number().int().min(1),
  }),
  checkpoint_name: z.string().optional(),
});

export type JobRequestBody = z.infer<typeof jobRequestSchema>;

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createJobRouter(): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // GET /health
  // -------------------------------------------------------------------------
  router.get('/health', async (_req, res) => {
    let comfyReachable = false;
    try {
      const response = await fetch(`${COMFYUI_URL}/system_stats`, {
        signal: AbortSignal.timeout(2000),
      });
      comfyReachable = response.ok;
    } catch {
      comfyReachable = false;
    }

    console.log(`[service] GET /health -> comfyui: ${comfyReachable}`);

    if (comfyReachable) {
      res.status(200).json({ status: 'ok', comfyui: true, mps: true });
    } else {
      res.status(503).json({ status: 'error', comfyui: false, mps: false });
    }
  });

  // -------------------------------------------------------------------------
  // POST /jobs
  // -------------------------------------------------------------------------
  router.post('/jobs', async (req, res) => {
    // Zod validation
    const parsed = jobRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      res.status(400).json({
        error: issue?.message ?? 'Invalid request body',
        field: issue?.path.join('.') ?? '',
      });
      return;
    }

    const body = parsed.data;

    // Resolution constraints (GEN-03)
    if (body.resolution.width > 512) {
      res.status(400).json({ error: 'width must be <= 512', field: 'resolution.width' });
      return;
    }
    if (body.resolution.height > 768) {
      res.status(400).json({ error: 'height must be <= 768', field: 'resolution.height' });
      return;
    }

    // batch_size guard — not in schema but check raw body for safety
    const rawBody = req.body as Record<string, unknown>;
    if (typeof rawBody['batch_size'] === 'number' && rawBody['batch_size'] > 1) {
      res.status(400).json({ error: 'batch_size must be 1', field: 'batch_size' });
      return;
    }

    // Create job entry
    const job = createJob({ status: 'queued' });

    console.log(
      `[service] POST /jobs -> jobId: ${job.jobId}, prompt: ${body.prompt_text.slice(0, 50)}...`,
    );

    // Respond immediately with 202 Accepted
    res.status(202).json({ jobId: job.jobId, status: 'queued' });

    // Fire-and-forget async job execution
    // TODO: Plan 02 wires ComfyUI execution here via comfyui-client
    setImmediate(async () => {
      // Stub: slot-fill template for future use
      const templatePath = path.join(WORKFLOWS_DIR, 'txt2img-lora.json');
      const templateJson = readFileSync(templatePath, 'utf-8');
      const _filled = slotFill(templateJson, {
        prompt_text: body.prompt_text,
        negative_prompt: body.negative_prompt ?? DEFAULT_NEGATIVE,
        seed: body.seed ?? Math.floor(Math.random() * 2 ** 32),
        checkpoint_name: body.checkpoint_name ?? DEFAULT_CHECKPOINT,
      });
      // Plan 02: submit _filled to ComfyUI WebSocket client
    });
  });

  // -------------------------------------------------------------------------
  // GET /jobs/:id
  // -------------------------------------------------------------------------
  router.get('/jobs/:id', (req, res) => {
    const { id } = req.params;
    const job = getJob(id);

    if (!job) {
      res.status(404).json({ error: 'Job not found', field: 'jobId' });
      return;
    }

    console.log(`[service] GET /jobs/${id} -> status: ${job.status}`);
    res.status(200).json({ ...job });
  });

  // -------------------------------------------------------------------------
  // POST /loras/train — GEN-01 stub (Phase 9)
  // -------------------------------------------------------------------------
  router.post('/loras/train', (_req, res) => {
    res.status(501).json({ error: 'Not implemented — Phase 9' });
  });

  // -------------------------------------------------------------------------
  // GET /loras/:id/status — GEN-01 stub (Phase 9)
  // -------------------------------------------------------------------------
  router.get('/loras/:id/status', (req, res) => {
    res.status(501).json({ error: 'Not implemented — Phase 9' });
  });

  return router;
}
