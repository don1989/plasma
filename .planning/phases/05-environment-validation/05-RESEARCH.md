# Phase 5: Environment Validation - Research

**Researched:** 2026-02-19
**Domain:** ComfyUI + kohya_ss local install on Apple Silicon (M1 Pro, macOS 25.2 arm64)
**Confidence:** MEDIUM overall — installation commands verified against current READMEs and live issues; MPS fp16 behavior is the area of highest uncertainty

---

## Summary

Phase 5 is pure infrastructure — install ComfyUI and kohya_ss, download model weights, verify GPU acceleration, and run a benchmark. No TypeScript code is written. No pipeline integration happens. The gate condition is simple: a 512x512 test image must generate in under 2 minutes via the browser UI, and accelerate must report MPS as the compute device.

Several findings from the prior milestone research require correction based on current source verification. Most critically: (1) `mixed_precision: "no"` is the correct accelerate config for Apple Silicon MPS — not `fp16` as previously assumed. fp16 mixed precision triggers "fp16 mixed precision requires a GPU" errors on MPS because PyTorch's AMP autocast does not fully support MPS. (2) kohya_ss `requirements_macos_arm64.txt` now references a PyTorch 2.8.0 nightly wheel that does not yet exist as a stable release — this requirements file is currently broken and must be worked around. (3) ComfyUI natively has no `GET /health` endpoint — the INFRA-01 success criterion "GET /health returns 200 OK" refers to the Express service health endpoint (Phase 7), not a ComfyUI native endpoint. For Phase 5, the correct validation is `GET /system_stats` on the raw ComfyUI server.

**Primary recommendation:** Install ComfyUI with Python 3.11.9 (already active), install kohya_ss using a curated manual pip install (not `requirements_macos_arm64.txt` which is currently broken), configure accelerate with `mixed_precision: no`, and use `GET /system_stats` for the ComfyUI health verification in this phase.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | ComfyUI runs locally at http://127.0.0.1:8188 with Metal/MPS, --force-fp16, install at ~/tools/ComfyUI | ComfyUI install steps verified against current README; `--force-fp16` flag confirmed for 16GB headroom; MPS is auto-detected by ComfyUI |
| INFRA-02 | SD 1.5 checkpoint available (Anything V5 primary, Realistic Vision V6.0 backup) in ~/tools/ComfyUI/models/checkpoints/ | Civitai model IDs confirmed stable; download path and target directory documented |
| INFRA-03 | kohya_ss at ~/tools/kohya_ss in Python 3.11.9 venv with PYTORCH_ENABLE_MPS_FALLBACK=1, skip bitsandbytes/xformers/triton, accelerate configured for MPS fp16 | CRITICAL UPDATE: correct accelerate setting is `mixed_precision: no`, not fp16. Multiple sources confirm fp16 fails on MPS. PYTORCH_ENABLE_MPS_FALLBACK=1 still required. |
| INFRA-04 | Hardware benchmark: 512x512, 20 steps, Euler a, Anything V5 completes in <2min | Benchmark method documented; expected range 30-90s based on M1 Pro community reports |
| INFRA-05 | ComfyUI-Manager and ComfyUI-ControlNet-Aux installed; control_v11p_sd15_openpose.pth downloaded to ~/tools/ComfyUI/models/controlnet/ | Git clone install method confirmed; ControlNet-Aux requires separate pip install -r requirements.txt after clone; HuggingFace download URL verified |
</phase_requirements>

---

## Standard Stack

### Core Tools

| Tool | Version | Purpose | Install Method |
|------|---------|---------|---------------|
| ComfyUI | latest (git) | SD 1.5 inference server with MPS | `git clone https://github.com/comfyanonymous/ComfyUI.git ~/tools/ComfyUI` |
| Python venv (ComfyUI) | Python 3.11.9 | Isolated env for ComfyUI | `python3.11 -m venv venv` |
| PyTorch | 2.5.1 (stable) | MPS-enabled tensor ops | Nightly NOT recommended — 2.5.1 is confirmed working on this machine |
| kohya_ss | latest (git) | LoRA training (Phase 8 use) | `git clone https://github.com/bmaltais/kohya_ss.git ~/tools/kohya_ss` |
| Python venv (kohya) | Python 3.11.9 | Separate venv from ComfyUI | `python3.11 -m venv venv` |
| accelerate | 1.3.0 | Training launch wrapper | `pip install accelerate==1.3.0` |
| ComfyUI-Manager | latest (git) | Custom node manager | `git clone https://github.com/ltdrdata/ComfyUI-Manager` |
| ComfyUI-ControlNet-Aux | latest (git) | OpenPose preprocessor | Install via ComfyUI-Manager UI or git clone + pip install |

### Model Files

| File | Size | Source | Destination |
|------|------|--------|-------------|
| `anything-v5-PrtRE.safetensors` | ~2.1 GB | Civitai model ID 9409 | `~/tools/ComfyUI/models/checkpoints/` |
| `control_v11p_sd15_openpose.pth` | 1.45 GB | HuggingFace lllyasviel/ControlNet-v1-1 | `~/tools/ComfyUI/models/controlnet/` |
| `control_v11p_sd15_openpose.yaml` | <1 KB | HuggingFace lllyasviel/ControlNet-v1-1 | `~/tools/ComfyUI/models/controlnet/` |

### Packages to SKIP on Apple Silicon

| Package | Reason |
|---------|--------|
| `bitsandbytes` | CUDA-only. Attempting to install will fail or silently degrade. |
| `xformers` | CUDA/NVIDIA-only. Confirmed incompatible with macOS; causes errors on install. kohya_ss PR #3084 explicitly removed xformers from Mac requirements. |
| `triton` | Linux/CUDA-only. |
| Any CUDA wheel (cu118, cu121, cu124) | Will not run on arm64. Use the `cpu` index URL which includes MPS. |

### Python Version Note

**Use Python 3.11.9 (already active via pyenv).** The current ComfyUI README states Python 3.13 is "very well supported," but Python 3.11.9 is confirmed working on this machine and is the safe, tested version for kohya_ss. Do not upgrade Python for this phase. Python 3.12+ drops `imp` which some custom nodes require.

---

## Architecture Patterns

### Install Layout

```
~/tools/
├── ComfyUI/                      # SD inference server
│   ├── venv/                     # Python 3.11.9 venv (ComfyUI only)
│   ├── models/
│   │   ├── checkpoints/          # anything-v5-PrtRE.safetensors
│   │   ├── loras/                # Spyke LoRA will land here (Phase 8)
│   │   ├── controlnet/           # control_v11p_sd15_openpose.pth
│   │   ├── vae/                  # (optional standalone VAE)
│   │   └── upscale_models/
│   ├── custom_nodes/
│   │   ├── ComfyUI-Manager/      # git clone (restart required)
│   │   └── comfyui_controlnet_aux/  # via Manager or git clone
│   ├── input/                    # pose reference images go here
│   ├── output/                   # ComfyUI writes generated images here
│   └── main.py
└── kohya_ss/                     # LoRA training toolkit
    ├── venv/                     # Python 3.11.9 venv (kohya only)
    └── train_network.py
```

### Pattern 1: ComfyUI Installation

```bash
# Step 1: Create ~/tools directory
mkdir -p ~/tools

# Step 2: Clone ComfyUI
git clone https://github.com/comfyanonymous/ComfyUI.git ~/tools/ComfyUI
cd ~/tools/ComfyUI

# Step 3: Create isolated Python venv
python3.11 -m venv venv
source venv/bin/activate

# Step 4: Install PyTorch for Apple Silicon
# The "cpu" index URL contains the arm64 MPS-enabled wheel — do NOT use CUDA wheels
pip install torch==2.5.1 torchvision==0.20.1 \
  --index-url https://download.pytorch.org/whl/cpu

# Step 5: Install ComfyUI dependencies
pip install -r requirements.txt

# Step 6: Verify MPS is detected
python -c "import torch; print('MPS available:', torch.backends.mps.is_available())"
# Expected: MPS available: True

# Step 7: Clone ComfyUI-Manager (before first launch)
cd ~/tools/ComfyUI/custom_nodes
git clone https://github.com/ltdrdata/ComfyUI-Manager.git

# Step 8: Launch ComfyUI
cd ~/tools/ComfyUI
source venv/bin/activate
PYTORCH_ENABLE_MPS_FALLBACK=1 python main.py --force-fp16 --listen 127.0.0.1 --port 8188
```

**Key flags:**
- `--force-fp16`: halves VRAM usage — required for 16GB unified memory
- `--listen 127.0.0.1`: accept only localhost connections (security; TypeScript client connects here)
- `--port 8188`: default port, matches all INFRA-01 references
- `PYTORCH_ENABLE_MPS_FALLBACK=1`: allows unsupported MPS ops to fall back to CPU instead of crashing

### Pattern 2: ComfyUI-ControlNet-Aux Installation

**Via ComfyUI-Manager UI (recommended path):**
1. Launch ComfyUI, open browser at `http://127.0.0.1:8188`
2. Click "Manager" button in the menu bar
3. Search for "ComfyUI-ControlNet-Aux"
4. Click Install, restart ComfyUI

**Via git clone (manual, if Manager fails):**
```bash
cd ~/tools/ComfyUI/custom_nodes
git clone https://github.com/Fannovel16/comfyui_controlnet_aux.git
cd comfyui_controlnet_aux
# IMPORTANT: Must install requirements inside the ComfyUI venv
source ~/tools/ComfyUI/venv/bin/activate
pip install -r requirements.txt
```

The OpenPose preprocessor node is named **"OpenPose Estimator"** in the ComfyUI node list.

### Pattern 3: Download Model Files

```bash
# Anything V5 from Civitai (requires browser or Civitai API token)
# URL: https://civitai.com/models/9409
# Download: anything-v5-PrtRE.safetensors (~2.1 GB)
# Place at: ~/tools/ComfyUI/models/checkpoints/

# ControlNet OpenPose model from HuggingFace (direct download, no auth required)
cd ~/tools/ComfyUI/models/controlnet

# Download the model file
curl -L \
  "https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_openpose.pth?download=true" \
  -o control_v11p_sd15_openpose.pth

# Download the config file (required alongside the model)
curl -L \
  "https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_openpose.yaml?download=true" \
  -o control_v11p_sd15_openpose.yaml
```

### Pattern 4: kohya_ss Installation

**IMPORTANT:** Do NOT use `requirements_macos_arm64.txt` — it references `torch==2.8.0.*` which is a nightly-only version that does not exist as a stable release. GitHub issue #3281 (open as of 2025-07-18) documents this failure. Install manually using the curated package list below.

```bash
# Step 1: Clone kohya_ss
git clone https://github.com/bmaltais/kohya_ss.git ~/tools/kohya_ss
cd ~/tools/kohya_ss

# Step 2: Create separate Python venv (must be separate from ComfyUI venv)
python3.11 -m venv venv
source venv/bin/activate

# Step 3: Install PyTorch for Apple Silicon (same 2.5.1 pin as ComfyUI)
pip install torch==2.5.1 torchvision==0.20.1 \
  --index-url https://download.pytorch.org/whl/cpu

# Step 4: Install core training dependencies
# Explicitly NOT installing: bitsandbytes, xformers, triton (CUDA/Linux only)
pip install \
  accelerate==1.3.0 \
  transformers==4.48.1 \
  diffusers==0.32.2 \
  safetensors \
  lycoris-lora \
  toml \
  voluptuous \
  tensorboard \
  Pillow \
  opencv-python \
  einops \
  ftfy \
  tqdm \
  pyyaml \
  huggingface_hub

# Step 5: DO NOT run: pip install bitsandbytes (CUDA only)
# Step 6: DO NOT run: pip install xformers (CUDA/NVIDIA only)
# Step 7: DO NOT run: pip install triton (Linux/CUDA only)

# Step 8: Configure accelerate for MPS
accelerate config
# Answer the prompts:
#   "This machine" (or local machine — single machine option)
#   "No distributed training"
#   CPU only training? → NO
#   torch dynamo? → NO
#   Mixed precision? → "no"  <-- CRITICAL: NOT fp16, NOT bf16
# This saves to ~/.cache/huggingface/accelerate/default_config.yaml

# Step 9: Verify accelerate reports MPS
accelerate env
# Look for: MPS-enabled device in the output
```

### Pattern 5: Accelerate Config for MPS

The correct `~/.cache/huggingface/accelerate/default_config.yaml` for Apple Silicon:

```yaml
compute_environment: LOCAL_MACHINE
debug: false
distributed_type: 'NO'
downcast_bf16: 'no'
machine_rank: 0
main_training_function: main
mixed_precision: 'no'
num_machines: 1
num_processes: 1
rdzv_backend: static
same_network: true
tpu_env: []
tpu_use_sudo: false
use_cpu: false
```

**CRITICAL:** `mixed_precision: 'no'` — not `fp16`. Attempting `fp16` on MPS triggers:
`ValueError: fp16 mixed precision requires a GPU (not 'mps')`

This is a PyTorch AMP limitation on MPS. PyTorch autocast for fp16 does not support the `mps` device. You CAN create fp16 tensors and run fp16 ops on MPS — but the accelerate/PyTorch AMP `mixed_precision` training framework does not support `mps` + `fp16` in combination.

**Alternative shortcut (skips interactive prompts):**
```bash
python -c "
from accelerate.utils import write_basic_config
write_basic_config(mixed_precision='no')
"
```

### Pattern 6: The MPS Benchmark Test

The success criterion for INFRA-04 is 512x512, 20 steps, Euler a, Anything V5, under 2 minutes via the ComfyUI browser UI.

**Steps:**
1. Launch ComfyUI and open browser at `http://127.0.0.1:8188`
2. Confirm Anything V5 checkpoint is selected in the "Load Checkpoint" node
3. Set sampler to "euler_ancestral" (Euler a), scheduler to "normal"
4. Set steps to 20, cfg to 7.0, resolution to 512x512
5. Enter a test prompt (e.g., `"anime character, white cloak, standing, masterpiece"`)
6. Click Queue Prompt and start a timer
7. Record time when image appears in the output area
8. Target: under 2 minutes (community reports: M1 Pro typically 30-90 seconds)

**Monitor GPU activity:**
Open Activity Monitor → GPU History tab while generation runs. The GPU utilization bar must show non-zero activity. If it stays flat, MPS is not active — generation is falling back to CPU (will take 10+ minutes).

### Pattern 7: Verifying ComfyUI is Running (Health Check)

ComfyUI does NOT have a native `GET /health` endpoint. The INFRA-01 success criterion "GET /health returns 200 OK" refers to the Express service endpoint that will be built in Phase 7. For Phase 5 validation, use `GET /system_stats` instead:

```bash
curl -s http://127.0.0.1:8188/system_stats | python3 -m json.tool
```

A 200 response with JSON containing `system` and `devices` fields confirms ComfyUI is running and listening. The response looks like:
```json
{
  "system": {
    "os": "posix",
    "python_version": "3.11.9",
    "embedded_python": false
  },
  "devices": [
    {
      "name": "mps",
      "type": "mps",
      "index": 0,
      "vram_total": 0,
      "vram_free": 0,
      "torch_vram_total": 0,
      "torch_vram_free": 0
    }
  ]
}
```

The `"type": "mps"` in devices array confirms Metal acceleration is active. `vram` fields are 0 on MPS — this is expected (unified memory doesn't report VRAM separately).

### Anti-Patterns to Avoid

- **Using `requirements_macos_arm64.txt` directly:** This file requires `torch==2.8.0.*` which only exists as nightly builds (not stable). Install will fail. Use the manual pip install above.
- **Using `--listen 0.0.0.0`:** Exposes ComfyUI to the local network. For this project, `--listen 127.0.0.1` is correct.
- **Installing ComfyUI inside the plasma repo:** Must be at `~/tools/ComfyUI` — outside the repo. ComfyUI has its own git history and model files.
- **Sharing the Python venv between ComfyUI and kohya_ss:** Keep them strictly separate to prevent dependency conflicts.
- **Setting `mixed_precision: fp16` in accelerate config:** Will fail with `ValueError: fp16 mixed precision requires a GPU (not 'mps')`. Use `mixed_precision: no`.
- **Using AdamW8bit in kohya_ss train_network.py:** Requires bitsandbytes which is CUDA-only. Use standard `AdamW`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Custom node installation | Manual git clone + dependency resolution | ComfyUI-Manager UI | Manager handles dependency install, version pinning, and restart prompts |
| Pose detection preprocessing | Custom OpenPose Python script | ComfyUI-ControlNet-Aux | Extension provides the "OpenPose Estimator" node with correct 18-keypoint output format |
| Model file download | Custom download script | `curl -L` with HuggingFace resolve URL | Direct download, no auth required, resumable with `-C -` flag |

---

## Common Pitfalls

### Pitfall 1: MPS Not Active During Generation

**What goes wrong:** ComfyUI launches without error but generation takes 10+ minutes because it silently falls back to CPU.
**Why it happens:** `PYTORCH_ENABLE_MPS_FALLBACK=1` is set (necessary to prevent crashes) but some operations fall back and the whole session degrades to CPU.
**How to avoid:** Check Activity Monitor → GPU History while a generation runs. GPU bar must show non-zero utilization. If flat, something is wrong with MPS detection.
**Warning signs:** Generation time exceeds 3 minutes for 512x512, 20 steps. No GPU activity in Activity Monitor.
**Fix:** Verify `torch.backends.mps.is_available()` returns True inside the ComfyUI venv. Check that PyTorch was installed from the `cpu` index (not a CUDA wheel).

### Pitfall 2: kohya_ss requirements_macos_arm64.txt Fails

**What goes wrong:** `pip install -r requirements_macos_arm64.txt` fails with "Could not find a version that satisfies the requirement torch==2.8.0.*"
**Why it happens:** The ARM64 requirements file specifies a nightly PyTorch version (2.8.0.dev) that isn't available as a stable release. GitHub issue #3281 documents this as open and unresolved.
**How to avoid:** Do NOT use `requirements_macos_arm64.txt`. Use the manual pip install with `torch==2.5.1` from the `cpu` index.
**Warning signs:** Error message mentioning `torch==2.8.0.*` not found during any pip install step.

### Pitfall 3: accelerate config fp16 Error During Training

**What goes wrong:** `accelerate launch train_network.py` fails immediately with `ValueError: fp16 mixed precision requires a GPU (not 'mps')`.
**Why it happens:** PyTorch's AMP autocast framework treats `mps` as "not a GPU" for mixed precision purposes. fp16 tensor creation works, but the training wrapper does not.
**How to avoid:** Set `mixed_precision: 'no'` in accelerate config. Verify with `accelerate env` after configuration.
**Warning signs:** The error message contains "fp16 mixed precision requires a GPU" during training launch.

### Pitfall 4: ComfyUI-ControlNet-Aux Missing pip Dependencies

**What goes wrong:** After cloning ComfyUI-ControlNet-Aux, the extension fails to load. ComfyUI reports the node as disabled at startup.
**Why it happens:** The extension has its own `requirements.txt` that must be installed separately after cloning.
**How to avoid:** After cloning (or after Manager installs it), activate the ComfyUI venv and run `pip install -r requirements.txt` from the custom_nodes/comfyui_controlnet_aux directory.
**Warning signs:** ComfyUI startup log shows "Failed to import" for ControlNet-Aux nodes.

### Pitfall 5: Anything V5 Download Requires Civitai Account

**What goes wrong:** Attempting to `wget` or `curl` the Civitai download URL without authentication fails.
**Why it happens:** Civitai requires login for model downloads (anti-scraping measure).
**How to avoid:** Download via the Civitai website browser after logging in, or use the Civitai API with a personal API token in the request header. Alternative: use `wget --header "Authorization: Bearer <token>"` with a Civitai API key.
**Warning signs:** Download returns HTML (the login page) instead of binary data.

### Pitfall 6: ~/tools Does Not Exist

**What goes wrong:** `git clone` fails if `~/tools` doesn't exist.
**Why it happens:** The directory has never been created on this machine.
**How to avoid:** Run `mkdir -p ~/tools` before any git clone commands.

### Pitfall 7: Both venvs Activated Simultaneously

**What goes wrong:** Commands run against the wrong venv, installing packages in the wrong environment.
**Why it happens:** Shell state confusion when switching between ComfyUI and kohya_ss work.
**How to avoid:** Deactivate one venv before activating the other. Use absolute paths to venv binaries when in doubt (`~/tools/ComfyUI/venv/bin/python`).

---

## Code Examples

### Verify MPS is Active in ComfyUI Venv
```bash
# Source: PyTorch MPS documentation
source ~/tools/ComfyUI/venv/bin/activate
python -c "
import torch
print('PyTorch version:', torch.__version__)
print('MPS available:', torch.backends.mps.is_available())
print('MPS built:', torch.backends.mps.is_built())
t = torch.ones(1, device='mps')
print('MPS tensor test:', t)
"
# Expected:
# PyTorch version: 2.5.1
# MPS available: True
# MPS built: True
# MPS tensor test: tensor([1.], device='mps:0')
```

### Verify accelerate MPS Configuration
```bash
# Source: HuggingFace accelerate docs
source ~/tools/kohya_ss/venv/bin/activate
accelerate env
# Look for: compute_environment: LOCAL_MACHINE, distributed_type: NO, mixed_precision: no
```

### Health Check ComfyUI Server
```bash
# Source: ComfyUI API documentation (docs.comfy.org/development/comfyui-server/comms_routes)
# Note: /health does not exist natively — use /system_stats
curl -s http://127.0.0.1:8188/system_stats
# 200 response with JSON confirms server is listening
# "type": "mps" in devices array confirms Metal acceleration
```

### Verify ControlNet Model File
```bash
# Simple existence check
ls -lh ~/tools/ComfyUI/models/controlnet/control_v11p_sd15_openpose.pth
# Expected: -rw-r--r--  1 ...  1.45G  ... control_v11p_sd15_openpose.pth
# File size under 1GB means a failed/partial download
```

### Verify kohya_ss Training Will Use MPS (Pre-Training Smoke Test)
```bash
# Source: accelerate docs - how MPS training is verified
source ~/tools/kohya_ss/venv/bin/activate
export PYTORCH_ENABLE_MPS_FALLBACK=1
python -c "
import torch
import accelerate
from accelerate import Accelerator
a = Accelerator()
print('Device:', a.device)
print('Mixed precision:', a.mixed_precision)
"
# Expected output should show device: mps
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `mixed_precision: fp16` on MPS | `mixed_precision: no` | Present throughout 2024-2025 | fp16 via AMP/autocast does not work on MPS; must use no mixed precision for training |
| Manual pip install without Mac requirements | `requirements_macos_arm64.txt` | ~2024 (partial) | The file exists but is broken (references nightly PyTorch). Manual install is still correct path. |
| ComfyUI recommends Python 3.10-3.11 | Python 3.12-3.13 now well supported | Late 2024 | 3.11.9 still works perfectly; no need to upgrade |
| `GET /system_stats` for health check | No change — there is still no `GET /health` | Still current | Phase 5 must use `/system_stats`; `/health` is the Express service endpoint (Phase 7) |
| PyTorch "cpu" wheel for Mac | pytorch-nightly recommended by ComfyUI docs | 2024-2025 | ComfyUI docs suggest nightly; for this project, stick with 2.5.1 stable (already confirmed working on this machine) |

**Deprecated/outdated prior research claims:**
- `mixed_precision: fp16` in accelerate config — INCORRECT for MPS. Prior research stated fp16 was "preferred precision on Apple Silicon" for training. Community and GitHub issues consistently show fp16 fails on MPS via accelerate/AMP. Correct value is `mixed_precision: no`.
- `--optimizer_type=AdamW8bit` — Prior STACK.md used this in the example command, then correctly noted it requires bitsandbytes. The training command must use `AdamW` (standard). Confirmed.
- `requirements_macos_arm64.txt` as the install path — Broken. References torch 2.8.0 nightly that doesn't exist.

---

## Open Questions

1. **Civitai download mechanism for Anything V5**
   - What we know: Civitai requires authentication for downloads; browser download works after login
   - What's unclear: Whether a Civitai API token is already set up, or if browser download is needed
   - Recommendation: Plan for browser download as default; note Civitai API token as an alternative. The plan task should instruct: "Download via browser at https://civitai.com/models/9409" and drop the file in the correct directory.

2. **PyTorch nightly vs stable for ComfyUI**
   - What we know: ComfyUI docs now suggest "install the latest pytorch nightly" for Apple Silicon. PyTorch 2.5.1 stable is already confirmed working on this machine.
   - What's unclear: Whether nightly provides meaningfully better MPS op coverage for SD inference on this machine
   - Recommendation: Stick with 2.5.1 stable. Do not introduce nightly installs (they break between days). If MPS performance is poor, evaluate nightly as a follow-up.

3. **kohya_ss MPS training: train_network.py path**
   - What we know: kohya_ss has been restructuring; some forks use `sd_scripts/train_network.py`, others have it at the root
   - What's unclear: Exact path in current master branch
   - Recommendation: Verify by running `ls ~/tools/kohya_ss/` and `find ~/tools/kohya_ss -name "train_network.py"` after cloning.

4. **PYTORCH_ENABLE_MPS_FALLBACK in training context**
   - What we know: Required for inference (ComfyUI); many MPS ops fall back to CPU without it
   - What's unclear: Whether it's needed for kohya_ss training specifically (training uses a different op set)
   - Recommendation: Set it for both contexts. It's a no-op if not needed, and prevents cryptic op-not-implemented errors.

---

## Sources

### Primary (HIGH confidence)
- `docs.comfy.org/installation/system_requirements` — ComfyUI Python 3.13 support note, PyTorch 2.4+ minimum
- `docs.comfy.org/development/comfyui-server/comms_routes` — Confirmed no native `/health` endpoint; `/system_stats` is correct health check
- `huggingface.co/docs/accelerate/usage_guides/mps` — Official accelerate MPS documentation: enabled by default on MPS Macs, single GPU only, no distributed
- `huggingface.co/lllyasviel/ControlNet-v1-1` — Confirmed `control_v11p_sd15_openpose.pth` exists at 1.45 GB; download URL verified
- Machine verification (from prior milestone research): Python 3.11.9 active, PyTorch 2.5.1 installed, MPS confirmed working (`tensor([1.], device='mps:0')`)
- `github.com/bmaltais/kohya_ss/issues/725` — Official issue thread: `mixed_precision: 'no'` is correct for MPS, fp16 causes "fp16 mixed precision requires a GPU" error
- `github.com/bmaltais/kohya_ss/issues/3281` — Confirmed `requirements_macos_arm64.txt` is broken: torch==2.8.0.* not available as stable, issue open 2025-07-18

### Secondary (MEDIUM confidence)
- `github.com/bmaltais/kohya_ss` — `requirements_macos_arm64.txt` content verified; `setup.sh` script exists but targets Linux; Mac users directed to pip_linux.md (404)
- `github.com/bmaltais/kohya_ss/pull/3084` — PR removed xformers from Mac requirements; disabled fp16 UI for MPS; added MPS device check
- `github.com/Fannovel16/comfyui_controlnet_aux` — Installation confirmed as git clone + `pip install -r requirements.txt`; OpenPose node named "OpenPose Estimator"
- `github.com/ltdrdata/ComfyUI-Manager` — Git clone method confirmed; security migration to `__manager/` path in V3.38; standard install still works via `custom_nodes/ComfyUI-Manager`
- `reallyar.com/training-stable-diffusion-lora-on-apple-silicon-m2-mac-gpus-metal/` — Community guide confirming `mixed_precision: "no"` with accelerate config on Mac

### Tertiary (LOW confidence — flag for validation)
- Community reports of 30-90 second generation time for 512x512 at 20 steps on M1 Pro — not verified on this specific machine; benchmark will confirm
- `mixed_precision: no` impact on training quality vs fp16 — with fp16 not available on MPS, "no" is the only option; training will use fp32 throughout

---

## Metadata

**Confidence breakdown:**
- ComfyUI install steps: HIGH — verified against current README and official docs
- kohya_ss install path: MEDIUM — requirements_macos_arm64.txt confirmed broken; manual install path is well-documented across multiple community sources
- accelerate MPS config: HIGH — multiple sources (official docs + GitHub issues) consistently confirm `mixed_precision: no`
- Model download URLs: HIGH — HuggingFace URL verified live; Civitai requires browser/token
- Benchmark timing: LOW — community estimates; actual number measured during Phase 5 execution
- ComfyUI health endpoint: HIGH — docs confirmed no /health; /system_stats is correct

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (30 days) — kohya_ss moves quickly; re-verify requirements_macos_arm64.txt status before any future phases touch training setup
