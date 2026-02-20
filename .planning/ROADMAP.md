# Roadmap: Plasma Manga Pipeline

## Milestones

- ✅ **v1.0 Gemini Pipeline MVP** — Phases 1–4 (shipped 2026-02-19) — [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 Local ComfyUI + LoRA Pipeline** — Phases 5–10 (in progress)

## Phases

<details>
<summary>✅ v1.0 Gemini Pipeline MVP (Phases 1–4) — SHIPPED 2026-02-19</summary>

- [x] Phase 1: Foundation (1/1 plans) — completed 2026-02-18
- [x] Phase 2: Scripts, Characters, and Prompts (5/5 plans) — completed 2026-02-19
- [x] Phase 3: Image Generation Workflow (3/3 plans) — completed 2026-02-19
- [x] Phase 4: Assembly and Publish (2/2 plans) — completed 2026-02-19

</details>

### 🚧 v2.0 Local ComfyUI + LoRA Pipeline

- [x] **Phase 5: Environment Validation** — ComfyUI running on M1 Pro with Metal/MPS confirmed and benchmarked (completed 2026-02-19)
- [ ] **Phase 6: Spyke Dataset Preparation** — 15–20 captioned training images + regularization set, ready for kohya_ss
- [x] **Phase 7: ComfyUI + Express Integration** — End-to-end generation via `--comfyui` flag produces output in correct directory (completed 2026-02-19)
- [ ] **Phase 8: Spyke LoRA Training** — Trained LoRA in ComfyUI models/loras/ with MPS confirmed active during training
- [ ] **Phase 9: LoRA Integration + Reproducibility** — LoRA wired into pipeline with full parameter traceability and manifest extension
- [ ] **Phase 10: ControlNet OpenPose** — Pose-conditioned generation available via `--pose-ref` flag on `POST /jobs`

## Phase Details

### Phase 5: Environment Validation
**Goal**: ComfyUI is running on M1 Pro with Metal/MPS acceleration confirmed, benchmarked, and custom nodes installed — the entire Python/Metal stack is validated before any TypeScript integration work begins.
**Depends on**: Nothing (first v2.0 phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. A 512×512, 20-step test generation via the ComfyUI browser UI completes in under 2 minutes using Anything V5 and Euler a sampler
  2. The ComfyUI server is reachable and returns valid JSON at `http://127.0.0.1:8188/system_stats` (NOTE: ComfyUI has no /health endpoint — /system_stats is the correct health check, confirmed by research)
  3. ComfyUI-Manager and ComfyUI-ControlNet-Aux nodes are installed and visible in the ComfyUI node list
  4. `control_v11p_sd15_openpose.pth` is present in `~/tools/ComfyUI/models/controlnet/`
  5. kohya_ss venv activates without errors and `accelerate config` reports `mixed_precision: no` (NOTE: MPS does not support fp16 mixed precision in training — `mixed_precision: no` is correct, confirmed by research)
**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md — Install ComfyUI venv + PyTorch 2.5.1 MPS + ComfyUI-Manager
- [x] 05-02-PLAN.md — Install kohya_ss venv + configure accelerate (mixed_precision: no)
- [x] 05-03-PLAN.md — Download Anything V5 + ControlNet model + ControlNet-Aux extension
- [x] 05-04-PLAN.md — Launch ComfyUI, verify /system_stats MPS, run INFRA-04 benchmark

### Phase 6: Spyke Dataset Preparation
**Goal**: A 15–20 image Spyke training dataset with paired caption files and a regularization set of 100–200 images exists on disk — all prerequisites for LoRA training are satisfied before any training is attempted.
**Depends on**: Phase 5
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. The training dataset directory contains 15–20 `.png` images of Spyke at 512px, each with a paired `.txt` caption file using trigger word `spyke_plasma_v1`
  2. Each caption file follows the format: `[trigger_word], [framing], [pose/action], [background type]`
  3. The dataset directory includes horizontally-flipped versions of each training image (automated augmentation applied)
  4. A sibling regularization directory contains 100–200 images generated from the base SD 1.5 model with a generic anime character prompt and no LoRA
**Plans**: 4 plans

Plans:
- [ ] 06-01-PLAN.md — Build crop script with dry-run mode; produce 18 preview crops from reference sheets
- [ ] 06-02-PLAN.md — Human crop review checkpoint; finalize training images, write captions, generate flips
- [ ] 06-03-PLAN.md — Build regularization generator script; run 100-image ComfyUI batch
- [ ] 06-04-PLAN.md — Dataset validation script + human final verification

### Phase 7: ComfyUI + Express Integration
**Goal**: The end-to-end generation loop works: `pnpm stage:generate -- --comfyui -c 1 --page 1` submits a job, polls the Express service, and produces a correctly-named image in `output/ch-01/raw/` — with the Gemini API mode still intact and the overlay/assemble stages consuming the output unchanged.
**Depends on**: Phase 5
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, PIPE-01, PIPE-02, PIPE-03
**Success Criteria** (what must be TRUE):
  1. `pnpm stage:generate -- --comfyui -c 1 --page 1` completes without error and an image appears in `output/ch-01/raw/` with the naming convention `ch01_pNNN_vN.png`
  2. The Express service starts on port 3000 and `GET /health` returns `{ status: "ok", comfyui: true, mps: true }`
  3. `POST /jobs` with `resolution.width > 512` or `resolution.height > 768` returns HTTP 400
  4. `POST /jobs` with a valid payload establishes a WebSocket connection before posting the workflow, and job completion is detected via that WebSocket (no polling)
  5. The overlay and assemble stages run on a ComfyUI-generated image for chapter 1 without modification
**Plans**: 3 plans

Plans:
- [ ] 07-01-PLAN.md — Install deps + scaffold Express service: types, job-store, slot-fill, router (validation), service entry point, workflow templates
- [ ] 07-02-PLAN.md — Implement ComfyUI WebSocket client + wire into router POST /jobs async handler
- [ ] 07-03-PLAN.md — Pipeline integration: --comfyui CLI flag, generate.ts ComfyUI branch, approve-and-copy promotion

### Phase 8: Spyke LoRA Training
**Goal**: A trained Spyke LoRA `.safetensors` file is placed in `~/tools/ComfyUI/models/loras/`, with the best-generalizing checkpoint selected and MPS confirmed active during training — the core v2.0 character consistency deliverable.
**Depends on**: Phase 6 (dataset), Phase 5 (kohya_ss environment)
**Requirements**: LORA-01, LORA-02, LORA-03, LORA-04, LORA-05
**Success Criteria** (what must be TRUE):
  1. Activity Monitor GPU History shows GPU utilization during the first 10 training steps, confirming MPS is active (not CPU fallback)
  2. Training completes targeting 800–1200 steps with checkpoints saved every 200 steps; at least one intermediate checkpoint file exists in the output directory
  3. The selected production LoRA `.safetensors` file is present in `~/tools/ComfyUI/models/loras/`
  4. A test generation with the selected LoRA loaded shows Spyke's asymmetric details (right bracer, left knee pauldron, ginger hair, white cloak) rendered consistently across two different pose prompts
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md — Fix sd-scripts submodule + write dataset TOML + MPS device check + 5-step smoke test
- [x] 08-02-PLAN.md — Full training run (1840 steps / 4 epochs, 10 checkpoints saved every 200 steps; step 1400 is loss minimum)
- [ ] 08-03-PLAN.md — Test step 1400 + 1200 checkpoints in ComfyUI, select best-generalizing, deploy to loras/

### Phase 9: LoRA Integration + Reproducibility
**Goal**: The trained Spyke LoRA is wired into the Express service workflow templates with full parameter traceability, and 3 same-seed generations confirm visually consistent reproducibility — all 6 milestone acceptance criteria pass.
**Depends on**: Phase 7 (Express service), Phase 8 (trained LoRA)
**Requirements**: GEN-04, GEN-06, PIPE-04, PIPE-05
**Success Criteria** (what must be TRUE):
  1. Three same-seed test generations using the Spyke LoRA produce visually consistent output — same character identity, same pose, same composition across all three runs
  2. The generation manifest (`generation-log.json`) records `seed`, `sampler`, `scheduler`, `steps`, `cfg`, `loraId`, and `workflowTemplate` for every ComfyUI-generated image
  3. The complete workflow JSON for each approved generation is stored as `chXX_pNNN_vN.workflow.json` alongside the raw image
  4. `POST /loras/train` with `batch_size=2` returns HTTP 400; `POST /loras/train` while a training job is already active returns HTTP 409
  5. All 6 acceptance criteria from REQUIREMENTS.md pass end-to-end
**Plans**: TBD

### Phase 10: ControlNet OpenPose
**Goal**: Pose-conditioned img2img generation is available via `poseImagePath` on `POST /jobs` — the `--pose-ref` workflow uses an img2img+ControlNet template and demonstrably affects panel composition.
**Depends on**: Phase 7 (Express service with job routing), Phase 5 (OpenPose model installed)
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04
**Success Criteria** (what must be TRUE):
  1. `POST /jobs` with a valid `poseImagePath` field uses the `img2img-lora-controlnet.json` template; `POST /jobs` without `poseImagePath` uses the `txt2img-lora.json` template
  2. A pose reference image is copied to `~/tools/ComfyUI/input/` before submission (filesystem copy, not API upload)
  3. A test generation with a pose reference image shows visually different composition than the same prompt without pose conditioning, demonstrating ControlNet is active
  4. ControlNet strength is configurable per job via `controlnetStrength` on `POST /jobs` (default 0.65, accepted range 0.4–0.9); values outside the range return HTTP 400
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 1/1 | Complete | 2026-02-18 |
| 2. Scripts, Characters, and Prompts | v1.0 | 5/5 | Complete | 2026-02-19 |
| 3. Image Generation Workflow | v1.0 | 3/3 | Complete | 2026-02-19 |
| 4. Assembly and Publish | v1.0 | 2/2 | Complete | 2026-02-19 |
| 5. Environment Validation | v2.0 | Complete    | 2026-02-19 | 2026-02-19 |
| 6. Spyke Dataset Preparation | 1/4 | In Progress|  | - |
| 7. ComfyUI + Express Integration | 3/3 | Complete    | 2026-02-19 | - |
| 8. Spyke LoRA Training | 2/3 | In Progress|  | - |
| 9. LoRA Integration + Reproducibility | v2.0 | 0/? | Not started | - |
| 10. ControlNet OpenPose | v2.0 | 0/? | Not started | - |
