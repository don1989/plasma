---
phase: 07-comfyui-express-integration
plan: "03"
subsystem: pipeline
tags: [comfyui, express, typescript, generate-stage, cli]

# Dependency graph
requires:
  - phase: 07-01
    provides: Express service scaffold with POST /jobs, GET /jobs/:id, GET /health
  - phase: 07-02
    provides: ComfyUI WebSocket client (comfyui-client.ts) wired into router POST /jobs
provides:
  - "--comfyui flag in CLI with --page validation and no-default mode enforcement"
  - "ComfyUI mode branch in generate.ts — health check, job submit, 95s poll loop, manifest record"
  - "approve-and-copy promotion from raw/comfyui/ to raw/ for source=comfyui entries"
  - "collision-safe version numbering (scans both raw/ and raw/comfyui/)"
  - "JSON-safe slot-fill for multi-line prompts (newlines, em-dashes, control chars)"
affects:
  - "07 phase overlay and assemble stages (consume promoted images from raw/ unchanged)"
  - "phase 09 LoRA training (will pass real lora_name through same slot-fill path)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fetch + AbortSignal.timeout(2000) for health-check with fail-fast semantics"
    - "poll loop with 2s interval / 95s ceiling — client-side timeout slightly above service 90s"
    - "JSON.stringify(s).slice(1,-1) for safe injection of arbitrary strings into JSON template slots"
    - "version = max(nextVersion(raw/), nextVersion(raw/comfyui/)) to prevent filename collision on promotion"

key-files:
  created: []
  modified:
    - pipeline/src/types/generation.ts
    - pipeline/src/config/paths.ts
    - pipeline/src/cli.ts
    - pipeline/src/stages/generate.ts
    - pipeline/src/comfyui/slot-fill.ts

key-decisions:
  - "No default mode — generate requires --comfyui, --api, or --manual explicitly; bare -c 1 exits with clear error"
  - "Version counter scans both raw/ and raw/comfyui/ to guarantee unique filenames across the approve-and-copy boundary"
  - "JSON.stringify().slice(1,-1) used in slotFill for all string tokens — handles newlines, em-dashes, and all control chars that break raw replacement"
  - "approve-and-copy is lazy: standard approveImage sets approved=true first, then generate.ts checks manifest for source=comfyui and copies if needed"
  - "argv stripping extended to handle '--' at argv[3] (pnpm stage:generate -- args) in addition to argv[2] (pnpm dev -- subcommand args)"

patterns-established:
  - "ComfyUI mode: health check -> prompt read -> ensureDir -> version calc -> job submit -> poll -> manifest record"
  - "Approve-and-copy: approveImage() sets flag, then caller reads manifest to detect source=comfyui and promotes file"

requirements-completed: [PIPE-01, PIPE-02, PIPE-03]

# Metrics
duration: 8min
completed: 2026-02-19
---

# Phase 7 Plan 03: Generate Stage ComfyUI Wiring Summary

**`pnpm stage:generate -- --comfyui -c 1 --page 1` wires the Express/ComfyUI bridge into the generate stage CLI with collision-safe versioning, JSON-safe prompt injection, and approve-and-copy promotion to `raw/`**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-19T19:48:04Z
- **Completed:** 2026-02-19T19:56:44Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `--comfyui` flag added to generate CLI with no-default mode enforcement and `--page` guard
- Full ComfyUI mode branch in `generate.ts`: service health check, job submit, 95s polling loop, manifest record with `source`/`sourcePath` fields
- Approve-and-copy: approving a ComfyUI image now promotes it from `raw/comfyui/` to `raw/` so overlay/assemble consume it unchanged (PIPE-03)
- Version numbering scans both `raw/` and `raw/comfyui/` — prevents filename collision on promote
- `slotFill` fixed to JSON-escape all string tokens — multi-line prompts with em-dashes and newlines no longer break the workflow JSON

## Task Commits

Each task was committed atomically:

1. **Task 1: Update types, paths, and CLI flag** - `c04b0b1` (feat)
2. **Task 2: Implement ComfyUI mode branch and approve-and-copy** - `7d5b015` (feat)

## Files Created/Modified

- `pipeline/src/types/generation.ts` — `GenerationLogEntry` extended with `source` and `sourcePath` optional fields
- `pipeline/src/config/paths.ts` — `chapterOutput()` now returns `comfyuiRaw` subpath helper (`raw/comfyui/`)
- `pipeline/src/cli.ts` — `--comfyui` flag added; mode requires explicit flag; `--comfyui` without `--page` exits with error; argv stripping handles both `--` injection patterns
- `pipeline/src/stages/generate.ts` — `GenerateOptions.mode` widened; `checkServiceRunning()` helper; full ComfyUI branch; approve-and-copy block; collision-safe version calc
- `pipeline/src/comfyui/slot-fill.ts` — `jsonEscapeString()` helper added; all string token replacements now JSON-safe

## Decisions Made

- No silent default mode — bare `pnpm stage:generate -- -c 1` now exits with clear error requiring explicit `--comfyui`, `--api`, or `--manual` flag. This prevents accidental manual-mode runs masking ComfyUI issues.
- Version counter scans both `raw/` and `raw/comfyui/` so promoted ComfyUI images never overwrite existing Gemini images. Without this, approve would silently approve the wrong manifest entry.
- `JSON.stringify(s).slice(1,-1)` chosen over regex escape for slotFill — handles all edge cases (newlines, tabs, backslashes, Unicode) in one correct operation.
- Approve-and-copy is structured as a post-approve check rather than a separate command — `--approve` remains the single user-facing verb for both Gemini and ComfyUI images.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CLI flag type widening caused TypeScript error**
- **Found during:** Task 1 (CLI flag addition)
- **Issue:** `mode: 'manual' | 'api' | 'comfyui'` in `cli.ts` was assigned to `GenerateOptions.mode: 'manual' | 'api' | undefined` — type mismatch. IDE flagged as TS2322.
- **Fix:** Updated `GenerateOptions.mode` in `generate.ts` to `'manual' | 'api' | 'comfyui'` immediately (part of Task 2 anyway). Cleaner than a cast at call site.
- **Files modified:** `pipeline/src/stages/generate.ts`
- **Verification:** `pnpm typecheck` passes.
- **Committed in:** c04b0b1 (Task 1 commit)

**2. [Rule 1 - Bug] pnpm `--` separator not stripped at argv[3]**
- **Found during:** Task 1 verification (`pnpm stage:generate -- -c 1` passed `--` as Commander argument)
- **Issue:** Existing argv stripping only handled `--` at `argv[2]` (for `pnpm dev -- subcommand args`). Stage-specific scripts like `pnpm stage:generate -- -c 1` inject `--` at `argv[3]`. Commander saw `--` as an unexpected positional argument and aborted with "too many arguments".
- **Fix:** Extended stripping logic to also handle `argv[3] === '--'`.
- **Files modified:** `pipeline/src/cli.ts`
- **Verification:** `pnpm stage:generate -- -c 1` now produces the expected "specify mode explicitly" error.
- **Committed in:** c04b0b1 (Task 1 commit)

**3. [Rule 1 - Bug] `slotFill` raw string replacement broke JSON for multi-line prompts**
- **Found during:** Task 2 end-to-end test (`pnpm stage:generate -- --comfyui -c 1 --page 1`)
- **Issue:** Prompt files contain literal newlines and em-dashes (`—`). `slotFill` did a raw `replaceAll` inserting the string directly into the JSON template. Literal `\n` at byte position 279 of the resulting JSON string is an illegal control character — `JSON.parse(filledJson)` in `comfyui-client.ts` threw "Bad control character in string literal in JSON at position 279". Job failed immediately.
- **Fix:** Added `jsonEscapeString()` — `JSON.stringify(s).slice(1,-1)` — applied to all string token values before substitution.
- **Files modified:** `pipeline/src/comfyui/slot-fill.ts`
- **Verification:** `pnpm exec tsx` unit test confirmed JSON validity. End-to-end generation completed successfully.
- **Committed in:** 7d5b015 (Task 2 commit)

**4. [Rule 1 - Bug] ComfyUI version counter scanned only `raw/comfyui/`, causing filename collision**
- **Found during:** Task 2 approve-and-copy verification
- **Issue:** `nextVersion(comfyuiDir, ...)` scanned only `raw/comfyui/` (which had only v1). It computed v2 — but v2 already existed as a Gemini image in `raw/`. `approveImage` found the first `ch01_p001_v2.png` manifest entry (Gemini) and approved that one instead of the ComfyUI entry. Promote check found `source !== 'comfyui'` and silently skipped the copy.
- **Fix:** Version computed as `Math.max(nextVersion(raw/), nextVersion(raw/comfyui/))` — always picks above the highest version in either directory.
- **Files modified:** `pipeline/src/stages/generate.ts`
- **Verification:** Re-run generated `v5` (v1-v4 existed in `raw/`). Approve printed "Promoted ComfyUI image" log and file appeared in `raw/`.
- **Committed in:** 7d5b015 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (4 Rule 1 bugs)
**Impact on plan:** All four fixes were necessary for functional correctness. No scope creep — all changes stay within the files listed in plan frontmatter plus `slot-fill.ts` which is directly called by `generate.ts`.

## Issues Encountered

- Service restart required between fix attempts for `slot-fill.ts` since `tsx` does not hot-reload modules — required explicit `pkill` to ensure clean restart.

## User Setup Required

None - no external service configuration required. ComfyUI and the Express service must be running for `--comfyui` mode (`pnpm start:service`), but no new env vars or credentials needed.

## Next Phase Readiness

- Phase 7 complete: full generate → approve → overlay → assemble chain works with ComfyUI-sourced images
- Phase 8 (LoRA training dataset) can proceed — Phase 7 unblocked it per v2.0 roadmap
- Phase 9 (LoRA wired into ComfyUI slot): `lora_name` slot in `slot-fill.ts` is already present and JSON-safe; Phase 9 only needs to pass the trained LoRA filename into the `generate --comfyui` call
- Blocker remains: `~/tools/kohya_ss/sd-scripts/` is empty — run `git submodule update --init --recursive` before Phase 8

---
*Phase: 07-comfyui-express-integration*
*Completed: 2026-02-19*

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log. All key artifacts confirmed in file contents. Promoted image confirmed at `output/ch-01/raw/ch01_p001_v5.png`.
