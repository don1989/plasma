# Phase 6: Spyke Dataset Preparation - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Spyke LoRA training dataset: 15–20 captioned 512×512 images of Spyke + 100–200 regularization images. No model training happens here. Output is files on disk ready for Phase 8 (kohya_ss training).

</domain>

<decisions>
## Implementation Decisions

### Image sourcing
- `Spyke_Final.png` is a multi-pose reference sheet — crop individual views into separate training images
- Existing images in `output/characters/spyke-tinwall/` (7 ref-sheets) and `03_manga/concept/characters/spyke_tinwall/` (4 Gemini images) — review individually, pick best ones manually
- If crops + selected existing images don't reach 15 images, top up with ComfyUI-generated images
- Top-up generation uses `AnythingXL_inkBase.safetensors` (already installed) — consistent with v2.0 stack
- Generated images use plain/simple background — cleaner training signal, character not background
- All training images resized to exactly 512×512 square (standard for SD 1.5 LoRA)

### Pose and framing coverage
- At least 60% of images must show Spyke's distinctive asymmetric details clearly: right bracer, left knee pauldron, ginger hair, white cloak — these are the LoRA's learning targets
- Framing mix: ~70% full body, ~20% bust/waist-up, ~10% closeup
- Pose mix: ~50% neutral (standing, walking, resting) and ~50% combat/action (sword drawn, fighting stance, dynamic)
- Expression variety across the set: neutral, determined/serious, surprised, angry, calm — distributed throughout images (not clustered)

### Dataset storage location
- Lives inside the repo at `dataset/spyke/train/` (training images + captions) and `dataset/spyke/reg/` (regularization images)
- `.gitignore` updated to exclude `dataset/**/*.png` — images are large and regeneratable
- Caption `.txt` files ARE committed — they are the intellectual work
- Directory structure mirrors kohya_ss expected layout and scales to future characters (dataset/june/, dataset/draster/)

### Regularization generation
- Use a TypeScript script in `pipeline/` that posts jobs to ComfyUI's REST API in a loop — automated, no manual clicking
- Consistent with project stack; previews the @stable-canvas/comfyui-client usage planned for Phase 7
- Regularization prompt: Claude decides exact wording based on LoRA training best practices (generic anime character, no Spyke-specific details)
- Target: 100–200 images (meet requirement minimum of 100)

### Claude's Discretion
- Exact regularization prompt text (user deferred: use LoRA training best practices)
- Script structure for regularization generation (basic loop, error handling)
- Exact file naming convention within dataset/spyke/train/
- How many crops to extract from Spyke_Final.png (user will review, Claude proposes crop list)

</decisions>

<specifics>
## Specific Ideas

- Spyke's right bracer and left knee pauldron are intentionally asymmetric — training images must show both sides to teach the LoRA the asymmetry
- The white cloak is the most visually distinctive element — ensure it appears in most full-body shots
- Expression variety is explicitly desired (not just neutral) — affects how dynamic the generated panels feel
- The dataset/ directory should scale to accommodate June and Draster datasets in future (hence character-namespaced subdirs)

</specifics>

<deferred>
## Deferred Ideas

- **June LoRA training** — no canonical reference art exists yet; deferred to v2.1
- **Draster LoRA training** — no canonical reference art exists yet; deferred to v2.1
- Multi-LoRA stacking (Spyke + June in same scene) — out of scope for v2.0

</deferred>

---

*Phase: 06-spyke-dataset-preparation*
*Context gathered: 2026-02-19*
