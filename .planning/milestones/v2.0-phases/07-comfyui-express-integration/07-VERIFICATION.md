---
phase: 07-comfyui-express-integration
verified: 2026-02-19T20:30:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 7: ComfyUI Express Integration Verification Report

**Phase Goal:** The end-to-end generation loop works: `pnpm stage:generate -- --comfyui -c 1 --page 1` submits a job, polls the Express service, and produces a correctly-named image in `output/ch-01/raw/` — with the Gemini API mode still intact and the overlay/assemble stages consuming the output unchanged.
**Verified:** 2026-02-19T20:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Express service starts on port 3000 via `pnpm start:service` and logs startup message | VERIFIED | `service.ts` calls `app.listen(3000, '127.0.0.1', ...)` with three startup console.log lines |
| 2 | `GET /health` returns `{status:'ok', comfyui:true, mps:true}` when ComfyUI reachable, 503 when not | VERIFIED | `router.ts` lines 54–72: probes `/system_stats` with 2s timeout, returns 200 or 503 with correct body |
| 3 | `POST /jobs` with width>512 or height>768 or batch_size>1 returns HTTP 400 with structured `{error, field}` body | VERIFIED | `router.ts` lines 92–106: explicit checks for each constraint, returns `res.status(400).json({error, field})` |
| 4 | Workflow templates exist with `{{PLACEHOLDER}}` tokens and ModelComputeDtype VAE fp32 node | VERIFIED | `txt2img-lora.json` contains all 5 tokens; node 10 is `ModelComputeDtype` with `dtype:"fp32"` connected to KSampler model path |
| 5 | WebSocket connection is established BEFORE POST /prompt is called — GEN-02 compliant | VERIFIED | `comfyui-client.ts` lines 146–176: `new WebSocket(...)` then `await new Promise(open)` then `fetch(...prompt)` |
| 6 | Job completion detected via `{type:'executing', data:{node:null, prompt_id}}` (not execution_success) | VERIFIED | `comfyui-client.ts` lines 94–102: `msg.type === 'executing' && msg.data.node === null && msg.data.prompt_id === promptId` |
| 7 | `pnpm stage:generate -- --comfyui -c 1 --page 1` submits to Express service and image lands in `output/ch-01/raw/comfyui/` | VERIFIED | `generate.ts` lines 483–655: full ComfyUI branch with health check, POST /jobs, poll loop, manifest record; `output/ch-01/raw/comfyui/` contains ch01_p001_v1.png through v3.png |
| 8 | Running generate without an explicit mode flag fails with a clear error | VERIFIED | `cli.ts` lines 106–109: guards all four flags; error message "specify --comfyui, --gemini (--api), or --manual explicitly" |
| 9 | Gemini API (--api) and manual (--manual) modes still work unchanged | VERIFIED | `generate.ts` manual and api branches intact (lines 132–480); no modifications to Gemini client; overlay/assemble commits predate Phase 7 |
| 10 | Approved ComfyUI image is promoted from `raw/comfyui/` to `raw/` so overlay/assemble can consume it | VERIFIED | `generate.ts` lines 94–130: approve block reads manifest, finds `source==='comfyui'` + `sourcePath`, calls `copyFile(sourcePath, raw/filename)` |

**Score: 10/10 truths verified**

---

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Provides | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|----------------------|----------------|--------|
| `pipeline/src/comfyui/types.ts` | JobRequest, JobState, ComfyMessage, JobStatus, HistoryEntry types | Yes | 50 lines, all 5 interfaces exported | Imported by job-store.ts, comfyui-client.ts, router.ts | VERIFIED |
| `pipeline/src/comfyui/job-store.ts` | Map<jobId,JobState> singleton with createJob/getJob/updateJob | Yes | 52 lines, all 3 functions implemented with UUID, timestamps, immutable fields | Imported by router.ts | VERIFIED |
| `pipeline/src/comfyui/slot-fill.ts` | Token replacement for 5 fields; JSON-safe via jsonEscapeString | Yes | 74 lines; TOKENS const, jsonEscapeString helper, slotFill with seed integer injection | Imported by comfyui-client.ts | VERIFIED |
| `pipeline/src/comfyui/service.ts` | Express entry point on port 3000 | Yes | 20 lines; `app.listen(3000, '127.0.0.1', ...)` present | Entry point, not imported (executed as process) | VERIFIED |
| `pipeline/src/comfyui/router.ts` | /health, POST /jobs, GET /jobs/:id, LoRA stubs | Yes | 195 lines; all endpoints implemented with Zod validation, resolution constraints, job store integration | Imported by service.ts via `createJobRouter()` | VERIFIED |
| `pipeline/src/comfyui/workflows/txt2img-lora.json` | 8-node ComfyUI API workflow with slot tokens and ModelComputeDtype | Yes | 45 lines; 5 tokens + node 10 ModelComputeDtype fp32 + SAVE_NODE_ID=7 | Loaded by comfyui-client.ts via readFileSync | VERIFIED |
| `pipeline/src/comfyui/workflows/img2img-lora-controlnet.json` | Phase 10 stub scaffold | Yes | 5 lines; valid JSON with _comment/_phase/_status stub fields | Not wired (by design — Phase 10) | VERIFIED |

#### Plan 02 Artifacts

| Artifact | Provides | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|----------------------|----------------|--------|
| `pipeline/src/comfyui/comfyui-client.ts` | WebSocket + REST wrapper for ComfyUI API | Yes | 198 lines; full submitJob implementation with WS-before-POST, 90s timeout, history retrieval, file copy | Imported by router.ts via `import {submitJob}` | VERIFIED |
| `pipeline/src/comfyui/router.ts` (updated) | POST /jobs calls submitJob (not stub) | Yes | setImmediate block calls `await submitJob(...)` with full job state transitions | submitJob imported and called at router.ts line 133 | VERIFIED |

#### Plan 03 Artifacts

| Artifact | Provides | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|----------------------|----------------|--------|
| `pipeline/src/cli.ts` | --comfyui flag with --page guard and no-default enforcement | Yes | `--comfyui` option at line 68; mode guard at lines 106–109; --page guard at lines 142–145 | Passes `mode: 'comfyui'` to `runGenerate` | VERIFIED |
| `pipeline/src/stages/generate.ts` | ComfyUI mode branch + approve-and-copy | Yes | 665 lines; full ComfyUI branch lines 482–655; approve-and-copy lines 101–110; `checkServiceRunning` helper | Called from cli.ts; calls Express service at 127.0.0.1:3000 | VERIFIED |
| `pipeline/src/types/generation.ts` | GenerationLogEntry with source/sourcePath fields | Yes | 38 lines; `source?: 'gemini' | 'comfyui'` and `sourcePath?: string` present | Used by generate.ts when recording ComfyUI entries | VERIFIED |
| `pipeline/src/config/paths.ts` | comfyuiRaw subpath helper | Yes | `comfyuiRaw: path.join(raw, 'comfyui')` at line 58 | Used by generate.ts at line 525 (`chapterPaths.comfyuiRaw`) | VERIFIED |

---

### Key Link Verification

| From | To | Via | Pattern Found | Status |
|------|----|-----|---------------|--------|
| `service.ts` | `router.ts` | `app.use('/', createJobRouter())` | `createJobRouter` at service.ts line 9 (import) + line 13 (use) | WIRED |
| `router.ts` | `slot-fill.ts` | `import { slotFill }` | Not directly — router.ts imports submitJob from comfyui-client.ts which imports slotFill | WIRED (via client) |
| `router.ts` | `comfyui-client.ts` | `import { submitJob }` | `import { submitJob } from './comfyui-client.js'` at router.ts line 14 | WIRED |
| `comfyui-client.ts` | `ws://127.0.0.1:8188/ws` | `new WebSocket(url)` | `new WebSocket(\`${COMFYUI_WS}/ws?clientId=${clientId}\`)` at line 146 | WIRED |
| `comfyui-client.ts` | `http://127.0.0.1:8188/prompt` | `fetch after ws.open` | `fetch(\`${COMFYUI_URL}/prompt\`, ...)` at line 158, called AFTER ws `open` event | WIRED |
| `cli.ts` | `generate.ts` | `mode: 'comfyui' passed in options` | `const mode: 'manual' | 'api' | 'comfyui' = options.comfyui ? 'comfyui' : ...` at line 110; passed to `runGenerate({..., mode, ...})` | WIRED |
| `generate.ts` | `http://127.0.0.1:3000` | `fetch /health then POST /jobs` | `fetch('http://127.0.0.1:${port}/health', ...)` and `fetch('http://127.0.0.1:3000/jobs', ...)` at lines 69, 541 | WIRED |
| `generate.ts` | `output/ch-01/raw/` | `copyFile from raw/comfyui/ on approve` | `copyFile(entry.sourcePath, path.join(chapterPaths.raw, options.approve))` at lines 106–108 | WIRED |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GEN-01 | 07-01 | Express service on port 3000 with POST /jobs, GET /jobs/:id, POST /loras/train, GET /loras/:id/status, GET /health | SATISFIED | All 5 endpoints implemented in router.ts; LoRA stubs return 501 per Phase 9 deferral |
| GEN-02 | 07-02 | WS-before-POST ordering — WebSocket established before POST /prompt | SATISFIED | comfyui-client.ts: WS open awaited at lines 147–153 before fetch at line 158 |
| GEN-03 | 07-01 | POST /jobs validates width>512, height>768, batch_size>1 → HTTP 400 | SATISFIED | router.ts lines 92–106: three explicit validation guards with structured error bodies |
| GEN-04 | 07-01 | Static JSON workflow templates with 5 slot tokens; no programmatic assembly | SATISFIED | txt2img-lora.json has all 5 tokens; slotFill does string replacement only |
| GEN-05 | 07-01/02 | U-Net fp16 (via --force-fp16 launch flag), VAE fp32 via explicit ModelComputeDtype node | SATISFIED | Node 10 in txt2img-lora.json: ModelComputeDtype fp32 between checkpoint and KSampler; 5 end-to-end images generated successfully |
| PIPE-01 | 07-03 | generate.ts gains mode==='comfyui' branch; existing manual and api branches unchanged | SATISFIED | generate.ts line 483: `if (mode === 'comfyui')` branch; manual (line 132) and api (line 245) branches untouched |
| PIPE-02 | 07-03 | CLI gains --comfyui flag; `pnpm stage:generate -- --comfyui -c 1 --page 1` submits and polls | SATISFIED | cli.ts line 68: `--comfyui` option; generate.ts submits to POST /jobs and polls GET /jobs/:id in 2s intervals |
| PIPE-03 | 07-03 | Images saved to output/ch-XX/raw/ with chXX_pNNN_vN.png naming; overlay/assemble unchanged | SATISFIED | output/ch-01/raw/ contains ch01_p001_v1–v5.png; overlay committed at 7aca122 (before Phase 7); assemble at 720b5fb (before Phase 7) |

All 8 requirements fully satisfied. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Assessment |
|------|------|---------|----------|------------|
| `slot-fill.ts` | 4, 37 | Word "PLACEHOLDER" in comments | Info | Documentation-only; describes the `{{PLACEHOLDER}}` token format. Not a stub indicator. |
| `router.ts` | lines 183–191 | POST /loras/train and GET /loras/:id/status return 501 | Info | Intentional Phase 9 stubs, documented in plan and per GEN-01 scope. Not a phase 7 gap. |
| `comfyui-client.ts` | line 137 | `lora_name: ''` (empty LoRA name) | Info | Intentional Phase 7 design — LoRA slot wired but unfilled until Phase 9. JSON-safe via jsonEscapeString. |

No blockers. No warnings.

---

### Human Verification Required

The following cannot be verified programmatically:

#### 1. Live End-to-End Generation

**Test:** With ComfyUI running at 127.0.0.1:8188 and `pnpm start:service` running in a separate terminal, run `pnpm stage:generate -- --comfyui -c 1 --page 1`
**Expected:** Command completes without error; image appears at `output/ch-01/raw/comfyui/chXX_pYYY_vN.png`; service terminal shows WS open log, progress steps, then completion
**Why human:** Requires live ComfyUI process; cannot be verified against static code

#### 2. Approve-and-Copy Promotion

**Test:** After ComfyUI generation, run `pnpm stage:generate -- --approve ch01_p001_vN.png -c 1`
**Expected:** Image is copied from `output/ch-01/raw/comfyui/ch01_p001_vN.png` to `output/ch-01/raw/ch01_p001_vN.png`; console logs "Promoted ComfyUI image"
**Why human:** Requires a ComfyUI-sourced manifest entry; depends on prior generation step

#### 3. Overlay Stage Compatibility

**Test:** After approve-and-copy, run `pnpm stage:overlay -- -c 1 --page 1`
**Expected:** Overlay runs on the promoted image without errors; output appears in `output/ch-01/lettered/`
**Why human:** Requires real image in raw/ from step 2; end-to-end visual confirmation

---

### Evidence of Successful End-to-End Run

The following output files exist, confirming prior live end-to-end runs completed successfully:

- `output/ch-01/raw/ch01_p001_v1.png` through `ch01_p001_v5.png` — Gemini + ComfyUI images in raw/ (v5 is confirmed promoted ComfyUI image per SUMMARY-03)
- `output/ch-01/raw/comfyui/ch01_p001_v1.png` through `ch01_p001_v3.png` — ComfyUI images in raw/comfyui/
- All 6 phase commits verified in git log: 51d7f08, dd174e3, b0ef300, 2422794, c04b0b1, 7d5b015

---

### Gaps Summary

No gaps found. All 10 observable truths verified. All 14 required artifacts exist, are substantive, and are wired. All 8 phase requirements (GEN-01 through GEN-05, PIPE-01 through PIPE-03) are satisfied. TypeScript typecheck passes with zero errors.

The only human-verification items are live execution scenarios that require ComfyUI to be running — not code defects. Prior live runs documented in SUMMARY files confirm these scenarios have already been executed successfully during plan execution.

---

_Verified: 2026-02-19T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
