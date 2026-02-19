---
phase: 02-scripts-characters-and-prompts
plan: 03
subsystem: characters
tags: [yaml, character-fingerprints, registry, cli, case-insensitive-lookup, style-guide]

# Dependency graph
requires:
  - phase: 02-scripts-characters-and-prompts
    provides: "CharacterFingerprintSchema, CharacterFingerprint type, PATHS.characterData/styleGuide"
provides:
  - "5 character YAML files with locked prompt fingerprints (Spyke, June, Draster, Hood, Punks)"
  - "CharacterRegistry class with loadAll, get, getFingerprint, getReferenceSheetPrompt, has, getAll"
  - "Case-insensitive lookup by id, name, or any alias"
  - "Style guide YAML config with verbatim style_prefix for Gemini prompts"
  - "CLI character list, add, and ref-sheet subcommands"
  - "scaffoldCharacterYaml utility for creating new character YAML files"
affects: [02-template-engine, 02-prompt-generator, 03-generation]

# Tech tracking
tech-stack:
  added: []
  patterns: [YAML data files validated by Zod schema on load, case-insensitive Map indexing, graceful skip on invalid YAML, CLI subcommand groups with Commander]

key-files:
  created:
    - pipeline/data/characters/spyke-tinwall.yaml
    - pipeline/data/characters/june-kamara.yaml
    - pipeline/data/characters/draster.yaml
    - pipeline/data/characters/hood-morkain.yaml
    - pipeline/data/characters/punks.yaml
    - pipeline/data/config/style-guide.yaml
    - pipeline/src/characters/registry.ts
    - pipeline/tests/characters/registry.test.ts
  modified:
    - pipeline/src/cli.ts
    - pipeline/src/types/characters.ts
    - pipeline/src/types/index.ts

key-decisions:
  - "Removed CharacterRegistry type alias from characters.ts, replaced by CharacterRegistry class in registry.ts"
  - "ref-sheet CLI uses simple string concatenation (not Nunjucks) for immediate utility without template engine dependency"
  - "Character fingerprints sourced verbatim from existing tested prompts in 03_manga/prompts/"

patterns-established:
  - "YAML data files in pipeline/data/ validated by Zod schemas at load time"
  - "Case-insensitive registry: all keys stored lowercase, lookup normalizes input"
  - "CLI character subcommands are lightweight utilities, not pipeline stages (no StageOptions/StageResult)"

requirements-completed: [CHAR-01, CHAR-03, CHAR-04]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 2 Plan 3: Character Fingerprints and Registry Summary

**5 character YAML fingerprints with case-insensitive registry, style guide config, and CLI subcommands for listing, scaffolding, and generating reference sheet prompts**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T05:52:34Z
- **Completed:** 2026-02-19T05:57:32Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Created 5 character YAML files with locked prompt fingerprints sourced verbatim from tested Gemini prompts
- Built CharacterRegistry class with case-insensitive lookup by id, name, or any alias across 5 characters
- Style guide config stores the verbatim style prefix in a single YAML file
- CLI `character list` displays all characters, `character add` scaffolds new YAML files, `character ref-sheet` outputs Gemini-ready reference sheet prompts
- 16 registry tests covering loading, case-insensitive lookup, alias consistency, deduplication, and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create character YAML files and style guide config** - `253fc0a` (feat)
2. **Task 2: Build CharacterRegistry, CLI character subcommands, and tests** - `500b9e2` (feat)

## Files Created/Modified
- `pipeline/data/characters/spyke-tinwall.yaml` - Spyke's locked fingerprint, reference sheet prompt, palette, variants
- `pipeline/data/characters/june-kamara.yaml` - June's locked fingerprint and reference sheet prompt
- `pipeline/data/characters/draster.yaml` - Draster's locked fingerprint and reference sheet prompt
- `pipeline/data/characters/hood-morkain.yaml` - Hood/Morkain's locked fingerprint and reference sheet prompt
- `pipeline/data/characters/punks.yaml` - Punk group fingerprint and reference sheet prompt
- `pipeline/data/config/style-guide.yaml` - Verbatim style prefix, setting description, weapon glow note
- `pipeline/src/characters/registry.ts` - CharacterRegistry class with loadAll, get, getFingerprint, etc.
- `pipeline/tests/characters/registry.test.ts` - 16 tests for registry loading, lookup, and validation
- `pipeline/src/cli.ts` - Added character list, add, ref-sheet subcommands
- `pipeline/src/types/characters.ts` - Removed CharacterRegistry type alias (replaced by class)
- `pipeline/src/types/index.ts` - Updated barrel export (removed CharacterRegistry type)

## Decisions Made
- Removed the `CharacterRegistry` type alias (`Map<string, CharacterFingerprint>`) from `characters.ts` since the new `CharacterRegistry` class replaces it with richer functionality
- CLI `ref-sheet` command uses simple string concatenation (style prefix + reference_sheet_prompt + layout instructions) instead of Nunjucks templates, providing immediate utility before the template engine is built in Plan 04
- Character fingerprints were sourced verbatim from the Character Quick Reference in `pages-01-to-15.md` and the character sheet prompts in `character-sheets.md` -- these are the tested descriptions that produce consistent Gemini output

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed conflicting CharacterRegistry type alias**
- **Found during:** Task 2 (CharacterRegistry class creation)
- **Issue:** The existing `CharacterRegistry` type alias in `characters.ts` (`Map<string, CharacterFingerprint>`) conflicts with the new `CharacterRegistry` class name
- **Fix:** Removed the type alias and updated the barrel export in `index.ts`. The class provides all the same functionality plus validation and convenience methods.
- **Files modified:** `pipeline/src/types/characters.ts`, `pipeline/src/types/index.ts`
- **Verification:** `pnpm run typecheck` exits 0, no consumers of the old type alias found
- **Committed in:** `500b9e2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking name conflict)
**Impact on plan:** Necessary to avoid TypeScript naming collision. No scope creep.

## Issues Encountered
- Pre-existing test failures (10) in `tests/parsers/script-parser.test.ts` from Plan 02-02 are unrelated to this plan's changes. All 16 character registry tests pass. All 37 pre-existing tests from Plan 02-01 still pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CharacterRegistry is ready for the template engine (Plan 04) to inject fingerprints into Nunjucks templates
- Style guide config at `PATHS.styleGuide` is ready for template and prompt generation stages
- CLI `character ref-sheet` provides immediate utility for generating Gemini reference sheet prompts
- `loadCharacterRegistry()` convenience function available for any module needing character lookup

## Self-Check: PASSED

All 11 claimed files verified present on disk. Both commit hashes (253fc0a, 500b9e2) verified in git log.

---
*Phase: 02-scripts-characters-and-prompts*
*Completed: 2026-02-19*
