---
phase: 07-comfyui-express-integration
plan: "02"
subsystem: api
tags: [comfyui, websocket, express, image-generation, ws, typescript]

requires:
  - phase: 07-01
    provides: Express service scaffold, router, job-store, slot-fill, txt2img-lora.json workflow template

provides:
  - comfyui-client.ts with WebSocket-before-POST ordering (GEN-02)
  - submitJob() function that opens WS, submits prompt, waits for completion, retrieves and copies image
  - Updated POST /jobs handler that executes real ComfyUI generation asynchronously
  - Job state transitions: queued -> running -> complete/failed with full error propagation
  - Image output at output/ch-XX/raw/comfyui/chXX_pNNN_vN.png with nextVersion() auto-increment

affects:
  - 07-03 (CLI generate.ts wires chapter/page into POST /jobs body)
  - Phase 9 (LoRA slot will be filled by LORA_NAME in comfyui-client)
  - Phase 10 (ControlNet extends the same job submission pattern)

tech-stack:
  added: []
  patterns:
    - WS-before-POST ordering: WebSocket must be opened and 'open' event awaited before POST /prompt — client_id routes messages back
    - Completion detection via executing+node:null (not execution_success — ComfyUI issue #11540)
    - Fire-and-forget setImmediate with explicit queued->running->complete/failed state machine
    - Dynamic import for naming utilities inside async context

key-files:
  created:
    - pipeline/src/comfyui/comfyui-client.ts
  modified:
    - pipeline/src/comfyui/router.ts

key-decisions:
  - "slotFill() called with lowercase keys (prompt_text, negative_prompt, seed, lora_name, checkpoint_name) matching slot-fill.ts token map — plan spec used uppercase which would silently no-op"
  - "lora_name hardcoded to empty string in Phase 7 — Phase 9 wires real LoRA name into this slot"
  - "COMFYUI_OUTPUT_DIR uses HOME env var with /Users/plasma fallback — supports multi-user/CI environments"
  - "chapter/page added as optional fields to jobRequestSchema — Plan 03 CLI will populate these"
  - "randomInt(2_147_483_647) for seed generation in router (not Math.random()) — crypto-quality randomness"

patterns-established:
  - "WS-before-POST pattern: always await ws 'open' before fetch to /prompt"
  - "waitForCompletion as local async function with explicit timer cleanup and message listener teardown"
  - "Error propagation pattern: all errors thrown, router catch block sets job status to 'failed'"

requirements-completed: [GEN-02, GEN-05]

duration: 5min
completed: 2026-02-19
---

# Phase 7 Plan 02: ComfyUI WebSocket Client Summary

**ComfyUI WS+REST client with GEN-02 compliant WS-before-POST ordering, 90s timeout, completion via executing+node:null, and image copy to output/ch-01/raw/comfyui/ch01_p001_v1.png — verified end-to-end with live ComfyUI**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T19:39:34Z
- **Completed:** 2026-02-19T19:44:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented `comfyui-client.ts` with strict WS-before-POST ordering per GEN-02 — WebSocket `open` event awaited before any POST /prompt call
- Completion detection uses `executing + node:null` not `execution_success` — avoids ComfyUI issue #11540 where execution_success fires before output files are flushed
- Replaced Plan 01 `setImmediate` stub in router with full async job pipeline: mkdir, nextVersion scan, submitJob, updateJob state transitions
- End-to-end verified with live ComfyUI: job submitted, 20/20 steps logged, image copied to `output/ch-01/raw/comfyui/ch01_p001_v1.png` (544KB PNG)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement comfyui-client.ts with WebSocket-before-POST pattern** - `b0ef300` (feat)
2. **Task 2: Wire comfyui-client into router POST /jobs async handler** - `2422794` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `pipeline/src/comfyui/comfyui-client.ts` — WebSocket + REST wrapper for ComfyUI API; exports `submitJob`, `ComfyJobInput`, `ComfyJobResult`
- `pipeline/src/comfyui/router.ts` — Updated POST /jobs with real async execution; added `chapter`/`page` to jobRequestSchema

## Decisions Made

- **slotFill key casing:** Plan spec called `slotFill` with uppercase keys (`PROMPT_TEXT`, etc.) but `slot-fill.ts` checks lowercase keys (`prompt_text`). Used lowercase to match the existing implementation — uppercase would silently no-op all token replacements, producing unfilled JSON. Auto-fixed under Rule 1 (bug).
- **lora_name empty string:** Phase 7 passes `lora_name: ''` to slotFill — the `{{LORA_NAME}}` token in the workflow template resolves to empty string in the LoRA loader node, which ComfyUI ignores. Phase 9 wires the real filename.
- **chapter/page in jobRequestSchema:** Added as optional fields so Plan 03's CLI can embed them in the POST body. Default to chapter=1, page=1 when absent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed slotFill key casing mismatch**
- **Found during:** Task 1 (comfyui-client.ts implementation)
- **Issue:** Plan spec passed uppercase keys (`PROMPT_TEXT`, `NEGATIVE_PROMPT`, `SEED`, `LORA_NAME`, `CHECKPOINT_NAME`) to `slotFill()`, but `slot-fill.ts` uses lowercase key guards (`'prompt_text' in values`, etc.). Uppercase keys would silently skip all replacements, leaving `{{PROMPT_TEXT}}` literals in the JSON sent to ComfyUI.
- **Fix:** Called `slotFill` with lowercase keys matching the implementation.
- **Files modified:** `pipeline/src/comfyui/comfyui-client.ts`
- **Verification:** End-to-end test produced a valid image — prompt text was processed correctly.
- **Committed in:** `b0ef300` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — key casing mismatch)
**Impact on plan:** Essential correctness fix. Without it, every job would send unfilled JSON to ComfyUI and likely produce garbage or fail. No scope creep.

## Issues Encountered

- An old service process (PID 30371) was already running on port 3000 from Plan 01 testing. First job submission hit the old stub code and stayed in `queued`. Killed old process, restarted service, job completed successfully. No code changes required.

## User Setup Required

None - no external service configuration required. ComfyUI must be running at 127.0.0.1:8188 for actual generation.

## Next Phase Readiness

- ComfyUI integration complete — `submitJob()` is the fully functional generation primitive
- Plan 03 (generate.ts CLI) can now call `POST /jobs` with chapter/page in body and poll to completion
- LoRA slot (`lora_name`) is wired but empty — ready for Phase 9 to fill
- Output directory structure (`output/ch-01/raw/comfyui/`) is created automatically on first job

---
*Phase: 07-comfyui-express-integration*
*Completed: 2026-02-19*

## Self-Check: PASSED

- comfyui-client.ts: FOUND
- router.ts: FOUND
- 07-02-SUMMARY.md: FOUND
- ch01_p001_v1.png (generated image): FOUND
- commit b0ef300 (comfyui-client): FOUND
- commit 2422794 (router): FOUND
