---
phase: 02-scripts-characters-and-prompts
plan: 02
subsystem: parser
tags: [unified, remark-parse, mdast, markdown-parser, script-stage, zod-validation, chapter-parsing]

# Dependency graph
requires:
  - phase: 02-scripts-characters-and-prompts
    plan: 01
    provides: "Zod schemas (ChapterSchema, PageSchema, PanelSchema), expanded manga types, unified/remark-parse dependencies"
provides:
  - "parseChapterScript() function converting markdown to typed Chapter objects via MDAST tree walking"
  - "validateChapter() function returning errors + warning-level panel count issues"
  - "Working script stage (runScript) that reads chapter markdown, parses, validates, writes JSON"
  - "output/ch-01/script.json with 28 pages, 101 panels, all metadata extracted"
  - "30 new tests (22 parser + 8 stage) covering all panel types, dialogue types, and edge cases"
affects: [02-prompt-template-engine, 02-character-registry, 03-generation, 04-assembly]

# Tech tracking
tech-stack:
  added: []
  patterns: [MDAST paragraph child walking for field extraction, Strong/Text pair parsing for bold-labeled fields, dialogue list splitting to handle trailing field contamination, bracket tag extraction from H2 headings]

key-files:
  created:
    - pipeline/src/parsers/script-parser.ts
    - pipeline/tests/parsers/script-parser.test.ts
  modified:
    - pipeline/src/stages/script.ts
    - pipeline/tests/stages/script.test.ts

key-decisions:
  - "28 page headings not 29 -- page 25 double-page spread covers pages 25-26 with single heading"
  - "MDAST paragraph child walking instead of regex on extractText -- remark merges consecutive lines into single paragraph nodes"
  - "Dialogue list items can contain trailing SFX/Notes fields (no blank line separator) -- parser splits on Strong nodes within list items"
  - "Off-panel speech is type 'speech' not separate type -- off-panel is a position modifier, not a dialogue type"

patterns-established:
  - "MDAST field extraction: walk Strong/Text children of paragraph nodes to extract bold-labeled field-value pairs"
  - "Dialogue list splitting: separate dialogue text from trailing field labels within list item paragraph children"
  - "Bracket tag extraction from headings: [PAGE-TURN REVEAL] and [PLAYER DECISION POINT] parsed as tags"
  - "Stage pattern: read file -> parse -> validate -> write JSON, with verbose/dryRun/error handling"

requirements-completed: [SCRP-01, SCRP-02, SCRP-03]

# Metrics
duration: 8min
completed: 2026-02-19
---

# Phase 2 Plan 2: Script Parser Summary

**MDAST-based markdown parser converting chapter scripts to validated JSON with unified/remark-parse, handling splash pages, double spreads, dialogue types, and all chapter-01 edge cases**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-19T05:52:46Z
- **Completed:** 2026-02-19T06:00:49Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Built parseChapterScript() that walks MDAST tree to extract pages, panels, dialogue from markdown chapter scripts
- Handled all chapter-01-script.md edge cases: splash pages, double spreads, em-dash markers, thought/narration/speech dialogue, off-panel speech, PAGE-TURN REVEAL tags, PLAYER DECISION POINT blockquotes, Black panels
- Wired parser into script stage with JSON output, verbose logging, dryRun support, and error handling
- 30 new tests (22 parser unit/integration + 8 stage tests), 79 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement markdown script parser** - `4bbf692` (feat)
2. **Task 2: Wire parser into script stage with JSON output** - `1cff497` (feat)

## Files Created/Modified
- `pipeline/src/parsers/script-parser.ts` - MDAST-based markdown parser with parseChapterScript() and validateChapter()
- `pipeline/tests/parsers/script-parser.test.ts` - 22 tests covering all panel types, dialogue types, edge cases, and real chapter-01 integration
- `pipeline/src/stages/script.ts` - Replaced stub with real implementation reading markdown, parsing, validating, writing JSON
- `pipeline/tests/stages/script.test.ts` - 8 tests including integration test producing output/ch-01/script.json

## Decisions Made
- Page count is 28 headings (not 29) because page 25 double-page spread covers pages 25-26 with a single heading; page 26 has no separate ## heading in the source script
- Used MDAST paragraph child walking instead of regex on extracted text because remark merges consecutive lines (Action/Dialogue/SFX/Notes) into a single paragraph with interleaved Strong and Text nodes
- Dialogue list items can contain trailing SFX and Notes fields when there's no blank line separator in the markdown; the parser splits list item children on Strong field labels
- Off-panel dialogue (e.g., "PUNK 1 (off-panel)") is typed as 'speech', not a separate type -- off-panel is a position modifier

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MDAST merges fields into single paragraph node**
- **Found during:** Task 1 (parser implementation)
- **Issue:** Plan assumed each **Action:**, **Dialogue:**, **SFX:**, **Notes:** would be separate paragraph nodes. In reality, remark merges consecutive lines without blank separators into a single paragraph with interleaved Strong/Text children.
- **Fix:** Rewrote parser to walk paragraph children extracting Strong/Text field-value pairs instead of matching against whole paragraph text
- **Files modified:** pipeline/src/parsers/script-parser.ts
- **Verification:** All 22 parser tests pass
- **Committed in:** 4bbf692

**2. [Rule 1 - Bug] Dialogue list items contaminated with trailing fields**
- **Found during:** Task 1 (parser implementation)
- **Issue:** When dialogue list items are followed by **SFX:** and **Notes:** without blank lines, remark merges those field labels into the last list item's paragraph children.
- **Fix:** Added logic to split list item children at Strong field label boundaries, extracting dialogue text before and trailing fields after
- **Files modified:** pipeline/src/parsers/script-parser.ts
- **Verification:** All panels have correct SFX and Notes values in integration test
- **Committed in:** 4bbf692

**3. [Rule 1 - Bug] Page count 28 not 29 as plan stated**
- **Found during:** Task 1 (integration test)
- **Issue:** Plan said "returns 29 pages" but chapter-01-script.md has 28 ## Page headings. Page 25 is a double-page spread covering 25-26; there is no ## Page 26 heading.
- **Fix:** Adjusted test to expect 28 pages with explicit verification that page 25 isDoubleSpread and page 26 is absent
- **Files modified:** pipeline/tests/parsers/script-parser.test.ts
- **Verification:** Integration test passes with 28 pages, page 25 correctly flagged
- **Committed in:** 4bbf692

---

**Total deviations:** 3 auto-fixed (3 bug fixes for MDAST structure and page count)
**Impact on plan:** All fixes were necessary for correct parsing. The MDAST structure differences required a fundamentally different field extraction approach than the plan's regex-based assumption. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Script parser complete, producing output/ch-01/script.json ready for prompt template engine (Plan 04)
- Chapter data structure available for character registry (Plan 03) to cross-reference character appearances
- All 79 tests passing (37 existing + 30 new parser/stage + 12 from parallel work)
- Stage pattern established: read -> parse -> validate -> write JSON, reusable for future stages

## Self-Check: PASSED

All 4 claimed files verified present on disk. Both commit hashes (4bbf692, 1cff497) verified in git log.

---
*Phase: 02-scripts-characters-and-prompts*
*Completed: 2026-02-19*
