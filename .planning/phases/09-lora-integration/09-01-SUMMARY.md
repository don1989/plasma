---
phase: 09-lora-integration
plan: 01
subsystem: infra
tags: [comfyui, lora, typescript, types, workflow-template, pipe-04]

# Dependency graph
requires:
  - phase: 08-spyke-lora-training
    provides: "spyke_plasma_v1_production.safetensors at strength 0.8 — the LoRA being wired in"
  - phase: 07-comfyui-express
    provides: "txt2img-lora.json workflow template, ComfyUI client, slot-fill token system"
provides:
  - "LoraLoader[11] and CLIPSetLastLayer[12] nodes wired into workflow template"
  - "GenerationLogEntry with 7 PIPE-04 inference tracking fields (seed, sampler, scheduler, steps, cfg, loraId, controlnetStrength, workflowTemplate)"
  - "JobState with 7 new inference fields (seed, loraId, sampler, scheduler, steps, cfg, workflowJson)"
  - "ComfyJobInput.loraName optional field"
  - "ComfyJobResult.seed and workflowJson required fields (populated in submitJob)"
affects:
  - "09-02 (runtime wiring — will use these types and workflow nodes)"
  - "10-controlnet (will extend JobState/GenerationLogEntry with controlnetStrength)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LoRA node ordering: ModelComputeDtype[10] -> LoraLoader[11] -> CLIPSetLastLayer[12] -> KSampler[5]"
    - "All PIPE-04 fields optional on GenerationLogEntry for backward-compatibility with Gemini entries"
    - "ComfyJobResult carries seed+workflowJson for reproducibility — filled from submitJob scope"

key-files:
  created: []
  modified:
    - "pipeline/src/comfyui/workflows/txt2img-lora.json"
    - "pipeline/src/types/generation.ts"
    - "pipeline/src/comfyui/types.ts"
    - "pipeline/src/comfyui/comfyui-client.ts"

key-decisions:
  - "CLIPSetLastLayer stop_at_clip_layer=-2 (CLIP skip 2) is the standard LoRA inference setting for SD 1.5 style models"
  - "LoRA strength 0.8 hardcoded in workflow template — locked Phase 8 production value, not a runtime slot"
  - "ComfyJobResult.seed and workflowJson are required (not optional) — every ComfyUI job must capture these for PIPE-05 reproducibility"
  - "loraName added to ComfyJobInput optional — allows callers to override; router wires in Phase 9-02"

patterns-established:
  - "Workflow graph: CheckpointLoader[1] -> ModelComputeDtype[10] -> LoraLoader[11] -> KSampler[5] (model chain)"
  - "CLIP chain: CheckpointLoader[1].clip -> LoraLoader[11].clip -> CLIPSetLastLayer[12] -> CLIPTextEncode[2,3]"

requirements-completed: [GEN-04, PIPE-04, PIPE-05]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 9 Plan 01: LoRA Workflow Template + PIPE-04 Type Extensions Summary

**LoRA graph wired into txt2img-lora.json (LoraLoader[11] + CLIPSetLastLayer[12]) and TypeScript types extended with all PIPE-04 inference tracking fields for reproducibility**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T13:18:30Z
- **Completed:** 2026-02-20T13:20:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Workflow template updated with LoraLoader[11] (strength 0.8) and CLIPSetLastLayer[12] (clip skip 2), correctly wired so KSampler reads model from node 11 and both CLIPTextEncode nodes read CLIP from node 12
- GenerationLogEntry extended with 7 PIPE-04 fields: seed, sampler, scheduler, steps, cfg, loraId, controlnetStrength, workflowTemplate (all optional for Gemini backward compatibility)
- JobState, ComfyJobInput, ComfyJobResult updated with inference tracking fields; submitJob return updated to populate seed and workflowJson

## Task Commits

Each task was committed atomically:

1. **Task 1: Add LoraLoader and CLIPSetLastLayer nodes to workflow template** - `bca2184` (feat)
2. **Task 2: Extend types — GenerationLogEntry, JobState, ComfyJobInput, ComfyJobResult** - `3c1308b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `pipeline/src/comfyui/workflows/txt2img-lora.json` - Added LoraLoader[11] and CLIPSetLastLayer[12]; rewired KSampler model input from [10,0] to [11,0]; rewired CLIPTextEncode clip inputs from [1,1] to [12,0]
- `pipeline/src/types/generation.ts` - Added 7 PIPE-04 optional fields to GenerationLogEntry
- `pipeline/src/comfyui/types.ts` - Added 7 inference tracking optional fields to JobState
- `pipeline/src/comfyui/comfyui-client.ts` - Added loraName to ComfyJobInput; added seed+workflowJson to ComfyJobResult; updated submitJob return statement

## Decisions Made

- `stop_at_clip_layer: -2` (CLIP skip 2) is the standard SD 1.5 LoRA inference setting — not a runtime slot, hardcoded
- LoRA strength 0.8 is locked from Phase 8 training results — not configurable per-job in Phase 9
- `ComfyJobResult.seed` and `workflowJson` are required fields (not optional) to enforce that every ComfyUI generation captures reproducibility data
- `loraName` on `ComfyJobInput` is optional — Phase 9-02 router will default it to `spyke_plasma_v1_production`

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Updated submitJob return to populate new required ComfyJobResult fields**

- **Found during:** Task 2 (type extension)
- **Issue:** Making `seed` and `workflowJson` required on `ComfyJobResult` would cause a TypeScript compile error on the existing return statement `{ promptId, imagePath, imageFile }` — the return was missing the new required fields
- **Fix:** Updated the return statement to `{ promptId, imagePath, imageFile, seed, workflowJson: filledJson }` — both values were already in scope from earlier in submitJob
- **Files modified:** pipeline/src/comfyui/comfyui-client.ts
- **Verification:** `pnpm tsc --noEmit` passes with zero errors
- **Committed in:** `3c1308b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing required field population)
**Impact on plan:** Necessary for type correctness. No scope creep — values were already computed in submitJob.

## Issues Encountered

None — plan executed cleanly. TypeScript compile passed on first attempt after all edits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Workflow template is ready for Phase 9-02 runtime wiring (LoRA slot will be filled with `spyke_plasma_v1_production`)
- Types are ready for Phase 9-02 router to populate `loraId`, `seed`, `sampler`, `scheduler`, `steps`, `cfg`, `workflowJson` on JobState
- Phase 10 (ControlNet) can extend from these types — `controlnetStrength` placeholder field already on GenerationLogEntry

---
*Phase: 09-lora-integration*
*Completed: 2026-02-20*
