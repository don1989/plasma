# Features Research: ComfyUI + LoRA Pipeline

**Domain:** Local ComfyUI + SD 1.5 inference pipeline for manga character generation
**Researched:** 2026-02-19
**Milestone:** v2.0 — Replacing Gemini generate stage with local ComfyUI + LoRA stack
**Confidence:** MEDIUM — ComfyUI node architecture, LoRA loading, and ControlNet wiring are
well-established as of training cutoff (August 2025). Node class names may shift across ComfyUI
versions; verify against running ComfyUI instance. kohya_ss training parameters are HIGH confidence
based on widely-documented SD 1.5 LoRA training practices.

> **Note on research conditions:** WebSearch and WebFetch were blocked during this session.
> Findings are based on training knowledge of ComfyUI's documented node graph architecture,
> the kohya_ss training toolkit, and community-standard wrapper patterns. Confidence levels
> are assigned conservatively. All node class names should be verified against the ComfyUI
> node list (`GET /object_info`) on first run.

---

## Context: What Exists vs What's New

**Already built (v1.0 — do not re-research):**
- Script parsing, panel extraction, character fingerprint system
- Gemini API image generation + manual import workflow
- Dialogue overlay (SVG balloons), Webtoon strip assembly
- Manifest/versioning system (`generation-log.json`)

**What v2.0 adds (scope of this research):**
- ComfyUI inference server running locally (Metal/MPS on M1 Pro)
- img2img workflow with ControlNet OpenPose pose conditioning
- LoRA training via kohya_ss on character reference images
- Seed locking for panel reproducibility
- Model preset switching (anime vs realistic checkpoints)
- TypeScript Express service wrapping ComfyUI with job management API
- Auto-caption generation for LoRA training dataset preparation

---

## Inference Features

### 1. txt2img — Baseline Workflow

**What it is:** Generate an image from a text prompt only, no input image.

**ComfyUI workflow JSON structure (simplified):**
```json
{
  "1": { "class_type": "CheckpointLoaderSimple",
         "inputs": { "ckpt_name": "dreamshaper_8.safetensors" } },
  "2": { "class_type": "CLIPTextEncode",
         "inputs": { "text": "...(positive prompt)...", "clip": ["1", 1] } },
  "3": { "class_type": "CLIPTextEncode",
         "inputs": { "text": "...(negative prompt)...", "clip": ["1", 1] } },
  "4": { "class_type": "EmptyLatentImage",
         "inputs": { "width": 512, "height": 768, "batch_size": 1 } },
  "5": { "class_type": "KSampler",
         "inputs": {
           "model":           ["1", 0],
           "positive":        ["2", 0],
           "negative":        ["3", 0],
           "latent_image":    ["4", 0],
           "seed":            42,
           "steps":           20,
           "cfg":             7.0,
           "sampler_name":    "euler_ancestral",
           "scheduler":       "karras",
           "denoise":         1.0
         }
  },
  "6": { "class_type": "VAEDecode",
         "inputs": { "samples": ["5", 0], "vae": ["1", 2] } },
  "7": { "class_type": "SaveImage",
         "inputs": { "images": ["6", 0], "filename_prefix": "ch01_p003" } }
}
```

**Key nodes for txt2img:**
| Node | Class Type | Purpose |
|------|------------|---------|
| Checkpoint loader | `CheckpointLoaderSimple` | Load model, CLIP, VAE as tuple |
| Positive CLIP encode | `CLIPTextEncode` | Encode positive prompt to conditioning |
| Negative CLIP encode | `CLIPTextEncode` | Encode negative prompt to conditioning |
| Empty latent | `EmptyLatentImage` | Create blank noise tensor at target resolution |
| KSampler | `KSampler` | Denoise: runs diffusion loop, produces latent |
| VAE decode | `VAEDecode` | Latent → pixel image |
| Save image | `SaveImage` | Write PNG to ComfyUI output dir |

**Complexity:** LOW — this is the base workflow; all other workflows extend it.

---

### 2. img2img — What Changes vs txt2img

**What it is:** Start from an existing image (partially denoised) instead of pure noise. Used for pose-guided generation or style transfer.

**The single difference from txt2img:** Replace `EmptyLatentImage` with `LoadImage` + `VAEEncode`.

```json
{
  "8": { "class_type": "LoadImage",
         "inputs": { "image": "pose_reference.png", "upload": "image" } },
  "9": { "class_type": "VAEEncode",
         "inputs": { "pixels": ["8", 0], "vae": ["1", 2] } }
}
```

Then in KSampler, wire `latent_image: ["9", 0]` instead of `["4", 0]`.

**Denoising strength** is the `denoise` parameter on KSampler (0.0–1.0):
- `1.0` = pure noise, ignores input image content entirely (same as txt2img)
- `0.75` = moderate influence from input image; good for pose-guided re-drawing
- `0.5` = strong image preservation, only style/detail changes
- `0.3–0.4` = image is barely changed; subtle style transfer

**For pose conditioning on character panels:** Use `denoise: 0.65–0.80`. Lower values preserve the reference pose shape; higher values give the model more creative freedom to interpret the prompt.

**Practical use in this pipeline:** When generating a panel where Spyke is in a known pose (e.g., an action pose from ControlNet skeleton), provide a rough pose sketch or previous panel as the `img2img` source. This constrains the spatial composition while the LoRA handles character appearance.

**Complexity:** LOW — 2 additional nodes, one parameter change in KSampler.

---

### 3. ControlNet OpenPose — Wiring Pose Conditioning

**What it is:** An auxiliary neural network that conditions image generation on structural information (skeleton/pose) extracted from a reference image. Uses a separate ControlNet model file.

**How it works:**
1. A pose reference image (real photo, 3D render, or stick figure) is passed through a preprocessor that extracts the OpenPose skeleton (JSON with 18 body keypoints).
2. The skeleton is then passed to the ControlNet model at inference time alongside the main diffusion model.
3. The generated image respects the extracted pose layout regardless of what the text prompt says about position.

**Node graph for ControlNet OpenPose:**

```json
{
  "10": { "class_type": "LoadImage",
          "inputs": { "image": "pose_reference.png" } },
  "11": { "class_type": "OpenposePreprocessor",
          "inputs": {
            "image":        ["10", 0],
            "detect_hand":  "enable",
            "detect_body":  "enable",
            "detect_face":  "disable",
            "resolution":   512
          }},
  "12": { "class_type": "ControlNetLoader",
          "inputs": { "control_net_name": "control_v11p_sd15_openpose.pth" } },
  "13": { "class_type": "ControlNetApply",
          "inputs": {
            "conditioning":    ["2", 0],
            "control_net":     ["12", 0],
            "image":           ["11", 0],
            "strength":        0.8
          }}
}
```

Wire `["13", 0]` as the `positive` input to KSampler instead of `["2", 0]`.

**Key parameters:**
| Parameter | Typical Value | Notes |
|-----------|---------------|-------|
| `strength` | 0.6–0.9 | How tightly to follow the pose. >0.9 can cause artifacts. 0.7–0.8 is the sweet spot for anime characters. |
| `resolution` | 512 | Should match model's training resolution (SD 1.5 = 512). |

**ControlNet model required:** `control_v11p_sd15_openpose.pth` (the `v1.1` series for SD 1.5). File goes in `ComfyUI/models/controlnet/`.

**Preprocessor node class name:** `OpenposePreprocessor` is provided by the `comfyui_controlnet_aux` custom node pack (not built into ComfyUI base). This is the standard community extension for ControlNet preprocessing.

**Pose source options for this pipeline:**
1. **Manual stick figure:** Draw a rough skeleton in any tool, export as PNG. Preprocessor extracts keypoints.
2. **Reference panel reuse:** Take a previously approved panel as pose reference, run through preprocessor. Good for maintaining Spyke's fight stance across sequential panels.
3. **3D pose tool output:** Tools like OpenPose Editor (ComfyUI custom node) or PoseMyArt export pose skeleton images directly.

**Complexity:** MEDIUM — requires installing `comfyui_controlnet_aux` custom nodes and downloading the ControlNet model file (~1.4GB). Node wiring is straightforward once files are in place.

---

## Training Features

### 4. LoRA Training via kohya_ss

**What it is:** LoRA (Low-Rank Adaptation) is a technique that fine-tunes a small adapter matrix on top of a frozen base model. The result is a `.safetensors` file (~10–150MB) that, when applied at inference, biases the model toward the training images.

**For this pipeline:** Train a LoRA on images of Spyke so that `<spyke>` trigger word reliably produces his exact appearance (white cloak, asymmetric gloves, ginger hair) regardless of prompt variation.

**The training pipeline:**

```
Reference images → Caption each image → Organize into dataset dirs → Run kohya_ss training → Output .safetensors
```

**Dataset directory structure for kohya_ss:**
```
lora_dataset/
└── 10_spyke/          ← "<repeats>_<trigger-word>"
    ├── Spyke_Final_crop_01.png
    ├── Spyke_Final_crop_01.txt    ← caption file
    ├── Spyke_Final_crop_02.png
    ├── Spyke_Final_crop_02.txt
    └── ...
```

The directory prefix `10_` means each image repeats 10 times per epoch. This compensates for having very few training images.

**Core training parameters for SD 1.5 LoRA on M1 Pro:**
| Parameter | Recommended Value | Notes |
|-----------|-------------------|-------|
| `network_dim` (rank) | 32 | 16 is minimal; 64 gives higher quality but larger file |
| `network_alpha` | 16 | Usually half of `network_dim` |
| `learning_rate` | 1e-4 | Standard starting point for LoRA |
| `lr_scheduler` | cosine_with_restarts | Smooth decay |
| `max_train_steps` | 500–1000 | With 5 images at 10 repeats × 10 epochs = ~500 steps |
| `train_batch_size` | 1 | M1 Pro 16GB: batch size 1 only |
| `resolution` | 512 | Match SD 1.5 training resolution |
| `mixed_precision` | fp16 | Use `bf16` on Apple Silicon if supported |
| `optimizer` | AdamW or Prodigy | Prodigy is self-tuning; good when unsure of LR |
| `base_model` | dreamshaper_8.safetensors | Use same checkpoint as inference |

**M1 Pro notes:**
- kohya_ss supports Metal/MPS backend but support has been variable. As of mid-2025, `--device mps` works for training but is 2–5x slower than CUDA. Expect 30–90 minutes for 500 steps with a single reference image.
- `--xformers` is CUDA-only; skip it on Apple Silicon
- Recommend using `accelerate` config set to `mps` device type

**Complexity:** HIGH — setup requires Python environment separate from the TypeScript pipeline, managing PyTorch/MPS compatibility, and the quality of output depends heavily on dataset size and captioning quality.

---

### 5. Dataset Preparation: Image Captioning

**What it is:** Each training image needs a `.txt` caption file that describes the image without describing the unique character features you want the LoRA to learn. The LoRA learns what's unique from visual patterns; the caption helps it learn context (e.g., "standing pose, white background" vs "action pose, dark background").

**Three approaches:**

#### Approach A: WD14 Tagger (Recommended for anime characters)

WD14 (WaifuDiffusion Tagger v1.4) is a danbooru-tag-based classifier trained on anime images. It outputs booru-style tags like `1boy, white_cloak, orange_hair, solo, full_body, sword`.

**Pros:** Fast, automated, native to anime style, understands character art conventions.
**Cons:** Tags are booru style (underscored, categorical), not natural language. May need manual pruning of tags that describe the trigger character's unique traits (remove `orange_hair` if you want the LoRA to own that feature).

**In ComfyUI workflow context:** WD14 is available as a ComfyUI custom node (`WD14Tagger`). Can be run as a separate captioning pass before training.

**Standard implementation:** Run the tagger, then manually remove tags that are the LoRA's job to learn (character-unique tags). Keep tags that describe pose, background, scene context.

#### Approach B: BLIP / BLIP-2 Captioning

Generates natural language captions: "a manga character in a white cloak standing with a sword on their back."

**Pros:** Natural language output compatible with any SD 1.5 model, easier to edit.
**Cons:** Less precise for anime-style details; tends to describe generic features, misses booru-specific tags that SD 1.5 anime checkpoints respond to.

**Recommendation for this pipeline:** BLIP is better if using a realistic checkpoint; WD14 Tagger is better if using an anime checkpoint (which is the case here — dreamshaper or AbyssOrangeMix).

#### Approach C: Manual Captioning

Write `.txt` files by hand. For a dataset of 5–15 images, this is 30 minutes of work and produces the highest-quality results.

**Format:** `spyke, manga character, white cloak, ginger hair, standing pose, full body, white background`

Include the trigger word (`spyke`) in every caption. Keep consistent across all images.

**Complexity (all approaches):** LOW for manual; MEDIUM for automated (requires running a tagger model). Manual is the right starting point when the dataset is small.

**Recommendation: Start with manual captioning.** With 1 source image (Spyke_Final.png, 2816x1536), you can generate 4–8 crops at 512px. Write captions by hand. Move to automated tagger if dataset grows beyond 20 images.

---

### 6. Source Image Constraints for Spyke LoRA

**Critical finding from project file inspection:**

Only 1 high-quality reference image exists for Spyke training: `Spyke_Final.png` (2816x1536, landscape). The Gemini-generated concept variations exist but show character inconsistency and should NOT be used as training data — they will teach the LoRA the drift, not the canonical design.

**From 1 image, you can generate a usable (small) dataset by:**
1. Multiple crops at 512x512 and 512x768 from different parts of the image
2. Horizontal flip (SD 1.5 is not symmetric — flips add variety)
3. Slight zoom crops (head-only crop, torso crop, full-body crop)
4. Color jitter / minor augmentations if kohya_ss augmentation options are enabled

**Realistic dataset size from 1 source:** 6–12 images. This is a minimal LoRA dataset. Expect the LoRA to capture broad character identity but not fine asymmetric details. This is still significantly better than the Gemini prompt-only approach.

**Complexity:** MEDIUM — requires writing a crop/augmentation script, not just pointing at existing files.

---

## API / Job Management Features

### 7. ComfyUI HTTP API

**What it is:** ComfyUI exposes a REST-style HTTP API when running as a server (`comfyui --listen`). The TypeScript Express service wraps this API.

**Core ComfyUI endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/prompt` | POST | Submit a workflow JSON as a queued job. Returns `{ prompt_id: "uuid" }`. |
| `/history/{prompt_id}` | GET | Poll job status. Returns output filenames when complete. |
| `/queue` | GET | See pending + running jobs. |
| `/interrupt` | POST | Cancel current generation. |
| `/object_info` | GET | List all available node class types + their input schemas. Use this to verify node names on first run. |
| `/view` | GET | Download a generated image by filename. Query params: `filename`, `type` (output/input/temp), `subfolder`. |
| `/upload/image` | POST | Upload an input image (for img2img, ControlNet reference). Returns filename to use in workflow. |

**WebSocket for real-time status:** ComfyUI also provides a WebSocket at `ws://localhost:8188/ws`. Messages include execution progress events. Polling `/history` is simpler for a wrapper service; WebSocket is better if you need progress percentage.

**Complexity:** LOW — standard HTTP client calls. No authentication required for local instance.

---

### 8. Job Management Pattern (TypeScript Express Wrapper)

**What it is:** The Express service queues generation requests, submits them to ComfyUI, polls for completion, and returns results.

**Standard polling pattern:**

```typescript
// POST /generate → submit to ComfyUI → return job ID to client immediately
async function submitJob(workflowJson: object): Promise<string> {
  const response = await fetch('http://localhost:8188/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflowJson }),
  });
  const { prompt_id } = await response.json();
  return prompt_id;
}

// Internal: poll ComfyUI until job finishes
async function pollUntilComplete(promptId: string): Promise<string[]> {
  while (true) {
    const res = await fetch(`http://localhost:8188/history/${promptId}`);
    const data = await res.json();
    if (data[promptId]) {
      // Job complete — extract output filenames
      const outputs = data[promptId].outputs;
      const images = Object.values(outputs)
        .flatMap((node: any) => node.images ?? [])
        .map((img: any) => img.filename);
      return images;
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // poll every 1s
  }
}
```

**Job state machine:**
```
PENDING → RUNNING → COMPLETE
                  → FAILED
```

**In-process job store (sufficient for single-user local service):**
```typescript
interface Job {
  id: string;           // UUID generated by wrapper, maps to ComfyUI prompt_id
  status: 'pending' | 'running' | 'complete' | 'failed';
  outputFiles: string[];
  error?: string;
  params: GenerateParams;
  createdAt: string;
}
const jobs = new Map<string, Job>();
```

**API surface (as specified in PROJECT.md):**
| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/generate` | POST | `{ prompt, seed, modelPreset, loraId, controlnetStrength, ... }` | `{ jobId }` |
| `/jobs/:id` | GET | — | `{ status, outputFiles?, error? }` |
| `/train-lora` | POST | `{ datasetPath, triggerWord, steps }` | `{ jobId }` |
| `/health` | GET | — | `{ status: 'ok', comfyuiReachable: boolean }` |

**Complexity:** LOW for polling pattern; MEDIUM for full job persistence + train-lora endpoint.

---

### 9. Output Retrieval and File Integration

**What it is:** After ComfyUI completes a generation, the output image is in ComfyUI's own output directory. The Express wrapper must:
1. Download/copy the image from ComfyUI's output directory to the pipeline's `output/ch-XX/raw/` directory
2. Apply the existing pipeline naming convention (`ch01_p003_v2.png`)
3. Write a manifest entry (reusing existing `generation-log.json` format)

**ComfyUI SaveImage node behavior:** The `SaveImage` node writes to `ComfyUI/output/` by default. Files are named with the `filename_prefix` parameter + a counter suffix (e.g., `ch01_p003_00001_.png`). The `/history` response includes the exact filename.

**Download via ComfyUI API:**
```
GET http://localhost:8188/view?filename=ch01_p003_00001_.png&type=output
```
Returns raw image bytes.

**Integration with existing manifest system:** The Express wrapper should write the same `GenerationLogEntry` format as the v1.0 pipeline, replacing `model: "gemini-..."` with `model: "dreamshaper_8-lora-spyke_v1"` or similar. This ensures the overlay and assemble stages work unchanged.

**Complexity:** LOW — the manifest format and output conventions already exist; just need a new writer in the Express service.

---

## Consistency Features

### 10. Seed Locking

**What it is:** Setting a fixed integer seed in the KSampler node guarantees that the same prompt + same parameters + same seed produces the same output, bit-for-bit. This is the core reproducibility mechanism.

**In ComfyUI workflow JSON:**
```json
{
  "5": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 4815162342,
      "steps": 20,
      "cfg": 7.0,
      "sampler_name": "euler_ancestral",
      "scheduler": "karras",
      "denoise": 1.0
    }
  }
}
```

**Requirements for seed lock to hold:**
1. **Same seed value** in KSampler inputs
2. **Same sampler name** (`euler_ancestral`, `dpm_2_ancestral`, `ddim`, etc.) — different samplers produce entirely different images from the same seed
3. **Same scheduler** (`karras`, `normal`, `exponential`) — scheduler affects noise schedule, which affects image even with same seed
4. **Same step count** — more/fewer steps = different image
5. **Same CFG** — scale changes how strongly prompt is applied
6. **Same model** — different checkpoint = different image
7. **Same resolution** — `EmptyLatentImage` width/height affect generation

**Sampler recommendation for consistency:** `euler_ancestral` with `karras` scheduler is the most widely-tested SD 1.5 combination. It is also the default in many anime-style checkpoints' training configs. Stick to this pair and document it as the project standard.

**Complexity:** LOW — just documenting and enforcing the parameter contract. The hard part is discipline: every panel generation must store all 6 parameters in the manifest, not just the seed.

**Manifest extension needed:** The existing `GenerationLogEntry` only stores `model`. For v2.0 it needs: `seed`, `sampler`, `scheduler`, `steps`, `cfg`, `denoise`, `loraId`, `controlnetStrength`. These are needed to reproduce a specific panel later.

---

### 11. LoRA Loading at Inference Time

**What it is:** Apply a trained LoRA `.safetensors` file during generation to bias the model toward the trained character appearance.

**In ComfyUI workflow JSON:** A `LoraLoader` node sits between the checkpoint loader and CLIP/KSampler:

```json
{
  "1": { "class_type": "CheckpointLoaderSimple",
         "inputs": { "ckpt_name": "dreamshaper_8.safetensors" } },
  "14": { "class_type": "LoraLoader",
          "inputs": {
            "model":           ["1", 0],
            "clip":            ["1", 1],
            "lora_name":       "spyke_v1.safetensors",
            "strength_model":  0.8,
            "strength_clip":   0.8
          }
  },
  "2": { "class_type": "CLIPTextEncode",
         "inputs": { "text": "spyke, ...", "clip": ["14", 1] } }
}
```

The LoraLoader outputs a modified `(model, clip)` pair. All downstream nodes use the LoRA-modified model/CLIP instead of the raw checkpoint outputs.

**Key parameters:**
| Parameter | Typical Value | Effect |
|-----------|---------------|--------|
| `strength_model` | 0.6–1.0 | How strongly the LoRA biases the U-Net (image appearance) |
| `strength_clip` | 0.6–0.9 | How strongly the LoRA biases CLIP (prompt interpretation) |

**Trigger word placement:** The trigger word (`spyke`) must appear in the positive CLIP prompt. Without it, the LoRA has reduced influence even with high strength. Recommended placement: at the very start of the positive prompt.

**Multiple LoRAs:** You can chain `LoraLoader` nodes (output of one becomes input of next). For v2.0, the plan is one LoRA per major character. When June appears in a panel, her LoRA is also loaded. Stacking 2–3 LoRAs at `strength_model: 0.5–0.7` each is feasible on M1 Pro 16GB.

**LoRA file location:** `ComfyUI/models/loras/spyke_v1.safetensors`

**Complexity:** LOW — one additional node in the workflow graph. The hard work is training the LoRA, not loading it.

---

### 12. Model Preset Switching (Anime vs Realistic Checkpoints)

**What it is:** Different checkpoint `.safetensors` files produce fundamentally different visual styles. The pipeline supports named presets that swap the loaded checkpoint without changing the rest of the workflow.

**What changes between presets:**

Only the `CheckpointLoaderSimple` node's `ckpt_name` input changes. Everything else — LoRA, ControlNet, sampler — remains identical.

| Preset | Checkpoint File | Style |
|--------|----------------|-------|
| `anime` | `AbyssOrangeMix3_AOM3.safetensors` or `counterfeitV30.safetensors` | Anime cel-shaded, high-contrast lines, vivid colors — matches Plasma's target style |
| `realistic` | `realisticVisionV51.safetensors` or `dreamshaper_8.safetensors` | Photorealistic or painterly. Useful for backgrounds, concept reference |
| `mix` | `dreamshaper_8.safetensors` | Semi-realistic with anime leanings. Default for Plasma characters |

**IMPORTANT for M1 Pro 16GB:** Each checkpoint is ~2–4GB in VRAM. Model loading is the most memory-intensive step. ComfyUI caches the loaded model between jobs — you pay the load cost once per server restart, not per generation. If you switch presets frequently, you pay the re-load cost each time (~15–30s on M1 Pro).

**Recommendation:** For v2.0, commit to one checkpoint for character generation (`dreamshaper_8` or an anime variant) and test thoroughly before adding preset switching. Multiple presets add workflow complexity with limited benefit in the initial milestone. Add preset switching in v2.1 once the core LoRA workflow is stable.

**Complexity:** LOW to implement (one parameter swap); MEDIUM to manage correctly (different checkpoints require different LoRAs — a Spyke LoRA trained on dreamshaper won't work as well on a different base checkpoint).

---

## Feature Priority Table

| Feature | Category | Complexity | Dependencies | Table Stakes? |
|---------|----------|------------|--------------|---------------|
| ComfyUI server setup (Metal/MPS) | Infrastructure | MEDIUM | None | YES |
| txt2img workflow via API | Inference | LOW | ComfyUI running | YES |
| Job polling pattern (`/jobs/:id`) | API | LOW | ComfyUI API | YES |
| Seed locking + manifest extension | Consistency | LOW | txt2img workflow | YES |
| LoRA loading at inference | Consistency | LOW | Trained LoRA file | YES |
| Output file retrieval + manifest write | API | LOW | Job polling | YES |
| `GET /health` endpoint | API | LOW | Express service | YES |
| Spyke dataset preparation (crop + caption) | Training | MEDIUM | Spyke_Final.png | YES (before LoRA training) |
| LoRA training via kohya_ss | Training | HIGH | Dataset prepared, kohya_ss installed | YES (for consistency) |
| img2img workflow | Inference | LOW | txt2img + VAEEncode node | DIFFERENTIATOR |
| ControlNet OpenPose (model download + node) | Inference | MEDIUM | `comfyui_controlnet_aux` custom nodes | DIFFERENTIATOR |
| ControlNet pose reference wiring | Inference | LOW | ControlNet model file | DIFFERENTIATOR |
| Manual captioning for dataset | Training | LOW | Cropped images | YES (before training) |
| WD14 Tagger auto-captioning | Training | MEDIUM | Custom ComfyUI node | DIFFERENTIATOR |
| `POST /train-lora` endpoint | API | MEDIUM | kohya_ss installed | YES (for training workflow) |
| Model preset switching | Inference | LOW | Multiple checkpoints downloaded | DIFFERENTIATOR |
| Multi-LoRA stacking (June, Draster) | Consistency | MEDIUM | Per-character LoRA trained | DIFFERENTIATOR |
| June / Draster LoRA training | Training | HIGH | Per-character reference images | DIFFERENTIATOR |
| Progress via WebSocket | API | MEDIUM | None | DEFER |
| ComfyUI node editor UI | Infrastructure | N/A | — | ANTI-FEATURE |

---

## Table Stakes vs Differentiators

### Table Stakes (Must have for any working output)

The pipeline cannot produce a single panel without these. They form the critical path.

1. **ComfyUI server running on M1 Pro (Metal/MPS)** — no generation happens without this
2. **txt2img workflow JSON** — baseline generation
3. **Job management API** — async submission + polling (client polls, service manages state)
4. **Spyke dataset prep + LoRA training** — the entire reason for switching from Gemini; without the LoRA, character consistency is not better than Gemini
5. **Seed locking** — if seeds are not stored + reproduced, panels cannot be regenerated after approval
6. **Output file integration** — images must land in `output/ch-XX/raw/` with correct naming so v1.0 overlay and assemble stages work unchanged

### Differentiators (What makes this better than Gemini)

These are the features that justify the v2.0 pivot. Without them, ComfyUI offers no advantage.

1. **LoRA character consistency** — Spyke's asymmetric glove setup, exact cloak length, and ginger hair become deterministic, not probabilistic
2. **Seed locking for panel reproduction** — Any approved panel can be exactly reproduced; no "generate and hope"
3. **ControlNet OpenPose** — Pose-anchored composition means sequential panels can maintain spatial continuity (Spyke's swing follows through in the next panel)
4. **No per-call API cost** — 28 pages × 3 iterations per page = 84 generations, free after hardware investment

---

## Anti-Features / Scope Warnings

### Anti-Feature 1: ComfyUI Web UI / Node Editor

**Looks useful:** "We can design workflows visually."

**Problem:** The workflow JSON must be programmatically templated by the TypeScript service. If workflow design relies on the ComfyUI GUI, the service cannot swap models, seeds, or LoRA IDs at runtime. The GUI is fine for initial workflow design and debugging, but must never be the runtime path.

**What to do instead:** Design 2–3 workflow templates (txt2img, img2img, img2img+ControlNet) in the GUI, export their JSON, then parameterize them in TypeScript by slot-filling node inputs programmatically.

---

### Anti-Feature 2: SDXL / Flux / SDXL-Turbo Models

**Looks useful:** "Flux produces better images."

**Problem:** M1 Pro 16GB cannot run SDXL at 512px batch size 1 without significant degradation of speed, and training an SDXL LoRA locally is borderline infeasible. `PROJECT.md` explicitly calls this out as out of scope. Adding SDXL model support adds checkpoint management complexity with no local hardware benefit.

**What to do instead:** Stay on SD 1.5. If quality ceiling is hit, document SDXL/Flux as an upgrade path for future hardware (M3 Max or cloud GPU), not a v2.0 item.

---

### Anti-Feature 3: Automated Pose Generation (OpenPose Skeleton Synthesis)

**Looks useful:** "Auto-generate the correct pose for each panel from the script description."

**Problem:** This requires either a pose estimation model running on character descriptions (language→skeleton) or integrating a 3D poser tool. Both are significant scope additions. The manual path — use a reference photo or previous panel as the pose source — is adequate for v2.0.

**What to do instead:** Keep pose reference images manual. Store them in `output/ch-XX/poses/` alongside the generation. If volume grows, re-evaluate in v2.1.

---

### Anti-Feature 4: LoRA Training for All Characters Before v2.0 Launch

**Looks useful:** "Train Spyke, June, and Draster LoRAs before shipping v2.0."

**Problem:** June and Draster have zero dedicated reference images (only Gemini-generated concept images exist, which show character drift and should not be training data). Training LoRAs on bad reference data produces a bad LoRA that's worse than no LoRA. Training June/Draster requires first creating canonical reference art — that's a separate creative task.

**What to do instead:** v2.0 ships with one Spyke LoRA only. June/Draster LoRAs are a v2.1 item gated on creating clean reference art first.

---

### Anti-Feature 5: Real-time Progress Streaming to Pipeline CLI

**Looks useful:** "Show a generation progress bar in the pipeline terminal."

**Problem:** Requires implementing WebSocket client in the TypeScript service + threading/streaming the progress back to the CLI caller. The job polling pattern (`GET /jobs/:id` on 1s interval) is sufficient for a local single-user pipeline. Progress bars add complexity without meaningful workflow benefit when generation takes 30–90 seconds.

**What to do instead:** Log `[generate] Job submitted: {id}` and `[generate] Polling...` to stdout. Return the output path when done.

---

### Anti-Feature 6: Parallel Batch Generation

**Looks useful:** "Generate all 28 pages in parallel."

**Problem:** ComfyUI processes one job at a time by default on M1 Pro (GPU is shared resource). Submitting multiple jobs simultaneously queues them; they do not run in parallel. Parallel HTTP requests to the service just result in a longer queue, not faster completion. Worse, it can cause memory pressure if multiple large models are being swapped.

**What to do instead:** Sequential generation per chapter. The Express service's job queue handles order naturally via ComfyUI's own queue. Add a `--pages 1-5` flag to generate subsets, not parallelism.

---

## Feature Dependencies

```
[Spyke_Final.png reference image]
    └──crop + augment──> [Training dataset (6-12 images + .txt captions)]
                              └──kohya_ss train──> [spyke_v1.safetensors]
                                                       └──placed in ComfyUI/models/loras/
                                                            └──enables──> [LoRA loading at inference]

[ComfyUI server running]
    └──provides──> [txt2img workflow]
                       └──extends──> [img2img workflow]  (add LoadImage + VAEEncode)
                       └──extends──> [ControlNet OpenPose] (add preprocessor + ControlNetApply)
                       └──extends──> [LoRA loading] (add LoraLoader node)

[Express service]
    └──wraps──> [ComfyUI HTTP API]
                    └──provides──> [POST /generate]
                    └──provides──> [GET /jobs/:id]
                    └──provides──> [GET /health]
    └──wraps──> [kohya_ss CLI]
                    └──provides──> [POST /train-lora]

[Output retrieval]
    └──depends on──> [Job polling complete]
    └──writes to──> [output/ch-XX/raw/ + generation-log.json]
    └──consumed by──> [v1.0 overlay stage] (unchanged)
    └──consumed by──> [v1.0 assemble stage] (unchanged)
```

**Critical path (minimum to generate one panel with LoRA consistency):**
1. ComfyUI server running with SD 1.5 checkpoint loaded
2. `spyke_v1.safetensors` trained and placed in `ComfyUI/models/loras/`
3. Express service with `POST /generate` + `GET /jobs/:id`
4. Output file integration writing to `output/ch-XX/raw/`

ControlNet is NOT on the critical path for v2.0 launch. It is a parallel track that can be added once LoRA generation is working.

---

## Sources

- ComfyUI workflow JSON structure: Training knowledge of ComfyUI API documentation and node architecture (MEDIUM confidence — node class names verified via common community usage patterns; verify against `GET /object_info` on running instance)
- kohya_ss LoRA training parameters: Training knowledge of SD 1.5 LoRA training community standards including `network_dim`, `network_alpha`, M1/MPS considerations (MEDIUM confidence — core parameters are stable; verify exact CLI flags against kohya_ss current release)
- KSampler seed determinism requirements: Training knowledge of Stable Diffusion sampling mechanics (HIGH confidence — sampler/scheduler/seed contract is fundamental to SD architecture)
- WD14 Tagger / BLIP captioning approaches: Training knowledge of LoRA training dataset preparation practices (MEDIUM confidence)
- ComfyUI HTTP API endpoints (`/prompt`, `/history`, `/view`): Training knowledge of ComfyUI's REST API (MEDIUM confidence — endpoint paths are stable; verify WebSocket path and `/upload/image` behavior on running instance)
- Spyke_Final.png dimensions and file count: Verified by direct inspection of `/Users/dondemetrius/Code/plasma/03_manga/concept/` (HIGH confidence)
- `comfyui_controlnet_aux` custom node pack: Training knowledge of the standard ComfyUI ControlNet extension (MEDIUM confidence — verify installation method and preprocessor node names against current GitHub release)
- M1 Pro 16GB constraints (batch size, MPS support): Training knowledge of Apple Silicon PyTorch/Metal performance characteristics (MEDIUM confidence — MPS support has improved through 2024-2025; verify current kohya_ss MPS status at install time)
- PROJECT.md v2.0 requirements: Verified by direct inspection (HIGH confidence)
- GenerationLogEntry interface: Verified by direct inspection of `pipeline/src/types/generation.ts` (HIGH confidence)

---

*Feature research for: ComfyUI + LoRA image generation pipeline (Plasma v2.0)*
*Researched: 2026-02-19*
*Confidence: MEDIUM — core architecture patterns HIGH confidence; specific node names and M1 MPS support status need live verification*
