---
phase: 06-spyke-dataset-preparation
plan: "04"
subsystem: dataset
tags: [validation, lora, dataset, spyke]

# Dependency graph
requires:
  - phase: 06-02
    provides: 23 training PNGs + 23 captions + 8 flips
  - phase: 06-03
    provides: 100 reg images
provides:
  - pipeline/src/scripts/validate-dataset.ts — dataset validation script
  - Confirmed: DATA-01 through DATA-04 all PASS
affects:
  - phase-08 (LoRA training — dataset is ready pending Phase 8 blocker fix)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validation script pattern: exit 0 = PASS, exit 1 = FAIL — CI-compatible"
    - "Color-coded output: green [PASS] / red [FAIL] with specific error file names printed"
    - "Dimension sampling: sharp metadata check on first 5 training + 5 reg images"

key-files:
  created:
    - pipeline/src/scripts/validate-dataset.ts
  modified: []

key-decisions:
  - "Samples first 5 images for dimension check (not all 123) — fast enough, catches systematic errors"
  - "Warnings vs errors: .txt files in reg dir are warnings (not blocking), not a hard fail"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04]

# Metrics
duration: 1min
completed: 2026-02-19
---

# Phase 6 Plan 04: Dataset Validation Summary

**All DATA-01 through DATA-04 checks PASS — Phase 6 complete**

## Validation Output

```
=== Spyke Dataset Validation ===

Directory: dataset/spyke/train/10_spyke_plasma_v1  [PASS] exists
Directory: dataset/spyke/reg/1_anime_character     [PASS] exists
DATA-01: Training originals                        [PASS] 15 images (expected 15–30)
DATA-02: Caption pairing                           [PASS] 23/23 images have captions
DATA-02: Trigger word                              [PASS] All 23 captions start with spyke_plasma_v1
DATA-02: Caption format (4+ tokens)               [PASS] All captions have 4+ comma-separated fields
DATA-03: Reg image count                           [PASS] 100 images (expected 100–200)
DATA-03: No captions in reg dir                    [PASS] 0 .txt files
DATA-04: Flip augmentation images                  [PASS] 8 flip images
DIMENSIONS: Training sample (5 sampled)            [PASS] All 512x512
DIMENSIONS: Reg sample (5 sampled)                 [PASS] All 512x512

==================================================
Result: PASS (0 errors, 0 warnings)
```

## Final Dataset Counts

| Metric | Value |
|---|---|
| Training originals | 15 |
| Flip augmentation copies | 8 |
| Total training PNGs | 23 |
| Caption .txt files | 23 |
| Regularization images | 100 |
| Caption files in reg dir | 0 |

## Human Visual Verification

Visual spot-checks confirmed throughout the session:
- Training images show Spyke with correct costume (white cloak, red bandana, asymmetric right bracer/left knee pauldron)
- All 6 expression crops show distinct, clean single-face images (corrected after review)
- Reg images show generic anime characters — no Spyke features
- Flip images only generated for back views + face closeups (asymmetric front/3q/side NOT flipped)

## PHASE 8 BLOCKER

`~/tools/kohya_ss/sd-scripts/` submodule is empty. Before Phase 8 (LoRA Training) can begin:

```bash
cd ~/tools/kohya_ss && git submodule update --init --recursive
```

`train_network.py` lives in sd-scripts and will be missing until this is run.

## Phase 6 Complete

All four DATA requirements satisfied:
- **DATA-01** ✓ 15 training images (min: 15)
- **DATA-02** ✓ 23/23 captions with trigger word and 4+ tokens
- **DATA-03** ✓ 100 regularization images (min: 100)
- **DATA-04** ✓ 8 flip augmentation copies for symmetric crops only

Phase 8 (Spyke LoRA Training) is unblocked pending the sd-scripts submodule fix above.

---
*Phase: 06-spyke-dataset-preparation*
*Completed: 2026-02-19*

## Self-Check: PASSED

- FOUND: pipeline/src/scripts/validate-dataset.ts
- CONFIRMED: tsx validate-dataset.ts exits 0 with Result: PASS
- FOUND: 06-04-SUMMARY.md
- DOCUMENTED: Phase 8 blocker (sd-scripts submodule)
