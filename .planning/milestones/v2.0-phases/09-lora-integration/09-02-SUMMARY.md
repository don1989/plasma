---
phase: 09-lora-integration
plan: 02
subsystem: api
tags: [comfyui, lora, inference, manifest, reproducibility, typescript]

# Dependency graph
requires:
  - phase: 09-01
    provides: "JobState, ComfyJobInput, ComfyJobResult, GenerationLogEntry types with inference param fields"
provides:
  - "submitJob uses production LoRA (spyke_plasma_v1_production) by default"
  - "router stores seed, loraId, sampler, scheduler, steps, cfg, workflowJson in JobState on completion"
  - "generate.ts records all 7 PIPE-04 inference fields in manifest entry"
  - "approve-and-copy writes chXX_pNNN_vN.workflow.json to raw/ (PIPE-05)"
affects:
  - 09-03
  - 09-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "resolvedSeed extracted before submitJob so the same value is passed to ComfyUI and stored in JobState"
    - "loraName defaults cascade: generate.ts hardwires production LoRA -> router passes to submitJob -> client fills slot"
    - "workflowTemplate in GenerationLogEntry enables post-hoc .workflow.json write at approve time (PIPE-05)"

key-files:
  created: []
  modified:
    - pipeline/src/comfyui/comfyui-client.ts
    - pipeline/src/comfyui/router.ts
    - pipeline/src/stages/generate.ts

key-decisions:
  - "generate.ts hardwires loraId: 'spyke_plasma_v1_production' in POST /jobs body — no CLI flag needed in Phase 9"
  - "resolvedSeed extracted before submitJob call so the value passed to ComfyUI matches what is stored in JobState"
  - "workflow.json written at approve time, not generation time — workflowTemplate stored in manifest for deferred write"

patterns-established:
  - "PIPE-04: every ComfyUI manifest entry records seed, loraId, sampler, scheduler, steps, cfg, workflowTemplate"
  - "PIPE-05: approve-and-copy checks for workflowTemplate in entry and writes .workflow.json if present"

requirements-completed:
  - GEN-04
  - PIPE-04
  - PIPE-05

# Metrics
duration: 7min
completed: 2026-02-20
---

# Phase 9 Plan 02: LoRA + Inference Params Runtime Wiring Summary

**LoRA name, seed, and full inference params now flow end-to-end from HTTP request through ComfyUI submission to manifest entry and .workflow.json file on disk**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-20T13:29:13Z
- **Completed:** 2026-02-20T13:36:30Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- comfyui-client.ts now fills `lora_name` slot from `input.loraName`, defaulting to `spyke_plasma_v1_production` — every generation uses the production LoRA
- router.ts extracts `resolvedSeed` before calling `submitJob` and stores all 7 inference params (seed, loraId, sampler, scheduler, steps, cfg, workflowJson) in `JobState` on completion
- generate.ts sends `loraId: 'spyke_plasma_v1_production'` in POST /jobs body, extends `JobStatusResponse` to capture inference params, and records all PIPE-04 fields in the manifest entry
- approve-and-copy block writes `chXX_pNNN_vN.workflow.json` alongside the promoted image when `workflowTemplate` is present in the manifest entry (PIPE-05)

## Task Commits

Each task was committed atomically:

1. **Task 1: comfyui-client.ts LoRA slot fill** - `84a99d3` (feat)
2. **Task 2: router.ts inference param wiring** - `0973103` (feat)
3. **Task 3: generate.ts PIPE-04/PIPE-05 wiring** - `9a54582` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `pipeline/src/comfyui/comfyui-client.ts` - `lora_name` slot filled from `input.loraName ?? 'spyke_plasma_v1_production'`
- `pipeline/src/comfyui/router.ts` - Added `loraId` to `jobRequestSchema`; extracted `resolvedSeed`; stored all inference params in `updateJob` on completion
- `pipeline/src/stages/generate.ts` - Added `loraId` to POST /jobs body; extended `JobStatusResponse`; PIPE-04 manifest fields; PIPE-05 workflow.json write on approve

## Decisions Made
- `generate.ts` hardwires `loraId: 'spyke_plasma_v1_production'` — no `--lora` CLI flag for Phase 9; simplest path to GEN-04 compliance
- `resolvedSeed` extracted before `submitJob` call so the integer passed to ComfyUI is identical to what gets stored in `JobState` and ultimately in the manifest entry
- `workflow.json` is written at approve time (not generation time) — the filled workflow JSON is stored as `workflowTemplate` in the manifest entry so it survives process restarts between generation and approval

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing test failures (out of scope):** `tests/templates/prompt-generator.test.ts` has 3 failing tests related to character fingerprint content in `prompt-generator`. These failures existed before this plan's changes (confirmed by stash verification) and are unrelated to comfyui/generate changes. Logged to deferred-items.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full inference param chain is wired: generate.ts -> router.ts -> comfyui-client.ts -> JobState -> manifest entry -> .workflow.json
- 09-03 (slot-fill tests) can now test the lora_name slot filling with the production default
- 09-04 (reproducibility checkpoint) can verify end-to-end: submit job, check manifest entry has all 7 PIPE-04 fields, approve and confirm .workflow.json is written

---
*Phase: 09-lora-integration*
*Completed: 2026-02-20*
