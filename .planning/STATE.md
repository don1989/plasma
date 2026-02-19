# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** A repeatable system that transforms any Plasma story chapter into publish-ready Webtoon manga pages with consistent character visuals across panels.
**Current focus:** v2.0 — Phase 5: Environment Validation

## Current Position

Phase: 5 — Environment Validation
Plan: 2 of 4 complete (05-01 + 05-02 done; 05-03 + 05-04 remaining)
Status: Executing (05-01 and 05-02 complete — ComfyUI and kohya_ss installed with MPS)
Last activity: 2026-02-19 — Completed 05-01 (ComfyUI + PyTorch MPS + ComfyUI-Manager)

Progress: [##________] ~25% (v2.0 Phase 5 — 2/4 plans complete)

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
- Last 5 plans: 03-01 (3 min), 03-02 (5 min), 03-03 (7 min), 04-01 (4 min), 05-02 (3 min)
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
- [v2.0 Roadmap]: ComfyUI install outside repo at ~/tools/ComfyUI — sidecar pattern, not embedded dependency
- [v2.0 Roadmap]: Phase 10 (ControlNet) depends on Phase 7 (Express service) and Phase 5 (OpenPose model) — can run in parallel with Phase 8/9
- [v2.0 Roadmap]: GEN-04 split across Phase 7 (template + slot definition) and Phase 9 (LoRA wired into slot after training)
- [v2.0 Roadmap]: Reproducibility defined as visually consistent same-character same-pose, not pixel-identical — MPS non-determinism is a hardware fact
- [05-01]: PyTorch 2.5.1 installed from cpu index URL (arm64 MPS wheel) — NOT nightly; 2.5.1 stable is confirmed working, nightly introduces breakage risk
- [05-01]: ComfyUI-Manager cloned before first launch — Manager is detected at startup, not dynamically loaded
- [05-01]: models/controlnet/ created in plan 01 so plan 03 curl only needs to drop the file
- [05-02]: Do not use requirements_macos_arm64.txt — references torch==2.8.0.* nightly (broken, GitHub issue #3281); manual pip install is correct path
- [05-02]: accelerate mixed_precision must be 'no' — fp16 triggers ValueError on MPS (PyTorch AMP autocast does not support mps+fp16)
- [05-02]: write_basic_config() sets use_cpu: true by default; manual YAML override needed to enforce use_cpu: false per spec
- [05-02]: Omit bitsandbytes, xformers, triton from kohya_ss install — CUDA/Linux-only, incompatible with Apple Silicon

### Pending Todos

None.

### Blockers/Concerns

- Gemini API image generation access status is unknown — IGEN-02 code is complete but untested with real API key (requires Cloud Billing setup)
- Phase 5 gates Phase 7 and Phase 10 — ComfyUI must be running and benchmarked before integration work begins
- Phase 6 gates Phase 8 — dataset minimum (15-20 images) must be met before any training is attempted; skipping this is the highest-probability failure mode

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 05-01-PLAN.md (ComfyUI + PyTorch 2.5.1 MPS + ComfyUI-Manager installed). Next: 05-03-PLAN.md (Plans 01 and 02 are both done).
Resume file: .planning/phases/05-environment-validation/05-03-PLAN.md
