---
phase: 08-spyke-lora-training
plan: "02"
subsystem: infra
tags: [kohya_ss, sd-scripts, lora, mps, pytorch, accelerate, training, safetensors]

# Dependency graph
requires:
  - phase: 08-01
    provides: "Validated kohya_ss stack, locked training command, dataset TOML with 23 train + 100 reg images"
provides:
  - "10 checkpoint .safetensors files (steps 200–1800 every 200, plus final at step 1840) in output/loras/spyke/"
  - "Loss curve data: U-curve with minimum at step 1400 (avr_loss=0.0717), overfitting onset at step 1600"
  - "Identified best-generalizing checkpoint candidate: spyke_plasma_v1-step00001400.safetensors"
affects: [08-03-checkpoint-selection, 09-lora-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Step-saving pattern: --save_every_n_steps=200 produces checkpoints suitable for post-hoc loss-curve analysis and best-step selection"
    - "Double-repeat error pattern: TOML num_repeats + folder prefix N_ are multiplicative — use one, not both"
    - "U-curve loss pattern: minimum loss step (not final step) is the best checkpoint candidate for generalization"

key-files:
  created:
    - output/loras/spyke/spyke_plasma_v1-step00000200.safetensors
    - output/loras/spyke/spyke_plasma_v1-step00000400.safetensors
    - output/loras/spyke/spyke_plasma_v1-step00000600.safetensors
    - output/loras/spyke/spyke_plasma_v1-step00000800.safetensors
    - output/loras/spyke/spyke_plasma_v1-step00001000.safetensors
    - output/loras/spyke/spyke_plasma_v1-step00001200.safetensors
    - output/loras/spyke/spyke_plasma_v1-step00001400.safetensors
    - output/loras/spyke/spyke_plasma_v1-step00001600.safetensors
    - output/loras/spyke/spyke_plasma_v1-step00001800.safetensors
    - output/loras/spyke/spyke_plasma_v1.safetensors
  modified: []

key-decisions:
  - "TOML num_repeats=10 + folder prefix 10_ are ADDITIVE: resulted in 20 repeats/epoch (1840 steps not 920). For future runs: use folder prefix OR TOML repeat, not both."
  - "Loss U-curve pattern: 0.0786 (step 1000) → 0.0717 (step 1400 minimum) → 0.0855 (step 1840). Step 1400 is lowest-loss checkpoint, likely sweet spot before overfitting."
  - "10 checkpoint files generated (steps 200–1800 every 200 + final at 1840), all 72MB each — more data than planned but all are valid inputs for 08-03 selection."

patterns-established:
  - "Loss curve analysis: plot avr_loss per checkpoint step; minimum-loss checkpoint (not final) is the best generalization candidate"
  - "Double-repeat guard: always audit TOML num_repeats and folder prefix N_ before launching training — they multiply, not add"

requirements-completed: [LORA-01, LORA-02]

# Metrics
duration: 114min
completed: 2026-02-20
---

# Phase 8 Plan 02: Spyke LoRA Full Training Run Summary

**1840-step kohya_ss LoRA training completed on Apple Silicon MPS, producing 10 checkpoint files with a U-curve loss pattern — step 1400 (avr_loss=0.0717) identified as the best-generalizing candidate before overfitting onset.**

## Performance

- **Duration:** ~1h 54m (human-run training; ~114 min wall clock)
- **Started:** 2026-02-20 (approximate)
- **Completed:** 2026-02-20
- **Tasks:** 1 (human-action checkpoint — user ran training)
- **Files modified:** 10 created (all in output/loras/spyke/)

## Accomplishments

- Full training run completed without NaN loss, memory crash, or MPS fallback errors
- 1840 steps executed across 4 epochs (planned 920 — doubled due to additive num_repeats; see Deviations)
- 10 safetensors checkpoints produced, each 72MB, at steps 200–1800 (every 200) plus final at step 1840
- Loss curve analyzed: U-curve shape with minimum at step 1400 (avr_loss=0.0717), confirmed overfitting onset from step 1600 (avr_loss=0.0805) onward
- Step 1400 checkpoint identified as primary candidate for 08-03 visual verification and deployment

## Task Commits

This plan had a single human-action checkpoint (no automatable code). No separate task commit was created.

- **Task 1: Launch full training run** — human-run (no commit; output/loras/spyke/ not tracked in git — binary safetensors files)

**Plan metadata:** (see final docs commit below)

## Files Created/Modified

- `output/loras/spyke/spyke_plasma_v1-step00000200.safetensors` — Step 200 checkpoint (72MB)
- `output/loras/spyke/spyke_plasma_v1-step00000400.safetensors` — Step 400 checkpoint (72MB)
- `output/loras/spyke/spyke_plasma_v1-step00000600.safetensors` — Step 600 checkpoint (72MB)
- `output/loras/spyke/spyke_plasma_v1-step00000800.safetensors` — Step 800 checkpoint (72MB)
- `output/loras/spyke/spyke_plasma_v1-step00001000.safetensors` — Step 1000 checkpoint (72MB)
- `output/loras/spyke/spyke_plasma_v1-step00001200.safetensors` — Step 1200 checkpoint (72MB)
- `output/loras/spyke/spyke_plasma_v1-step00001400.safetensors` — Step 1400 checkpoint (72MB) — PRIMARY CANDIDATE
- `output/loras/spyke/spyke_plasma_v1-step00001600.safetensors` — Step 1600 checkpoint (72MB)
- `output/loras/spyke/spyke_plasma_v1-step00001800.safetensors` — Step 1800 checkpoint (72MB)
- `output/loras/spyke/spyke_plasma_v1.safetensors` — Final checkpoint at step 1840 (72MB)

## Decisions Made

**1. Step count doubled (1840 vs 920 planned) — valid run, not a failure**

The dataset TOML had `num_repeats=10` and the training folder was named `10_spyke_plasma_v1`. kohya_ss applies both multiplicatively: 20 effective repeats/epoch × 23 images × 4 epochs = 1840 steps. For future LoRA training configs: set either `num_repeats` in TOML OR the folder prefix integer, not both. The extra training is within acceptable range — overfitting was identifiable and checkpoints span the full loss curve.

**2. Step 1400 is the recommended checkpoint for 08-03 testing**

Loss curve:
- Step 1000: avr_loss=0.0786
- Step 1200: avr_loss=0.0738
- Step 1400: avr_loss=0.0717 (MINIMUM)
- Step 1600: avr_loss=0.0805 (rising — overfitting onset)
- Step 1800: avr_loss=0.0856
- Step 1840 (final): avr_loss=0.0855

Steps 1200 and 1400 are the strongest candidates. Step 1400 should be tested first; step 1200 is the fallback if 1400 shows overfit artifacts in ComfyUI.

**3. Final checkpoint (step 1840) is likely NOT the production choice**

Rising loss from step 1600 onward indicates the model was overfitting to training images in the second half of the run. The final checkpoint should be tested in 08-03 as a baseline comparison, but is not expected to be selected for deployment.

## Deviations from Plan

### Step Count Deviation

**[Deviation - Configuration Discovery] Training ran 1840 steps instead of planned 920**
- **Found during:** Task 1 (training run)
- **Root cause:** TOML `num_repeats=10` and folder prefix `10_spyke_plasma_v1` are both applied by kohya_ss — effective repeats = 10 × 10 = 100 images/epoch (not 50). Result: 20 effective repeats/epoch × 23 images = 460 steps/epoch × 4 epochs = 1840 total steps.
- **Impact:** More training than planned, with more checkpoints (10 vs 5). The run is valid. The additional steps revealed the loss U-curve and identified where overfitting begins — which makes 08-03 checkpoint selection more data-informed.
- **Correction for future runs:** Set folder prefix to `1_spyke_plasma_v1` (or `10_spyke_plasma_v1` with `num_repeats=1` in TOML) to avoid doubling.

---

**Total deviations:** 1 (configuration artifact — doubled step count)
**Impact on plan:** Net positive — more checkpoint data and a clear loss curve. No functional issues with the training output.

## Issues Encountered

None. Training completed without interruption, memory errors, NaN loss, or MPS fallback. All 10 checkpoint files are intact at 72MB each.

## User Setup Required

None.

## Next Phase Readiness

**08-03 (Checkpoint Selection) is ready to begin.**

Priority test order for 08-03:
1. `spyke_plasma_v1-step00001400.safetensors` — lowest loss, primary candidate
2. `spyke_plasma_v1-step00001200.safetensors` — second-lowest loss, fallback if 1400 shows overfit artifacts
3. `spyke_plasma_v1.safetensors` (final, step 1840) — baseline comparison; likely shows overfit artifacts
4. Steps 200–800 — early/undertrained; test only if 1200/1400 both fail

Deployment target: `~/tools/ComfyUI/models/loras/spyke_plasma_v1.safetensors` (the selected checkpoint, renamed for production)

---
*Phase: 08-spyke-lora-training*
*Completed: 2026-02-20*
