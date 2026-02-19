# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** A repeatable system that transforms any Plasma story chapter into publish-ready Webtoon manga pages with consistent character visuals across panels.
**Current focus:** Phase 4 — Assembly and Publish

## Current Position

Phase: 4 of 4 (Assembly and Publish)
Plan: 2 of 2 in current phase
Status: Complete
Last activity: 2026-02-19 — Completed 04-02-PLAN.md (Webtoon assembly stage)

Progress: [##########] 100% (Phase 4 Complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 5.4 min
- Total execution time: 0.90 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 1 | 4 min | 4 min |
| 2. Scripts/Characters | 4 | 28 min | 7.0 min |
| 3. Image Generation | 3 | 15 min | 5.0 min |
| 4. Assembly & Publish | 2 | 7 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 02-04 (8 min), 03-01 (3 min), 03-02 (5 min), 03-03 (7 min), 04-01 (4 min)
- Trend: Steady

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Pipeline is TypeScript (not Python as research assumed) with Sharp for image processing
- [Init]: All pipeline code lives in `pipeline/` directory, decoupled from story content
- [Init]: Text in panels is always programmatic overlay — never baked into AI-generated art
- [Init]: Manual Gemini workflow (copy-paste) is a first-class path; API automation is upgrade, not prerequisite
- [01-01]: Commander v14 for CLI (zero deps, native TS types, subcommand-per-stage pattern)
- [01-01]: assertSourceDir throws on missing dirs (fail fast with descriptive errors)
- [01-01]: output/ at project root as sibling to 01_bible/, not inside pipeline/
- [01-01]: pnpm.onlyBuiltDependencies for Sharp/esbuild native build approval
- [02-01]: z.string() for shotType (not enum) — scripts have compound types like "Wide (Action)"
- [02-01]: Warning-level panel count check instead of hard rejection — action montages break 4-7 range
- [02-01]: Zod v4 .check() API with input field for custom refinement issues
- [02-01]: Schema + z.infer type co-export pattern for all schema files
- [02-02]: 28 page headings in chapter-01-script.md (not 29) — double-page spread 25-26 has single heading
- [02-02]: MDAST paragraph child walking for field extraction — remark merges consecutive lines into single paragraph
- [02-02]: Dialogue list items split on Strong field labels to separate dialogue from trailing SFX/Notes
- [02-02]: Off-panel speech is type 'speech' — off-panel is position modifier, not dialogue type
- [02-03]: Removed CharacterRegistry type alias, replaced by CharacterRegistry class with richer functionality
- [02-03]: CLI ref-sheet uses string concatenation (not Nunjucks) for immediate utility before template engine
- [02-03]: Character fingerprints sourced verbatim from tested prompts in 03_manga/prompts/
- [02-04]: Establishing shot detection limited to page 1 Wide shots + pages with establishing/panorama keywords
- [02-04]: Narrator excluded from character extraction -- narration boxes have no visual character to fingerprint
- [02-04]: Character fingerprints deduplicated by id per panel -- prevents duplicates from name+alias matches
- [02-04]: Layout description uses count-based text (vertical layout for 2-3, layout for 4+) matching hand-written style
- [03-01]: readdirSync for nextVersion scan -- synchronous is fine for small directories, avoids async complexity
- [03-01]: generation-log.json filename for manifest -- descriptive, avoids collision with other chapter metadata
- [03-01]: getApprovedEntry returns latest by timestamp when multiple approved -- supports re-approval workflow
- [03-02]: mode defaults to 'manual' when omitted -- manual is the first-class workflow path
- [03-02]: importImage copies (never moves) source files -- user's original is always preserved
- [03-02]: approveImage enforces single-approved-per-page -- approving v2 automatically unapproves v1
- [03-02]: JPEG extension normalized to jpg in filenames -- consistency with common convention
- [03-03]: Dry-run checked before API key validation so --dry-run works without a configured key
- [03-03]: loadEnvFile inline helper avoids dotenv dependency for minimal .env parsing
- [03-03]: vi.hoisted() pattern for vitest mocks that need constructor-safe references
- [04-01]: SVG-to-Buffer balloon rendering — Sharp composites SVG buffers directly, no temp files needed
- [04-01]: Zone-based balloon placement divides image height by panel count, alternates left-right
- [04-01]: Thought bubbles use dashed-stroke ellipse (not trailing circles) for v1 simplicity
- [04-01]: Passthrough mode copies raw to lettered when page has no dialogue/SFX — maintains stage chain
- [04-01]: OverlayOptions interface separate from StageOptions for page/pages filtering

### Pending Todos

None yet.

### Blockers/Concerns

- Gemini API image generation access status is unknown — IGEN-02 code is complete but untested with real API key (requires Cloud Billing setup)

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 04-02-PLAN.md (Webtoon assembly stage). Phase 4 complete (2/2 plans). Milestone v1.0 complete.
Resume file: .planning/phases/04-assembly-and-publish/04-02-SUMMARY.md
