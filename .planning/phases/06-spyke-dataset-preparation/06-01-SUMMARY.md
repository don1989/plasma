---
phase: 06-spyke-dataset-preparation
plan: "01"
subsystem: dataset
tags: [sharp, lora, dataset, crop, spyke, comfyui, training]

# Dependency graph
requires:
  - phase: 05-environment-validation
    provides: ComfyUI and kohya_ss installed — prerequisite for training phase
  - phase: 03-image-generation
    provides: ref-sheet-v1.png, ref-sheet-v2.png, ref-sheet-v7.png source images
provides:
  - pipeline/src/scripts/crop-spyke.ts — crop tool with 19 CROP_SOURCES, --dry-run and final modes
  - dataset/spyke/train/10_spyke_plasma_v1/ directory scaffold with preview/ subdirectory
  - dataset/spyke/reg/1_anime_character/ regularization directory placeholder
  - 19 preview PNG files (512x512 letterboxed crops) for visual review
affects:
  - 06-02 (flip augmentation and caption writing depends on reviewed crop approval)
  - 06-03 (dataset must be complete before LoRA training config)
  - phase-08 (LoRA training ingests dataset/spyke/train/10_spyke_plasma_v1/)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone script pattern: no Commander for simple scripts — manual process.argv parsing"
    - "Dry-run preview pattern: --dry-run flag writes to preview/ subdirectory, final mode writes to parent"
    - "LoRA dataset naming: 10_spyke_plasma_v1 follows kohya_ss repeat_count_trigger_word convention"

key-files:
  created:
    - pipeline/src/scripts/crop-spyke.ts
    - dataset/spyke/train/10_spyke_plasma_v1/.gitkeep
    - dataset/spyke/train/10_spyke_plasma_v1/preview/.gitkeep
    - dataset/spyke/reg/1_anime_character/.gitkeep
  modified: []

key-decisions:
  - "Standalone script uses manual process.argv (not Commander) — zero dep overhead for single-flag utility"
  - "Dry-run writes to preview/ subdirectory, not final dir — user can safely run and inspect without polluting final output"
  - "_back crop left coordinate corrected from 790 to 784 for all ref-sheets (1024px wide images; 790+240=1030 out of bounds)"
  - "spyke_final_calm marked SPECULATIVE in both code comment and summary — must be visually confirmed or excluded at Plan 02 review"
  - "Phase 8 blocker noted: ~/tools/kohya_ss/sd-scripts/ is empty — run git submodule update --init --recursive before Phase 8"

patterns-established:
  - "Crop coordinate table: all coords in CROP_SOURCES at top of script — easy to scan and update"
  - "Caption strings stored in CROP_SOURCES alongside crop coords — single source of truth for Plan 02 .txt generation"
  - "flip flag embedded in CROP_SOURCES — Plan 02 reads this to know which crops to horizontally flip for augmentation"

requirements-completed: [DATA-01, DATA-04]

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 6 Plan 01: Spyke Dataset Preparation Summary

**Sharp-based crop script with 19 CROP_SOURCES (18 confirmed + 1 speculative) extracts 512x512 letterboxed training images from Spyke_Final.png and three ref-sheets, with --dry-run producing 19 preview PNGs for visual review before finalizing**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-19T17:33:25Z
- **Completed:** 2026-02-19T17:36:00Z
- **Tasks:** 1 of 1
- **Files modified:** 4 (created)

## Accomplishments

- Built `pipeline/src/scripts/crop-spyke.ts` with documented CROP_SOURCES table covering all 4 Spyke reference sheets
- All 19 dry-run preview PNGs generated successfully at 512x512 with white letterbox background
- Directory scaffold committed: `dataset/spyke/train/10_spyke_plasma_v1/`, `preview/`, `dataset/spyke/reg/1_anime_character/`
- Script exits 0 in dry-run mode with summary table printed to stdout

## Task Commits

Each task was committed atomically:

1. **Task 1: Create dataset directory structure and crop script** - `3ae6751` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `pipeline/src/scripts/crop-spyke.ts` — Crop tool with 19 CROP_SOURCES, --dry-run + final modes, Sharp extract/resize/letterbox pipeline, summary table printer
- `dataset/spyke/train/10_spyke_plasma_v1/.gitkeep` — Directory placeholder for final training images
- `dataset/spyke/train/10_spyke_plasma_v1/preview/.gitkeep` — Directory placeholder for dry-run preview images (19 PNGs now present)
- `dataset/spyke/reg/1_anime_character/.gitkeep` — Regularization image directory placeholder

## Decisions Made

- `process.argv` over Commander for dry-run flag — standalone script, one flag, no reason to add Commander
- Dry-run preview goes to `preview/` subdirectory — protects final output dir, lets user inspect without consequences
- `spyke_final_calm` kept in script but flagged SPECULATIVE with inline comment and NOTE in summary output

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed out-of-bounds crop coordinates for ref-sheet _back views**
- **Found during:** Task 1 (crop script execution / dry-run verification)
- **Issue:** All three ref-sheet `_back` crops used `left: 790, width: 240` on 1024px-wide images. `790 + 240 = 1030 > 1024` — Sharp throws `extract_area: bad extract area`.
- **Fix:** Adjusted `left` from `790` to `784` so right edge = `784 + 240 = 1024` exactly. Added inline `// NOTE:` comment explaining the adjustment for future maintainers.
- **Files modified:** `pipeline/src/scripts/crop-spyke.ts` (three entries: v1_back, v7_back, v2_back)
- **Verification:** Re-ran `--dry-run`; all 19 crops succeeded with exit 0.
- **Committed in:** `3ae6751` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - coordinate bounds bug)
**Impact on plan:** Necessary correctness fix — coordinates from research phase were 6px out of bounds for 1024px images. No scope creep.

## Issues Encountered

None beyond the auto-fixed coordinate bounds issue.

## Dry-Run Results by Source

| Source | Crops | Status |
|--------|-------|--------|
| Spyke_Final.png (2816x1536) | 9 (4 full-body + 5 expressions) | All OK |
| ref-sheet-v1.png (1024x1024) | 4 views | All OK (after left coord fix) |
| ref-sheet-v7.png (1024x1024) | 4 views | All OK (after left coord fix) |
| ref-sheet-v2.png (1024x1024) | 2 views (front + back) | All OK (after left coord fix) |

**Speculative crop:** `spyke_final_calm` (left:1260, top:1230, 380x280 from Spyke_Final.png) generated a preview PNG. Whether it shows a distinct expression panel or is blank/overlap requires user visual review at the Plan 02 checkpoint. If no distinct calm panel exists, exclude from final dataset.

**Crop coordinates confidence:** MEDIUM — all coordinates derived from research estimates against confirmed image dimensions. User must visually review all 19 preview PNGs in `dataset/spyke/train/10_spyke_plasma_v1/preview/` before running final mode.

## Phase 8 Blocker (noted for future execution)

`~/tools/kohya_ss/sd-scripts/` is empty — the sd-scripts submodule was not initialized. Before Phase 8 (LoRA training) begins, run:

```bash
cd ~/tools/kohya_ss && git submodule update --init --recursive
```

## Next Phase Readiness

- Plan 02 (flip augmentation + caption .txt files) is unblocked — it depends on user review of preview PNGs from this plan
- User should open `dataset/spyke/train/10_spyke_plasma_v1/preview/` and verify all crops before the Plan 02 checkpoint
- The `flip` and `caption` fields in `CROP_SOURCES` are already populated, ready for Plan 02 to read

---
*Phase: 06-spyke-dataset-preparation*
*Completed: 2026-02-19*

## Self-Check: PASSED

- FOUND: pipeline/src/scripts/crop-spyke.ts
- FOUND: dataset/spyke/train/10_spyke_plasma_v1/.gitkeep
- FOUND: dataset/spyke/train/10_spyke_plasma_v1/preview/.gitkeep
- FOUND: dataset/spyke/reg/1_anime_character/.gitkeep
- FOUND: 06-01-SUMMARY.md
- FOUND: 19 preview PNGs in dataset/spyke/train/10_spyke_plasma_v1/preview/
- FOUND: commit 3ae6751
