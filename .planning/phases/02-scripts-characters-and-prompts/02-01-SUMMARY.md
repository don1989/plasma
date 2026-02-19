---
phase: 02-scripts-characters-and-prompts
plan: 01
subsystem: types
tags: [zod, typescript, validation, schemas, manga-types, character-types, nunjucks, yaml, unified, remark-parse]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Pipeline scaffold with stub types (Panel, Page, Chapter) and centralized PATHS config"
provides:
  - "Expanded Panel/Page/Chapter interfaces with shotType, dialogue, isSplash, isDoubleSpread fields"
  - "CharacterFingerprint and CharacterRegistry types for prompt generation"
  - "DialogueLine type for structured dialogue extraction"
  - "Zod validation schemas (PanelSchema, PageSchema, ChapterSchema, CharacterFingerprintSchema)"
  - "Custom refinements: splash pages must have 1 panel, chapters must have Wide shot"
  - "Warning-level panel count check (checkPagePanelCountWarnings)"
  - "New PATHS: characterData, templates, styleGuide, pipelineRoot, prompts in chapterOutput"
  - "Phase 2 dependencies: nunjucks, yaml, zod, unified, remark-parse, unist-util-visit"
affects: [02-parser, 02-character-registry, 02-template-engine, 03-generation]

# Tech tracking
tech-stack:
  added: [nunjucks@3.2.4, yaml@2.8.2, zod@4.3.6, unified@11.0.5, remark-parse@11.0.0, unist-util-visit@5.1.0, "@types/nunjucks@3.2.6", "@types/mdast@4.0.4"]
  patterns: [Zod schema-first validation with z.infer type derivation, custom refinements via .check() for domain rules, warning-level checks separate from hard validation, schema + inferred type co-export pattern]

key-files:
  created:
    - pipeline/src/types/characters.ts
    - pipeline/src/schemas/manga.schema.ts
    - pipeline/src/schemas/character.schema.ts
    - pipeline/tests/schemas/manga.schema.test.ts
    - pipeline/tests/schemas/character.schema.test.ts
  modified:
    - pipeline/package.json
    - pipeline/pnpm-lock.yaml
    - pipeline/src/types/manga.ts
    - pipeline/src/types/index.ts
    - pipeline/src/config/paths.ts

key-decisions:
  - "Used z.string() for shotType instead of z.enum() because scripts contain compound types like 'Wide (Action)'"
  - "Warning-level panel count check instead of hard rejection -- action montages break typical 4-7 panel range"
  - "Zod v4 .check() API with input field for custom refinement issues"
  - "Schema + inferred type co-export pattern (export schema and z.infer type from same file)"

patterns-established:
  - "Schema co-export: every schema file exports both the Zod schema and the z.infer'd TypeScript type"
  - "Custom refinements use .check() with code:'custom' and input:ctx.value for Zod v4 compatibility"
  - "Warning-level checks are separate functions (not schema refinements) that return string arrays"
  - "Test data builders: validPanel(), validPage(), validChapter() helper functions with override pattern"

requirements-completed: [SCRP-02, SCRP-03, CHAR-04]

# Metrics
duration: 7min
completed: 2026-02-19
---

# Phase 2 Plan 1: Dependencies and Type System Summary

**Zod v4 validation schemas with expanded Panel/Page/Chapter/CharacterFingerprint types, custom manga refinements (splash page rules, Wide shot requirement), and 24 new tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-18T22:58:12Z
- **Completed:** 2026-02-19T05:48:49Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Installed 8 Phase 2 dependencies (nunjucks, yaml, zod, unified, remark-parse, unist-util-visit, @types/nunjucks, @types/mdast)
- Expanded manga types with full field set matching chapter script format (shotType, dialogue, isSplash, isDoubleSpread, themeBeat, etc.)
- Created CharacterFingerprint interface with id, name, aliases, fingerprint, palette, variants fields
- Built Zod validation schemas with domain-specific refinements (splash page panel count, Wide shot requirement, kebab-case id regex)
- Added 24 new tests (37 total) covering valid data, edge cases, and validation failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and expand types** - `e55a054` (feat)
2. **Task 2: Create Zod validation schemas with tests** - `23d37be` (feat)

## Files Created/Modified
- `pipeline/package.json` - Added 6 runtime and 2 dev dependencies
- `pipeline/pnpm-lock.yaml` - Lock file updated for 55 new packages
- `pipeline/src/types/manga.ts` - Expanded Panel, Page, Chapter with all fields; added DialogueLine
- `pipeline/src/types/characters.ts` - New file: CharacterFingerprint interface and CharacterRegistry type
- `pipeline/src/types/index.ts` - Updated barrel exports for DialogueLine, CharacterFingerprint, CharacterRegistry
- `pipeline/src/config/paths.ts` - Added pipelineRoot, characterData, templates, styleGuide, prompts paths
- `pipeline/src/schemas/manga.schema.ts` - Zod schemas for DialogueLine, Panel, Page, Chapter with refinements
- `pipeline/src/schemas/character.schema.ts` - Zod schema for CharacterFingerprint with kebab-case id and min fingerprint length
- `pipeline/tests/schemas/manga.schema.test.ts` - 17 tests for manga schema validation
- `pipeline/tests/schemas/character.schema.test.ts` - 7 tests for character schema validation

## Decisions Made
- Used z.string() for shotType instead of z.enum() because chapter scripts contain compound types like "Wide (Action)" that would be rejected by a strict enum
- Made panel count range (4-7) a warning-level check rather than hard validation -- action montages and stylistic layouts legitimately break this range
- Used Zod v4 .check() API (not .refine()) for custom refinements, requiring input field in issue objects for type safety
- Co-exported schema and z.infer'd type from each schema file so consumers can import either

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 custom issue requires `input` field**
- **Found during:** Task 2 (schema creation)
- **Issue:** Zod v4's .check() API requires an `input` field in custom issue objects, unlike documented Zod v3 API. TypeScript rejected `{ code: 'custom', message: '...' }` without `input`.
- **Fix:** Added `input: ctx.value` to all custom issue objects in PageSchema and ChapterSchema refinements
- **Files modified:** pipeline/src/schemas/manga.schema.ts
- **Verification:** `pnpm run typecheck` exits 0
- **Committed in:** 23d37be (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix for Zod v4 API compatibility)
**Impact on plan:** Minor API surface difference between Zod v3 and v4. No scope creep.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Type system and schemas are complete, ready for Plan 02 (Markdown script parser) to use PanelSchema/PageSchema/ChapterSchema for validation
- CharacterFingerprintSchema ready for Plan 03 (character registry) to validate YAML-parsed character data
- PATHS.characterData, PATHS.templates, PATHS.styleGuide paths ready for Plans 03-05
- All 37 tests passing, including 24 new schema tests

## Self-Check: PASSED

All 10 claimed files verified present on disk. Both commit hashes (e55a054, 23d37be) verified in git log.

---
*Phase: 02-scripts-characters-and-prompts*
*Completed: 2026-02-19*
