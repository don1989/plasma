---
phase: 05-environment-validation
plan: 01
subsystem: infra
tags: [comfyui, pytorch, mps, apple-silicon, python-venv]

# Dependency graph
requires: []
provides:
  - ComfyUI cloned at ~/tools/ComfyUI with Python 3.11.9 venv
  - PyTorch 2.5.1 MPS-enabled (arm64 cpu wheel) confirmed via tensor test on mps:0
  - ComfyUI-Manager cloned into custom_nodes before first launch
  - ~/tools/ComfyUI/models/controlnet/ directory created for Plan 03

affects:
  - 05-02 (ComfyUI launch and benchmark — depends on this venv + MPS install)
  - 05-03 (kohya_ss install — separate venv, same ~/tools/ sidecar pattern)
  - 05-04 (ControlNet model download — uses controlnet/ dir created here)
  - 07 (Express service wraps running ComfyUI instance)
  - 10 (ControlNet nodes need ComfyUI-Manager already installed)

# Tech tracking
tech-stack:
  added:
    - ComfyUI (latest git, ~/tools/ComfyUI)
    - PyTorch 2.5.1 (arm64 MPS wheel via https://download.pytorch.org/whl/cpu)
    - torchvision 0.20.1
    - ComfyUI-Manager (latest git, custom_nodes)
  patterns:
    - Sidecar install: ComfyUI outside the plasma repo at ~/tools/, not embedded
    - Separate Python 3.11.9 venv per tool (ComfyUI venv isolated from kohya_ss)
    - arm64 MPS wheels installed via cpu index URL, never CUDA wheels

key-files:
  created:
    - ~/tools/ComfyUI/ (git clone — outside repo)
    - ~/tools/ComfyUI/venv/ (Python 3.11.9 isolated env)
    - ~/tools/ComfyUI/custom_nodes/ComfyUI-Manager/ (git clone)
    - ~/tools/ComfyUI/models/controlnet/ (empty dir for Plan 03)
    - .planning/phases/05-environment-validation/05-01-install-record.md
  modified: []

key-decisions:
  - "PyTorch 2.5.1 stable installed from cpu index URL (not nightly) — confirmed working on this machine, nightly introduces breakage risk"
  - "ComfyUI-Manager cloned before first launch — Manager is detected at startup, not dynamically loaded"
  - "models/controlnet/ created in this plan so Plan 03 can drop files without needing to create the directory"

patterns-established:
  - "Pattern: All Apple Silicon PyTorch installs use --index-url https://download.pytorch.org/whl/cpu — cpu index contains arm64 MPS wheels, not CUDA-only wheels"
  - "Pattern: MPS verification command: python -c \"import torch; t = torch.ones(1, device='mps'); print(t)\" must print tensor([1.], device='mps:0')"

requirements-completed: [INFRA-01]

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 5 Plan 01: ComfyUI Install Summary

**ComfyUI installed at ~/tools/ComfyUI with Python 3.11.9 venv, PyTorch 2.5.1 MPS confirmed active (tensor([1.], device='mps:0')), and ComfyUI-Manager pre-installed in custom_nodes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T13:02:57Z
- **Completed:** 2026-02-19T13:06:57Z
- **Tasks:** 2
- **Files modified:** 1 (install-record.md created in .planning)

## Accomplishments

- ComfyUI cloned from github.com/comfyanonymous/ComfyUI at ~/tools/ComfyUI — sidecar pattern outside plasma repo
- PyTorch 2.5.1 with MPS acceleration installed; verified `torch.backends.mps.is_available() = True` and tensor runs on `mps:0`
- ComfyUI-Manager cloned into custom_nodes before first launch (required for startup detection)
- `models/controlnet/` directory created to allow Plan 03 to drop ControlNet weights without setup

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: ComfyUI install and ComfyUI-Manager** - `e589760` (chore)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `~/tools/ComfyUI/` - ComfyUI clone (outside plasma repo — not tracked in git)
- `~/tools/ComfyUI/venv/` - Python 3.11.9 isolated venv with PyTorch 2.5.1 + ComfyUI deps
- `~/tools/ComfyUI/custom_nodes/ComfyUI-Manager/` - ComfyUI-Manager extension
- `~/tools/ComfyUI/models/controlnet/` - Empty directory for ControlNet model files
- `.planning/phases/05-environment-validation/05-01-install-record.md` - Install documentation

## Decisions Made

- **PyTorch wheel source:** Used `--index-url https://download.pytorch.org/whl/cpu` — this is the arm64 MPS wheel, NOT a CPU-only wheel despite the URL name. ComfyUI docs suggest nightly but 2.5.1 stable is confirmed working and stable.
- **ComfyUI-Manager timing:** Cloned before first launch because Manager is discovered at ComfyUI startup, not dynamically. Installing after first launch would require a restart.
- **controlnet dir:** Created now (not in Plan 03) so the download in Plan 03 only needs a `curl` to the correct path, not `mkdir -p` first.

## Deviations from Plan

None — plan executed exactly as written. The minor command formatting issue (backslash-continuation parsing in shell) was fixed inline by switching to quoted arguments; not a bug, just shell syntax.

## Issues Encountered

- **Pip install backslash continuation:** The `pip install torch==2.5.1 torchvision==0.20.1 \` multi-line form produced "Invalid requirement: ''" due to shell interpretation of the backslash in the Bash tool. Fixed immediately by passing both packages on one line with quoted versions.

## User Setup Required

None — no external service configuration required. ComfyUI is installed and ready to launch. First launch command (Plan 02):

```bash
cd ~/tools/ComfyUI
source venv/bin/activate
PYTORCH_ENABLE_MPS_FALLBACK=1 python main.py --force-fp16 --listen 127.0.0.1 --port 8188
```

## Next Phase Readiness

- **Plan 02 (Launch + Benchmark):** Ready — venv, PyTorch MPS, and ComfyUI-Manager are all in place. Plan 02 can launch ComfyUI immediately.
- **Plan 03 (kohya_ss):** Independent of Plan 02 — can run in parallel. Models dir controlnet/ is ready.
- No blockers.

---
*Phase: 05-environment-validation*
*Completed: 2026-02-19*

## Self-Check: PASSED

| Artifact | Status |
|----------|--------|
| ~/tools/ComfyUI/main.py | FOUND |
| ~/tools/ComfyUI/venv/bin/python | FOUND |
| ~/tools/ComfyUI/custom_nodes/ComfyUI-Manager/__init__.py | FOUND |
| ~/tools/ComfyUI/models/controlnet/ | FOUND |
| .planning/phases/05-environment-validation/05-01-SUMMARY.md | FOUND |
| Commit e589760 | FOUND |
