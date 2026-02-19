---
phase: 05-environment-validation
plan: 02
subsystem: infra
tags: [kohya_ss, python, pytorch, accelerate, mps, lora-training, apple-silicon]

# Dependency graph
requires: []
provides:
  - "kohya_ss cloned at ~/tools/kohya_ss with isolated Python 3.11.9 venv"
  - "torch 2.5.1 + accelerate 1.3.0 installed via manual pip (bypassing broken requirements_macos_arm64.txt)"
  - "accelerate configured for MPS with mixed_precision: no"
  - "Accelerator() smoke test confirms Device: mps"
affects: [08-lora-training, phase-8]

# Tech tracking
tech-stack:
  added:
    - "torch==2.5.1 (Apple Silicon MPS, cpu index URL)"
    - "accelerate==1.3.0"
    - "transformers==4.48.1"
    - "diffusers==0.32.2"
    - "lycoris-lora==3.4.0"
    - "safetensors, einops, ftfy, tensorboard, opencv-python, huggingface_hub"
  patterns:
    - "Manual pip install to bypass broken kohya_ss requirements_macos_arm64.txt"
    - "write_basic_config(mixed_precision='no') + manual YAML correction for use_cpu: false"
    - "PYTORCH_ENABLE_MPS_FALLBACK=1 for runtime MPS op fallback safety"

key-files:
  created:
    - "~/tools/kohya_ss/ (git clone of bmaltais/kohya_ss)"
    - "~/tools/kohya_ss/venv/ (Python 3.11.9 isolated venv)"
    - "~/.cache/huggingface/accelerate/default_config.yaml (mixed_precision: no, use_cpu: false)"
  modified: []

key-decisions:
  - "Do NOT use requirements_macos_arm64.txt — references torch==2.8.0.* nightly that does not exist as stable release (GitHub issue #3281)"
  - "accelerate mixed_precision must be 'no' — fp16 triggers ValueError on MPS because PyTorch AMP autocast does not support mps+fp16"
  - "write_basic_config() sets use_cpu: true by default; override with manual YAML write to enforce use_cpu: false"
  - "Omit bitsandbytes, xformers, and triton — CUDA/Linux-only packages incompatible with Apple Silicon"
  - "Same torch==2.5.1 cpu index URL as ComfyUI venv — confirmed stable, MPS-enabled ARM64 wheel"

patterns-established:
  - "Pattern: Separate venv for each tool — kohya_ss venv is strictly isolated from ComfyUI venv"
  - "Pattern: Use Accelerator() smoke test with PYTORCH_ENABLE_MPS_FALLBACK=1 to confirm MPS device at runtime"

requirements-completed: [INFRA-03]

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 5 Plan 02: kohya_ss Install and accelerate MPS Config Summary

**kohya_ss cloned at ~/tools/kohya_ss with Python 3.11.9 venv, torch 2.5.1 + accelerate 1.3.0 installed via manual pip, and accelerate configured for MPS with mixed_precision: no — Accelerator() smoke test confirms device: mps**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T13:03:03Z
- **Completed:** 2026-02-19T13:06:21Z
- **Tasks:** 2
- **Files modified:** 0 in-repo (all changes to ~/tools/ and ~/.cache/ — infrastructure only)

## Accomplishments
- kohya_ss cloned at ~/tools/kohya_ss with a fully isolated Python 3.11.9 venv (separate from ComfyUI venv)
- All curated training dependencies installed manually via pip — no bitsandbytes, xformers, or triton (CUDA/Linux-only exclusions)
- accelerate 1.3.0 config written to ~/.cache/huggingface/accelerate/default_config.yaml with mixed_precision: no and use_cpu: false
- Accelerator() smoke test confirms Device: mps and Mixed precision: no — ready for Phase 8 LoRA training

## Task Commits

Both tasks are infrastructure-only (changes outside the git repo). No in-repo source files were created or modified. Metadata commit records this plan's completion.

1. **Task 1: Clone kohya_ss and install dependencies** - Infrastructure (~/tools/kohya_ss/)
2. **Task 2: Configure accelerate for MPS** - Infrastructure (~/.cache/huggingface/accelerate/)

**Plan metadata commit:** recorded in docs commit below

## Files Created/Modified

All outside the git repository:

- `~/tools/kohya_ss/` - git clone of bmaltais/kohya_ss (LoRA training toolkit)
- `~/tools/kohya_ss/venv/` - Python 3.11.9 isolated venv with torch 2.5.1, accelerate 1.3.0, and all curated training deps
- `~/.cache/huggingface/accelerate/default_config.yaml` - accelerate config: mixed_precision: no, use_cpu: false, compute_environment: LOCAL_MACHINE

## Decisions Made

1. **Do not use requirements_macos_arm64.txt** — The file references `torch==2.8.0.*` which is a nightly-only version. GitHub issue #3281 confirms this is broken and unresolved. Manual pip install with torch==2.5.1 is the correct path.

2. **mixed_precision must be 'no'** — Setting fp16 triggers `ValueError: fp16 mixed precision requires a GPU (not 'mps')`. PyTorch's AMP autocast does not support mps + fp16 in the accelerate training wrapper, even though fp16 tensor ops work on MPS directly.

3. **Override use_cpu after write_basic_config()** — The `write_basic_config(mixed_precision='no')` helper sets `use_cpu: true` by default. Manual YAML rewrite sets `use_cpu: false` so the config matches the full spec. The Accelerator() runtime correctly selects MPS regardless, but the config file now matches expected spec.

4. **Omit bitsandbytes, xformers, triton** — These are CUDA/NVIDIA/Linux-only. Including them would fail on install or cause silent degradation on Apple Silicon. kohya_ss PR #3084 explicitly removed xformers from Mac requirements.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] write_basic_config() sets use_cpu: true; manually overrode to use_cpu: false**
- **Found during:** Task 2 (Configure accelerate for MPS)
- **Issue:** `write_basic_config(mixed_precision='no')` produced `use_cpu: true` in the YAML output, contradicting the plan's must_haves spec (`use_cpu: false`)
- **Fix:** Followed the write_basic_config call with a direct YAML write to set all fields per the research spec exactly
- **Verification:** `accelerate env` shows `use_cpu: False`; Accelerator() smoke test shows Device: mps
- **Impact:** Runtime behavior unchanged (accelerate auto-detects MPS regardless), but config file now matches full expected spec

---

**Total deviations:** 1 auto-fixed (Rule 1 - config value correction)
**Impact on plan:** Necessary for spec compliance. Runtime MPS selection was unaffected.

## Issues Encountered

None beyond the use_cpu deviation above — plan executed cleanly. The warned pitfalls (broken requirements_macos_arm64.txt, fp16 error on MPS) were avoided entirely by following the plan's explicit instructions.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- **INFRA-03 complete:** kohya_ss at ~/tools/kohya_ss with Python 3.11.9 venv, MPS-confirmed accelerate config
- **Phase 8 (LoRA Training) prerequisite met:** Environment is validated; training can be attempted once the dataset (Phase 6 gate) is ready
- **No blockers:** All smoke tests pass, device: mps confirmed

## Self-Check: PASSED

- FOUND: ~/tools/kohya_ss/venv/bin/python
- FOUND: ~/.cache/huggingface/accelerate/default_config.yaml (mixed_precision: 'no', use_cpu: false)
- FOUND: ~/tools/kohya_ss/ (git clone)
- FOUND: .planning/phases/05-environment-validation/05-02-SUMMARY.md
- FOUND: commit 6ac3adf (docs(05-02): complete kohya_ss install and accelerate MPS config plan)

---
*Phase: 05-environment-validation*
*Completed: 2026-02-19*
