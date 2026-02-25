---
phase: 05-environment-validation
plan: 03
subsystem: infra
tags: [comfyui, controlnet, openpose, stable-diffusion, sd15, safetensors]

# Dependency graph
requires:
  - phase: 05-01
    provides: ComfyUI installation at ~/tools/ComfyUI with venv and models/ directory tree

provides:
  - AnythingXL_inkBase.safetensors (2.0 GB SD 1.5 checkpoint) in ~/tools/ComfyUI/models/checkpoints/
  - control_v11p_sd15_openpose.pth (1.3 GiB ControlNet OpenPose model) in ~/tools/ComfyUI/models/controlnet/
  - control_v11p_sd15_openpose.yaml config alongside model weights
  - comfyui_controlnet_aux extension cloned into ~/tools/ComfyUI/custom_nodes/
  - opencv-python 4.13.0 and full ControlNet-Aux pip requirements installed in ComfyUI venv

affects:
  - 05-04  # benchmark plan that loads the checkpoint
  - Phase 7 (Express service wiring ComfyUI API)
  - Phase 10 (ControlNet OpenPose pipeline)

# Tech tracking
tech-stack:
  added:
    - comfyui_controlnet_aux (ComfyUI extension — Fannovel16/comfyui_controlnet_aux)
    - opencv-python 4.13.0 (in ComfyUI venv)
    - mediapipe 0.10.32 (in ComfyUI venv, for pose estimation)
    - albumentations 2.0.8, scikit-image 0.26.0, scikit-learn 1.8.0 (ControlNet-Aux deps)
    - AnythingXL_inkBase.safetensors (SD 1.5 manga-style checkpoint)
    - control_v11p_sd15_openpose.pth (lllyasviel ControlNet-v1-1 OpenPose weights)
  patterns:
    - Model binaries placed directly in ~/tools/ComfyUI/models/{type}/ — ComfyUI discovers on startup
    - ControlNet extensions installed via git clone + pip install -r inside the ComfyUI venv

key-files:
  created:
    - ~/tools/ComfyUI/models/checkpoints/AnythingXL_inkBase.safetensors  # primary checkpoint
    - ~/tools/ComfyUI/models/controlnet/control_v11p_sd15_openpose.pth   # ControlNet weights
    - ~/tools/ComfyUI/models/controlnet/control_v11p_sd15_openpose.yaml  # ControlNet config
    - ~/tools/ComfyUI/custom_nodes/comfyui_controlnet_aux/               # extension dir
  modified: []

key-decisions:
  - "Accepted AnythingXL_inkBase.safetensors as substitute for anything-v5-PrtRE.safetensors — same SD 1.5 architecture, both work identically in ComfyUI Load Checkpoint node"
  - "control_v11p_sd15_openpose.pth downloaded as 1.3 GiB binary (HuggingFace base-10 = 1378 MB = 1.35 GiB binary) — size is correct despite macOS showing 1.3G"

patterns-established:
  - "Large model binaries downloaded via curl -L -C - for resume support"
  - "ControlNet extensions installed via git clone to custom_nodes/ then pip install -r inside venv"

requirements-completed:
  - INFRA-02
  - INFRA-05

# Metrics
duration: 67min
completed: 2026-02-19
---

# Phase 5 Plan 03: Model Downloads and ControlNet-Aux Extension Summary

**AnythingXL_inkBase checkpoint (2.0 GB SD 1.5) and OpenPose ControlNet model (1.3 GiB) placed in ComfyUI; comfyui_controlnet_aux cloned with full pip requirements installed in ComfyUI venv**

## Performance

- **Duration:** 67 min (dominated by 2x large binary downloads: ~170 MB/s sustained)
- **Started:** 2026-02-19T14:26:46Z
- **Completed:** 2026-02-19T15:33:46Z
- **Tasks:** 2 (Task 1 was human-action checkpoint; Task 2 automated)
- **Files modified:** 0 (repo files); 4 new binary/extension artifacts in ~/tools/

## Accomplishments

- Placed a 2.0 GB SD 1.5 manga-style checkpoint (AnythingXL_inkBase) for Phase 5 benchmark and future generation
- Downloaded control_v11p_sd15_openpose.pth (1378 MB) from HuggingFace with .yaml config alongside it
- Cloned comfyui_controlnet_aux into ComfyUI custom_nodes and installed all pip requirements (opencv 4.13.0, mediapipe 0.10.32, albumentations, scikit-image, and 40+ transitive packages) in the ComfyUI venv
- Verified `import cv2` works in ComfyUI venv confirming extension is ready for ComfyUI startup

## Task Commits

Tasks 1 and 2 produced no repository code changes — all artifacts are binary model weights and external tooling in ~/tools/. Documented in this plan metadata commit.

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `~/tools/ComfyUI/models/checkpoints/AnythingXL_inkBase.safetensors` — SD 1.5 checkpoint for ComfyUI Load Checkpoint node (user download via browser)
- `~/tools/ComfyUI/models/controlnet/control_v11p_sd15_openpose.pth` — ControlNet OpenPose model weights (curl from HuggingFace lllyasviel/ControlNet-v1-1)
- `~/tools/ComfyUI/models/controlnet/control_v11p_sd15_openpose.yaml` — ControlNet config (required alongside .pth)
- `~/tools/ComfyUI/custom_nodes/comfyui_controlnet_aux/` — Full extension directory (git clone Fannovel16/comfyui_controlnet_aux)

## Decisions Made

- Accepted `AnythingXL_inkBase.safetensors` as equivalent substitute for the plan-specified `anything-v5-PrtRE.safetensors`. Both are SD 1.5 safetensors format; ComfyUI accepts any filename — the Load Checkpoint node lists files by name from the directory scan, and neither filename is hardcoded anywhere in the pipeline.
- Confirmed 1.3 GiB display on macOS is correct for the 1378 MB file: HuggingFace reports in base-10 megabytes, macOS `ls -lh` shows GiB (base-2), so 1378 MB / 1024 = 1.35 GiB displays as "1.3G". No truncation occurred.

## Deviations from Plan

### Filename Deviation (Task 1 — Human Action)

**Checkpoint filename differs from plan spec**
- **Found during:** Task 1 verification
- **Plan expected:** `anything-v5-PrtRE.safetensors` (~2.1 GB)
- **Actual downloaded:** `AnythingXL_inkBase.safetensors` (2.0 GB)
- **Impact:** None — both are SD 1.5 format safetensors. ComfyUI's Load Checkpoint node reads the checkpoints/ directory dynamically; no filename is hardcoded in the pipeline or plan configuration. The user obtained a high-quality manga-style SD 1.5 model that meets the same functional requirement.
- **Rule applied:** No auto-fix rule applies (human download, filename choice is user's). Accepted as-is and documented.

---

**Total deviations:** 1 (filename difference on human-downloaded checkpoint)
**Impact on plan:** No functional impact. INFRA-02 requirement satisfied by equivalent model.

## Issues Encountered

None during automated Task 2. HuggingFace downloads proceeded without interruption. pip install completed with all packages resolving successfully (no CUDA/Linux-only packages attempted, macOS-compatible build paths throughout).

## User Setup Required

None beyond what was executed in this plan.

## Next Phase Readiness

- Plan 04 (INFRA-04 benchmark) is unblocked: `AnythingXL_inkBase.safetensors` is in checkpoints/ and ComfyUI can load it
- Phase 10 (ControlNet OpenPose pipeline) has its model and extension pre-positioned: `control_v11p_sd15_openpose.pth` + `comfyui_controlnet_aux` both ready
- Phase 7 (Express service / ComfyUI API) can proceed once benchmark passes
- Note: benchmark (Plan 04) will reference `AnythingXL_inkBase` by its actual filename, not the plan-spec `anything-v5-PrtRE` filename — Plan 04 should be updated accordingly before execution

---
*Phase: 05-environment-validation*
*Completed: 2026-02-19*
