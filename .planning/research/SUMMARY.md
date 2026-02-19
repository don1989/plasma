# Research Summary: Plasma Pipeline v2.0

**Project:** Plasma Manga Pipeline — v2.0 Local ComfyUI + LoRA milestone
**Domain:** Local AI image generation service integrated into TypeScript manga production pipeline
**Researched:** 2026-02-19
**Confidence:** MEDIUM overall — core architecture is HIGH confidence; Apple Silicon MPS behavior and kohya_ss install specifics are MEDIUM; all speed benchmarks are LOW until calibrated on hardware

---

## Key Takeaways

1. **The pivot is sound but has a hard dependency ordering.** You cannot generate a useful panel until the Spyke LoRA exists. You cannot train the LoRA until you have a dataset. Dataset prep must be the first non-infrastructure work item — not an afterthought.

2. **M1 Pro 16GB sets hard limits that must be encoded as requirements, not discovered during development.** Max resolution 512x768. Training batch size 1. One ControlNet model at a time. No simultaneous training + generation. These are not suggestions; violating them causes OOM kills with hours of lost work.

3. **Seed locking on MPS provides visual consistency, not pixel-identical reproducibility.** The requirement for "reproducible panels" must be defined as "visually consistent same-character same-pose output," not bit-exact identity. This is a deliberate requirement scoping decision, not a bug.

4. **The Express service is an optional sidecar, not a rewrite.** The architecture adds a new `comfyui` mode to `generate.ts` alongside existing `manual` and `api` modes. All downstream stages (overlay, assemble) are unchanged. This limits risk and keeps rollback to removing one mode branch.

5. **ControlNet is a differentiator, not a blocker.** The critical path for v2.0 is: ComfyUI server + SD 1.5 checkpoint + Spyke LoRA + txt2img workflow + Express job API + output file integration. ControlNet OpenPose is on a parallel track and can be implemented after the core loop produces working output.

6. **kohya_ss on Apple Silicon requires deliberate setup.** The standard install script targets CUDA/Linux. You must explicitly skip `bitsandbytes`, `xformers`, and `triton`; configure `accelerate` for MPS; and use `AdamW` (not `AdamW8bit`). Use Python 3.11.9 (already active) and pin PyTorch at 2.5.1 (already installed).

7. **Workflow JSON templates are the single source of truth for generation parameters.** The Express service slot-fills 5 injectable fields into static JSON templates exported from the ComfyUI GUI. This is more robust than assembling workflow JSON programmatically from scratch and makes the parameter contract explicit.

---

## Key Findings

### Stack (from STACK.md)

The new npm dependency surface is minimal: one package (`@stable-canvas/comfyui-client` v1.5.9 — zero transitive deps, ESM, TypeScript types, verified on npm registry). All other TypeScript dependencies already exist. Python infrastructure (PyTorch 2.5.1, accelerate, diffusers, transformers) is already globally installed on the machine with MPS confirmed working.

- **ComfyUI** — local SD 1.5 inference server, runs as Python sidecar, communicates with TypeScript pipeline over HTTP + WebSocket. Install at `~/tools/ComfyUI`, outside the repo.
- **kohya_ss** — LoRA training toolkit. Install at `~/tools/kohya_ss`, separate Python venv. Training only, not inference.
- **`@stable-canvas/comfyui-client`** — TypeScript wrapper around ComfyUI's REST + WebSocket API. Zero deps, ESM-native. Replaces writing WebSocket reconnect logic from scratch.
- **Anything V5 anime checkpoint** — primary SD 1.5 base model. Correct aesthetic match for Plasma's manga style. Realistic Vision V6.0 as backup for background/reference art.
- **ControlNet SD 1.5 OpenPose** — `control_v11p_sd15_openpose.pth` (~1.4GB). Only install OpenPose for v2.0; Canny/Depth are optional expansions.

**Version locks that matter:** PyTorch 2.5.1 (do not upgrade — MPS breaking changes between minor versions). Python 3.11.9 (kohya_ss has Python 3.12 issues). `--force-fp16` on ComfyUI launch (required for 16GB headroom). VAE precision: U-Net in fp16, VAE in fp32 — this split must be explicit in workflow templates.

**Disk budget:** ~7GB minimum (ComfyUI + one checkpoint + OpenPose ControlNet + VAE), ~10GB full setup.

### Features (from FEATURES.md)

**Table stakes — the pipeline produces nothing without these:**
- ComfyUI server running on M1 Pro (Metal/MPS) with SD 1.5 checkpoint loaded
- txt2img workflow JSON wired through Express service job API
- Spyke dataset prepared (crop + augment `Spyke_Final.png` to 6-12 crops, supplement with Gemini-generated references to reach 15-20 images) and LoRA trained
- Full parameter manifest per generated image: seed, sampler, scheduler, steps, CFG, loraId, controlnetStrength, workflow JSON
- Output files landing in `output/ch-XX/raw/` with existing naming convention so overlay and assemble stages work unchanged

**Differentiators — what justifies the Gemini pivot:**
- LoRA character consistency (Spyke's asymmetric gloves, cloak length, ginger hair become deterministic)
- Seed locking for composition reproducibility (any approved panel can be re-generated with the same parameters)
- ControlNet OpenPose for pose-anchored composition across sequential panels
- No per-call API cost after hardware investment

**Deferred to v2.1:**
- June/Draster LoRAs (no clean reference images exist; training on Gemini-generated concept art would encode the drift, not the canon design)
- Multi-LoRA stacking beyond Spyke
- Real-time WebSocket progress streaming in CLI
- Model preset switching (commit to one checkpoint first, add switching after the core loop is stable)
- SDXL/Flux models (M1 Pro 16GB cannot train SDXL LoRAs; document as future hardware upgrade path)

**Anti-features to explicitly exclude from scope:**
- Parallel batch generation (ComfyUI processes jobs serially on M1 Pro; parallel submission just queues them)
- Automated pose skeleton synthesis (keep pose reference images manual for v2.0)
- ComfyUI web UI as runtime path (GUI is for designing and exporting workflow templates only)

### Architecture (from ARCHITECTURE.md)

The architecture adds an Express sidecar service (`pipeline/service/`) between the TypeScript pipeline CLI and ComfyUI. The pipeline's `generate.ts` gains a third mode (`comfyui`) that calls the Express service via HTTP and polls for completion. The Express service manages ComfyUI API interaction, workflow template injection, job state, and kohya_ss process spawning. The Gemini API mode is NOT removed.

**New components (all in `pipeline/service/`):**
1. `index.ts` — Express app bootstrap, port 3000
2. `routes/jobs.ts` — `POST /jobs`, `GET /jobs/:id`
3. `routes/loras.ts` — `POST /loras/train`, `GET /loras/:id/status`
4. `job-manager.ts` — in-memory Map, serial queue, single active job (no Redis needed for a local dev tool)
5. `comfyui/http-client.ts` + `ws-client.ts` — thin wrappers over ComfyUI REST + WebSocket
6. `workflows/loader.ts` + `injector.ts` + JSON templates — `txt2img-lora.json`, `img2img-lora-controlnet.json`
7. `training/kohya-runner.ts` — child_process.spawn wrapper for kohya_ss, log streaming, OOM kill detection

**Modified components (additive only):**
- `pipeline/src/stages/generate.ts` — new `mode === 'comfyui'` branch; `manual` and `api` branches unchanged
- `pipeline/src/cli.ts` — new `--comfyui` flag + `train-lora` subcommand
- `pipeline/src/types/generation.ts` — new `generationBackend` field on `GenerationLogEntry`

**Key env vars:** `COMFYUI_URL`, `COMFYUI_DIR` (required — no default; all model/output paths derived from this), `EXPRESS_PORT`, `KOHYA_SCRIPT`, `KOHYA_PYTHON`.

**Data flow summary:**
```
CLI → generate.ts (mode=comfyui) → comfyui-client.ts → Express service
    → JobManager → ComfyUI API (HTTP + WebSocket)
    → output/ch-XX/raw/chXX_pNNN_vN.png + generation-log.json
```

### Critical Pitfalls (from PITFALLS.md)

**Critical — must be addressed in requirements or architecture before writing code:**

1. **Spyke dataset is below LoRA minimum.** `Spyke_Final.png` gives 1-3 rendered views. Minimum is 15-20 varied images. Plan explicit augmentation: crop the reference sheet into face/bust/full-body crops at 512px, flip horizontally, and generate 10-15 supplementary images via the v1.0 Gemini pipeline before training. Without this, the LoRA will overfit and fail on novel action poses.

2. **Unified memory OOM is the primary failure mode.** SD 1.5 inference + ControlNet simultaneously uses 8-12GB. Training uses up to 15GB. Hard-cap resolution at 512x768 and training batch size at 1; never run generation and training simultaneously; encode these as validation constraints in the API endpoint (reject requests that violate limits, don't rely on discipline).

3. **WebSocket race condition on job completion.** Connect the WebSocket with a `client_id` UUID BEFORE posting the workflow via HTTP. If you POST first, the completion event may fire before the WebSocket listener is open. This is the documented ComfyUI integration pattern and must be designed in from the start — not fixed later.

4. **fp16 NaN and VAE color bugs on MPS.** Some MPS fp16 ops produce NaN, resulting in black/gray output with no error message. VAE fp16 specifically causes washed-out color. The correct split: U-Net fp16, VAE fp32. This must be explicit in workflow templates, not inherited from ComfyUI defaults.

5. **MPS seed non-determinism.** Seeds on MPS do not guarantee pixel-identical output the way CUDA does. Define "reproducible" in requirements as "visually consistent same-character same-pose" — not bit-exact. Store the full workflow JSON alongside every approved generation.

---

## Critical Risks

These risks could derail the milestone if not addressed before implementation begins:

**Risk 1: Training never produces a usable Spyke LoRA (HIGH probability if dataset prep is skipped)**
The project has one reference image. Training on 1-3 crops produces a LoRA that memorizes those specific pixels rather than learning Spyke's character identity. Mitigation: dataset augmentation is explicitly the first implementation work item, with a 15-20 image gate before any training is attempted.

**Risk 2: OOM kills waste multi-hour training runs (HIGH probability without hard constraints)**
16GB unified memory is genuinely tight for SD 1.5 LoRA training. One batch-size mistake or one Chrome tab left open can kill a 4-hour run with nothing to show for it. Mitigation: encode resolution and batch size limits as validation constraints in the training API endpoint — reject non-compliant requests rather than relying on documentation.

**Risk 3: ComfyUI MPS performance is worse than expected (MEDIUM probability)**
If MPS coverage has degraded or a sampler op falls back to CPU silently, 512x512 generation takes 5+ minutes instead of 45 seconds, making panel iteration painful. Mitigation: run a reference benchmark (512x512, 20 steps, Euler a, Anything V5) immediately after ComfyUI setup — before writing any pipeline integration code. Gate Phase 3 on this result.

**Risk 4: kohya_ss install on this specific Mac breaks in a non-obvious way (MEDIUM probability)**
The install procedure requires manually skipping CUDA-only packages and configuring accelerate for MPS. A subtle misconfiguration (e.g., training silently falls back to CPU) produces a 10x slower run that looks like a slow MPS run. Mitigation: verify MPS is active during training by watching Activity Monitor GPU History during the first 10 steps.

**Risk 5: v2.0 scope expands to include June/Draster LoRAs (LOW probability, HIGH impact)**
There are no clean reference images for June or Draster. Adding those LoRAs to v2.0 would block the milestone on a separate creative task. Mitigation: explicitly scope v2.0 to Spyke LoRA only in requirements; June/Draster is a v2.1 item with a clear prerequisite (canonical reference art first).

---

## Build Order

Recommended implementation sequence based on dependency analysis from ARCHITECTURE.md and pitfall analysis:

**Phase 1: Environment Validation**
Install ComfyUI, download Anything V5 checkpoint, run a 512x512 test generation via the browser UI. Run the MPS benchmark. Install ComfyUI-Manager + ComfyUI-ControlNet-Aux. This validates the entire Python/Metal stack before writing any TypeScript. Do not proceed to Phase 2 until generation is working in the browser UI and the benchmark is acceptable.

**Phase 2: Spyke Dataset Preparation**
Crop and augment `Spyke_Final.png` into 15-20 training images at 512px. Generate 10-15 supplementary images via the existing Gemini pipeline with varied poses/expressions. Write manual caption `.txt` files for each image (trigger word + pose + framing + background type). Generate 100-200 regularization images. This is a prerequisite for all LoRA work and gates Phase 4.

**Phase 3: ComfyUI + Express Integration (Core Loop)**
Add `@stable-canvas/comfyui-client` to the pipeline. Build the Express service: ComfyUI HTTP/WS clients, workflow templates + injector, JobManager, jobs routes. Wire `generate.ts` with the `comfyui` mode. End-to-end test: `pnpm stage:generate -- --comfyui -c 1 --page 1` produces an image in `output/ch-01/raw/`.

At this point the pipeline works with the base SD 1.5 model. Character consistency is not yet better than Gemini — the integration plumbing is validated but the LoRA is missing.

**Phase 4: kohya_ss Installation + Spyke LoRA Training**
Install kohya_ss in a separate Python venv. Configure accelerate for MPS. Verify MPS is active during training (Activity Monitor GPU History). Run a 50-step test to calibrate actual training speed. Train the Spyke LoRA targeting 800-1200 steps for a 15-20 image dataset. Test intermediate checkpoints; select the best-generalizing one (not necessarily the final step). This is the core v2.0 deliverable.

**Phase 5: LoRA Integration + Reproducibility**
Wire the trained Spyke LoRA into the Express service workflow templates. Implement the full generation manifest extension. Store workflow JSON alongside every approved generation. Run 3 same-seed generations and confirm "visually consistent" reproducibility. Build the `POST /train-lora` endpoint in the Express service.

**Phase 6: ControlNet OpenPose (Parallel Track)**
Download `control_v11p_sd15_openpose.pth`. Build the `img2img-lora-controlnet.json` template. Wire image upload via filesystem copy to ComfyUI's `input/` dir (simpler than `POST /upload/image`). Test with a reference panel as pose source. This track is independent and can start during Phase 3-4 or be deferred to v2.1 if timeline is tight.

---

## What's Confirmed vs What Needs Verification

### Confirmed (HIGH confidence — verified on this machine or stable since 2023)

| Item | Evidence |
|------|----------|
| PyTorch 2.5.1 installed, MPS working (`mps:0` tensor ops) | Verified on machine |
| accelerate 1.3.0, diffusers 0.32.2, transformers 4.48.1, opencv, Pillow installed | `pip show` verified |
| `@stable-canvas/comfyui-client` v1.5.9, zero deps, ESM, typed | npm registry verified |
| bitsandbytes and xformers are CUDA-only — must skip on Mac | Confirmed NOT installed; architecture constraint |
| ComfyUI workflow JSON node graph format | Stable core format since 2023 |
| KSampler seed/sampler/scheduler/steps contract for output determinism | Fundamental SD architecture |
| LoRA minimum dataset: 15-20 images for reliable character generalization | Community consensus across multiple training guides |
| Regularization images needed for small datasets to prevent language drift | Standard LoRA training practice |
| WebSocket + client_id pattern for ComfyUI API | Official documented integration pattern |
| `.safetensors` preferred over `.ckpt` (security + MPS stability) | Non-controversial, well-established |

### Needs Verification at Implementation Time (MEDIUM confidence)

| Item | How to Verify |
|------|---------------|
| ComfyUI install steps and current README | Check `github.com/comfyanonymous/ComfyUI` before running |
| kohya_ss current Mac/MPS install path | Check `github.com/bmaltais/kohya_ss` — may have a Mac-specific install script now |
| Actual generation speed on this hardware | Run benchmark: 512x512, 20 steps, Euler a, Anything V5 |
| Actual training speed on this hardware | Run 50-step test, extrapolate with 1.4x thermal buffer |
| ComfyUI WebSocket event names (`execution_success` vs `execution_complete`) | Check against running instance on `ws://127.0.0.1:8188/ws` |
| ComfyUI node class names (`OpenposePreprocessor`, `LoraLoader`) | Verify via `GET /object_info` on running instance |
| VAE fp16 behavior on PyTorch 2.5.1 MPS | Test: generate with VAE fp16 vs fp32 and compare color saturation |
| kohya_ss progress output format for stdout parsing | Inspect actual first training run output |
| ComfyUI-ControlNet-Aux current install method and preprocessor node names | Check current GitHub release notes |

### Intentionally Out of Scope for v2.0

| Item | Reason |
|------|--------|
| June/Draster LoRA training | No canonical reference images exist; training on Gemini concept art encodes drift |
| SDXL/Flux models | M1 Pro 16GB cannot train SDXL LoRAs; future hardware upgrade path |
| Cloud GPU training | Out of scope for v2.0 local-first design |
| A1111 (Automatic1111) | Poor Apple Silicon support; ComfyUI is the correct choice |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | npm packages verified against registry; Python packages verified on machine; ComfyUI/kohya_ss install steps are training data — verify at repos before executing |
| Features | MEDIUM | Feature list and node architecture are well-understood; specific node class names must be verified against running ComfyUI instance via `/object_info` |
| Architecture | MEDIUM-HIGH | Integration pattern is standard (Express sidecar + polling); existing pipeline codebase was directly inspected; ComfyUI API shape is well-documented |
| Pitfalls | HIGH | Memory math is deterministic; MPS constraints are fundamental hardware limits; LoRA dataset requirements are community consensus; WebSocket race condition is the documented integration pattern |

**Overall confidence: MEDIUM.** The design is solid and the risks are well-identified. The primary uncertainty is operational: actual MPS performance and current kohya_ss install behavior on this specific machine. Both are resolved with a hardware validation phase before building integration code.

### Gaps to Address in Requirements

- **Define "reproducible"** explicitly as "visually consistent same-character same-pose" (not pixel-identical). MPS non-determinism makes pixel-identical impractical; visually consistent is sufficient for manga production.
- **Specify the Spyke dataset minimum** (15-20 images) as a hard requirement gate before training is scheduled — not a soft guideline.
- **Encode M1 Pro hardware limits as API constraints**: training endpoint rejects batch_size > 1; generation defaults to 512x768 max.
- **Scope v2.0 explicitly to Spyke LoRA only**: June/Draster require canonical reference art creation first (separate creative milestone).
- **Decide img2img base image upload method**: filesystem copy to `[COMFYUI_DIR]/input/` vs `POST /upload/image` API call — choose before designing Express service input handling.

---

## Sources

### Verified on this machine (HIGH confidence)
- Python 3.11.9, PyTorch 2.5.1 with MPS confirmed working (`tensor([1.], device='mps:0')`)
- accelerate 1.3.0, diffusers 0.32.2, transformers 4.48.1, opencv-python 4.11.0.86, Pillow 11.2.1
- `@stable-canvas/comfyui-client` v1.5.9 (npm registry — zero deps, ESM, typed)
- `comfyui-sdk` rejected (Tencent Cloud SDK as transitive dep — confirmed via npm registry)
- `Spyke_Final.png` at `03_manga/concept/` — single high-quality reference image confirmed by file inspection
- Existing pipeline codebase: `generate.ts`, `gemini-client.ts`, `generation.ts` types, `cli.ts` — directly inspected for architecture fit

### Training data (MEDIUM confidence, cutoff Aug 2025)
- ComfyUI workflow JSON node graph format and API endpoints
- kohya_ss SD 1.5 LoRA training parameters and Mac/MPS constraints
- ControlNet model file locations (HuggingFace `lllyasviel/ControlNet-v1-1`)
- Anime checkpoint recommendations (Anything V5, Counterfeit V3.0)
- Apple Silicon PyTorch MPS behavior (fp16 correctness, memory limits, thermal throttling)
- LoRA training best practices (dataset size, captioning, regularization, overfitting detection)

### Needs live verification (before implementation)
- `github.com/comfyanonymous/ComfyUI` — current install steps
- `github.com/bmaltais/kohya_ss` — current Mac/MPS install path
- Running ComfyUI instance — WebSocket event names, node class names, API response shapes

---

*Research completed: 2026-02-19*
*Ready for roadmap: yes*
