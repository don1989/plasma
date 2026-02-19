---
phase: 07-comfyui-express-integration
plan: "01"
subsystem: api
tags: [express, websocket, comfyui, typescript, zod, validation]

# Dependency graph
requires:
  - phase: 05-environment-validation
    provides: ComfyUI running at 127.0.0.1:8188, MPS benchmark result (15s/image), /system_stats health endpoint confirmed

provides:
  - Express service on port 3000 with /health, POST /jobs, GET /jobs/:id endpoints
  - Zod-validated job request schema with resolution constraints (512x768 max)
  - In-memory job store with UUID-keyed CRUD
  - Slot-fill template engine with integer seed injection
  - txt2img-lora.json workflow template (8 nodes, ModelComputeDtype fp32, slot tokens)
  - img2img-lora-controlnet.json Phase 10 stub scaffold
  - pnpm start:service script

affects:
  - 07-02-comfyui-express-integration (Plan 02 wires ComfyUI WebSocket client into router stub)
  - 10-controlnet (img2img template scaffold ready for Phase 10)

# Tech tracking
tech-stack:
  added: [express@5.2.1, ws@8.19.0, "@types/express@5.0.6", "@types/ws@8.18.1"]
  patterns:
    - Express router factory pattern (createJobRouter() export)
    - Zod v4 safeParse with .issues[0] (not .errors)
    - 202 Accepted + fire-and-forget setImmediate for async job dispatch
    - slotFill with quoted-token seed integer injection ("{{SEED}}" -> bare int)
    - ComfyUI API-format workflow JSON with stable string node IDs

key-files:
  created:
    - pipeline/src/comfyui/types.ts
    - pipeline/src/comfyui/job-store.ts
    - pipeline/src/comfyui/slot-fill.ts
    - pipeline/src/comfyui/service.ts
    - pipeline/src/comfyui/router.ts
    - pipeline/src/comfyui/workflows/txt2img-lora.json
    - pipeline/src/comfyui/workflows/img2img-lora-controlnet.json
  modified:
    - pipeline/package.json

key-decisions:
  - "Zod v4 uses .issues not .errors on ZodError — fixed at Task 2 typecheck"
  - "Port 3000 hardcoded (not configurable) per user decision"
  - "LoRA node not included in Phase 7 txt2img template — Phase 9 adds LoRA slot"
  - "POST /jobs returns 202 immediately with fire-and-forget setImmediate stub — Plan 02 replaces stub with WebSocket client"
  - "SAVE_NODE_ID = '7' in txt2img-lora.json (SaveImage node) — documented for comfyui-client.ts in Plan 02"
  - "mps: true hardcoded in /health response — confirmed by Phase 5 benchmark (MPS active)"

patterns-established:
  - "createJobRouter() factory: all Express routes live in router.ts, service.ts is a thin entry point"
  - "slotFill token convention: string tokens replaceAll, seed token strips JSON quotes for integer injection"
  - "jobRequestSchema exported from router.ts for external type inference"

requirements-completed: [GEN-01, GEN-03, GEN-04, GEN-05]

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 7 Plan 01: ComfyUI Express Service Scaffold Summary

**Express service on port 3000 with Zod-validated job submission, in-memory job store, slot-fill template engine, and ComfyUI API-format workflow templates with ModelComputeDtype fp32 override**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T19:32:58Z
- **Completed:** 2026-02-19T19:35:48Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Full Express service skeleton with /health, POST /jobs (Zod validation + resolution constraints), GET /jobs/:id, and Phase 9 stub stubs
- In-memory job store using Map singleton with UUID keys, createJob/getJob/updateJob helpers
- Slot-fill engine that correctly injects seed as a bare JSON integer (strips surrounding quotes in template)
- txt2img-lora.json with 8 nodes: CheckpointLoaderSimple -> ModelComputeDtype fp32 -> KSampler -> VAEDecode -> SaveImage, with all 5 slot tokens
- Health endpoint probes ComfyUI /system_stats with 2s timeout; returns 503 when unreachable (CI-compatible)
- Live verification: /health returned `{ comfyui: true, mps: true }` against the running ComfyUI instance

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps and create shared types + job-store + slot-fill** - `51d7f08` (feat)
2. **Task 2: Create workflow templates and Express service + router** - `dd174e3` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `pipeline/package.json` — Added express, ws deps; @types/express, @types/ws devDeps; start:service script
- `pipeline/src/comfyui/types.ts` — JobRequest, JobState, ComfyMessage, HistoryEntry types
- `pipeline/src/comfyui/job-store.ts` — In-memory Map<jobId, JobState> with createJob/getJob/updateJob
- `pipeline/src/comfyui/slot-fill.ts` — Token replacement with TOKENS const, seed integer injection
- `pipeline/src/comfyui/service.ts` — Express entry point, listens on 127.0.0.1:3000
- `pipeline/src/comfyui/router.ts` — Full router with Zod validation, resolution constraints, 501 LoRA stubs
- `pipeline/src/comfyui/workflows/txt2img-lora.json` — 8-node ComfyUI API workflow, ModelComputeDtype fp32
- `pipeline/src/comfyui/workflows/img2img-lora-controlnet.json` — Phase 10 stub scaffold

## Decisions Made

- Zod v4 (already in deps) uses `.issues[0]` not `.errors[0]` — updated error extraction in router
- `POST /jobs` returns `202 Accepted` immediately; async work fires via `setImmediate` (Plan 02 replaces stub with real WebSocket dispatch)
- KSampler `model` input is `["10", 0]` (through ModelComputeDtype node), not `["1", 0]` directly
- `mps: true` hardcoded in health response body — Phase 5 confirmed MPS is active on this machine

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 ZodError uses .issues not .errors**
- **Found during:** Task 2 (router.ts typecheck)
- **Issue:** Plan specified `parsed.error.errors[0]` but Zod v4 renamed `errors` to `issues` on ZodError — TS2339 compile error
- **Fix:** Changed to `parsed.error.issues[0]` with optional chaining for strict-mode undefined safety
- **Files modified:** `pipeline/src/comfyui/router.ts`
- **Verification:** `pnpm typecheck` passed; live test confirmed 400 response with correct message/field structure
- **Committed in:** `dd174e3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — API incompatibility)
**Impact on plan:** Trivial fix, no scope change. Zod v4 migration is a known breaking change.

## Issues Encountered

None beyond the Zod v4 API fix documented above.

## User Setup Required

None — no external service configuration required. ComfyUI is already running (Phase 5 gate passed).

## Next Phase Readiness

- Plan 02 can immediately start wiring the ComfyUI WebSocket client into the `setImmediate` stub in router.ts
- `SAVE_NODE_ID = '7'` for the comfyui-client.ts SaveImage node detection
- Service start verified against live ComfyUI at 127.0.0.1:8188
- No blockers — all Plan 01 must-haves satisfied

---
*Phase: 07-comfyui-express-integration*
*Completed: 2026-02-19*
