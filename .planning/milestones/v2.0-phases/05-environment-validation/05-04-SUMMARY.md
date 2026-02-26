---
phase: 05-environment-validation
plan: "04"
subsystem: infra
tags: [comfyui, mps, apple-silicon, benchmark, pytorch, sd15]

# Dependency graph
requires:
  - phase: 05-01
    provides: ComfyUI venv with PyTorch 2.5.1 MPS wheel installed at ~/tools/ComfyUI
  - phase: 05-03
    provides: AnythingXL_inkBase.safetensors checkpoint + OpenPose ControlNet model + comfyui_controlnet_aux extension

provides:
  - ComfyUI launch confirmed working at http://127.0.0.1:8188 with MPS device (devices[0].type == "mps")
  - INFRA-04 benchmark result: 512x512, 20-step euler_ancestral via AnythingXL_inkBase.safetensors in 15s (PASS)
  - Phase 5 gate cleared — Phases 7 and 10 may now be planned

affects: [phase-07, phase-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ComfyUI health check via /system_stats (not /health — that endpoint does not exist in ComfyUI)"
    - "Benchmark gating: hardware generation speed validated before pipeline integration begins"
    - "AnythingXL_inkBase accepted as functional substitute for anything-v5-PrtRE — same SD 1.5 architecture, no hardcoded checkpoint name in pipeline"

key-files:
  created:
    - .planning/phases/05-environment-validation/05-BENCHMARK.md
    - .planning/phases/05-environment-validation/05-04-SUMMARY.md
  modified: []

key-decisions:
  - "AnythingXL_inkBase.safetensors accepted as equivalent substitute for anything-v5-PrtRE.safetensors — same SD 1.5 architecture, ComfyUI accepts any filename, no hardcoded path in pipeline"
  - "Benchmark elapsed time of 15s (8x under the 120s threshold) confirms M1 Pro MPS throughput is acceptable for Phase 7 integration timing expectations"
  - "Phase 5 gate is PASS on all five INFRA criteria — Phase 6 and Phase 7 planning is now unblocked"

patterns-established:
  - "Phase gating: run hardware benchmark before any integration code is written — prevents investing weeks in integration work on a machine that cannot hit target throughput"
  - "/system_stats JSON structure: devices array with type, name, vram_total fields — use this for programmatic MPS confirmation in Phase 7 Express service health check"

requirements-completed: [INFRA-04, INFRA-01]

# Metrics
duration: 20min
completed: 2026-02-19
---

# Phase 5 Plan 04: Hardware Benchmark Summary

**ComfyUI MPS benchmark PASS: 512x512 euler_ancestral generation in 15s (8x under 120s threshold), devices[0].type confirmed "mps" via /system_stats, Phase 5 gate cleared**

## Performance

- **Duration:** ~20 min (including ComfyUI startup wait + human benchmark run)
- **Started:** 2026-02-19T15:49:00Z (estimated)
- **Completed:** 2026-02-19T16:09:27Z
- **Tasks:** 2 of 2
- **Files modified:** 2 (05-BENCHMARK.md created + filled in)

## Accomplishments

- ComfyUI launched at http://127.0.0.1:8188 with PYTORCH_ENABLE_MPS_FALLBACK=1 and --force-fp16 flags
- /system_stats confirmed MPS device: devices[0].type == "mps", PyTorch 2.5.1, Python 3.11.9
- INFRA-04 benchmark completed: 512x512, 20 steps, euler_ancestral, AnythingXL_inkBase.safetensors, elapsed 15s — PASS (threshold 120s, 8x headroom)
- GPU History in Activity Monitor showed active utilization confirming Metal acceleration (not CPU fallback)
- 05-BENCHMARK.md filled in with actual system_stats JSON, timing, GPU History observation, and PASS verdicts
- All five Phase 5 success criteria satisfied (INFRA-01 through INFRA-05)

## Task Commits

1. **Task 1: Launch ComfyUI and verify /system_stats confirms MPS** - `c299d30` (feat)
2. **Task 2: Run INFRA-04 benchmark in browser and record results** - human-verify checkpoint (no separate commit — results written into 05-BENCHMARK.md by user, committed with this plan metadata)

## Files Created/Modified

- `.planning/phases/05-environment-validation/05-BENCHMARK.md` — Benchmark results: actual /system_stats JSON, MPS confirmation, 15s elapsed time, PASS verdict for INFRA-04 and Phase 5 gate
- `.planning/phases/05-environment-validation/05-04-SUMMARY.md` — This file

## Decisions Made

- AnythingXL_inkBase.safetensors accepted as equivalent substitute for anything-v5-PrtRE.safetensors. Same SD 1.5 architecture. ComfyUI accepts any checkpoint filename with no hardcoded name in the pipeline — this decision was already recorded in STATE.md during Plan 03.
- Benchmark result (15s) sets baseline timing expectation for Phase 7 Express service: polling timeout and job completion logic should assume generation completes in well under 2 minutes on this hardware.
- Phase 5 gate is PASS on all criteria. Phases 6 and 7 are unblocked.

## Deviations from Plan

None — plan executed exactly as written. Task 1 (auto) committed at c299d30. Task 2 was a human-verify checkpoint that proceeded as designed: user ran the generation in the ComfyUI browser UI and filled in 05-BENCHMARK.md.

## Issues Encountered

None. ComfyUI started cleanly, MPS was detected on first launch, and benchmark exceeded expectations (15s vs 120s threshold).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Phase 5 is complete.** All five INFRA requirements satisfied:

- INFRA-01: ComfyUI running with MPS at http://127.0.0.1:8188 (confirmed by /system_stats) — PASS
- INFRA-02: AnythingXL_inkBase.safetensors in ~/tools/ComfyUI/models/checkpoints/ — PASS
- INFRA-03: kohya_ss venv with mixed_precision: no (Plan 02) — PASS
- INFRA-04: 512x512, 20-step benchmark in 15s (under 2 minutes) — PASS
- INFRA-05: ComfyUI-Manager + ControlNet-Aux installed, OpenPose model present (Plan 03) — PASS

**Phase 6 (Spyke Dataset Preparation)** and **Phase 7 (ComfyUI + Express Integration)** are both unblocked.

Key facts for Phase 7 implementation:
- ComfyUI launch command: `PYTORCH_ENABLE_MPS_FALLBACK=1 python main.py --force-fp16 --listen 127.0.0.1 --port 8188`
- Health check endpoint: `GET /system_stats` (not /health)
- MPS detection: `response.devices[0].type === "mps"`
- Throughput baseline: 512x512, 20 steps ~15s on M1 Pro 16GB — job timeout can be 90s with comfortable headroom

---
*Phase: 05-environment-validation*
*Completed: 2026-02-19*
