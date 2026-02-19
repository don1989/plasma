---
phase: 02-scripts-characters-and-prompts
plan: 04
subsystem: templates
tags: [nunjucks, prompt-generation, template-engine, gemini-prompts, character-fingerprints, setting-description]

# Dependency graph
requires:
  - phase: 02-scripts-characters-and-prompts
    plan: 02
    provides: "parseChapterScript() producing Chapter objects from markdown, script.json output"
  - phase: 02-scripts-characters-and-prompts
    plan: 03
    provides: "CharacterRegistry with case-insensitive lookup, 5 character YAML files, style-guide.yaml"
provides:
  - "createPromptEngine() configuring Nunjucks for plain-text prompt rendering with trimBlocks/lstripBlocks"
  - "generateChapterPrompts() combining script data + character fingerprints + setting into per-page prompts"
  - "loadStyleGuide() extracting style_prefix and setting from style-guide.yaml"
  - "5 Nunjucks templates: page-prompt.njk, character-sheet.njk, and 3 partials (style-prefix, character-block, setting-description)"
  - "Working prompt stage (runPrompt) reading script.json, loading registry + style guide, writing per-page prompt .txt files"
  - "28 prompt text files for chapter 1 in output/ch-01/prompts/"
  - "30 new tests (13 engine + 17 prompt generator) covering template rendering and prompt generation"
affects: [03-image-generation, 04-assembly]

# Tech tracking
tech-stack:
  added: [nunjucks]
  patterns: [Nunjucks template partials for reusable prompt components, conditional include for establishing shot setting, character fingerprint injection via registry lookup, word-boundary regex matching for character detection in action text]

key-files:
  created:
    - pipeline/src/templates/engine.ts
    - pipeline/src/templates/prompt-generator.ts
    - pipeline/data/templates/page-prompt.njk
    - pipeline/data/templates/character-sheet.njk
    - pipeline/data/templates/partials/style-prefix.njk
    - pipeline/data/templates/partials/character-block.njk
    - pipeline/data/templates/partials/setting-description.njk
    - pipeline/tests/templates/engine.test.ts
    - pipeline/tests/templates/prompt-generator.test.ts
  modified:
    - pipeline/src/stages/prompt.ts

key-decisions:
  - "Establishing shot detection limited to page 1 Wide shots and pages with establishing/panorama/vista/landscape/skyline keywords -- prevents false positives on regular Wide action shots"
  - "Narrator dialogue speaker excluded from character extraction -- narration boxes have no visual character to fingerprint"
  - "Character fingerprints deduplicated by character id per panel -- prevents duplicate fingerprint blocks when character matches via both name and alias"
  - "Layout description uses simple count-based text (vertical layout for 2-3 panels, layout for 4+) -- matches hand-written prompt style"

patterns-established:
  - "Template partials as single-source-of-truth: changing style-prefix.njk or a character YAML propagates to all generated prompts"
  - "Conditional template includes: setting-description.njk included only for establishing shot pages"
  - "Character detection: dialogue speakers + word-boundary regex against action text, with unknown characters tracked as warnings not errors"
  - "Prompt stage pattern: read script.json -> load registry -> load style guide -> generate prompts -> write .txt files"

requirements-completed: [PRMT-01, PRMT-02, PRMT-03, PRMT-04, PRMT-05]

# Metrics
duration: 8min
completed: 2026-02-19
---

# Phase 2 Plan 4: Prompt Template Engine Summary

**Nunjucks template engine generating 28 Gemini-optimized art prompts per chapter from script data + character fingerprints + style guide with setting descriptions as reusable partials**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-19T06:06:41Z
- **Completed:** 2026-02-19T06:14:15Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Built createPromptEngine() configuring Nunjucks with plain-text settings (no HTML escaping, throwOnUndefined, trimBlocks/lstripBlocks) and custom upper filter
- Created 5 Nunjucks templates: page-prompt.njk (main per-page template), character-sheet.njk, and 3 partials (style-prefix, character-block, setting-description)
- Built generateChapterPrompts() that combines parsed Chapter data with CharacterRegistry lookups and style guide settings to produce one prompt per page
- Implemented character extraction from panels via dialogue speakers + word-boundary regex matching against action text, with fingerprint deduplication by character id
- Setting description conditionally included for pages with establishing/wide shots on page 1, and pages with panorama/vista keywords
- Replaced the prompt stage stub with full implementation: reads script.json, loads registry and style guide, generates prompts, writes per-page .txt files
- Generated 28 prompts for chapter 1 with all 5 characters (Spyke, June, Draster, Hood, Punks) fingerprinted and 2 minor characters (REGISTRAR, INTERCOM) tracked as unknown
- 30 new tests (13 engine + 17 prompt generator), 134 total tests passing across 10 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Nunjucks templates and template engine** - `7c8efc5` (feat)
2. **Task 2: Build prompt generator and wire into prompt stage** - `d22a868` (feat)

## Files Created/Modified
- `pipeline/src/templates/engine.ts` - Nunjucks Environment factory with plain-text config and custom filters
- `pipeline/src/templates/prompt-generator.ts` - generateChapterPrompts() combining script + registry + style guide, loadStyleGuide() utility
- `pipeline/data/templates/page-prompt.njk` - Main per-page Nunjucks template matching hand-written prompt structure
- `pipeline/data/templates/character-sheet.njk` - Character reference sheet prompt template
- `pipeline/data/templates/partials/style-prefix.njk` - Verbatim style prefix partial (single source of truth)
- `pipeline/data/templates/partials/character-block.njk` - Character fingerprint wrapper partial
- `pipeline/data/templates/partials/setting-description.njk` - Setting description partial for establishing shots
- `pipeline/src/stages/prompt.ts` - Replaced stub with full prompt stage implementation
- `pipeline/tests/templates/engine.test.ts` - 13 tests for template engine and template rendering
- `pipeline/tests/templates/prompt-generator.test.ts` - 17 tests for prompt generation including chapter 1 integration test

## Decisions Made
- Establishing shot detection uses a conservative heuristic: page 1 with any Wide shot always qualifies, other pages only if the first panel is Wide with establishing/panorama/vista/landscape/skyline keywords in the action text -- this prevents false positives on regular Wide action shots mid-chapter
- Narrator dialogue speakers are excluded from character extraction since narration boxes have no visual character to fingerprint
- Character fingerprints are deduplicated by character id within each panel to prevent the same character's description appearing twice when matched by both name and alias
- Layout descriptions use simple count-based text ("vertical layout" for 2-3 panels, "layout" for 4+) matching the conversational style of the hand-written prompts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Page count is 28 not 29 (known from Plan 02-02)**
- **Found during:** Task 2 (integration test)
- **Issue:** Plan verification says "produces 29 prompt text files" but chapter 1 has 28 page headings (page 25-26 double spread has single heading)
- **Fix:** Integration test expects 28 prompts; verified this matches the 28 pages from the script parser
- **Files modified:** pipeline/tests/templates/prompt-generator.test.ts
- **Committed in:** d22a868

---

**Total deviations:** 1 auto-fixed (known page count from Plan 02-02)
**Impact on plan:** Minimal -- the 28 vs 29 page count was already established and documented in Plan 02-02. No scope creep.

## Issues Encountered
None beyond the known page count discrepancy.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Prompt stage generates ready-to-use Gemini art prompts for any parsed chapter
- Output files at `output/ch-NN/prompts/page-NN.txt` are self-contained prompts ready for copy-paste into Gemini
- Template library is extensible -- new partials can be added, existing ones modified to propagate changes
- Single-source updates confirmed: changing character YAML, style-prefix.njk, or style-guide.yaml setting all propagate to generated prompts on re-run
- Phase 3 (Image Generation) can read these prompt files directly for API automation

## Self-Check: PASSED

All 10 claimed files verified present on disk. Both commit hashes (7c8efc5, d22a868) verified in git log.

---
*Phase: 02-scripts-characters-and-prompts*
*Completed: 2026-02-19*
