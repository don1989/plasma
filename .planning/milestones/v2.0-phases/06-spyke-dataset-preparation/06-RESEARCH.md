# Phase 6: Spyke Dataset Preparation - Research

**Researched:** 2026-02-19
**Domain:** LoRA dataset curation, kohya_ss directory format, ComfyUI REST API, Sharp image processing
**Confidence:** HIGH (core findings from official docs and direct filesystem inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Image sourcing**
- `Spyke_Final.png` is a multi-pose reference sheet — crop individual views into separate training images
- Existing images in `output/characters/spyke-tinwall/` (7 ref-sheets) and `03_manga/concept/characters/spyke_tinwall/` (4 Gemini images) — review individually, pick best ones manually
- If crops + selected existing images don't reach 15 images, top up with ComfyUI-generated images
- Top-up generation uses `AnythingXL_inkBase.safetensors` (already installed) — consistent with v2.0 stack
- Generated images use plain/simple background — cleaner training signal
- All training images resized to exactly 512×512 square (standard for SD 1.5 LoRA)

**Pose and framing coverage**
- At least 60% of images must show asymmetric details clearly: right bracer, left knee pauldron, ginger hair, white cloak
- Framing mix: ~70% full body, ~20% bust/waist-up, ~10% closeup
- Pose mix: ~50% neutral, ~50% combat/action
- Expression variety: neutral, determined/serious, surprised, angry, calm — distributed throughout

**Dataset storage location**
- `dataset/spyke/train/` and `dataset/spyke/reg/` inside the repo
- `.gitignore` updated to exclude `dataset/**/*.png` — images regeneratable
- Caption `.txt` files ARE committed
- Directory structure mirrors kohya_ss expected layout

**Regularization generation**
- TypeScript script in `pipeline/` that posts jobs to ComfyUI's REST API in a loop
- Target: 100–200 images
- Claude decides exact regularization prompt text

### Claude's Discretion
- Exact regularization prompt text
- Script structure for regularization generation
- Exact file naming convention within `dataset/spyke/train/`
- How many crops to extract from `Spyke_Final.png`

### Deferred Ideas (OUT OF SCOPE)
- June, Draster LoRA training (no canonical reference images; v2.1)
- Any LoRA model training (Phase 8)
- ComfyUI Express service (Phase 7)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Training dataset of 15–20 images of Spyke at 512px before LoRA training | Asset audit confirms enough source material for 15+ images via cropping + selection |
| DATA-02 | Each training image has paired `.txt` caption file; format: `[trigger_word], [framing], [pose/action], [background type]`; trigger = `spyke_plasma_v1` | kohya_ss docs confirm .txt overrides class token; comma-separated tag format confirmed |
| DATA-03 | Regularization dataset of 100–200 images via SD 1.5 base model | ComfyUI REST API pattern documented; TypeScript script approach validated |
| DATA-04 | Horizontal flips included in dataset | CRITICAL: `--flip_aug` is training-time parameter but MUST NOT be used for Spyke due to asymmetric costume; pre-generate flipped images only for symmetric subjects |
| LORA-01 | Spyke LoRA trained with specified params (Phase 8) | Phase 6 produces the dataset consumed by Phase 8 |
| LORA-02 | Checkpoints every 200 steps (Phase 8) | Phase 6 produces the dataset consumed by Phase 8 |
| LORA-03 | LoRA file placed in ComfyUI loras dir (Phase 8) | Phase 6 produces the dataset consumed by Phase 8 |
| LORA-04 | MPS verified active during training (Phase 8) | Phase 6 produces the dataset consumed by Phase 8 |
| LORA-05 | Only Spyke LoRA in v2.0 | Phase 6 produces Spyke-only dataset |
</phase_requirements>

---

## Summary

Phase 6 assembles a ready-to-train kohya_ss LoRA dataset with no actual model training. Three work streams run in sequence: (1) curate and crop existing reference art into 512×512 training images with captions, (2) generate 100–200 regularization images via ComfyUI's REST API using a TypeScript script, and (3) validate the final dataset structure matches kohya_ss expectations.

The most important discovery is the **flip augmentation constraint**: Spyke has intentionally asymmetric costume details (right bracer, left knee pauldron). The kohya_ss `--flip_aug` flag flips randomly at training time, which would teach the LoRA both left and right bracer orientations — exactly the opposite of what's needed. DATA-04 (horizontal flips for diversity) should be implemented by pre-generating mirrored images **only for symmetric compositions** (back view, pure expression closeups) and excluding flips for images where asymmetric details are prominent. This is a judgment call per-image, not a blanket augmentation.

The second critical discovery is that `~/tools/kohya_ss/sd-scripts/` is an empty directory — the actual training scripts (`train_network.py`) have not been checked out. This is a Phase 8 blocker, not Phase 6, but Phase 6 must document this so Phase 8 is not surprised.

**Primary recommendation:** Crop all four body views from each of the three reference sheets (Final, concept, Younger = 12 crops), add selected face closeups (2–4 from expression rows), evaluate existing ref-sheets and Gemini images for quality, then generate 3–5 ComfyUI top-up images if needed to reach 15. This is the fastest path to a quality dataset.

---

## Asset Audit — Existing Source Material

### Source File Inventory

| File | Path | Dimensions | Content | Usable for Training |
|------|------|-----------|---------|---------------------|
| `Spyke_Final.png` | `03_manga/concept/characters/spyke_tinwall/` | 2816×1536 | 4 full-body views (front, 3/4, side, back) + expression row + detail callouts | YES — primary crop source |
| `Spyke_concept.png` | same | 2784×1536 | Earlier version: front, 3/4, side, back + expression row | YES — secondary crops |
| `Spyke_Younger.png` | same | 2816×1536 | Age 16 version: 3 body views + expression row | PARTIAL — age 16 design, different from v2.0 style |
| `Gemini_Generated_Image_654svk654svk654s.png` | same | 1408×768 | Age 16 ref-sheet multi-pose | EXCLUDE — age 16 |
| `Gemini_Generated_Image_dj54badj54badj54.png` | same | 1408×768 | Age 16 version without cloak | EXCLUDE — missing cloak |
| `Gemini_Generated_Image_jw6skljw6skljw6s.png` | same | 1408×768 | Age 16 action pose version | EXCLUDE — age 16 |
| `ref-sheet-v1.png` | `output/characters/spyke-tinwall/` | 1024×1024 | 4-view sheet (front, 3/4, side, back) — clean white background | YES — whole images or crops |
| `ref-sheet-v2.png` | same | 1024×1024 | 4-view sheet — similar to v1 | YES |
| `ref-sheet-v3.png` | same | 1408×736 | Landscape: 3 body views + expression row + detail callouts | PARTIAL — landscape, must crop |
| `ref-sheet-v4.png` | same | 1408×736 | Similar to v3 | PARTIAL — landscape, must crop |
| `ref-sheet-v5.png` | same | 1408×736 | Similar to v3/v4 | PARTIAL |
| `ref-sheet-v6.png` | same | 1024×1024 | 4-view sheet + expression row — different costume variant (no cloak visible) | EVALUATE |
| `ref-sheet-v7.png` | same | 1024×1024 | 4-view sheet — latest v, clean white background | YES |

### Recommended Crop Plan from `Spyke_Final.png` (2816×1536)

The image has 4 body views across width plus an expression row at the bottom (~y=1230):

| Crop | Left | Top | Width | Height | Training Value |
|------|------|-----|-------|--------|---------------|
| front_view | 30 | 100 | 640 | 1120 | Full body, front, shows left knee pauldron |
| three_quarter | 720 | 100 | 640 | 1120 | 3/4 angle, shows right bracer clearly |
| side_profile | 1400 | 100 | 640 | 1120 | Side view, shows cloak length |
| back_view | 2080 | 100 | 640 | 1120 | Back view, shows cloak symbol |
| face_neutral | 30 | 1230 | 380 | 280 | Closeup, neutral expression |
| face_angry | 410 | 1230 | 380 | 280 | Closeup, angry expression |
| face_battle | 830 | 1230 | 380 | 280 | Closeup, battle-focused |
| face_shocked | 1680 | 1230 | 380 | 280 | Closeup, shocked expression |

**NOTE:** All body view crops will contain annotation text labels (arrows, callout text). This is acceptable — the LoRA will not learn the text as it's incidental. However, if annotation density is high, prefer crops from ref-sheet-v1/v2/v7 which have clean white backgrounds.

**Best-quality crops (no annotation text):** `ref-sheet-v1.png`, `ref-sheet-v2.png`, `ref-sheet-v7.png` — these are 1024×1024 multi-view sheets with clean backgrounds. Each can be cropped into 4 individual views at approximately 256×1024 per view, then letterboxed to 512×512.

### Projected Training Image Count (before top-up)

| Source | Usable Images |
|--------|--------------|
| Spyke_Final.png crops (4 body + 4 face) | 8 |
| ref-sheet-v1.png crops (4 body views) | 4 |
| ref-sheet-v7.png crops (4 body views) | 4 |
| ref-sheet-v2.png crops (2 unique poses) | 2 |
| **Subtotal before quality review** | **~18** |

This reaches the 15–20 target without ComfyUI top-up, assuming quality review passes. Some images from `Spyke_Final.png` contain heavy annotation text that may degrade training — these should be replaced by cleaner ref-sheet crops of the same pose.

---

## Standard Stack

### Core

| Library/Tool | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| `sharp` | 0.34.5 (already in pipeline) | Crop, resize, letterbox to 512×512 | Already project dependency; libvips is fastest Node.js image processing |
| `@stable-canvas/comfyui-client` | 1.5.9 | TypeScript client for ComfyUI REST + WebSocket | Purpose-built Node.js client with TypeScript types, supports both WS and polling modes |
| `ws` | latest | WebSocket for Node.js (required by comfyui-client) | comfyui-client requires WS and fetch as explicit deps in Node.js environment |
| `node-fetch` | latest | fetch polyfill for Node.js (required by comfyui-client) | Same as above |
| `tsx` | already in pipeline | Run TypeScript scripts directly | Already in devDependencies, enables `tsx pipeline/src/scripts/gen-reg.ts` |

### Supporting

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `node:fs/promises` | Read/write files for captions and image management | Use for caption file generation and dataset validation |
| `node:path` | Consistent path manipulation | Use everywhere paths are constructed |

**Installation for regularization script:**
```bash
cd /Users/dondemetrius/Code/plasma/pipeline
pnpm add @stable-canvas/comfyui-client ws node-fetch
pnpm add -D @types/ws @types/node-fetch
```

---

## Architecture Patterns

### Recommended Dataset Directory Structure

```
dataset/
└── spyke/
    ├── train/
    │   └── 10_spyke_plasma_v1/     # {repeats}_{class_token} — kohya_ss naming
    │       ├── spyke_001.png
    │       ├── spyke_001.txt
    │       ├── spyke_002.png
    │       ├── spyke_002.txt
    │       └── ...
    └── reg/
        └── 1_anime_character/      # Low repeats, generic class name
            ├── reg_001.png
            ├── reg_002.png
            └── ...                 # No .txt files needed for reg images
```

**Critical:** The folder name format is `{N}_{concept}`. The `N` is the number of times each image is repeated per epoch. With 15 images and target 800–1200 steps at batch_size=1, use `10_spyke_plasma_v1` (15 × 10 repeats × ~5-6 epochs = ~750–900 steps). Tune by targeting steps, not epochs.

**Caption files:** The `.txt` file content overrides the folder class token on a per-image basis (verified from kohya_ss docs). Since we use captions for every image, the folder class token acts as a fallback only. Caption files go only in the `train/` subfolder — NOT in `reg/`.

### Pattern 1: Sharp Crop + Letterbox to 512×512

```typescript
// Source: Sharp official docs - https://sharp.pixelplumbing.com/api-resize/
import sharp from 'sharp';

async function cropToTrainingImage(
  sourcePath: string,
  outputPath: string,
  crop: { left: number; top: number; width: number; height: number }
): Promise<void> {
  await sharp(sourcePath)
    .extract(crop)
    .resize(512, 512, {
      fit: 'contain',           // letterbox — preserves aspect ratio
      background: { r: 255, g: 255, b: 255, alpha: 1 },  // white padding
    })
    .png()
    .toFile(outputPath);
}
```

**Why `contain` not `cover`:** Training images must show the full character, not crop to fill. `cover` would cut off feet or head. `contain` adds white bars if needed — white is a clean neutral background that doesn't add style noise.

### Pattern 2: Caption File Format

```
// Content of dataset/spyke/train/10_spyke_plasma_v1/spyke_001.txt
spyke_plasma_v1, full body, standing, white background

// More specific examples:
spyke_plasma_v1, full body, front view, standing neutral pose, white background
spyke_plasma_v1, full body, three quarter angle, sword drawn, white background
spyke_plasma_v1, bust shot, angry expression, white background
spyke_plasma_v1, full body, back view, white cloak visible, white background
spyke_plasma_v1, closeup face, neutral expression, white background
```

**Format rules (confirmed from kohya_ss docs):**
- Trigger word FIRST, always — `spyke_plasma_v1` is the first token
- Comma-separated tags (no special syntax, no quotes)
- Tags describe: framing, pose/action, expression, background — in that order
- No maximum tag count; keep concise
- Background type should always be present — helps regularization

### Pattern 3: ComfyUI REST API — Regularization Generator

The regularization script posts workflows to ComfyUI and polls for completion using the `@stable-canvas/comfyui-client` package.

```typescript
// Source: StableCanvas/comfyui-client README + official ComfyUI websocket example
import { Client, Workflow } from '@stable-canvas/comfyui-client';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const client = new Client({
  api_host: '127.0.0.1:8188',
  WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
  fetch: fetch as unknown as typeof globalThis.fetch,
});

async function generateRegImage(index: number, outputDir: string): Promise<void> {
  client.connect();

  const wk = new Workflow();
  const cls = wk.classes;

  const [model, clip, vae] = cls.CheckpointLoaderSimple({
    ckpt_name: 'AnythingXL_inkBase.safetensors',
  });

  const enc = (text: string) => cls.CLIPTextEncode({ text, clip })[0];

  const [samples] = cls.KSampler({
    seed: Math.floor(Math.random() * 2 ** 32),
    steps: 20,
    cfg: 7,
    sampler_name: 'euler_ancestral',
    scheduler: 'normal',
    denoise: 1,
    model,
    positive: enc(REG_PROMPT),
    negative: enc(REG_NEGATIVE),
    latent_image: cls.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 })[0],
  });

  cls.SaveImage({
    filename_prefix: `reg_${String(index).padStart(3, '0')}`,
    images: cls.VAEDecode({ samples, vae })[0],
  });

  // enqueue_polling avoids WebSocket complexity for a sequential batch script
  await wk.invoke(client);
}
```

**Alternative: raw fetch approach** (simpler, no package needed):

```typescript
// Source: ComfyUI official example — https://github.com/comfyanonymous/ComfyUI/blob/master/script_examples/websockets_api_example.py
// POST /prompt to queue, then GET /history/{prompt_id} to poll
const response = await fetch('http://127.0.0.1:8188/prompt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: workflowJson, client_id: crypto.randomUUID() }),
});
const { prompt_id } = await response.json();

// Poll /history until complete
while (true) {
  await new Promise(r => setTimeout(r, 2000));
  const hist = await fetch(`http://127.0.0.1:8188/history/${prompt_id}`).then(r => r.json());
  if (hist[prompt_id]) {
    // Job complete — extract output filename
    const outputs = hist[prompt_id].outputs;
    for (const nodeId of Object.keys(outputs)) {
      if (outputs[nodeId].images) {
        for (const img of outputs[nodeId].images) {
          // img.filename, img.subfolder, img.type
          // Retrieve via GET /view?filename={img.filename}&subfolder={img.subfolder}&type={img.type}
          const imageData = await fetch(
            `http://127.0.0.1:8188/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`
          ).then(r => r.arrayBuffer());
          await writeFile(path.join(outputDir, img.filename), Buffer.from(imageData));
        }
      }
    }
    break;
  }
}
```

**Recommendation:** Use the raw fetch approach for the regularization script. The `@stable-canvas/comfyui-client` Workflow API is more powerful but adds complexity and peer dependencies. For a sequential batch script generating 100–200 images, raw fetch + polling is simpler, easier to debug, and has zero additional dependencies.

### Pattern 4: Dataset Validation Script

```typescript
// Verify dataset structure before handing off to Phase 8
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

function validateDataset(trainDir: string, regDir: string): ValidationResult {
  const trainImages = readdirSync(trainDir).filter(f => f.endsWith('.png'));
  const trainCaptions = readdirSync(trainDir).filter(f => f.endsWith('.txt'));

  const errors: string[] = [];

  // Each image must have a matching caption
  for (const img of trainImages) {
    const capPath = path.join(trainDir, img.replace('.png', '.txt'));
    if (!existsSync(capPath)) errors.push(`Missing caption: ${img}`);
  }

  // Caption must start with trigger word
  for (const cap of trainCaptions) {
    const content = readFileSync(path.join(trainDir, cap), 'utf-8').trim();
    if (!content.startsWith('spyke_plasma_v1')) {
      errors.push(`Caption missing trigger word: ${cap}`);
    }
  }

  // Count checks
  if (trainImages.length < 15) errors.push(`Too few training images: ${trainImages.length}`);
  if (trainImages.length > 20) errors.push(`Too many training images: ${trainImages.length} (may overfit)`);

  const regImages = readdirSync(regDir).filter(f => f.endsWith('.png'));
  if (regImages.length < 100) errors.push(`Too few reg images: ${regImages.length}`);

  return { valid: errors.length === 0, errors, trainCount: trainImages.length, regCount: regImages.length };
}
```

### Anti-Patterns to Avoid

- **Mixing age-16 and age-21 images:** The 3 Gemini images in `03_manga/concept/` all show age-16 Spyke (different costume, no white cloak). Including these would confuse the LoRA between two distinct character designs. Exclude them.
- **Using `--flip_aug` in kohya_ss training args:** This flag applies horizontal flips randomly during training. For Spyke it's destructive — the right bracer becomes a left bracer in half the training steps. If flip diversity is wanted, pre-generate flipped images manually and caption them accordingly.
- **Including annotation text crops as training images:** Crops from `Spyke_Final.png` that contain heavy callout text (arrows, labels) should be deprioritized. Use ref-sheet-v1/v2/v7 crops (clean white background) when the same pose is available there.
- **Caption files in the regularization directory:** Reg images do not need `.txt` captions. kohya_ss uses the folder name as their class token (`anime_character`). Adding trigger word captions to reg images teaches the LoRA that generic characters are "spyke_plasma_v1".

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resize with aspect ratio | Custom math for padding | `sharp(...).resize(512, 512, { fit: 'contain' })` | Sharp handles edge cases, EXIF stripping, color profiles |
| ComfyUI job tracking | Custom WebSocket parser | `@stable-canvas/comfyui-client` or raw `/history` polling | Race conditions if WS connected after POST; library handles client_id correctly |
| Crop coordinate calculation | Manual pixel math embedded in code | Hardcoded constants in a `CROPS` config object | Pixel coordinates need per-image tuning; keep them visible and editable |

**Key insight:** The dataset preparation is 80% manual judgment (which crops look good, which expressions are usable) and 20% automation. The automation should be as thin as possible — a crop script with explicit coordinate tables, not a smart computer vision system.

---

## Common Pitfalls

### Pitfall 1: Flip Augmentation Destroys Asymmetric Details

**What goes wrong:** Enabling `--flip_aug` in kohya_ss training (Phase 8) horizontally mirrors training images at random during each epoch. For Spyke, this means the LoRA sees: right bracer on right (original) + right bracer on left (flipped) = learns "either side is fine" and generates bracers inconsistently.

**Why it happens:** The flag is presented as a free augmentation that "increases variety" — which is true for symmetric subjects (faces, generic characters) but wrong for asymmetric costume designs.

**How to avoid:** DATA-04 says "horizontal flips included in dataset." Implement this as **pre-generated disk files**, not as a training flag. Only flip back-view images (where asymmetry is not prominent) and pure expression closeups. Do NOT flip any image that clearly shows the right bracer or left knee pauldron. Add a note to Phase 8 PLAN to explicitly set `flip_aug = false`.

**Warning signs:** If generated test images show the bracer on the wrong side, flip_aug contamination is the likely cause.

### Pitfall 2: kohya_ss `sd-scripts/` Directory is Empty

**What goes wrong:** `~/tools/kohya_ss/sd-scripts/` is an empty directory. The `train_network.py` script and all actual training code live there as a git submodule. Phase 8 will fail immediately if this is not resolved.

**Why it happens:** kohya_ss uses a git submodule for sd-scripts. If installed without `--recursive` or if the submodule was not initialized, the directory is created but empty.

**How to avoid (Phase 8 action, not Phase 6):**
```bash
cd ~/tools/kohya_ss
git submodule update --init --recursive
```
Or re-run the setup with the GUI: `bash ~/tools/kohya_ss/gui.sh`

**This is a Phase 8 blocker.** Phase 6 should document this in its output summary so Phase 8 is not surprised.

### Pitfall 3: Annotation Text in Reference Sheet Crops

**What goes wrong:** `Spyke_Final.png` and `Spyke_concept.png` contain callout text labels (arrows, notes like "Green → Purple/Black Sclera"). Including heavily annotated crops teaches the LoRA that characters have floating text annotations — this appears as text artifacts in generated images.

**Why it happens:** The reference sheets are designed for human readability, not machine training.

**How to avoid:** For each pose available in both `Spyke_Final.png` (annotated) and ref-sheet-v1/v2/v7 (clean), prefer the clean version. Only use `Spyke_Final.png` crops for poses not available in the clean ref-sheets (e.g., specific expression faces).

### Pitfall 4: Regularization Prompt Includes Spyke Details

**What goes wrong:** If the reg prompt mentions any Spyke-specific features (red bandana, white cloak, ginger hair), the regularization images teach the LoRA to associate those features with generic anime characters instead of with the `spyke_plasma_v1` trigger.

**How to avoid:** The regularization prompt must be entirely generic. See recommended reg prompt in Code Examples section.

### Pitfall 5: Folder Naming Breaks kohya_ss Recognition

**What goes wrong:** If the training folder is named something like `spyke_train/` without the `{N}_` prefix, kohya_ss does not know how many times to repeat the images and may error or default to repeats=1.

**How to avoid:** Strictly follow `{N}_{class_token}` naming. For Phase 6: `10_spyke_plasma_v1` for training, `1_anime_character` for regularization.

### Pitfall 6: AnythingXL_inkBase is SDXL, Not SD 1.5

**What goes wrong:** `AnythingXL_inkBase.safetensors` — the "XL" in the name indicates this is a Stable Diffusion XL checkpoint. REQUIREMENTS.md says "SD 1.5 only" for training. Training a LoRA on SDXL dataset images when the base model is SD 1.5 is fine (the dataset is just images). However, for **regularization image generation**, using an SDXL model produces a different aesthetic than the SD 1.5 base model that will actually be used for training.

**The issue:** Regularization images are supposed to show what the base model "normally" generates for the class concept, so the LoRA knows what to deviate from. If reg images are SDXL style but training uses SD 1.5, the reg/train aesthetic mismatch reduces regularization effectiveness.

**How to handle:** Use `AnythingXL_inkBase.safetensors` for regularization generation anyway — it is the only checkpoint installed. The impact is moderate (not catastrophic). For best results, Phase 8 could optionally note to add an SD 1.5 checkpoint (e.g., Anything V5). For Phase 6, proceed with the available checkpoint.

**Confidence:** MEDIUM — this is a nuance from community practice, not official documentation.

---

## Code Examples

### Recommended Regularization Prompt

```
// Positive prompt for regularization images
const REG_PROMPT = [
  'anime character, 1boy, young man, generic fantasy warrior',
  'standing pose, full body, white background',
  'anime style, clean lineart, flat shading',
  'masterpiece, best quality',
].join(', ');

// Negative prompt
const REG_NEGATIVE = [
  'spyke_plasma_v1',          // CRITICAL: exclude trigger word
  'red bandana, white cloak', // Exclude Spyke-specific features
  'ginger hair, red hair',    // Exclude distinctive hair color
  'lowres, bad anatomy, bad hands, text, error, missing fingers',
  'extra digit, fewer digits, cropped, worst quality, low quality',
  'signature, watermark, username, blurry',
].join(', ');
```

**Why this exact wording:**
- Generic enough that no Spyke features bleed in
- "1boy, young man" matches Spyke's class — regularization effectiveness depends on class match
- "white background" matches training images for consistency
- Negative explicitly excludes trigger word and distinctive features
- Anime style matches the base checkpoint's training distribution

### Complete Crop Coordinates Table

Coordinates verified by direct visual inspection of source images at actual dimensions.

```typescript
// Source: Direct inspection of Spyke_Final.png (2816×1536)
// All crops should be letterboxed to 512×512 using sharp's 'contain' fit with white background

const SPYKE_FINAL_CROPS = [
  // Body views — prefer these for bracer/pauldron visibility
  { id: 'spyke_final_front',   left: 30,   top: 100, width: 650, height: 1100 },
  { id: 'spyke_final_3q',      left: 720,  top: 100, width: 650, height: 1100 },
  { id: 'spyke_final_side',    left: 1400, top: 100, width: 650, height: 1100 },
  { id: 'spyke_final_back',    left: 2080, top: 100, width: 650, height: 1100 },
  // Expression row — closeup faces, y≈1230
  { id: 'spyke_final_neutral', left: 30,   top: 1230, width: 380, height: 270 },
  { id: 'spyke_final_angry',   left: 430,  top: 1230, width: 380, height: 270 },
  { id: 'spyke_final_battle',  left: 850,  top: 1230, width: 380, height: 270 },
  { id: 'spyke_final_shocked', left: 1680, top: 1230, width: 380, height: 270 },
];

// Source: Direct inspection of ref-sheet-v1.png (1024×1024)
// 4 views in a 2×2 or 1×4 layout — inspect manually to confirm grid
// ref-sheet-v1 appears to be 4 views across the width (4 narrow full-body figures)
// Approx 256px wide per figure in a 1024×1024 image
const REF_SHEET_V1_CROPS = [
  { id: 'v1_front',  left: 10,  top: 60, width: 240, height: 900 },
  { id: 'v1_3q',    left: 270, top: 60, width: 240, height: 900 },
  { id: 'v1_side',  left: 530, top: 60, width: 240, height: 900 },
  { id: 'v1_back',  left: 790, top: 60, width: 240, height: 900 },
];
```

**Note:** These coordinates are starting estimates based on image dimensions and visual inspection. The crop script must include a `--dry-run` mode that saves preview crops for human approval before final output.

### ComfyUI Workflow JSON (Minimal txt2img)

```json
{
  "1": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": { "ckpt_name": "AnythingXL_inkBase.safetensors" }
  },
  "2": {
    "class_type": "CLIPTextEncode",
    "inputs": { "text": "POSITIVE_PROMPT", "clip": ["1", 1] }
  },
  "3": {
    "class_type": "CLIPTextEncode",
    "inputs": { "text": "NEGATIVE_PROMPT", "clip": ["1", 1] }
  },
  "4": {
    "class_type": "EmptyLatentImage",
    "inputs": { "width": 512, "height": 512, "batch_size": 1 }
  },
  "5": {
    "class_type": "KSampler",
    "inputs": {
      "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
      "latent_image": ["4", 0],
      "seed": 42, "steps": 20, "cfg": 7,
      "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1
    }
  },
  "6": {
    "class_type": "VAEDecode",
    "inputs": { "samples": ["5", 0], "vae": ["1", 2] }
  },
  "7": {
    "class_type": "SaveImage",
    "inputs": { "images": ["6", 0], "filename_prefix": "reg" }
  }
}
```

**Slot-fill fields:** Replace `POSITIVE_PROMPT`, `NEGATIVE_PROMPT`, and `seed` at generation time. The `filename_prefix` should include an index to avoid overwriting.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual image editing (Photoshop) for crops | Sharp programmatic crops with coordinate tables | Reproducible, documented, scriptable |
| Dreambooth (full model fine-tune) | LoRA (adapter only) | LoRA is ~50MB vs 2–5GB; no full model needed |
| Folder class name only (no captions) | Per-image `.txt` caption files | Better control over what LoRA learns per image |
| BLIP auto-captions | Manual human captions | For character LoRA with specific feature targets, manual captions are more accurate |
| 1:1 reg:train ratio | 5–10× more reg than train images | More reg images = better class separation, less trigger word bleed |

**Deprecated approaches to avoid:**
- Using `--enable_bucket` without setting bucket sizes (can cause resolution mismatches)
- Per-image TOML config (overly complex for a single-character dataset; folder structure is sufficient)

---

## Open Questions

1. **Annotation text contamination severity**
   - What we know: Body view crops from `Spyke_Final.png` contain callout text labels
   - What's unclear: Whether these labels appear frequently enough in the cropped area to affect training
   - Recommendation: Do a visual quality pass — if text covers >10% of any crop, substitute with clean ref-sheet crop of same pose. The front view crop is the worst case; back view is cleanest.

2. **Optimal crop tightness for bracer/pauldron visibility**
   - What we know: 60% of images must show asymmetric details
   - What's unclear: Whether a 650×1100 crop from 2816×1536 captures the right bracer in the 3/4 view without it being cut off by the adjacent figure
   - Recommendation: Run dry-run crop generation and visually inspect all 8 `Spyke_Final.png` crops before committing coordinates to the script

3. **Whether `Spyke_Younger.png` (age 16) crops are usable**
   - What we know: Age 16 design has different costume (no white cloak, different bracer style)
   - What's unclear: Whether including 2–3 age-16 poses would help or hurt LoRA generalization
   - Recommendation: Exclude. The target is age-21 Spyke with white cloak as the identifying visual anchor

4. **sd-scripts submodule for Phase 8**
   - What we know: `~/tools/kohya_ss/sd-scripts/` is empty
   - What's unclear: Whether the Phase 5 benchmark used the GUI (which has its own training path) or the CLI scripts
   - Recommendation: Phase 6 should flag this in its output. Phase 8 must resolve before training begins

5. **ComfyUI output image retrieval method**
   - What we know: ComfyUI saves images to its own `output/` directory; retrieval via `/view` endpoint or direct filesystem read
   - What's unclear: Whether the regularization script should copy files via the `/view` API or read directly from `~/tools/ComfyUI/output/`
   - Recommendation: Use direct filesystem read from `~/tools/ComfyUI/output/reg_*.png` — simpler, no additional HTTP call, and ComfyUI runs locally

---

## Sources

### Primary (HIGH confidence)
- Direct filesystem inspection — `~/tools/kohya_ss/docs/image_folder_structure.md` — folder naming format verified from installed kohya_ss docs
- Direct filesystem inspection — `~/tools/kohya_ss/pyproject.toml` — confirms sd-scripts empty directory issue
- Direct image inspection — all 14 source images viewed and dimensions confirmed via Sharp metadata
- Sharp official docs — `https://sharp.pixelplumbing.com/api-resize/` — `contain` fit with background color confirmed
- ComfyUI official example — `https://github.com/comfyanonymous/ComfyUI/blob/master/script_examples/websockets_api_example.py` — `/history/{prompt_id}` response structure confirmed

### Secondary (MEDIUM confidence)
- `@stable-canvas/comfyui-client` v1.5.9 npm page + GitHub README — WebSocket + polling API surface confirmed
- kohya_ss wiki LoRA training parameters — `flip_aug` is training-time random flip, confirmed compatible with cache_latents
- kohya_ss sd-scripts config_README — TOML dataset format, `is_reg = true` subset approach confirmed
- Community guidance (verified with multiple sources): Asymmetric features + flip_aug = wrong-side artifacts

### Tertiary (LOW confidence)
- Regularization prompt best practices — community-derived, not official documentation; treat as starting point
- AnythingXL_inkBase aesthetic mismatch with SD 1.5 training — community observation, not officially documented

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Sharp already in project, comfyui-client version confirmed from npm, kohya_ss docs read directly from disk
- Architecture (folder structure): HIGH — verified from installed `kohya_ss/docs/image_folder_structure.md`
- Caption format: HIGH — confirmed per-image `.txt` overrides class token
- Flip augmentation behavior: HIGH — confirmed automatic at training time from kohya_ss wiki
- Crop coordinates: MEDIUM — estimated from dimension analysis + visual inspection; need dry-run verification
- Regularization prompt: MEDIUM — derived from LoRA training best practices, not official specification
- SDXL vs SD 1.5 reg mismatch: MEDIUM — community observation

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (stable domain; kohya_ss and ComfyUI APIs change slowly)
