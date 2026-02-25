# Phase 8: Spyke LoRA Training — Research

**Researched:** 2026-02-19
**Domain:** kohya_ss LoRA training on Apple Silicon (MPS), SD 1.5 character LoRA, sd-scripts submodule
**Confidence:** HIGH — key findings verified against live filesystem, accelerate runtime, and official kohya_ss source code

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LORA-01 | Spyke LoRA trained using kohya_ss `train_network.py`, params: network_dim=32, network_alpha=16, resolution=512,512, train_batch_size=1, mixed_precision=fp16, optimizer_type=AdamW. Target 800–1200 steps. | CRITICAL CORRECTION: `mixed_precision=fp16` must become `mixed_precision=no` for MPS — see Pitfall 1. Correct script is `train_network.py` (not sdxl_). Full working command documented. |
| LORA-02 | Checkpoints saved every 200 steps; best-generalizing checkpoint selected as production LoRA. | `--save_every_n_steps=200` confirmed working. File naming pattern: `{output_name}-step{step:08d}.safetensors`. Step math verified: 4 epochs = 920 steps, 5 epochs = 1150 steps. |
| LORA-03 | Trained LoRA `.safetensors` placed in `~/tools/ComfyUI/models/loras/`. | Copy or symlink from kohya output_dir to ComfyUI loras dir. Procedure documented. |
| LORA-04 | MPS verified as active during training (Activity Monitor GPU History shows GPU utilization). | Two-layer verification: (1) accelerate Accelerator() prints device=mps before training, (2) Activity Monitor GPU History during training. Both procedures documented. |
| LORA-05 | Only Spyke LoRA in v2.0. June and Draster LoRAs deferred to v2.1. | Single-character dataset; no action needed beyond confirming this phase only trains Spyke. |
</phase_requirements>

---

## Summary

Phase 8 trains a Spyke character LoRA on Apple Silicon using kohya_ss `train_network.py`. Three critical discoveries shape this phase.

**Discovery 1 — AnythingXL_inkBase is SD 1.5, not SDXL.** Despite the "XL" in the name, filesystem inspection of the safetensors header confirms `cond_stage_model` keys (SD 1.5 architecture), not `conditioner.embedders` keys (SDXL). The file is 2.0 GB — consistent with SD 1.5, not the 6–7 GB of SDXL. This means: use `train_network.py` (not `sdxl_train_network.py`), set `--resolution=512,512` (correct for SD 1.5), and the SDXL memory and complexity concerns do not apply.

**Discovery 2 — sd-scripts submodule is empty.** `~/tools/kohya_ss/sd-scripts/` is an empty directory — the git submodule was not initialized. `train_network.py` does not exist yet. This must be fixed before any training command is run. The fix is a single command: `cd ~/tools/kohya_ss && git submodule update --init --recursive`.

**Discovery 3 — mixed_precision must be "no", not "fp16".** LORA-01 specifies `mixed_precision=fp16`. This cannot work on MPS. The accelerate configuration on this machine is already correctly set to `mixed_precision: no` (verified live). The training command must use `--mixed_precision=no`. The REQUIREMENTS.md note for fp16 reflects a CUDA assumption that does not apply to MPS.

**Primary recommendation:** Fix submodule, write the dataset TOML config, run a 50-step smoke test with MPS verification, then launch the full 4-epoch (920-step) run. Select best-performing checkpoint from saves at steps 200, 400, 600, 800.

---

## Standard Stack

### Core

| Tool | Version (verified) | Purpose | Status |
|------|-------------------|---------|--------|
| `accelerate` | 1.3.0 | Training launch wrapper — handles MPS device routing | Installed in kohya_ss venv |
| `train_network.py` | kohya-ss/sd-scripts @ 3e6935a | The LoRA training script (SD 1.5) | MISSING — submodule empty |
| `kohya_ss` | current git | Parent framework, Python environment | Installed at ~/tools/kohya_ss/ |
| PyTorch | 2.5.1 | MPS tensor operations | Installed in kohya_ss venv |

### Environment Verified

Running `Accelerator()` inside `~/tools/kohya_ss/venv` produces:
```
Device: mps
Mixed precision: no
Num processes: 1
```
MPS is active and accelerate is configured correctly. No changes needed to the Python environment before training.

### AnythingXL_inkBase Architecture Confirmation

| Property | Value | Source |
|----------|-------|--------|
| File size | 2.0 GB | `ls -lh ~/tools/ComfyUI/models/checkpoints/AnythingXL_inkBase.safetensors` |
| Key prefix (first key) | `cond_stage_model.transformer.text_model...` | safetensors header inspection |
| SDXL indicators (`conditioner.embedders`) | NOT FOUND | safetensors header inspection |
| SD 1.5 indicators (`cond_stage_model`) | FOUND | safetensors header inspection |
| Architecture conclusion | **SD 1.5** | HIGH confidence |
| Correct training script | `train_network.py` | Follows from SD 1.5 architecture |
| Correct resolution | `512,512` | SD 1.5 native training resolution |

This fully resolves the SDXL vs SD 1.5 question. The "XL" in the model name is a marketing/series name, not an architecture designation.

---

## Architecture Patterns

### Recommended Project Structure for Phase 8

```
~/tools/kohya_ss/
└── sd-scripts/                    # MUST be populated first (submodule fix)
    └── train_network.py            # The actual training script

/Users/dondemetrius/Code/plasma/
├── dataset/spyke/
│   ├── train/
│   │   └── 10_spyke_plasma_v1/    # 23 images + .txt captions (confirmed exists)
│   └── reg/
│       └── 1_anime_character/     # 100 reg images (confirmed exists)
└── .planning/phases/08-spyke-lora-training/
    └── spyke_lora.toml            # Training config file (must be created)

~/tools/ComfyUI/models/loras/      # Destination for trained LoRA file
```

### Pattern 1: Fix the sd-scripts Submodule (MUST DO FIRST)

The sd-scripts directory is empty. `train_network.py` does not exist. No training command will work until this is fixed.

```bash
cd ~/tools/kohya_ss
git submodule update --init --recursive
```

**Verify the fix:**
```bash
ls ~/tools/kohya_ss/sd-scripts/train_network.py
# Must exist and be a non-empty Python file
```

**Expected output after fix:** The sd-scripts directory will contain `train_network.py`, `sdxl_train_network.py`, the `networks/` module directory, and all supporting library files.

**Why the leading dash in `git submodule status`:** The output `-3e6935a07edcb944407840ef74fcaf6fcad352f7 sd-scripts` shows a dash (-) prefix, which means the submodule is registered in `.gitmodules` and tracked at commit `3e6935a` but the content has never been checked out.

### Pattern 2: Dataset TOML Configuration

kohya_ss `train_network.py` accepts a `--dataset_config` TOML file. This is the recommended approach over passing all flags on the command line. Create this file before training:

```toml
# /Users/dondemetrius/Code/plasma/.planning/phases/08-spyke-lora-training/spyke_lora_dataset.toml
[general]
enable_bucket = true
caption_extension = ".txt"
shuffle_caption = true
keep_tokens = 1

[[datasets]]
resolution = 512
batch_size = 1

  [[datasets.subsets]]
  image_dir = "/Users/dondemetrius/Code/plasma/dataset/spyke/train/10_spyke_plasma_v1"
  num_repeats = 10
  # caption files (.txt) co-located with images; kohya reads them automatically

  [[datasets.subsets]]
  is_reg = true
  image_dir = "/Users/dondemetrius/Code/plasma/dataset/spyke/reg/1_anime_character"
  num_repeats = 1
```

**Notes on TOML fields:**
- `enable_bucket = true` — enables Aspect Ratio Bucketing; for 512×512 square images this is a no-op but keeps the config flexible
- `keep_tokens = 1` — preserves the first token (`spyke_plasma_v1`) from being shuffled to a random position
- `num_repeats` in the TOML overrides the folder name prefix; both are equivalent — include here for explicit documentation
- Regularization subset uses `is_reg = true` — this tells kohya_ss not to apply trigger word learning to reg images

### Pattern 3: Full Training Command (MPS / Apple Silicon)

```bash
# Step 1: Set environment
export PYTORCH_ENABLE_MPS_FALLBACK=1

# Step 2: Activate kohya_ss venv
source ~/tools/kohya_ss/venv/bin/activate

# Step 3: Launch training
accelerate launch \
  --num_cpu_threads_per_process=4 \
  ~/tools/kohya_ss/sd-scripts/train_network.py \
  --pretrained_model_name_or_path="~/tools/ComfyUI/models/checkpoints/AnythingXL_inkBase.safetensors" \
  --dataset_config="/Users/dondemetrius/Code/plasma/.planning/phases/08-spyke-lora-training/spyke_lora_dataset.toml" \
  --output_dir="/Users/dondemetrius/Code/plasma/output/loras/spyke/" \
  --output_name="spyke_plasma_v1" \
  --save_model_as="safetensors" \
  --save_every_n_steps=200 \
  --max_train_epochs=4 \
  --learning_rate=1e-4 \
  --unet_lr=1e-4 \
  --text_encoder_lr=5e-5 \
  --lr_scheduler="cosine" \
  --lr_warmup_steps=0 \
  --network_module="networks.lora" \
  --network_dim=32 \
  --network_alpha=16 \
  --mixed_precision="no" \
  --save_precision="float" \
  --optimizer_type="AdamW" \
  --no_half_vae \
  --clip_skip=2 \
  --prior_loss_weight=1.0 \
  --max_data_loader_n_workers=1 \
  --persistent_data_loader_workers \
  --gradient_checkpointing \
  --seed=42
```

**Parameter rationale:**
- `--max_train_epochs=4` — yields 4 × 230 = 920 steps (within 800–1200 target)
- `--mixed_precision="no"` — REQUIRED for MPS; fp16 crashes
- `--save_precision="float"` — saves as fp32; more compatible for inspection, fine for SD 1.5 LoRA
- `--optimizer_type="AdamW"` — standard AdamW, works on MPS; AdamW8bit requires bitsandbytes (CUDA only)
- `--no_half_vae` — prevents NaN loss from half-precision VAE on MPS
- `--gradient_checkpointing` — reduces peak memory on 16GB unified
- `--clip_skip=2` — standard for anime-style models (Anything series)
- `--network_module="networks.lora"` — standard LoRA, not LyCORIS
- `--prior_loss_weight=1.0` — standard for DreamBooth-style training with regularization images
- `--seed=42` — ensures reproducibility for debugging
- Do NOT include `--flip_aug` — Spyke's asymmetric costume makes flip augmentation destructive (from Phase 6 research)

### Pattern 4: Smoke Test (5-Step MPS Verification Run)

Run before committing to a full 920-step training run. This confirms MPS is active and the command syntax is correct without waiting 70+ minutes.

```bash
export PYTORCH_ENABLE_MPS_FALLBACK=1
source ~/tools/kohya_ss/venv/bin/activate

accelerate launch \
  --num_cpu_threads_per_process=4 \
  ~/tools/kohya_ss/sd-scripts/train_network.py \
  --pretrained_model_name_or_path="~/tools/ComfyUI/models/checkpoints/AnythingXL_inkBase.safetensors" \
  --dataset_config="/Users/dondemetrius/Code/plasma/.planning/phases/08-spyke-lora-training/spyke_lora_dataset.toml" \
  --output_dir="/tmp/spyke_smoke_test/" \
  --output_name="smoke_test" \
  --save_model_as="safetensors" \
  --max_train_steps=5 \
  --learning_rate=1e-4 \
  --network_module="networks.lora" \
  --network_dim=32 \
  --network_alpha=16 \
  --mixed_precision="no" \
  --save_precision="float" \
  --optimizer_type="AdamW" \
  --no_half_vae \
  --gradient_checkpointing \
  --seed=42
```

**What to observe during the smoke test:**
1. First printed lines should show `accelerate.state - Accelerator state: DistributedType.NO ... MPS` or `mps:0` — confirms device routing
2. No `ValueError: fp16 mixed precision requires a GPU` — confirms mixed_precision is correct
3. No `AssertionError` or `aten::...` not implemented errors — if they appear, `PYTORCH_ENABLE_MPS_FALLBACK=1` should handle them; if not, log and investigate
4. `loss:` value appears in stdout and decreases (or at least is finite, not NaN)
5. Activity Monitor → GPU History shows non-zero GPU utilization during the run

### Pattern 5: MPS Verification Procedure (LORA-04)

Two verification methods, use both:

**Method 1: Python device check (pre-training)**
```bash
source ~/tools/kohya_ss/venv/bin/activate
export PYTORCH_ENABLE_MPS_FALLBACK=1
python3 -c "
import torch
from accelerate import Accelerator
print('MPS available:', torch.backends.mps.is_available())
a = Accelerator()
print('Accelerator device:', a.device)
print('Mixed precision:', a.mixed_precision)
"
# Expected:
# MPS available: True
# Accelerator device: mps
# Mixed precision: no
```

**Method 2: Activity Monitor (during training)**
1. Open Activity Monitor.app
2. Click Window menu → GPU History (or press Cmd+4)
3. Start the training command
4. Within 10–20 seconds, the GPU panel should show non-zero utilization
5. Take a screenshot as documentation (satisfies LORA-04 "Activity Monitor GPU History shows GPU utilization")

**PYTORCH_ENABLE_MPS_FALLBACK behavior:** This env var allows PyTorch operations not yet implemented in MPS to fall back to CPU silently. Without it, unsupported ops raise a runtime error. It does NOT switch all ops to CPU — only unsupported ones. The training will still use MPS for the supported operations (most of the matrix math). Training time on MPS with MPS_FALLBACK is slower than pure CUDA but faster than pure CPU.

### Pattern 6: Output File Naming and Checkpoint Selection

When using `--save_every_n_steps=200` and `--output_name="spyke_plasma_v1"`:

| Step | Filename |
|------|----------|
| 200 | `spyke_plasma_v1-step00000200.safetensors` |
| 400 | `spyke_plasma_v1-step00000400.safetensors` |
| 600 | `spyke_plasma_v1-step00000600.safetensors` |
| 800 | `spyke_plasma_v1-step00000800.safetensors` |
| End (920) | `spyke_plasma_v1.safetensors` (final, no step suffix) |

Source: `kohya-ss/sd-scripts/library/train_util.py` defines:
```python
STEP_FILE_NAME = "{}-step{:08d}"    # zero-padded 8-digit step number
```

**Checkpoint selection strategy (LORA-02):**
Test each checkpoint by loading it in ComfyUI and generating 3–5 images with the trigger word at different CFG values (5, 7, 9). Evaluate:
- Does Spyke's ginger hair color appear?
- Does the white cloak appear?
- Does the right bracer appear on the correct side?
- Is the artstyle consistent with the training images?

Earlier checkpoints (step 200-400) are often under-trained; later checkpoints (step 800+) may overfit. The "sweet spot" is typically 50–70% through the training run. Select the checkpoint that best generalizes.

### Pattern 7: Deploying to ComfyUI

After selecting the best checkpoint:

```bash
# Copy to ComfyUI loras directory
mkdir -p ~/tools/ComfyUI/models/loras/
cp /Users/dondemetrius/Code/plasma/output/loras/spyke/spyke_plasma_v1-step00000600.safetensors \
   ~/tools/ComfyUI/models/loras/spyke_plasma_v1.safetensors

# Verify
ls -lh ~/tools/ComfyUI/models/loras/spyke_plasma_v1.safetensors
```

The LoRA file name used for inference in ComfyUI workflows is the filename without extension: `spyke_plasma_v1`.

### Anti-Patterns to Avoid

- **Using `sdxl_train_network.py`:** AnythingXL_inkBase is SD 1.5 (verified via header inspection). The SDXL script will fail on this model's architecture.
- **Using `--mixed_precision=fp16`:** Crashes with `ValueError: fp16 mixed precision requires a GPU (not 'mps')`. Use `--mixed_precision=no`.
- **Using `--flip_aug`:** Destroys Spyke's asymmetric costume. Pre-flipped images are already in the dataset as explicit files.
- **Using `--optimizer_type=AdamW8bit`:** Requires bitsandbytes (CUDA only); will import-error on MPS.
- **Running train_network.py before submodule fix:** The file does not exist — the command silently fails or errors on path.
- **Using max_resolution="1024,1024":** SD 1.5 base model; correct resolution is 512,512.
- **Omitting `PYTORCH_ENABLE_MPS_FALLBACK=1`:** Training may crash on an unsupported MPS op.
- **Omitting `--no_half_vae`:** Half-precision VAE on MPS can produce NaN loss values.
- **Training with ComfyUI running simultaneously:** GPU memory contention on 16GB unified memory. Both should not run at the same time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LoRA training loop | Custom PyTorch training script | kohya_ss `train_network.py` | Handles bucketing, caption loading, noise prediction, regularization loss weighting, checkpoint saving — enormous surface area |
| MPS device routing | Manual `device = torch.device('mps')` in custom code | `accelerate launch + Accelerator()` | accelerate handles MPS detection, fallback env, and multi-process concerns automatically |
| Checkpoint naming and saving | Custom checkpoint save logic | kohya_ss built-in `save_every_n_steps` | File naming, safetensors serialization, and state tracking are handled; custom code duplicates this with likely bugs |
| Training progress monitoring | Custom loss tracking script | kohya_ss stdout loss output | `train_network.py` logs `loss:` to stdout every step; no additional tooling needed for monitoring |

---

## Common Pitfalls

### Pitfall 1: `mixed_precision=fp16` Crashes Training on MPS

**What goes wrong:** Training fails immediately with:
```
ValueError: fp16 mixed precision requires a GPU (not 'mps')
```
**Why it happens:** LORA-01 in REQUIREMENTS.md specifies `mixed_precision=fp16`. This was written with CUDA in mind. PyTorch's AMP autocast framework does not support `mps` as a device for mixed precision training — `mps` is treated as "not a GPU" by the autocast path.

**How to avoid:** Always use `--mixed_precision=no` in the training command. The accelerate config on this machine is already set to `mixed_precision: no` (verified). Passing `--mixed_precision=no` in the CLI command overrides if the config ever changes.

**Note on LORA-01 spec:** The requirement says `mixed_precision=fp16` — this is incorrect for MPS. The planner MUST use `mixed_precision=no` instead. This is not optional — fp16 will not train.

### Pitfall 2: train_network.py Does Not Exist (Submodule Not Initialized)

**What goes wrong:** The command `accelerate launch .../train_network.py` fails with:
```
FileNotFoundError: .../sd-scripts/train_network.py
```
or silently exits if the path is interpreted differently.

**Why it happens:** `~/tools/kohya_ss/sd-scripts/` is an empty directory. The training scripts live in the kohya-ss/sd-scripts submodule which was never checked out.

**How to fix:**
```bash
cd ~/tools/kohya_ss
git submodule update --init --recursive
ls sd-scripts/train_network.py  # Must show the file
```

**This is the first task in Phase 8.** Nothing else can proceed until this is done.

### Pitfall 3: NaN Loss from Half-Precision VAE

**What goes wrong:** Training appears to start but loss immediately becomes `nan` and stays there. The LoRA trains on noise, not content.

**Why it happens:** On MPS, half-precision VAE operations can produce NaN outputs in certain numerical edge cases. This is a known MPS numerical stability issue.

**How to avoid:** Pass `--no_half_vae` in the training command. Confirmed as necessary by the Mac training reference discussion on GitHub and the ReallyAR training guide.

**Warning signs:** Loss is `nan` from step 1 or becomes `nan` after a few steps. NaN loss means the LoRA is learning nothing.

### Pitfall 4: Suboptimal Checkpoint Selected (Overfitting vs. Under-training)

**What goes wrong:** The final-step checkpoint (step 920) is used as the production LoRA, but it overfits — it only generates images that look exactly like the training set, failing to generalize to new poses/prompts.

**Why it happens:** Small dataset (23 images) + many steps = potential overfit at the end. Earlier checkpoints often generalize better.

**How to avoid:** Test all saved checkpoints (200, 400, 600, 800, 920) with diverse prompts before selecting. LORA-02 explicitly requires this — "best-generalizing checkpoint selected as production LoRA — not necessarily the final step."

**Selection test prompts to use:**
```
# Test 1: Trigger word only
spyke_plasma_v1, standing in a forest, dramatic lighting, anime style

# Test 2: Novel pose not in training set
spyke_plasma_v1, crouching, looking up, urban environment

# Test 3: Consistency check — asymmetric details
spyke_plasma_v1, full body, front view, detailed character study
```

### Pitfall 5: GPU Memory Exhausted Mid-Training

**What goes wrong:** Training crashes partway through with a memory error on Apple Silicon (unified memory).

**Why it happens:** 16GB shared between system and GPU. SD 1.5 model load (~2GB), LoRA training overhead, and batch processing together can push limits.

**How to avoid:**
- Use `--gradient_checkpointing` (already in recommended command — halves activation memory at cost of ~30% slower training)
- `train_batch_size=1` (already specified in LORA-01)
- Close ComfyUI and other GPU-intensive apps before training
- Close browser tabs that use GPU (GPU-accelerated video, WebGL)

**If it still crashes:** Add `--cache_latents` to pre-compute and cache VAE outputs, reducing repeated VAE memory usage. Note: `cache_latents` cannot be used with `color_aug` or `flip_aug`.

### Pitfall 6: PYTORCH_ENABLE_MPS_FALLBACK Not Set

**What goes wrong:** Training crashes mid-step with errors like:
```
RuntimeError: MPS backend out of memory (MPS allocated: X, other allocations: Y)
```
or
```
NotImplementedError: The operator 'aten::some_op' is not currently supported on the MPS backend.
```

**Why it happens:** Some PyTorch operations used in training are not implemented in the MPS kernel. Without the fallback env var, these raise errors instead of silently falling back to CPU.

**How to avoid:** Always set `export PYTORCH_ENABLE_MPS_FALLBACK=1` before launching training.

---

## Code Examples

### Minimal Viable Training Command (MPS — Confirmed Pattern)

```bash
# Source: GitHub Discussion #1185, ReallyAR guide — verified against Phase 5 research
export PYTORCH_ENABLE_MPS_FALLBACK=1
source ~/tools/kohya_ss/venv/bin/activate

accelerate launch \
  --num_cpu_threads_per_process=4 \
  ~/tools/kohya_ss/sd-scripts/train_network.py \
  --pretrained_model_name_or_path="~/tools/ComfyUI/models/checkpoints/AnythingXL_inkBase.safetensors" \
  --dataset_config="/Users/dondemetrius/Code/plasma/.planning/phases/08-spyke-lora-training/spyke_lora_dataset.toml" \
  --output_dir="/Users/dondemetrius/Code/plasma/output/loras/spyke/" \
  --output_name="spyke_plasma_v1" \
  --save_model_as="safetensors" \
  --save_every_n_steps=200 \
  --max_train_epochs=4 \
  --learning_rate=1e-4 \
  --network_module="networks.lora" \
  --network_dim=32 \
  --network_alpha=16 \
  --mixed_precision="no" \
  --save_precision="float" \
  --optimizer_type="AdamW" \
  --no_half_vae \
  --clip_skip=2 \
  --prior_loss_weight=1.0 \
  --max_data_loader_n_workers=1 \
  --gradient_checkpointing \
  --seed=42
```

### Step Math Verification

```
Dataset: 23 training images × 10 repeats = 230 images per epoch
Batch size: 1
Steps per epoch: 230 / 1 = 230 steps

Target: 800–1200 steps

4 epochs: 4 × 230 = 920 steps  ← RECOMMENDED (within target range)
5 epochs: 5 × 230 = 1150 steps ← ALTERNATIVE (upper bound of range)

Checkpoint saves with save_every_n_steps=200 at 4 epochs:
  Step 200 → spyke_plasma_v1-step00000200.safetensors
  Step 400 → spyke_plasma_v1-step00000400.safetensors
  Step 600 → spyke_plasma_v1-step00000600.safetensors
  Step 800 → spyke_plasma_v1-step00000800.safetensors
  Step 920 → spyke_plasma_v1.safetensors (final)
```

### MPS Active Verification

```bash
# Source: Phase 5 research + live verification on this machine
source ~/tools/kohya_ss/venv/bin/activate
export PYTORCH_ENABLE_MPS_FALLBACK=1

python3 -c "
import torch
from accelerate import Accelerator

print('PyTorch version:', torch.__version__)
print('MPS available:', torch.backends.mps.is_available())
print('MPS built:', torch.backends.mps.is_built())

a = Accelerator()
print('Accelerator device:', a.device)
print('Mixed precision:', a.mixed_precision)
"

# Confirmed output on this machine:
# PyTorch version: 2.5.1
# MPS available: True
# MPS built: True
# Accelerator device: mps
# Mixed precision: no
```

### Submodule Fix and Verification

```bash
# Fix the empty sd-scripts submodule
cd ~/tools/kohya_ss
git submodule update --init --recursive

# Verify train_network.py now exists
ls -la ~/tools/kohya_ss/sd-scripts/train_network.py

# Verify the networks module (required for --network_module=networks.lora)
ls ~/tools/kohya_ss/sd-scripts/networks/lora.py
```

### Dataset TOML Config (Complete)

```toml
# Save as: /Users/dondemetrius/Code/plasma/.planning/phases/08-spyke-lora-training/spyke_lora_dataset.toml

[general]
enable_bucket = true
caption_extension = ".txt"
shuffle_caption = true
keep_tokens = 1

[[datasets]]
resolution = 512
batch_size = 1

  [[datasets.subsets]]
  image_dir = "/Users/dondemetrius/Code/plasma/dataset/spyke/train/10_spyke_plasma_v1"
  num_repeats = 10

  [[datasets.subsets]]
  is_reg = true
  image_dir = "/Users/dondemetrius/Code/plasma/dataset/spyke/reg/1_anime_character"
  num_repeats = 1
```

---

## Step Count Calculation (LORA-01/LORA-02)

| Variable | Value | Source |
|----------|-------|--------|
| Training images | 23 | `ls dataset/spyke/train/10_spyke_plasma_v1/*.png \| wc -l` |
| Repeats per epoch | 10 | Folder prefix `10_spyke_plasma_v1` |
| Batch size | 1 | LORA-01 requirement |
| Steps per epoch | 230 | 23 × 10 / 1 |
| Target steps | 800–1200 | LORA-01 requirement |
| Recommended epochs | 4 | 4 × 230 = 920 steps |
| Alternative | 5 epochs | 5 × 230 = 1150 steps |
| Checkpoints at step | 200, 400, 600, 800 | save_every_n_steps=200 × 4 epochs |

**Important:** The 23 images include 8 horizontal flips of asymmetric-safe poses. These were pre-generated in Phase 6 as discrete files. Do NOT also pass `--flip_aug` — that would additionally flip ALL images at training time, including the ones that should not be flipped.

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 8 |
|--------------|------------------|--------------------|
| Full fine-tune (DreamBooth, modify whole model) | LoRA (adapter only, ~50MB) | LoRA is the correct tool; lower VRAM, faster to train, swappable |
| AdamW8bit (CUDA default) | AdamW (standard) on MPS | AdamW8bit requires bitsandbytes (CUDA only); AdamW is correct for MPS |
| fp16 mixed precision | `mixed_precision=no` on MPS | fp16 via AMP autocast is not supported on MPS device; no mixed precision is the only option |
| CUDA-centric training guides | MPS-aware config | PYTORCH_ENABLE_MPS_FALLBACK, no_half_vae, mixed_precision=no are the Apple Silicon differences |
| Manual CLI flags | TOML dataset config + CLI for training params | TOML is cleaner for dataset config; CLI args are fine for training hyperparameters |

**Deprecated for this setup:**
- `--xformers` — CUDA only, do not pass
- `--fp8_base` — experimental, not needed for SD 1.5
- `--wandb_api_key` — not needed for single-run offline training
- `sdxl_cache_text_encoder_outputs` — SDXL only, not applicable

---

## Open Questions

1. **Training time estimate on M1 Pro**
   - What we know: Community report on M2 with 32GB RAM + 11 images + 4400 steps took ~70 minutes. The reallyar.com guide shows similar patterns.
   - What's unclear: Exact time on M1 Pro (16GB) for 230 steps/epoch × 4 epochs = 920 steps with batch_size=1
   - Estimate: At ~1–2 sec/step on M1 Pro, 920 steps ≈ 15–30 minutes. Confirm with the smoke test (5 steps) to time 1 step.
   - Recommendation: Plan for up to 60 minutes to account for MPS fallback overhead on unsupported ops.

2. **network_train_unet_only flag**
   - What we know: The SDXL official docs recommend `--network_train_unet_only` for SDXL (dual text encoders). For SD 1.5, this is less critical.
   - What's unclear: Whether training both UNet and text encoder is better or worse for character LoRA on SD 1.5
   - Recommendation: Do not add `--network_train_unet_only` for the first run. If character features are not captured well, add it for a second attempt.

3. **cache_latents impact on MPS**
   - What we know: `--cache_latents` pre-computes VAE encodings and saves them to disk, reducing per-step VAE memory usage
   - What's unclear: Whether it interacts with MPS in any unexpected way
   - Recommendation: Omit for first run. Add if memory errors occur. Note: `cache_latents` disables `color_aug` and `flip_aug` (already disabled).

4. **Clip skip setting for AnythingXL_inkBase**
   - What we know: Anime-style SD 1.5 models typically use `clip_skip=2`. The model name suggests it's from the Anything anime series.
   - What's unclear: The inkBase variant may have different optimal clip_skip
   - Recommendation: Start with `--clip_skip=2` (standard for Anything series). If visual results are poor, try clip_skip=1.

---

## Sources

### Primary (HIGH confidence)

- Live filesystem inspection — `~/tools/ComfyUI/models/checkpoints/AnythingXL_inkBase.safetensors` — 2.0 GB file, `cond_stage_model.*` keys confirmed (SD 1.5 architecture), `conditioner.embedders.*` keys absent (not SDXL)
- Live runtime verification — `accelerate` v1.3.0 in `~/tools/kohya_ss/venv`, `Accelerator()` prints `device: mps`, `mixed_precision: no`
- Live filesystem inspection — `~/tools/kohya_ss/sd-scripts/` is empty (leading `-` in `git submodule status` confirms not initialized)
- `github.com/kohya-ss/sd-scripts/blob/main/library/train_util.py` — `STEP_FILE_NAME = "{}-step{:08d}"` — checkpoint naming format confirmed
- `~/tools/kohya_ss/kohya_gui/lora_gui.py` — `if sdxl: run_cmd.append(".../sdxl_train_network.py") ... else: run_cmd.append(".../train_network.py")` — SD 1.5 uses `train_network.py`, SDXL uses `sdxl_train_network.py`
- Phase 5 research — `mixed_precision: no` for MPS confirmed via multiple sources; this machine's accelerate config already set correctly
- `~/tools/kohya_ss/docs/image_folder_structure.md` — `{N}_{class_token}` folder naming confirmed
- `~/tools/kohya_ss/docs/train_README.md` — TOML dataset config format with `[[datasets.subsets]]` and `is_reg = true` confirmed

### Secondary (MEDIUM confidence)

- `github.com/bmaltais/kohya_ss/discussions/1185` — Mac training working command: `accelerate launch --num_cpu_threads_per_process=10 train_network.py --mixed_precision=no --save_precision=float --optimizer_type=AdamW --no_half_vae`; M2 with 11 images + 4400 steps ≈ 70 min
- `reallyar.com` training guide — full accelerate launch command for Apple Silicon confirmed: `--mixed_precision=no`, `--optimizer_type=AdamW`, warning that `AdamW8bit` and `fp16` don't work on Mac
- `github.com/kohya-ss/sd-scripts/blob/main/docs/train_SDXL-en.md` — confirmed `sdxl_train_network.py` is required for SDXL, `train_network.py` is SD 1.5 — validates the script selection logic
- `huggingface.co/docs/accelerate/usage_guides/mps` — accelerate MPS: enabled by default on macOS, `mixed_precision: no` is the correct setting

### Tertiary (LOW confidence — flag for validation)

- M1 Pro training time estimate (15–30 minutes) — extrapolated from M2 community report; actual time unknown until smoke test
- `clip_skip=2` for AnythingXL_inkBase — based on Anything series convention; specific value for inkBase variant not verified
- Step 600 as likely "sweet spot" for checkpoint selection — based on general LoRA training community heuristics for 20-image datasets; requires empirical testing per this specific dataset

---

## Metadata

**Confidence breakdown:**
- AnythingXL_inkBase is SD 1.5: HIGH — verified via safetensors header inspection and file size
- Correct script is `train_network.py` (not sdxl_): HIGH — follows directly from SD 1.5 confirmation
- `resolution=512,512` is correct: HIGH — SD 1.5 native resolution; all training images confirmed 512×512
- sd-scripts submodule is empty: HIGH — verified via `git submodule status` and `ls sd-scripts/`
- MPS is active and correctly configured: HIGH — live `Accelerator()` test shows `device: mps`
- `mixed_precision=no` required (not fp16): HIGH — confirmed by accelerate config, multiple sources, Phase 5 research
- Checkpoint filename format: HIGH — confirmed from `train_util.py` source code
- Step count math: HIGH — 23 images × 10 repeats / 1 batch = 230 steps/epoch, verified by formula
- Training time estimate: LOW — extrapolated from M2 community report, unverified on this M1 Pro

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (30 days) — kohya_ss and PyTorch/MPS change frequently; re-verify if PyTorch version is upgraded beyond 2.5.1 or kohya_ss is updated before training
