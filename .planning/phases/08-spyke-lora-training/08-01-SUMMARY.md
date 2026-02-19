---
phase: 08-spyke-lora-training
plan: "01"
subsystem: infra
tags: [kohya_ss, sd-scripts, lora, mps, pytorch, accelerate, training]

# Dependency graph
requires:
  - phase: 06-spyke-dataset-prep
    provides: "Cropped Spyke training images in dataset/spyke/train/10_spyke_plasma_v1"
  - phase: 05-environment-validation
    provides: "kohya_ss venv with PyTorch + accelerate confirmed working on MPS"
provides:
  - "Populated sd-scripts submodule with train_network.py and networks/lora.py"
  - "spyke_lora_dataset.toml dataset config referencing train + reg image dirs"
  - "Verified MPS device routing via Python accelerate check"
  - "Passing 5-step smoke test confirming full training stack works on Apple Silicon"
affects: [08-02-full-training, 08-03-checkpoint-selection]

# Tech tracking
tech-stack:
  added:
    - kohya_ss sd-scripts (submodule populated via git submodule update --init --recursive)
    - imagesize (pip-installed into kohya_ss venv — missing sd-scripts dependency)
    - rich, sentencepiece, altair, lion-pytorch, schedulefree, pytorch-optimizer, prodigy-plus-schedule-free, prodigyopt (pip-installed into kohya_ss venv)
  patterns:
    - Dataset TOML config pattern with is_reg=true for regularization subset isolation
    - keep_tokens=1 to anchor trigger word at position 0 regardless of caption shuffle
    - no_half_vae + mixed_precision=no for MPS-safe training (avoids fp16 AMP errors)

key-files:
  created:
    - .planning/phases/08-spyke-lora-training/spyke_lora_dataset.toml
    - /tmp/spyke_smoke_test/smoke_test.safetensors (ephemeral smoke test output)
  modified: []

key-decisions:
  - "sd-scripts submodule was empty — git submodule update --init --recursive required before any training command"
  - "Missing Python deps (imagesize, rich, sentencepiece + 6 others) must be pip-installed into kohya_ss venv; do NOT rely on requirements.txt alone on Apple Silicon"
  - "flip_aug intentionally excluded — Spyke's asymmetric costume makes horizontal flip destructive to character consistency"
  - "smoke_test.safetensors confirmed at /tmp/spyke_smoke_test/ — 5-step run produced valid output file"
  - "Full training command flags locked: --no_half_vae --mixed_precision=no --optimizer_type=AdamW --network_dim=32 --network_alpha=16"

patterns-established:
  - "Dataset TOML: enable_bucket=true + keep_tokens=1 + caption_extension=.txt is the baseline for all future character LoRA configs"
  - "Smoke test at --max_train_steps=5 before every full run — catches environment issues in 30-90 seconds vs 70+ minutes"

requirements-completed: [LORA-04]

# Metrics
duration: 45min
completed: 2026-02-19
---

# Phase 8 Plan 01: Spyke LoRA Training Environment Summary

**sd-scripts submodule populated, dataset TOML written, MPS confirmed active, and a 5-step smoke test ran to completion with finite loss — full training stack is validated on Apple Silicon.**

## Performance

- **Duration:** ~45 min (includes user-run smoke test)
- **Started:** 2026-02-19T20:41:00Z
- **Completed:** 2026-02-19T21:26:58Z
- **Tasks:** 3 (Tasks 1-2 automated, Task 3 human-verified)
- **Files modified:** 1 created (spyke_lora_dataset.toml)

## Accomplishments

- Fixed empty sd-scripts submodule by running `git submodule update --init --recursive` — train_network.py and networks/lora.py are now present
- Written dataset TOML with correct train dir (23 images) and reg dir (100 images), is_reg=true, keep_tokens=1, flip_aug excluded
- Confirmed Accelerator device: mps, mixed_precision: no via Python accelerate check
- 5-step smoke test completed: 23 train images loaded, 100 reg images loaded (caption warnings on reg are harmless), finite loss each step, no NaN, no fp16 error
- smoke_test.safetensors written to /tmp/spyke_smoke_test/ — LORA-04 satisfied

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix sd-scripts submodule and write dataset TOML** - `0498ef9` (feat)
2. **Task 2: MPS device check** - included in 0498ef9 (verification only, no code change)
3. **Task 3: 5-step smoke test (human-verified)** - no separate commit (human-run gate)

## Files Created/Modified

- `.planning/phases/08-spyke-lora-training/spyke_lora_dataset.toml` - Dataset config: train subset (10_spyke_plasma_v1, 10 repeats) + reg subset (1_anime_character, is_reg=true, 1 repeat), resolution 512, bucket enabled

## Decisions Made

- sd-scripts was an empty submodule at plan start — `git submodule update --init --recursive` from ~/tools/kohya_ss is the fix; this must be documented for any future machine setup
- Missing Python dependencies (imagesize, rich, sentencepiece, altair, lion-pytorch, schedulefree, pytorch-optimizer, prodigy-plus-schedule-free, prodigyopt) were not installed in the kohya_ss venv; these must be pip-installed before the first training run; requirements.txt is insufficient on Apple Silicon
- flip_aug excluded by design — Spyke's costume asymmetry makes horizontal flip destructive
- Full training command flags are now locked and validated by the smoke test

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing sd-scripts Python dependencies prevented smoke test from running**
- **Found during:** Task 3 (5-step smoke test)
- **Issue:** kohya_ss venv was missing imagesize and 8 other packages required by train_network.py imports
- **Fix:** User pip-installed all missing packages (imagesize, rich, sentencepiece, altair, lion-pytorch, schedulefree, pytorch-optimizer, prodigy-plus-schedule-free, prodigyopt) into the kohya_ss venv before re-running the smoke test
- **Files modified:** kohya_ss venv (pip install, not tracked in repo)
- **Verification:** Smoke test ran to completion after installs — all 5 steps with finite loss
- **Committed in:** not committed (venv changes are not repo-tracked)

---

**Total deviations:** 1 (blocking dependency install)
**Impact on plan:** Required to unblock smoke test. No scope creep — this was a hidden environment prerequisite for sd-scripts on Apple Silicon.

## Issues Encountered

- sd-scripts directory was completely empty at plan start — submodule had not been initialized on this machine. Fixed with `git submodule update --init --recursive`.
- kohya_ss venv missing sd-scripts Python dependencies — imagesize was the first import failure, followed by 8 more packages. All installed via pip before smoke test could proceed.
- Reg image caption warnings during training are expected and harmless — regularization images deliberately have no captions so the trigger word is not associated with them.

## User Setup Required

None - no external service configuration required. All setup was completed during plan execution.

## Next Phase Readiness

- Environment is fully validated — the same command used in the smoke test (with --max_train_steps=5 replaced by full step count) is ready to run
- 08-02 (Full Training Run) is unblocked: 920 steps at 1e-4 LR, saving every 230 steps
- 08-03 (Checkpoint Selection) depends on 08-02 producing .safetensors checkpoints

---
*Phase: 08-spyke-lora-training*
*Completed: 2026-02-19*
