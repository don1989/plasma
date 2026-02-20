---
phase: 09-lora-integration
plan: 03
subsystem: api
tags: [express, zod, validation, lora, comfyui]

# Dependency graph
requires:
  - phase: 07-comfyui-express
    provides: router.ts Express router factory with POST /jobs and 501 stubs for Phase 9

provides:
  - POST /loras/train endpoint with Zod validation, batch_size guard, and concurrency detection
  - Module-level trainingJobActive flag for GEN-06 concurrency enforcement
  - loraTrainSchema (Zod) for POST /loras/train request body validation

affects: [09-04, 10-controlnet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-level mutable flag for in-process concurrency guard (trainingJobActive)
    - Zod safeParse + optional chaining for consistent 400 error shape across all POST endpoints

key-files:
  created: []
  modified:
    - pipeline/src/comfyui/router.ts

key-decisions:
  - "loraTrainSchema uses optional batch_size field (not absent from schema) so the handler can explicitly reject > 1 while allowing omission"
  - "trainingJobActive is module-level (not inside createJobRouter) so it persists across all router instances in a process lifetime"
  - "GET /loras/:id/status remains 501 stub — out of scope for Phase 9 per RESEARCH.md"
  - "5-second setTimeout stub simulates async job lifecycle without actual kohya_ss invocation — training is still manual CLI workflow per Phase 8 decisions"

patterns-established:
  - "GEN-06 pattern: optional numeric field validated at schema level, then additionally bounded-checked in handler for semantic rules"
  - "Fire-and-forget setImmediate + setTimeout pair for async stub endpoints that must return 202 immediately"

requirements-completed: [GEN-06]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 9 Plan 03: LoRA Train Endpoint Validation Summary

**POST /loras/train upgraded from 501 stub to GEN-06-compliant handler with Zod validation, batch_size=1 enforcement, and module-level concurrency guard returning HTTP 400/409/202**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T13:18:31Z
- **Completed:** 2026-02-20T13:20:22Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced the `POST /loras/train` 501 stub with a fully working implementation meeting all GEN-06 criteria
- Added `loraTrainSchema` Zod schema validating `datasetDir`, `outputName`, `steps`, `resolution`, and optional `batch_size`
- Added module-level `trainingJobActive` flag that persists across requests and correctly detects concurrent training attempts
- `GET /loras/:id/status` deliberately left as 501 — confirmed out of scope for Phase 9

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement POST /loras/train with batch_size validation and concurrency guard** - `730f276` (feat)

## Files Created/Modified

- `pipeline/src/comfyui/router.ts` — Added `loraTrainSchema`, module-level `trainingJobActive` flag, and replaced 501 stub with GEN-06 handler

## Decisions Made

- `loraTrainSchema` keeps `batch_size` as an optional field so the handler can explicitly reject values > 1 while silently passing omitted values through — cleaner than schema-level `.refine()` for this semantic rule.
- `trainingJobActive` lives at module scope (not inside `createJobRouter`) so it survives across all call sites within the process — there is only one router instance in practice, but module scope is the correct pattern for process-lifetime state.
- Stub uses `setImmediate` + `setTimeout(5000)` to simulate async job lifecycle; actual kohya_ss invocation is still a manual CLI workflow as established in Phase 8.
- `GET /loras/:id/status` remains 501 stub per plan spec and RESEARCH.md — Phase 9 does not implement job polling for training.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `POST /loras/train` now returns the three HTTP codes required by GEN-06: 400 (batch_size > 1), 409 (concurrent request), 202 (valid first request)
- TypeScript compiles cleanly — zero errors
- Ready for 09-04 end-to-end checkpoint which will verify all three curl cases against a live service

---
*Phase: 09-lora-integration*
*Completed: 2026-02-20*
