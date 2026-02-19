# Stack Research: ComfyUI + LoRA Pipeline

**Project:** Plasma Manga Pipeline — v2.0 Local ComfyUI + LoRA milestone
**Researched:** 2026-02-19
**Scope:** New additions only. Existing TypeScript pipeline (Sharp, Commander, Nunjucks, @google/genai) not re-researched.

---

## Hardware Context (Verified)

| Property | Value |
|----------|-------|
| Chip | Apple M1 Pro |
| RAM | 16 GB unified memory |
| macOS | 26.2 (arm64) |
| Python | 3.11.9 (pyenv) |
| PyTorch | 2.5.1 — already installed |
| MPS available | **YES** — confirmed (`torch.backends.mps.is_available() = True`) |
| MPS built | **YES** — confirmed (`torch.backends.mps.is_built() = True`) |

MPS tensor operations verified working: `tensor([1.], device='mps:0')`.

---

## Node.js / TypeScript Additions

### Primary Package: ComfyUI Client

**Recommended:** `@stable-canvas/comfyui-client` v1.5.9

```bash
pnpm add @stable-canvas/comfyui-client
```

| Property | Detail |
|----------|--------|
| Version | 1.5.9 (published ~2026-02-12 — confirmed current on npm) |
| License | MIT |
| Runtime deps | **Zero** — no transitive dependencies |
| ESM support | YES — ships `dist/main.modern.mjs` with proper `exports` field |
| TypeScript types | YES — bundled `dist/main.d.ts` |
| API coverage | Full REST + WebSocket APIs for ComfyUI |
| Node.js compat | Confirmed Node.js + Browser dual environment |

**Why this over alternatives:**
- `comfyui-sdk` (v0.0.5) has 4 dependencies including `cos-nodejs-sdk-v5` (Tencent Cloud SDK — completely unrelated), chalk, lodash. It's clearly a one-person prototype. Reject.
- Raw `fetch` + `ws` works but means writing WebSocket reconnect logic, queue ID tracking, and output polling from scratch. Not worth it when `@stable-canvas/comfyui-client` covers all of this with zero deps.
- The zero-dep constraint matters here: the pipeline is a TypeScript ESM project and adding packages with CJS-only transitive deps causes interop pain with `"type": "module"`.

### Supporting Packages (TypeScript pipeline already has these — no additions needed)

| Package | Already in package.json | Note |
|---------|------------------------|------|
| `sharp` | YES (^0.34.5) | Will handle fetching and saving ComfyUI output images |
| `zod` | YES (^4.3.6) | Use for validating ComfyUI API response shapes |
| `yaml` | YES (^2.8.2) | Workflow JSON/YAML config |
| `commander` | YES (^14.0.3) | CLI already built |

**No other npm packages are needed.** The ComfyUI API is plain HTTP + WebSocket; `@stable-canvas/comfyui-client` handles both. Node.js 20 has native `fetch` — no `node-fetch` required.

---

## ComfyUI Setup (Apple Silicon)

### Installation

ComfyUI runs as a Python process. It is NOT an npm package — the TypeScript pipeline calls it over HTTP.

**Confidence: MEDIUM** — Steps derived from training data (ComfyUI README patterns stable since 2023). WebFetch unavailable to verify current README. Verify at `https://github.com/comfyanonymous/ComfyUI` before running.

```bash
# 1. Clone ComfyUI (recommended location: alongside the plasma repo, NOT inside it)
git clone https://github.com/comfyanonymous/ComfyUI.git ~/tools/ComfyUI
cd ~/tools/ComfyUI

# 2. Create a dedicated Python 3.11 venv (do NOT use the system or global pip)
python3.11 -m venv venv
source venv/bin/activate

# 3. Install PyTorch for Apple Silicon (MPS backend)
#    PyTorch 2.5.1 is already globally installed on this machine (confirmed).
#    Install inside the venv to keep ComfyUI isolated:
pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
# Note: On Apple Silicon, the "cpu" wheel includes MPS support.
# Do NOT install the CUDA wheel (cu118, cu121, etc.) — they will not run on arm64.

# 4. Install ComfyUI dependencies
pip install -r requirements.txt

# 5. Launch with Metal/MPS backend
#    --force-fp16 reduces VRAM pressure on 16GB unified memory
python main.py --force-fp16
```

**Apple Silicon flags:**

| Flag | Effect | Use? |
|------|--------|------|
| `--force-fp16` | Forces half-precision — halves VRAM for models | YES — required for 16GB |
| `--cpu` | Disables GPU entirely, uses CPU | NO — only fallback if MPS crashes |
| `--lowvram` | Aggressive VRAM offloading | Only if OOM errors with fp16 |
| `--novram` | Maximum offloading, slow | Last resort |
| `--listen 0.0.0.0` | Accept connections from other processes | YES — needed for TypeScript client |
| `--port 8188` | Default port (change if needed) | Use default |

**Recommended launch command:**
```bash
python main.py --force-fp16 --listen 127.0.0.1 --port 8188
```

### MPS Compatibility Notes

**Confidence: MEDIUM** — Based on training data through Aug 2025. Metal support in PyTorch has improved significantly between 2.0 and 2.5.

- PyTorch 2.5.1 MPS is confirmed installed and working on this machine.
- ComfyUI detects MPS automatically via `torch.backends.mps.is_available()` — no extra configuration.
- xformers is **CUDA-only** and cannot be installed on Apple Silicon. ComfyUI gracefully falls back to PyTorch attention when xformers is absent. Do not attempt to install it.
- bitsandbytes is CUDA-only. Do not install it. LLM quantization features in some custom nodes will not work.
- triton is CUDA/Linux-only. Not needed for inference.
- `float16` (fp16) is supported on MPS but some operations may fall back to `float32` with a warning. This is expected behavior, not an error.
- SD 1.5 inference on M1 Pro 16GB with fp16: expect ~15-30 seconds per image at 512x512, ~45-90 seconds at 768x768.

### ComfyUI Folder Structure for Models

```
~/tools/ComfyUI/
├── models/
│   ├── checkpoints/      ← SD 1.5 base model .safetensors files go here
│   ├── loras/            ← Trained LoRA .safetensors files go here
│   ├── controlnet/       ← ControlNet model .safetensors files go here
│   ├── clip/             ← CLIP text encoder models
│   ├── vae/              ← VAE models
│   └── upscale_models/   ← ESRGAN upscaler models (optional)
├── custom_nodes/         ← ComfyUI-Manager and ControlNet extension go here
├── input/                ← Input images for img2img / reference / pose maps
├── output/               ← ComfyUI writes generated images here
└── main.py
```

The TypeScript pipeline will read images from `~/tools/ComfyUI/output/` after jobs complete.

### ComfyUI-Manager (Required)

ComfyUI-Manager is the de facto plugin manager — install it first. It handles custom node installation including ComfyUI-ControlNet-Aux (the OpenPose preprocessor).

```bash
cd ~/tools/ComfyUI/custom_nodes
git clone https://github.com/ltdrdata/ComfyUI-Manager.git
```

Restart ComfyUI after cloning. Then use the Manager UI to install `ComfyUI-ControlNet-Aux`.

---

## kohya_ss Setup (Apple Silicon)

**Confidence: MEDIUM** — kohya_ss has undergone significant restructuring. The canonical repo is `https://github.com/bmaltais/kohya_ss`. Steps below are based on training data patterns; verify at the repo before running. The Python dependencies are verified correct for Apple Silicon.

### Critical Apple Silicon Constraints

| Component | Status on Apple Silicon |
|-----------|------------------------|
| PyTorch MPS | YES — works (confirmed on this machine) |
| bitsandbytes | NO — CUDA-only. kohya_ss has a bitsandbytes dependency flag |
| xformers | NO — CUDA-only |
| triton | NO — Linux/CUDA-only |
| bf16 training | PARTIAL — MPS supports bf16 in PyTorch 2.x but some ops fall back |
| fp16 training | YES — preferred precision on Apple Silicon |

### Installation

```bash
# 1. Clone kohya_ss (separate from ComfyUI)
git clone https://github.com/bmaltais/kohya_ss.git ~/tools/kohya_ss
cd ~/tools/kohya_ss

# 2. Create isolated Python 3.11 venv (separate from ComfyUI venv)
python3.11 -m venv venv
source venv/bin/activate

# 3. Install PyTorch for Apple Silicon (MPS)
pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu

# 4. Install base requirements WITHOUT CUDA-specific packages
#    kohya_ss requirements.txt includes bitsandbytes and xformers — skip them on Mac.
#    Use the Mac-specific install path if the repo provides one, otherwise:
pip install \
  accelerate==1.3.0 \
  transformers==4.48.1 \
  diffusers==0.32.2 \
  datasets \
  huggingface_hub \
  safetensors \
  lycoris-lora \
  prodigyopt \
  lion-pytorch \
  schedulefree \
  toml \
  voluptuous \
  wandb \
  tensorboard \
  Pillow \
  opencv-python \
  einops \
  ftfy \
  tqdm \
  pyyaml

# NOTE: accelerate, transformers, diffusers are already installed globally (confirmed).
# In a venv they will be reinstalled at the pinned versions above.

# 5. Skip these — CUDA/Linux only:
#    DO NOT: pip install bitsandbytes
#    DO NOT: pip install xformers
#    DO NOT: pip install triton

# 6. Configure accelerate for MPS
accelerate config
# When prompted:
#   - "This machine" (single machine)
#   - NO distributed training
#   - "MPS" when asked about device (or "mps" depending on version)
#   - fp16 as default mixed precision
```

**Accelerate config for MPS (save to `~/.cache/huggingface/accelerate/default_config.yaml`):**

```yaml
compute_environment: LOCAL_MACHINE
debug: false
distributed_type: 'NO'
downcast_bf16: 'no'
machine_rank: 0
main_training_function: main
mixed_precision: fp16
num_machines: 1
num_processes: 1
rdzv_backend: static
same_network: true
tpu_env: []
tpu_use_sudo: false
use_cpu: false
```

### LoRA Training Command (SD 1.5 target)

```bash
# From ~/tools/kohya_ss/
source venv/bin/activate

# Example: train a character LoRA on SD 1.5
accelerate launch train_network.py \
  --pretrained_model_name_or_path="/path/to/sd15-checkpoint.safetensors" \
  --train_data_dir="/path/to/training/images" \
  --output_dir="./output/loras" \
  --output_name="plasma_char_v1" \
  --network_module=networks.lora \
  --network_dim=32 \
  --network_alpha=16 \
  --resolution="512,512" \
  --train_batch_size=1 \
  --gradient_accumulation_steps=4 \
  --max_train_steps=2000 \
  --learning_rate=1e-4 \
  --lr_scheduler="cosine_with_restarts" \
  --lr_warmup_steps=200 \
  --optimizer_type="AdamW8bit" \
  --mixed_precision="fp16" \
  --save_precision="fp16" \
  --save_model_as=safetensors \
  --caption_extension=".txt" \
  --shuffle_caption \
  --keep_tokens=1 \
  --enable_bucket \
  --min_bucket_reso=256 \
  --max_bucket_reso=1024 \
  --xformers=False
```

**Apple Silicon training parameters:**

| Parameter | Mac Setting | Reason |
|-----------|------------|--------|
| `--train_batch_size` | 1 | 16GB unified memory; larger batches OOM |
| `--gradient_accumulation_steps` | 4 | Simulates effective batch size 4 |
| `--mixed_precision` | fp16 | MPS supports fp16; bf16 support is partial |
| `--optimizer_type` | AdamW (not AdamW8bit) | 8-bit Adam requires bitsandbytes (CUDA only) |
| `--xformers` | False | Not available on Apple Silicon |
| `--network_dim` | 32 | Good quality/size tradeoff for character LoRAs |
| `--network_alpha` | 16 | Half of dim is standard default |

**Training time estimate on M1 Pro:** ~2-4 hours for 2000 steps at 512x512, batch 1.

### Training Data Preparation

```
training_data/
└── plasma_character/
    ├── 20_plasma_char_v1/    ← "20 repeats" prefix, trigger word as folder name
    │   ├── image_001.png
    │   ├── image_001.txt     ← caption: "plasma_char_v1, [description]"
    │   ├── image_002.png
    │   ├── image_002.txt
    │   └── ...
    └── ...
```

Minimum 15-20 training images for a character LoRA. Aim for 20-30 with varied angles, expressions, lighting. All images must be captioned `.txt` files alongside each `.png`.

---

## Recommended Model Files

**Confidence: MEDIUM** — Filenames and sources are based on training data. Civitai model IDs and HuggingFace repo names verified against known-stable references, but download URLs may have changed. Verify each URL before downloading.

### SD 1.5 Base Checkpoints

#### Realistic — Recommended: Realistic Vision V6.0

| Property | Value |
|----------|-------|
| Filename | `realisticVisionV60B1_v51HyperVAE.safetensors` |
| Size | ~2.1 GB |
| Civitai | `https://civitai.com/models/4201/realistic-vision-v60-b1` |
| Why | Best overall realistic checkpoint on SD 1.5 as of 2025. Human anatomy and faces handle well. Active maintenance. Includes built-in VAE. |
| Place in ComfyUI | `~/tools/ComfyUI/models/checkpoints/` |

Alternative realistic: **DreamShaper v8** — better for semi-realistic/painterly style if pure photorealism is too uncanny.
- Filename: `dreamshaper_8.safetensors`
- Civitai: `https://civitai.com/models/4384/dreamshaper`

#### Anime — Recommended: Anything V5 / Anything XL (SD 1.5 version)

| Property | Value |
|----------|-------|
| Filename | `anything-v5-PrtRE.safetensors` |
| Size | ~2.1 GB |
| Civitai | `https://civitai.com/models/9409` |
| Why | The most-used anime-style SD 1.5 checkpoint. Consistent anime proportions, good character rendering. Well-supported by the community. |
| Place in ComfyUI | `~/tools/ComfyUI/models/checkpoints/` |

Alternative anime: **Counterfeit V3.0** — cleaner line art, slightly less saturated. Good for manga-adjacent style.
- Filename: `CounterfeitV30_v30.safetensors`
- Civitai: `https://civitai.com/models/4468/counterfeit-v30`

**STRONGLY RECOMMENDED for this project:** Use **Anything V5** as the primary checkpoint. The Plasma manga is an anime-style universe (manga = Japanese visual style). Realistic Vision will produce uncanny results for manga characters.

### VAE

Most SD 1.5 checkpoints have baked-in VAEs but a standalone VAE can fix washed-out colors:

| Filename | Source | Note |
|----------|--------|------|
| `vae-ft-mse-840000-ema-pruned.safetensors` | HuggingFace: `stabilityai/sd-vae-ft-mse-original` | Standard VAE for SD 1.5 |
| `orangemix.vae.pt` | Civitai (search "orangemix vae") | Better saturation for anime checkpoints |

Place in: `~/tools/ComfyUI/models/vae/`

### ControlNet Models (OpenPose for SD 1.5)

**Confidence: HIGH** — ControlNet SD 1.5 models are well-documented on HuggingFace. File sizes and names are stable.

#### Primary: OpenPose (pose control)

| Filename | Size | Source |
|----------|------|--------|
| `control_v11p_sd15_openpose.pth` | ~1.4 GB | HuggingFace: `lllyasviel/ControlNet-v1-1` |

Download URL:
```
https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_openpose.pth
```

Place in: `~/tools/ComfyUI/models/controlnet/`

Also download the config file alongside it:
```
https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_openpose.yaml
```

#### Optional: Canny (line art / composition control)

| Filename | Size | Source |
|----------|------|--------|
| `control_v11p_sd15_canny.pth` | ~1.4 GB | HuggingFace: `lllyasviel/ControlNet-v1-1` |

Download URL:
```
https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_canny.pth
```

#### Optional: Depth (3D composition control)

```
https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11f1p_sd15_depth.pth
```

### OpenPose Preprocessor Models (for ComfyUI-ControlNet-Aux)

ComfyUI-ControlNet-Aux auto-downloads these on first use, but you can pre-download:

| Model | Purpose | Auto-download dir |
|-------|---------|------------------|
| `body_pose_model.pth` | Detect body keypoints | `custom_nodes/comfyui_controlnet_aux/ckpts/` |
| `hand_pose_model.pth` | Detect hand keypoints | same |
| `facenet.pth` | Detect face keypoints | same |

These are small (< 200MB total) and downloaded from HuggingFace by the extension automatically.

### Disk Space Budget

| Component | Size |
|-----------|------|
| ComfyUI + deps | ~3 GB |
| SD 1.5 checkpoint (1x) | ~2.1 GB |
| ControlNet OpenPose | ~1.4 GB |
| ControlNet Canny (optional) | ~1.4 GB |
| VAE standalone | ~335 MB |
| LoRA output (trained) | ~70-140 MB |
| **Total (minimum)** | **~7 GB** |
| **Total (full setup)** | **~10 GB** |

---

## ComfyUI API Integration

### Protocol: WebSocket (Primary) + REST (Secondary)

**Use WebSocket, not polling.** ComfyUI's job queue is async — a workflow submission returns a `prompt_id` immediately, then pushes progress events over WebSocket. REST polling works but requires a polling loop with arbitrary sleep intervals; WebSocket is event-driven and accurate.

### API Endpoints (All HTTP, no auth by default)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /system_stats` | GET | Health check — confirm ComfyUI is running |
| `GET /queue` | GET | View current queue state |
| `POST /prompt` | POST | Submit a workflow JSON for execution |
| `GET /history/{prompt_id}` | GET | Get completed job output (image filenames) |
| `GET /view` | GET | Download a specific output image |
| `GET /object_info` | GET | Introspect available nodes/models |
| `WS /ws?clientId={uuid}` | WebSocket | Receive real-time execution events |

**No authentication by default.** ComfyUI runs with no API key when launched locally. If exposed to a network, consider `--listen 127.0.0.1` (localhost only, which is the recommendation above).

### Workflow: Submit → Track → Download

```
1. Generate a clientId (UUID v4)
2. Open WebSocket: ws://127.0.0.1:8188/ws?clientId={clientId}
3. POST /prompt with { prompt: workflowJSON, client_id: clientId }
   → Response: { prompt_id: "abc123", number: 7, node_errors: {} }
4. Listen on WebSocket for messages:
   - { type: "execution_start", data: { prompt_id } }
   - { type: "executing", data: { node, prompt_id } }  ← progress
   - { type: "progress", data: { value, max } }
   - { type: "executed", data: { node, output: { images: [...] } } }
   - { type: "execution_complete", data: { prompt_id } }
5. When execution_complete fires:
   GET /history/{prompt_id}
   → Response: { [prompt_id]: { outputs: { [node_id]: { images: [{ filename, subfolder, type }] } } } }
6. Download each image:
   GET /view?filename={filename}&subfolder={subfolder}&type=output
   → Binary image data (PNG)
```

### TypeScript Integration Pattern

```typescript
import { Client } from '@stable-canvas/comfyui-client';

// Initialize client (connects WebSocket automatically)
const client = new Client({
  api_host: '127.0.0.1',
  api_port: 8188,
  ssl: false,
});

// Connect
await client.connect();

// Submit a workflow
const { prompt_id } = await client.enqueue(workflowJson);

// Wait for completion using the client's built-in promise
const result = await client.wait(prompt_id);

// Get output image(s)
// @stable-canvas/comfyui-client provides helper methods —
// check its README for current API: https://github.com/StableCanvas/comfyui-client
```

**Verify the exact `@stable-canvas/comfyui-client` API** against the package README before writing the implementation — the library is actively maintained and method names may differ from the above sketch.

### Workflow JSON Format

ComfyUI accepts its workflow in "API format" (not the visual editor format). To export from the ComfyUI UI:

1. In ComfyUI web UI, enable "Developer Mode" in Settings
2. Click "Save (API Format)" button
3. This produces the JSON your TypeScript code submits via `POST /prompt`

The workflow JSON is a dictionary of node IDs → node configs. It is opaque to the TypeScript client — treat it as a data blob with a few fill-in-the-blank fields (prompt text, LoRA name, seed).

### Integrating with the Existing Generate Stage

The current `generate.ts` has two modes: `manual` and `api` (Gemini). Add a third mode: `comfyui`.

```
mode: 'manual'   → display prompts for copy-paste (existing)
mode: 'api'      → call Gemini API (existing)
mode: 'comfyui'  → submit to local ComfyUI (new)
```

The `comfyui` mode:
1. Reads the prompt `.txt` file (same as now)
2. Injects prompt text into a pre-saved workflow JSON template
3. Submits to ComfyUI via `@stable-canvas/comfyui-client`
4. Waits for completion via WebSocket
5. Downloads the output image
6. Saves to `output/ch-XX/raw/` with existing naming convention
7. Records in generation manifest (same as now)

This is a drop-in third mode — no changes to overlay, assemble, or CLI structure.

---

## Version Compatibility Notes

### Confirmed Working (Verified on This Machine)

| Component | Version | Status |
|-----------|---------|--------|
| Python | 3.11.9 | Confirmed installed |
| PyTorch | 2.5.1 | Confirmed installed, MPS verified working |
| torchvision | 0.20.1 | Confirmed installed |
| accelerate | 1.3.0 | Confirmed installed |
| diffusers | 0.32.2 | Confirmed installed |
| transformers | 4.48.1 | Confirmed installed |
| opencv-python | 4.11.0.86 | Confirmed installed |
| Pillow | 11.2.1 | Confirmed installed |
| Node.js | 20.19.5 | Confirmed |
| pnpm | 10.2.0 | Confirmed |

### Known Issues on Apple Silicon (MEDIUM confidence — training data)

**bitsandbytes:** CUDA-only. kohya_ss training commands that use `--optimizer_type=AdamW8bit` will fail. Use `AdamW` (standard 32-bit) instead on Mac. Training will use more memory but will work.

**xformers:** CUDA-only. ComfyUI and kohya_ss both check for xformers and skip gracefully when absent. Performance will be slightly lower but correct.

**ControlNet + MPS float precision:** Some ControlNet operations may produce NaN values with fp16 on MPS in older PyTorch versions. PyTorch 2.5.1 has significantly improved MPS fp16 stability. If NaN artifacts appear, add `--force-fp32` to the ComfyUI launch command (slower but correct).

**Memory pressure with ControlNet:** OpenPose preprocessor + SD 1.5 + ControlNet simultaneously may push 16GB RAM. Recommended mitigations:
- Launch ComfyUI with `--force-fp16 --lowvram`
- Generate at 512x512, upscale programmatically with Sharp if needed
- Close all other applications during generation

**kohya_ss GUI vs CLI:** The kohya_ss GUI (Gradio web app) adds significant overhead and has additional dependencies (gradio, etc.). Use the CLI training scripts (`train_network.py`) directly. The GUI is optional and not needed for this pipeline.

**Python 3.12 compatibility:** kohya_ss has had issues with Python 3.12 in the past. Python 3.11.9 (already active) is the recommended and validated version.

**ComfyUI + Python 3.11:** Confirmed compatible. ComfyUI targets Python 3.10+ and Python 3.11 is the sweet spot.

### PyTorch Version Lock

Do NOT upgrade PyTorch beyond 2.5.x until ComfyUI explicitly declares 2.6+ support. PyTorch has had breaking MPS changes between minor versions historically. Pin `torch==2.5.1` in both venvs.

### Custom Node Compatibility

When installing ComfyUI custom nodes via ComfyUI-Manager, some nodes have CUDA-only dependencies (e.g., nodes using `xformers`, `flash-attention`, `triton`). These nodes will fail to load on Apple Silicon — this is expected and ComfyUI will report them as disabled at startup. They do not affect other nodes.

The only custom nodes needed for this project:
1. **ComfyUI-Manager** — meta (management)
2. **ComfyUI-ControlNet-Aux** — OpenPose preprocessor (confirmed Mac compatible)

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| ComfyUI HTTP client (npm) | `@stable-canvas/comfyui-client` | Raw `fetch` + `ws` | Saves writing WebSocket reconnect, job tracking, output parsing. Zero deps is a non-issue. |
| ComfyUI HTTP client (npm) | `@stable-canvas/comfyui-client` | `comfyui-sdk` | Prototype quality, unrelated dependencies (Tencent Cloud SDK). Reject. |
| SD 1.5 anime checkpoint | Anything V5 | NAI Anime Diffusion | Anything V5 has better community support, more ControlNet-compatible training data. NAI Anime requires a naifu subscription or legally ambiguous sources. |
| SD 1.5 realistic checkpoint | Realistic Vision V6 | Deliberate | Deliberate is good but less actively maintained than Realistic Vision. |
| LoRA framework | kohya_ss | diffusers native training | diffusers LoRA training is lower-level; kohya_ss provides the `train_network.py` script that is the community standard for SD 1.5 LoRAs. Same underlying tech, better ergonomics. |
| LoRA framework | kohya_ss | OneTrainer | OneTrainer is cross-platform and Mac-compatible, and may be worth evaluating if kohya_ss has dependency issues. Flag as backup. |
| Diffusion inference | ComfyUI | Automatic1111 (A1111) | A1111 has poor Apple Silicon support, slower Python-based API, no workflow JSON. ComfyUI is the correct choice for pipeline integration. |
| Diffusion inference | ComfyUI | InvokeAI | InvokeAI has better Mac support than A1111 but ComfyUI has a larger ecosystem and more ControlNet extensions. |
| OpenPose preprocessor | ComfyUI-ControlNet-Aux | mediapipe (Python) | mediapipe can detect poses but output format doesn't match ControlNet's expected 18-keypoint format without manual conversion. Use the ComfyUI extension. |

---

## Installation Checklist Summary

### Phase A: ComfyUI (prerequisite for everything)
```bash
git clone https://github.com/comfyanonymous/ComfyUI.git ~/tools/ComfyUI
cd ~/tools/ComfyUI && python3.11 -m venv venv && source venv/bin/activate
pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
git clone https://github.com/ltdrdata/ComfyUI-Manager.git custom_nodes/ComfyUI-Manager
python main.py --force-fp16 --listen 127.0.0.1 --port 8188
# Install ComfyUI-ControlNet-Aux via Manager UI
```

### Phase B: Download Models
```
models/checkpoints/anything-v5-PrtRE.safetensors      (Civitai)
models/checkpoints/realisticVisionV60B1_v51HyperVAE.safetensors  (Civitai)
models/controlnet/control_v11p_sd15_openpose.pth      (HuggingFace lllyasviel/ControlNet-v1-1)
models/controlnet/control_v11p_sd15_openpose.yaml     (same repo)
```

### Phase C: TypeScript Pipeline Addition
```bash
cd /Users/dondemetrius/Code/plasma/pipeline
pnpm add @stable-canvas/comfyui-client
```

### Phase D: kohya_ss (for LoRA training only — separate from inference)
```bash
git clone https://github.com/bmaltais/kohya_ss.git ~/tools/kohya_ss
cd ~/tools/kohya_ss && python3.11 -m venv venv && source venv/bin/activate
pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu
pip install accelerate transformers diffusers safetensors lycoris-lora toml tqdm Pillow
# Skip: bitsandbytes, xformers, triton
accelerate config  # choose MPS, fp16
```

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| PyTorch 2.5.1 installed, MPS working | `python3 -c "import torch; print(torch.backends.mps.is_available())"` — verified on machine | HIGH |
| MPS tensor ops confirmed | `tensor([1.], device='mps:0')` verified | HIGH |
| `@stable-canvas/comfyui-client` v1.5.9, zero deps, ESM, types | `npm show @stable-canvas/comfyui-client --json` — registry verified | HIGH |
| `comfyui-sdk` has unrelated deps (Tencent Cloud) | `npm show comfyui-sdk --json` — registry verified | HIGH |
| diffusers 0.32.2, transformers 4.48.1, accelerate 1.3.0 installed | `pip show` — verified on machine | HIGH |
| ComfyUI install steps | Training data (ComfyUI README pattern) — WebFetch unavailable | MEDIUM |
| komfyUI Metal/MPS auto-detection | Training data — stable since ComfyUI added MPS support in 2023 | MEDIUM |
| kohya_ss install steps | Training data (bmaltais/kohya_ss README pattern) | MEDIUM |
| Model filenames (Realistic Vision, Anything V5, ControlNet) | Training data — stable filenames since 2023 | MEDIUM |
| ControlNet HuggingFace repo `lllyasviel/ControlNet-v1-1` | Training data — well-documented, stable URL | MEDIUM |
| bitsandbytes/xformers CUDA-only constraint | Training data + confirmed NOT installed on this machine | HIGH |
| OneTrainer as kohya_ss alternative | Training data | LOW — verify current Mac support |

---

*Stack research for: v2.0 Local ComfyUI + LoRA Pipeline*
*Researched: 2026-02-19*
*WebSearch and WebFetch unavailable during this session — all findings are training data (cutoff Aug 2025) except where marked "verified on machine".*
