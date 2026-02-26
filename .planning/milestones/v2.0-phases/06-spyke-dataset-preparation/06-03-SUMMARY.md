---
phase: 06-spyke-dataset-preparation
plan: "03"
subsystem: dataset
tags: [comfyui, lora, dataset, regularization, gen-reg]

# Dependency graph
requires:
  - phase: 05-environment-validation
    provides: ComfyUI installed at ~/tools/ComfyUI with AnythingXL_inkBase.safetensors
provides:
  - pipeline/src/scripts/gen-reg.ts — ComfyUI REST API regularization image generator
  - dataset/spyke/reg/1_anime_character/ — 100 generic anime character PNGs at 512x512
affects:
  - 06-04 (validation checks reg count >= 100)
  - phase-08 (kohya_ss ingests reg dir for class separation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ComfyUI REST API: POST /prompt → poll /history/{prompt_id} → copyFile from ComfyUI output dir"
    - "No new npm packages: Node.js built-in fetch (Node 18+), fs/promises, crypto"
    - "Resume support: script counts existing PNGs at startup, skips to next index"
    - "Skip-and-continue error strategy: failed generations are logged and skipped, loop continues"

key-files:
  created:
    - pipeline/src/scripts/gen-reg.ts
    - dataset/spyke/reg/1_anime_character/reg_001.png through reg_100.png
  modified: []

key-decisions:
  - "Raw fetch + polling over ComfyUI SDK — zero new deps, simpler for a one-shot generation script"
  - "AnythingXL_inkBase.safetensors chosen — only checkpoint available in ComfyUI installation"
  - "Negative prompt explicitly excludes spyke_plasma_v1 trigger + red bandana, white cloak, ginger hair — ensures reg images have no Spyke features"
  - "COMFYUI_OUTPUT_DIR hardcoded to ~/tools/ComfyUI/output — ComfyUI saves to its own dir, script copies to reg dir"

patterns-established:
  - "--count N flag: override default 100 target for test runs (--count 5)"
  - "Resume pattern: count existing .png files at startup, start index from existing+1"

requirements-completed: [DATA-03]

# Metrics
duration: 26min 25sec (1585s)
images_generated: 100
failures: 0
avg_per_image: ~15.85s
completed: 2026-02-19
---

# Phase 6 Plan 03: Regularization Image Generation Summary

**100 generic anime character images generated via ComfyUI REST API in 26m 25s — DATA-03 complete**

## Performance

- **Duration:** 26m 25s (1585s total)
- **Images generated:** 100
- **Failures:** 0
- **Average per image:** ~15.9s (MPS on Apple Silicon)
- **Completed:** 2026-02-19

## Accomplishments

- Built `pipeline/src/scripts/gen-reg.ts` using Node.js built-in fetch + polling (no new npm packages)
- Test run of 5 images succeeded before full batch: 0 failures, correct dimensions
- Full 100-image batch completed: 0 failures
- All images confirmed generic anime characters — no Spyke features (no red bandana, white cloak, ginger hair)
- Zero `.txt` files in reg directory

## Script Design

```
POST /prompt → extract prompt_id → poll /history/{prompt_id} → copyFile from ComfyUI output/
```

- Model: AnythingXL_inkBase.safetensors (only checkpoint in ComfyUI)
- Resolution: 512×512, 20 steps, cfg=7, euler_ancestral sampler
- Each image uses a unique random seed (Math.random() × 2^32)
- Timeout: 2 minutes per image; skip-and-continue on failure

## Visual Spot-Check

First reg image (`reg_001.png`) confirmed: generic anime fantasy warrior, full body, white background, clean lineart, no Spyke-specific features.

## Dataset State After Plan 03

| Location | Contents |
|---|---|
| dataset/spyke/train/10_spyke_plasma_v1/ | 23 PNGs (15 orig + 8 flips) + 23 captions |
| dataset/spyke/reg/1_anime_character/ | 100 PNGs, 0 captions |

## Next Phase Readiness

- Plan 04 (validation): Unblocked — reg count now satisfies DATA-03

---
*Phase: 06-spyke-dataset-preparation*
*Completed: 2026-02-19*

## Self-Check: PASSED

- FOUND: pipeline/src/scripts/gen-reg.ts
- FOUND: 100 PNGs in dataset/spyke/reg/1_anime_character/
- FOUND: 0 .txt files in reg dir
- CONFIRMED: All images 512x512 (validation script)
- FOUND: 06-03-SUMMARY.md
