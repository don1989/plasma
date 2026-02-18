---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [typescript, commander, sharp, vitest, tsx, esm, cli, pipeline]

# Dependency graph
requires: []
provides:
  - "Standalone TypeScript pipeline project in pipeline/ with pnpm"
  - "Commander CLI with 5 stage subcommands (script, prompt, generate, overlay, assemble)"
  - "Shared types: StageResult, StageOptions, StageName, Panel, Page, Chapter"
  - "Centralized PATHS config resolving 01_bible/ and 03_manga/ as read-only sources"
  - "Filesystem utilities: ensureDir, isReadableDir, assertSourceDir"
  - "Vitest test infrastructure with 13 passing tests"
affects: [02-scripting, 03-generation, 04-assembly]

# Tech tracking
tech-stack:
  added: [commander@14.0.3, sharp@0.34.5, tsx@4.21.0, typescript@5.7.3, vitest@4.0.18]
  patterns: [subcommand-per-stage CLI, centralized path resolution, stage function contract (StageOptions -> StageResult), ESM with .js import extensions, verbatimModuleSyntax]

key-files:
  created:
    - pipeline/package.json
    - pipeline/tsconfig.json
    - pipeline/vitest.config.ts
    - pipeline/src/cli.ts
    - pipeline/src/types/pipeline.ts
    - pipeline/src/types/manga.ts
    - pipeline/src/types/index.ts
    - pipeline/src/config/paths.ts
    - pipeline/src/config/defaults.ts
    - pipeline/src/utils/fs.ts
    - pipeline/src/stages/script.ts
    - pipeline/src/stages/prompt.ts
    - pipeline/src/stages/generate.ts
    - pipeline/src/stages/overlay.ts
    - pipeline/src/stages/assemble.ts
    - pipeline/tests/config/paths.test.ts
    - pipeline/tests/utils/fs.test.ts
    - pipeline/tests/stages/script.test.ts
    - .gitignore
  modified: []

key-decisions:
  - "Used Commander v14 for CLI (zero dependencies, native TypeScript types, subcommand pattern maps 1:1 to stages)"
  - "Used assertSourceDir with throws (not silent boolean return) for stage source directory validation"
  - "Added pnpm.onlyBuiltDependencies in package.json to approve Sharp and esbuild native builds"
  - "output/ at project root (sibling of 01_bible/) not inside pipeline/ per PATHS design"

patterns-established:
  - "Stage contract: every stage exports async function run<Name>(options: StageOptions): Promise<StageResult>"
  - "Centralized path resolution: stages import PATHS from config/paths.js, never hardcode relative paths"
  - "ESM import convention: all .ts file imports use .js extensions for Node.js ESM compatibility"
  - "Type-only imports: use 'import type' for interfaces/types (verbatimModuleSyntax enforced)"
  - "CLI wiring: cli.ts only wires subcommands to stage functions via dynamic import, no stage logic in cli.ts"

requirements-completed: [INFR-01, INFR-02, INFR-03, INFR-04, INFR-05]

# Metrics
duration: 4min
completed: 2026-02-18
---

# Phase 1 Plan 1: Pipeline Setup Summary

**TypeScript pipeline scaffold with Commander CLI, 5 stage stubs, centralized path resolution, and 13 passing vitest tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-18T21:02:19Z
- **Completed:** 2026-02-18T21:06:19Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments
- Standalone `pipeline/` project with pnpm, strict TypeScript, ESM, Sharp verified working
- Commander CLI entry point with all 5 stage subcommands accepting --chapter, --verbose, --dry-run
- Shared type system (StageResult, StageOptions, Panel, Page, Chapter) with barrel exports
- Centralized PATHS config that resolves 01_bible/ and 03_manga/ to real existing directories
- Filesystem utilities (ensureDir, isReadableDir, assertSourceDir) with full test coverage
- 13 tests across 3 test files, all passing (path resolution, filesystem utils, stage contract)

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize pipeline project** - `8769b36` (chore)
2. **Task 2: Shared types, path resolution, filesystem utilities** - `d0f75a1` (feat)
3. **Task 3: CLI entry point and 5 stage stubs** - `9fd8ce8` (feat)

Cleanup: `ff19cd5` (chore: remove placeholder index.ts)

## Files Created/Modified
- `pipeline/package.json` - pnpm project with commander, sharp, tsx, typescript, vitest
- `pipeline/tsconfig.json` - Strict TypeScript config (es2022, NodeNext, verbatimModuleSyntax)
- `pipeline/vitest.config.ts` - Vitest with globals, v8 coverage provider
- `pipeline/src/cli.ts` - Commander CLI with 5 subcommands wired to stage modules
- `pipeline/src/types/pipeline.ts` - StageResult, StageOptions, StageName types
- `pipeline/src/types/manga.ts` - Panel, Page, Chapter domain types
- `pipeline/src/types/index.ts` - Barrel re-export file
- `pipeline/src/config/paths.ts` - Centralized PATHS with bible, manga, output, chapterOutput
- `pipeline/src/config/defaults.ts` - DEFAULT_CHAPTER, PIPELINE_VERSION, STAGE_NAMES
- `pipeline/src/utils/fs.ts` - ensureDir, isReadableDir, assertSourceDir helpers
- `pipeline/src/stages/script.ts` - Script stage stub (verifies manga dir, returns StageResult)
- `pipeline/src/stages/prompt.ts` - Prompt stage stub
- `pipeline/src/stages/generate.ts` - Generate stage stub (verifies output parent dir)
- `pipeline/src/stages/overlay.ts` - Overlay stage stub
- `pipeline/src/stages/assemble.ts` - Assemble stage stub
- `pipeline/tests/config/paths.test.ts` - 4 tests: bible/manga exist, output is sibling, chapter paths
- `pipeline/tests/utils/fs.test.ts` - 5 tests: isReadableDir, assertSourceDir, ensureDir
- `pipeline/tests/stages/script.test.ts` - 4 tests: StageResult shape, success, stage name, duration
- `.gitignore` - output/, pipeline/node_modules/, pipeline/dist/, *.DS_Store

## Decisions Made
- Used Commander v14 for CLI (zero dependencies, strong TypeScript support, subcommand pattern maps perfectly to 5 pipeline stages)
- Used `assertSourceDir` with throws rather than silent boolean return, so stages fail fast with descriptive errors
- Added `pnpm.onlyBuiltDependencies` to package.json to approve Sharp and esbuild native build scripts (pnpm 10 requires explicit approval)
- Placed output/ at project root as sibling to 01_bible/, not inside pipeline/, keeping generated artifacts separate from pipeline code

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Sharp build scripts not approved by pnpm**
- **Found during:** Task 1 (dependency installation)
- **Issue:** pnpm 10 requires explicit approval for native build scripts. `pnpm install` ignored Sharp and esbuild build scripts.
- **Fix:** Added `pnpm.onlyBuiltDependencies: ["esbuild", "sharp"]` to package.json and ran `pnpm rebuild sharp`
- **Files modified:** pipeline/package.json
- **Verification:** `import sharp from 'sharp'; console.log(sharp.versions)` prints version info successfully
- **Committed in:** 8769b36 (Task 1 commit)

**2. [Rule 3 - Blocking] TypeScript typecheck fails on empty src directory**
- **Found during:** Task 1 (verification step)
- **Issue:** `tsc --noEmit` requires at least one input file. Empty src/ directory caused TS18003 error.
- **Fix:** Created temporary `src/index.ts` placeholder with `export {}`. Removed after real source files were added in Tasks 2-3.
- **Files modified:** pipeline/src/index.ts (created then deleted)
- **Verification:** `pnpm run typecheck` exits 0
- **Committed in:** 8769b36 (created), ff19cd5 (removed)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes necessary to unblock Task 1 verification. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pipeline scaffold is complete and ready for Phase 2 to implement real stage logic
- Every stage stub slots in with `StageOptions` input and `StageResult` output
- PATHS config resolves all source directories, tests prove they exist on disk
- Test infrastructure is in place with vitest (add tests alongside new stage implementations)
- Concern: Gemini API access status still unknown (Phase 3 dependency, not blocking Phase 2)

## Self-Check: PASSED

All 19 claimed files verified present on disk. All 4 commit hashes (8769b36, d0f75a1, 9fd8ce8, ff19cd5) verified in git log.

---
*Phase: 01-foundation*
*Completed: 2026-02-18*
