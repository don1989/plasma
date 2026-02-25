---
phase: 08-spyke-lora-training
plan: "03"
subsystem: infra
tags: [kohya_ss, lora, mps, pytorch, accelerate, training, captioning, character-consistency]

# Dependency graph
requires:
  - phase: 08-01
    provides: "Validated kohya_ss stack, locked training command, dataset TOML"
  - phase: 08-02
    provides: "10 checkpoint files, loss U-curve, step 1400 primary candidate"
provides:
  - "Production Spyke LoRA: ~/tools/ComfyUI/models/loras/spyke_plasma_v1_production.safetensors (v3 final, 72MB)"
  - "Locked caption strategy: pose-only + asymmetric details only embeds appearance in trigger word"
  - "v2 and v3 checkpoints in output/loras/spyke/ for future reference"
affects: [09-lora-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Character LoRA caption strategy: pose/composition only + ONLY asymmetric costume details. All general appearance (hair, eye color, cloak, etc.) must be learned visually from images and embedded in the trigger word — NOT listed in captions."
    - "Flip augmentation is destructive for asymmetric costumes — a flipped image shows the bracer on the wrong arm. Never use flip_aug for characters with asymmetric gear."
    - "accelerate launch --num_cpu_threads_per_process=4 is required for MPS training speed (~2s/step). Running train_network.py directly with python3 causes 10–40s/step due to missing MPS JIT initialization."
    - "AdamW8bit fails on MPS: bitsandbytes blockwise update uses CPU backend fallback, causing NotImplementedError. Use plain AdamW on Apple Silicon."
    - "Detailed captions decouple features from trigger word: if hair/cloak/accessories appear in every caption, the model learns them as text token associations, not as embedded trigger-word appearance. They only fire when explicitly in the inference prompt."

key-files:
  created:
    - output/loras/spyke/spyke_plasma_v2-step00000200.safetensors
    - output/loras/spyke/spyke_plasma_v2-step00000400.safetensors
    - output/loras/spyke/spyke_plasma_v2-step00000600.safetensors
    - output/loras/spyke/spyke_plasma_v2-step00000800.safetensors
    - output/loras/spyke/spyke_plasma_v2-step00001000.safetensors
    - output/loras/spyke/spyke_plasma_v2-step00001200.safetensors
    - output/loras/spyke/spyke_plasma_v2.safetensors
    - output/loras/spyke/spyke_plasma_v3-step00000200.safetensors
    - output/loras/spyke/spyke_plasma_v3-step00000400.safetensors
    - output/loras/spyke/spyke_plasma_v3-step00000600.safetensors
    - output/loras/spyke/spyke_plasma_v3-step00000800.safetensors
    - output/loras/spyke/spyke_plasma_v3-step00001000.safetensors
    - output/loras/spyke/spyke_plasma_v3-step00001200.safetensors
    - output/loras/spyke/spyke_plasma_v3.safetensors
  modified:
    - dataset/spyke/train/10_spyke_plasma_v1/*.txt (all 15 captions rewritten twice — v2 then v3)
    - eval_lora.py (updated regex to support any vN_ prefix pattern)
  deleted:
    - dataset/spyke/train/10_spyke_plasma_v1/*_flip.png (8 files — destructive for asymmetric costume)
    - dataset/spyke/train/10_spyke_plasma_v1/*_flip.txt (8 files)

key-decisions:
  - "Caption strategy for character LoRAs: pose-only captions + ONLY asymmetric costume details. Never list general appearance (hair color, eye color, cloak, weapons) in captions — these must be learned visually from images and embedded in the trigger word."
  - "Flip images removed: 8 flip pairs deleted before v2 retraining. Asymmetric costumes (different glove/bracer sides, single-knee pauldron) make horizontal flips actively harmful to character consistency."
  - "v2 trained but rejected: detailed captions decoupled Spyke's appearance features from the trigger word. Bare trigger generated a generic anime character; ginger hair and cloak only appeared when explicitly in the inference prompt."
  - "v3 trained as production: pose-only captions + asymmetric details only. Bare trigger reliably generates ginger hair, white sleeveless cloak, red arm accents, sword, black combat pants."
  - "Production LoRA filename: spyke_plasma_v1_production.safetensors (not spyke_plasma_v1.safetensors as plan specified). Phase 9 must reference this filename when wiring LoRA into workflow templates."
  - "Locked inference prompt template: 'spyke_plasma_v1, 1boy, ginger hair, red bandana, white sleeveless cloak, right arm red fingerless glove, left arm red metallic bracer, right knee metal pauldron, black combat pants, [pose], [scene], anime style'"

patterns-established:
  - "Character LoRA caption discipline: appearance in images, not captions. Captions teach the model WHEN to apply the trigger concept, not WHAT the concept looks like."
  - "Caption audit before training: always verify captions against character sheet for left/right accuracy and absence of appearance tokens that should be trigger-embedded."

requirements-completed: [LORA-02, LORA-03, LORA-05]

# Metrics
duration: 165min
completed: 2026-02-20
---

# Phase 8 Plan 03: Checkpoint Selection + Production Deployment Summary

**Three training runs executed (v1 baseline analysis → v2 detailed captions → v3 pose-only captions). v3 final selected as production LoRA — bare trigger reliably generates Spyke's full visual identity. Deployed as `spyke_plasma_v1_production.safetensors`.**

## Performance

- **Duration:** ~165 min wall clock (v1 evaluation + v2 train + v3 train + ComfyUI testing)
- **Completed:** 2026-02-20
- **Tasks:** 4 (v1 eval, v2 retrain, v3 retrain, production deploy)
- **Files modified:** 15 captions rewritten ×2, 8 flip files deleted, 14 new checkpoint files created

## Accomplishments

- Diagnosed root cause of v1 LoRA quality failure: minimal training captions with no costume details
- Identified and removed 8 flip images that were destructive to asymmetric costume learning
- Corrected left/right assignments across all captions (right arm = glove, left arm = bracer, right knee = pauldron)
- Trained v2 (1200 steps, loss 0.0697) — revealed a deeper captioning problem: detailed captions decouple appearance from trigger word
- Trained v3 (1200 steps, loss 0.0698) with pose-only + asymmetric details only — bare trigger generates full Spyke visual identity
- Deployed v3 final as production LoRA: `~/tools/ComfyUI/models/loras/spyke_plasma_v1_production.safetensors`
- Locked inference prompt template for Phase 9 integration
- Updated eval_lora.py with generic vN_ regex pattern for any training version

## Task Commits

Plans 08-01 through 08-03 involved human-run training jobs and ComfyUI testing (no automatable code). Caption rewrites and dataset cleanup are tracked in git.

- **Caption v2 rewrite + flip removal:** All 15 `.txt` captions in `dataset/spyke/train/10_spyke_plasma_v1/`, 8 flip pairs deleted
- **Caption v3 rewrite:** All 15 captions rewritten to pose-only + asymmetric details
- **eval_lora.py:** Updated lora_name pattern to support `v3_final`, `v3_step1000`, etc.

## Files Created/Modified

### Training Checkpoints (output/loras/spyke/)
- `spyke_plasma_v2-step{200..1200}.safetensors` — 6 v2 checkpoints (72MB each)
- `spyke_plasma_v2.safetensors` — v2 final at step 1200 (72MB) — rejected (caption decoupling)
- `spyke_plasma_v3-step{200..1200}.safetensors` — 6 v3 checkpoints (72MB each)
- `spyke_plasma_v3.safetensors` — **v3 final at step 1200 (72MB) — PRODUCTION SOURCE**

### Production LoRA
- `~/tools/ComfyUI/models/loras/spyke_plasma_v1_production.safetensors` — copy of v3 final (72MB)

### Dataset Changes
- `dataset/spyke/train/10_spyke_plasma_v1/*.txt` — all 15 captions rewritten to v3 format
- **Deleted:** 16 flip files (8 `.png` + 8 `.txt`)

### Tooling
- `eval_lora.py` — regex updated from `v1_step` prefix to generic `vN_` pattern

## v3 Caption Format (Locked)

```
# Pose-only captions + asymmetric details only
# DO NOT add: hair color, eye color, cloak, weapons, bandana
# ONLY add: pose/composition + which arm/knee has asymmetric gear

spyke_plasma_v1, full body, front view, standing neutral, right arm red fingerless glove, left arm red metallic bracer, right knee metal pauldron, white background
spyke_plasma_v1, full body, combat stance, sword raised, right arm red fingerless glove, left arm red metallic bracer, right knee metal pauldron, white background
spyke_plasma_v1, closeup face, neutral expression, white background
spyke_plasma_v1, full body, back view, white background
spyke_plasma_v1, full body, side profile, right knee metal pauldron, white background
```

## Production Inference Prompt Template (Phase 9 Input)

```
spyke_plasma_v1, 1boy, ginger hair, red bandana, white sleeveless cloak, right arm red fingerless glove, left arm red metallic bracer, right knee metal pauldron, black combat pants, [POSE], [SCENE], anime style
```

With LoRA: `spyke_plasma_v1_production` at strength 0.8.

## Decisions Made

**1. Caption decoupling: the key LoRA quality insight**

v2 used detailed captions listing every appearance token (`ginger hair, red bandana, green eyes, white sleeveless cloak, right arm red fingerless glove, ...`). Result: these features were learned as text token associations. The trigger word `spyke_plasma_v1` alone generated a generic anime character — Spyke's identity only appeared when the appearance tokens were also in the inference prompt.

v3 stripped captions down to pose/composition only + asymmetric details (which arm has glove vs bracer, which knee has pauldron). These asymmetric details must be in captions because without them, the model has no way to learn left vs right. All other appearance (hair, eyes, cloak, weapons, bandana) is learned purely from images and gets embedded in the trigger word.

**2. Flip images are harmful for asymmetric characters**

8 flip image pairs were removed before v2 training. A flipped image shows the fingerless glove on the LEFT arm and the bracer on the RIGHT arm — the opposite of canon. These images would actively teach the model incorrect costume topology. The flip_aug flag in the TOML was already excluded (08-01 decision), but the pre-existing flip PNG/TXT files in the dataset directory needed manual deletion.

**3. Production LoRA filename deviation from plan**

Plan 08-03 specified deployment as `spyke_plasma_v1.safetensors`. Deployed as `spyke_plasma_v1_production.safetensors` to distinguish production-quality v3 from the original v1 checkpoints. Phase 9 must reference `spyke_plasma_v1_production` as the LoRA name in workflow templates.

## Deviations from Plan

### Full Plan Deviation: v2 and v3 Retrains (not checkpoint selection from v1)

**[Major Deviation - Plan Replaced by New Runs]**
- **Expected by plan:** Visual test v1 checkpoints (step 1400 primary candidate), select best, deploy
- **Actual:** v1 checkpoint evaluation revealed quality failure requiring full caption rewrite and two new training runs
- **Root cause:** v1 training captions were bare pose descriptions with no costume detail, causing the model to fail to learn Spyke's visual identity
- **Impact:** 2 additional full training runs (~41 min each), 14 new checkpoint files, caption strategy fundamentally reworked
- **Outcome:** v3 final is a significantly better production LoRA than any v1 checkpoint would have been

---

**Total deviations:** 1 (plan scope replacement — v1 selection replaced by v2+v3 retraining)
**Impact on plan:** Net positive — final LoRA quality is substantially higher than the v1 baseline

## Issues Encountered

### v2 "even worse" than v1

**Root cause:** Detailed captions with appearance tokens decoupled visual features from the trigger word. Features only generated when explicitly in the inference prompt — behavior inconsistent with the goal of trigger-embedded character identity.

**Resolution:** Retrained v3 with pose-only captions + asymmetric details. Bare trigger now reliably generates full Spyke visual identity.

### AdamW8bit fails on MPS

`NotImplementedError: optimizer_update_8bit_blockwise from CPU backend` — bitsandbytes 8-bit blockwise updates are not MPS-compatible. Switched to plain AdamW for all runs.

### Training speed: python3 vs accelerate launch

Running `python3 train_network.py` directly caused 33–83s/step (10–40× slower than expected). Root cause: `accelerate launch --num_cpu_threads_per_process=4` initializes the MPS JIT compilation path and CPU thread affinity. The original smoke test command used `accelerate launch` — this was the correct invocation and must be used for all training runs.

## Phase 8 Gate Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| LORA-01: MPS active during training | ✅ | GPU utilization confirmed in Activity Monitor (08-01/08-02) |
| LORA-02: Best-generalizing checkpoint selected | ✅ | v3 final selected after visual comparison with v1, v2 |
| LORA-03: LoRA in ComfyUI models/loras/ | ✅ | `spyke_plasma_v1_production.safetensors` present |
| LORA-04: Training completes 800–1200 steps | ✅ | v3: 1200 steps, ~41 min |
| LORA-05: Only Spyke LoRA deployed (no June/Draster) | ✅ | Single LoRA file in loras/ |

**Phase 8 gate: PASS. Phase 9 (LoRA Integration + Reproducibility) is unblocked.**

## Next Phase Readiness

**Phase 9 inputs from this plan:**
- LoRA path: `~/tools/ComfyUI/models/loras/spyke_plasma_v1_production.safetensors`
- LoRA name (for workflow template slot): `spyke_plasma_v1_production`
- LoRA strength: `0.8` (model and clip)
- Inference prompt template: see Production Inference Prompt Template above
- Clip skip: 2
- Sampler: euler_ancestral, 20 steps, CFG 7.0

Phase 9 should wire `spyke_plasma_v1_production` into the Express service `txt2img-lora.json` template's `lora_name` slot.

---
*Phase: 08-spyke-lora-training*
*Completed: 2026-02-20*
