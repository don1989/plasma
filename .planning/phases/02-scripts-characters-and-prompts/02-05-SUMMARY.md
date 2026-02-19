---
phase: 02-scripts-characters-and-prompts
plan: 05
subsystem: testing
tags: [qc, character-consistency, checklist, cross-reference]

requires:
  - phase: 02-02
    provides: Parsed Chapter objects from script parser
  - phase: 02-03
    provides: CharacterRegistry with fingerprint lookup
provides:
  - QC checklist generator for character-panel cross-referencing
  - Markdown QC report formatter
affects: [03-image-generation-workflow]

tech-stack:
  added: []
  patterns: [cross-reference validation, markdown report generation]

key-files:
  created:
    - pipeline/src/characters/qc.ts
    - pipeline/tests/characters/qc.test.ts
  modified: []

key-decisions:
  - "QC module is a standalone library (not wired to CLI) — consumed by prompt stage or called programmatically"
  - "Unknown characters produce warnings, not errors — minor characters (registrar, commuters) don't need fingerprints"

patterns-established:
  - "Cross-reference pattern: parsed data + registry + generated output = verification report"

requirements-completed: [CHAR-02]

duration: 3min
completed: 2026-02-19
---

# Plan 02-05: QC Checklist Summary

**Per-panel character QC checklist cross-referencing script panels against character registry with fingerprint verification in generated prompts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T06:08:00Z
- **Completed:** 2026-02-19T06:11:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- QC checklist generator that cross-references every character appearance in every panel against the character registry
- Markdown report formatter producing human-readable QC reports with per-page summaries and overall statistics
- Fingerprint verification confirming that generated prompts actually contain the expected character description text
- Warning system for unknown characters (characters in script but not in registry)

## Task Commits

1. **Task 1: QC checklist module and tests** - `563cbdb` (feat)

## Files Created/Modified
- `pipeline/src/characters/qc.ts` - QC checklist generator with `generateQCChecklist`, `formatQCReport`, and `extractCharacterNames` exports
- `pipeline/tests/characters/qc.test.ts` - Comprehensive tests for QC module

## Decisions Made
- QC module extracts character names from both dialogue speakers and action text pattern matching
- Missing characters logged as warnings with notes, not hard failures
- Report format includes per-page breakdown and overall summary statistics

## Deviations from Plan
None - plan executed as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- QC module ready for integration with prompt stage or standalone use
- Phase 2 complete — all 12 requirements covered

---
*Phase: 02-scripts-characters-and-prompts*
*Completed: 2026-02-19*
