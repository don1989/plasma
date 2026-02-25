---
phase: 06-spyke-dataset-preparation
plan: "02"
subsystem: dataset
tags: [sharp, lora, dataset, captions, flip-augmentation, spyke]

# Dependency graph
requires:
  - phase: 06-01
    provides: 15 final training PNGs at 512x512 in dataset/spyke/train/10_spyke_plasma_v1/
provides:
  - dataset/spyke/train/10_spyke_plasma_v1/ — 23 training PNGs (15 originals + 8 flips)
  - dataset/spyke/train/10_spyke_plasma_v1/*.txt — 23 caption files
  - .gitignore updated — dataset/**/*.png excluded, .txt committed
affects:
  - 06-04 (validation depends on captions and flips being present)
  - phase-08 (training ingests this directory)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Captions mode pattern: --captions flag added to crop-spyke.ts handles both flip generation and .txt writing"
    - "Flip augmentation: pre-generated disk files via sharp().flop() — NOT kohya --flip_aug (would corrupt asymmetric costume)"
    - "Caption format: trigger_word, framing, pose/action, background — 4+ comma-separated tokens"
    - "Mirrored captions: _flip.txt files append ', mirrored' to the base caption"

key-files:
  created:
    - dataset/spyke/train/10_spyke_plasma_v1/spyke_001.txt through spyke_023.txt (23 captions)
    - dataset/spyke/train/10_spyke_plasma_v1/spyke_004_flip.png through spyke_015_flip.png (8 flips)
  modified:
    - pipeline/src/scripts/crop-spyke.ts (added --captions mode with writeCaptionsAndFlips function)
    - .gitignore (added dataset/**/*.png exclusion)

key-decisions:
  - "Pre-generated flip files chosen over kohya --flip_aug: Spyke's right bracer and left knee pauldron are asymmetric — kohya's random flip would create incorrect mirrored training data for front/3q/side views"
  - "Only back views and face closeups are flipped (symmetric content): spyke_004–010, spyke_015"
  - "Front, 3q, side body views NOT flipped: spyke_001–003, spyke_012–014"
  - "Red bandana detail (spyke_011) NOT flipped: detail orientation matters"
  - "dataset/**/*.png excluded from git — images are regeneratable; .txt captions ARE committed"

patterns-established:
  - "Caption mode integrated into crop-spyke.ts — single source of truth for both crops and captions"
  - "flip:true in CROP_SOURCES drives which images get _flip.png generated — no separate config needed"

requirements-completed: [DATA-02, DATA-04]

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 6 Plan 02: Flip Augmentation + Captions Summary

**23 caption files written and 8 flipped copies generated — DATA-02 and DATA-04 complete**

## Performance

- **Duration:** ~2 min
- **Completed:** 2026-02-19
- **Tasks:** 1 of 1 (checkpoint: crop review — passed inline during session; final crops already generated)
- **Files modified:** 3 (crop-spyke.ts, .gitignore) + 23 new .txt + 8 new _flip.png

## Accomplishments

- Added `--captions` mode to `pipeline/src/scripts/crop-spyke.ts` — runs `writeCaptionsAndFlips()` against the final training dir
- Generated 23 caption `.txt` files (15 originals + 8 flip copies), all starting with `spyke_plasma_v1`
- Generated 8 flipped PNG copies for symmetric-only crops (back views + all 6 face closeups + younger back)
- Updated `.gitignore` to exclude `dataset/**/*.png` while leaving `.txt` captions committable

## Final Training Dataset State

| Category | Count |
|---|---|
| Original training images | 15 |
| Flip augmentation copies | 8 |
| **Total PNGs in train dir** | **23** |
| Caption .txt files | 23 |

### Flip-eligible crops (flip: true)

| File | ID | Reason |
|---|---|---|
| spyke_004_flip.png | spyke_final_back | Symmetric — back view, white cloak |
| spyke_005_flip.png | spyke_final_neutral | Symmetric — face closeup |
| spyke_006_flip.png | spyke_final_angry | Symmetric — face closeup |
| spyke_007_flip.png | spyke_final_battle | Symmetric — face closeup |
| spyke_008_flip.png | spyke_final_smirk | Symmetric — face closeup |
| spyke_009_flip.png | spyke_final_shocked | Symmetric — face closeup |
| spyke_010_flip.png | spyke_final_inner_pain | Symmetric — face closeup |
| spyke_015_flip.png | younger_back | Symmetric — back view, white cloak |

### NOT flipped (asymmetric costume details)

- spyke_001–003: front/3q/side — right bracer + left knee pauldron visible
- spyke_011: red bandana detail — orientation matters
- spyke_012–014: Spyke_Younger front/action/side — same asymmetry reason

### Sample captions

```
spyke_001.txt: spyke_plasma_v1, full body, front view, standing neutral, white background
spyke_004.txt: spyke_plasma_v1, full body, back view, white cloak visible, white background
spyke_004_flip.txt: spyke_plasma_v1, full body, back view, white cloak visible, white background, mirrored
spyke_005.txt: spyke_plasma_v1, closeup face, neutral expression, white background
```

## Deviations from Plan

**1. Crop coordinates revised between Plan 01 and Plan 02 (mid-session)**
- User reviewed Plan 01 preview images and identified expression crops were misaligned (all shifted right by ~1 panel)
- All 6 expression coordinates corrected via 2 dry-run iterations with visual image reads to map panel positions
- v1/v2/v7 ref-sheet crops (10 total) removed and replaced with 4 Spyke_Younger.png body crops
- Red Bandana detail shot added as 15th crop (to meet DATA-01 minimum)
- Final script updated before final mode was run — Plan 02 received correct final images

**No other deviations.** .gitignore update was part of the plan spec.

## Next Phase Readiness

- Plan 03 (reg image generation): Running in background — 100 images via ComfyUI
- Plan 04 (validation): Unblocked once reg gen completes

---
*Phase: 06-spyke-dataset-preparation*
*Completed: 2026-02-19*

## Self-Check: PASSED

- FOUND: 15 original PNGs in dataset/spyke/train/10_spyke_plasma_v1/
- FOUND: 8 _flip.png files
- FOUND: 23 .txt caption files
- FOUND: All captions start with spyke_plasma_v1
- FOUND: .gitignore excludes dataset/**/*.png
- FOUND: 06-02-SUMMARY.md
