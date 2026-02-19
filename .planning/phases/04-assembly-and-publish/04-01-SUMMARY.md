---
phase: 04-assembly-and-publish
plan: 01
subsystem: pipeline
tags: [sharp, svg, pango, overlay, text-rendering, speech-balloons]

# Dependency graph
requires:
  - phase: 03-image-generation-workflow
    provides: "Approved raw panel images via generation manifest"
  - phase: 02-script-and-characters
    provides: "script.json with dialogue lines per page/panel"
provides:
  - "Overlay type definitions (BalloonConfig, SfxConfig, PageOverlayData, OverlayConfig)"
  - "SVG speech balloon generator for speech/thought/narration types"
  - "Text measurement via Sharp Pango for auto-sizing balloons"
  - "SFX text renderer with Pango markup"
  - "Page overlay compositor (overlayPage) compositing balloons + SFX onto panels"
  - "Overlay stage reading script.json + generation manifest, writing to lettered/"
  - "CLI --page and --pages options for selective overlay"
affects: [04-02-PLAN, assemble-stage]

# Tech tracking
tech-stack:
  added: []
  patterns: [svg-buffer-compositing, zone-based-balloon-placement, pango-text-measurement]

key-files:
  created:
    - pipeline/src/types/overlay.ts
    - pipeline/src/overlay/balloon.ts
    - pipeline/src/overlay/text-measure.ts
    - pipeline/src/overlay/sfx.ts
    - pipeline/src/overlay/renderer.ts
  modified:
    - pipeline/src/stages/overlay.ts
    - pipeline/src/cli.ts

key-decisions:
  - "SVG balloon word-wrap uses character-count heuristic (width/8 chars per line) for simple v1 implementation"
  - "Zone-based balloon placement: image divided vertically by panel count, balloons alternate left-right"
  - "Speech tail is a simple triangle pointing down from bottom-center of ellipse"
  - "Thought bubbles use dashed-stroke ellipse (not trailing circles) for v1 simplicity"
  - "Passthrough mode copies raw image directly when page has no dialogue and no SFX"
  - "OverlayOptions interface separate from StageOptions to support page/pages filtering"

patterns-established:
  - "SVG-to-Buffer compositing: generate SVG string, Buffer.from(), pass to sharp.composite()"
  - "Zone-based overlay placement: divide image height by panel count for spatial distribution"
  - "Passthrough pattern: copy raw to lettered when no overlays needed (maintains stage chain)"

requirements-completed: [TEXT-01, TEXT-02, ASSM-04]

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 4 Plan 1: Dialogue Overlay Summary

**Programmatic dialogue overlay stage with SVG speech balloons, Pango text measurement, SFX rendering, and zone-based compositor writing lettered PNGs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T08:47:08Z
- **Completed:** 2026-02-19T08:51:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Built complete overlay module (types, balloon SVG, text measurement, SFX renderer, page compositor)
- Replaced overlay stage stub with full implementation reading script.json + generation manifest
- Added --page and --pages CLI options for selective page overlay
- Implemented passthrough mode for pages with no dialogue/SFX

## Task Commits

Each task was committed atomically:

1. **Task 1: Create overlay types, SVG balloon generator, and text measurement** - `da38b78` (feat)
2. **Task 2: Build overlay renderer and wire overlay stage with CLI support** - `7aca122` (feat)

## Files Created/Modified
- `pipeline/src/types/overlay.ts` - Overlay-specific types (BalloonConfig, SfxConfig, PageOverlayData, OverlayConfig) with DEFAULT_OVERLAY_CONFIG
- `pipeline/src/overlay/balloon.ts` - SVG speech balloon generator for speech (ellipse + tail), thought (dashed ellipse), narration (rounded rectangle) types
- `pipeline/src/overlay/text-measure.ts` - Text measurement via Sharp Pango for auto-sizing balloon dimensions
- `pipeline/src/overlay/sfx.ts` - SFX text rendering with Pango markup, skips empty/em-dash text
- `pipeline/src/overlay/renderer.ts` - Page compositor orchestrating balloon placement and SFX onto panel images
- `pipeline/src/stages/overlay.ts` - Stage entry point reading script.json + manifest, producing lettered PNGs
- `pipeline/src/cli.ts` - Added --page and --pages options to overlay subcommand with range parsing

## Decisions Made
- Used SVG-to-Buffer approach for balloon rendering (Sharp composites SVG buffers directly, no temp files)
- Zone-based balloon placement divides image height by panel count, alternates left/right for readability
- Thought bubbles use dashed-stroke ellipse rather than trailing small circles (simpler for v1, visually distinct)
- Speech balloon tail is a simple downward-pointing triangle at bottom-center
- Passthrough mode preserves stage chain by copying raw images to lettered/ even when no overlays needed
- Created separate OverlayOptions interface (not extending StageOptions) to support page/pages filtering cleanly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Sharp OverlayOptions import**
- **Found during:** Task 2 (renderer.ts)
- **Issue:** Initially imported `OverlayComposite` from sharp which does not exist; the correct type is `OverlayOptions`
- **Fix:** Changed import to `OverlayOptions` from sharp
- **Files modified:** pipeline/src/overlay/renderer.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 7aca122 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type name correction. No scope creep.

## Issues Encountered
None beyond the Sharp type name correction noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Overlay stage complete and wired to CLI
- Ready for Plan 04-02: Webtoon vertical strip assembly stage
- The lettered/ directory output feeds directly into the assemble stage

## Self-Check: PASSED

All 7 files verified present. Both task commits (da38b78, 7aca122) verified in git log.

---
*Phase: 04-assembly-and-publish*
*Completed: 2026-02-19*
