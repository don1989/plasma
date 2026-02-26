# Phase 05-01 Installation Record

## Task 1: ComfyUI Install — COMPLETE

**Date:** 2026-02-19
**Location:** ~/tools/ComfyUI/

### What was installed

- ComfyUI cloned from https://github.com/comfyanonymous/ComfyUI.git
- Python 3.11.9 venv created at ~/tools/ComfyUI/venv/
- PyTorch 2.5.1 installed from https://download.pytorch.org/whl/cpu (arm64 MPS wheel)
- torchvision 0.20.1 installed
- ComfyUI runtime dependencies installed from requirements.txt

### MPS Verification Output

```
PyTorch version: 2.5.1
MPS available: True
MPS built: True
MPS tensor test: tensor([1.], device='mps:0')
```

### Key flags for launch

```bash
PYTORCH_ENABLE_MPS_FALLBACK=1 python main.py --force-fp16 --listen 127.0.0.1 --port 8188
```

## Task 2: ComfyUI-Manager Install — COMPLETE

- ComfyUI-Manager cloned from https://github.com/ltdrdata/ComfyUI-Manager.git
- Installed at ~/tools/ComfyUI/custom_nodes/ComfyUI-Manager/
- ~/tools/ComfyUI/models/controlnet/ directory created for Plan 03

### Verification

```
~/tools/ComfyUI/custom_nodes/ComfyUI-Manager/__init__.py  EXISTS
~/tools/ComfyUI/models/controlnet/                        EXISTS
```
