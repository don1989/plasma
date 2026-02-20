# Requirements: v2.0 Local ComfyUI + LoRA Pipeline

**Milestone:** v2.0
**Status:** Active
**Last Updated:** 2026-02-19

---

## Goal

Replace Gemini image generation with a local ComfyUI + kohya_ss stack that delivers deterministic character consistency via LoRA fine-tuning, running entirely on M1 Pro 16GB. The v1.0 overlay and assemble stages are unchanged. The generate stage gains a new `comfyui` mode.

---

## Hardware Constraints (Hard Limits)

These are not guidelines. They are hardware facts that must be encoded as API validation:

| Constraint | Value | Reason |
|------------|-------|--------|
| Max generation resolution | 512×768 | M1 Pro 16GB unified memory |
| Training batch size | 1 | Only safe value for 16GB during LoRA training |
| ControlNet models simultaneously | 1 | Memory budget |
| Simultaneous training + generation | NEVER | GPU resource conflict |
| Base model family | SD 1.5 only | SDXL training not feasible on 16GB |

---

## Requirements

### INFRA — Infrastructure

**INFRA-01** ComfyUI runs locally as a Python sidecar at `http://127.0.0.1:8188` with Apple Silicon Metal/MPS acceleration. Launch command includes `--force-fp16 --listen 127.0.0.1 --port 8188`. Installation at `~/tools/ComfyUI` (outside repo).

**INFRA-02** At least one SD 1.5 checkpoint is available: Anything V5 (primary, anime-style) and/or Realistic Vision V6.0 (backgrounds/reference). Placed in `~/tools/ComfyUI/models/checkpoints/`.

**INFRA-03** kohya_ss installed at `~/tools/kohya_ss` in a separate Python 3.11.9 venv with `PYTORCH_ENABLE_MPS_FALLBACK=1`. CUDA-only packages (`bitsandbytes`, `xformers`, `triton`) are explicitly skipped. `accelerate` configured for MPS with fp16 mixed precision.

**INFRA-04** A hardware validation benchmark confirms ComfyUI generation on MPS is acceptable: 512×512, 20 steps, Euler a sampler, Anything V5 checkpoint completes in under 2 minutes. This benchmark gates all pipeline integration work.

**INFRA-05** ComfyUI-Manager and ComfyUI-ControlNet-Aux custom nodes installed. ControlNet OpenPose model (`control_v11p_sd15_openpose.pth`) downloaded to `~/tools/ComfyUI/models/controlnet/`.

---

### DATA — Spyke Training Dataset

**DATA-01** A training dataset of 15–20 images of Spyke at 512px exists before any LoRA training is attempted. Sources: crops from `Spyke_Final.png` reference sheet + supplementary images generated via the v1.0 Gemini pipeline.

**DATA-02** Each training image has a paired `.txt` caption file. Caption format: `[trigger_word], [framing], [pose/action], [background type]`. Trigger word is `spyke_plasma_v1`.

**DATA-03** A regularization dataset of 100–200 images is generated using the base SD 1.5 model (no LoRA) with a generic anime character prompt. Placed in a sibling directory to the training set.

**DATA-04** Horizontal flips of training images are included in the dataset (automated via preprocessing script). This is the primary augmentation method to increase dataset diversity without new art generation.

---

### LORA — LoRA Training

**LORA-01** A Spyke LoRA is trained on the prepared dataset using kohya_ss `train_network.py`. Training parameters: `network_dim=32`, `network_alpha=16`, `resolution=512,512`, `train_batch_size=1`, `mixed_precision=fp16`, `optimizer_type=AdamW` (not AdamW8bit — CUDA only). Target 800–1200 steps for a 15–20 image dataset.

**LORA-02** Checkpoints are saved every 200 steps. The best-generalizing checkpoint (evaluated via test generations) is selected as the production LoRA — not necessarily the final step.

**LORA-03** The trained LoRA `.safetensors` file is placed in `~/tools/ComfyUI/models/loras/` for immediate use at inference time.

**LORA-04** MPS is verified as active during training (Activity Monitor GPU History shows GPU utilization) before committing to a full training run.

**LORA-05** Only Spyke LoRA is trained in v2.0. June and Draster LoRAs require canonical reference art creation first — explicitly deferred to v2.1.

---

### GEN — ComfyUI Generation

**GEN-01** The Express service exposes the following HTTP API on port 3000:
- `POST /jobs` — submit a generation job (prompt, loraId, seed, steps, cfg, sampler, scheduler, resolution)
- `GET /jobs/:id` — poll job status and retrieve output filename when complete
- `POST /loras/train` — submit a LoRA training job (datasetDir, outputName, steps, resolution)
- `GET /loras/:id/status` — poll training job status
- `GET /health` — returns `{ status: "ok", comfyui: boolean, mps: boolean }`

**GEN-02** The Express service uses the WebSocket + `client_id` pattern for ComfyUI job completion detection: WebSocket connection is established with a UUID `client_id` BEFORE the workflow is posted via `POST /prompt`. This is non-negotiable — the race condition is unrecoverable if this order is wrong.

**GEN-03** `POST /jobs` validates hardware constraints and rejects non-compliant requests with HTTP 400:
- `resolution` width > 512 → reject
- `resolution` height > 768 → reject
- `batch_size` > 1 → reject (if the endpoint accepts it at all — recommended: don't expose batch_size)

**GEN-04** Workflow templates for generation are static JSON files exported from the ComfyUI GUI in "API format" (not the visual editor format). The Express service slot-fills 5 injectable fields: `prompt_text`, `negative_prompt`, `seed`, `lora_name`, `checkpoint_name`. No workflow JSON is assembled programmatically from scratch.

**GEN-05** U-Net inference runs in fp16. VAE runs in fp32. This split is explicit in workflow templates — not inherited from ComfyUI defaults. Prevents known MPS VAE color-desaturation bugs.

**GEN-06** `POST /loras/train` rejects `batch_size > 1` at the API layer and returns HTTP 409 if a training job is already running. This is enforced in code, not documentation.

---

### PIPE — Pipeline Integration

**PIPE-01** `pipeline/src/stages/generate.ts` gains a new `mode === 'comfyui'` branch. Existing `manual` and `api` (Gemini) branches are unchanged. The Gemini API mode is NOT removed.

**PIPE-02** The CLI gains a `--comfyui` flag on the `generate` command. Running `pnpm stage:generate -- --comfyui -c 1 --page 1` submits page 1 to the Express service and polls until the output image appears in `output/ch-01/raw/`.

**PIPE-03** Generated images are saved to `output/ch-XX/raw/` with the existing naming convention (`chXX_pNNN_vN.png`). The overlay and assemble stages consume these files unchanged.

**PIPE-04** `GenerationLogEntry` is extended with: `seed`, `sampler`, `scheduler`, `steps`, `cfg`, `loraId`, `controlnetStrength`, `workflowTemplate`. Existing fields (`imageFile`, `promptFile`, `promptHash`, `model`, `timestamp`, `version`, `approved`) are preserved. The `model` field records the checkpoint name for ComfyUI jobs.

**PIPE-05** The complete workflow JSON used for an approved generation is stored as `chXX_pNNN_vN.workflow.json` alongside the raw image. This enables exact parameter reproduction without relying on the Express service's in-memory state.

---

### CTRL — ControlNet (Parallel Track)

**CTRL-01** The img2img + ControlNet OpenPose workflow accepts a pose reference image path. The image is copied to `~/tools/ComfyUI/input/` before submission (filesystem copy, not `POST /upload/image` API).

**CTRL-02** ControlNet strength is a configurable parameter on `POST /jobs` (default 0.65, range 0.4–0.9). It is NOT hardcoded in the workflow template.

**CTRL-03** The Express service accepts `POST /jobs` with an optional `poseImagePath` field. If present, the `img2img-lora-controlnet.json` template is used; if absent, the `txt2img-lora.json` template is used.

**CTRL-04** ControlNet is on a parallel track. It can be implemented during or after the core generation loop, and may be deferred to v2.1 without blocking the milestone.

---

## Reproducibility Definition

**"Reproducible panel"** in v2.0 is defined as: given the same workflow JSON, same checkpoint, same LoRA version, and same seed, the generated image is visually consistent — same character, same pose, same composition — across multiple runs. Pixel-identical bit-exact identity is explicitly NOT required and NOT achievable on MPS.

---

## Acceptance Criteria

The milestone is complete when ALL of the following are true:

1. `pnpm stage:generate -- --comfyui -c 1 --page 1` produces an image in `output/ch-01/raw/` without Gemini API calls
2. Spyke's asymmetric details (right bracer, left knee pauldron, ginger hair, white cloak) are consistently rendered across 3 same-seed test generations
3. The generation manifest records `seed`, `sampler`, `steps`, `cfg`, `loraId`, and `workflowTemplate` for every ComfyUI-generated image
4. `GET /health` returns `{ status: "ok", comfyui: true, mps: true }`
5. `POST /loras/train` with `batch_size=2` returns HTTP 400
6. The overlay and assemble stages run unchanged on ComfyUI-generated images for chapter 1

---

## Out of Scope (v2.0)

- June, Draster LoRA training — no canonical reference images; v2.1 item
- Multi-LoRA stacking beyond Spyke
- SDXL/Flux models — M1 Pro 16GB constraint; future hardware upgrade path
- Cloud GPU training
- Parallel batch generation — ComfyUI queues serially; parallel submission provides no benefit
- Automated pose skeleton synthesis from text descriptions
- WebSocket progress streaming from Express service to CLI
- Model preset switching in the CLI — commit to one checkpoint first
- Automatic1111 (A1111) — poor Apple Silicon support

---

## Deferred Decisions

**img2img base image:** Filesystem copy to `[COMFYUI_DIR]/input/` is the default approach (simpler, no API call). `POST /upload/image` API is available as an alternative if filesystem access is not viable. Resolved before Phase 10 implementation.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 5 | Complete |
| INFRA-02 | Phase 5 | Complete |
| INFRA-03 | Phase 5 | Complete |
| INFRA-04 | Phase 5 | Complete |
| INFRA-05 | Phase 5 | Complete |
| DATA-01 | Phase 6 | Complete |
| DATA-02 | Phase 6 | Pending |
| DATA-03 | Phase 6 | Pending |
| DATA-04 | Phase 6 | Complete |
| GEN-01 | Phase 7 | Complete |
| GEN-02 | Phase 7 | Complete |
| GEN-03 | Phase 7 | Complete |
| GEN-04 | Phase 7 (template + slot definition) / Phase 9 (LoRA wired into slot) | Complete |
| GEN-05 | Phase 7 | Complete |
| PIPE-01 | Phase 7 | Complete |
| PIPE-02 | Phase 7 | Complete |
| PIPE-03 | Phase 7 | Complete |
| LORA-01 | Phase 8 | Pending |
| LORA-02 | Phase 8 | Pending |
| LORA-03 | Phase 8 | Pending |
| LORA-04 | Phase 8 | Complete |
| LORA-05 | Phase 8 | Pending |
| GEN-06 | Phase 9 | Pending |
| PIPE-04 | Phase 9 | Pending |
| PIPE-05 | Phase 9 | Pending |
| CTRL-01 | Phase 10 | Pending |
| CTRL-02 | Phase 10 | Pending |
| CTRL-03 | Phase 10 | Pending |
| CTRL-04 | Phase 10 | Pending |

**Coverage: 26/26 v2.0 requirements mapped. No orphans.**

---

*Requirements for: Plasma Manga Pipeline v2.0*
*Created: 2026-02-19 based on SUMMARY.md research synthesis*
*Traceability added: 2026-02-19 after roadmap creation*
