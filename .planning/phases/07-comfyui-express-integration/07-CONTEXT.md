# Phase 7: ComfyUI + Express Integration - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a TypeScript Express service that wraps ComfyUI's REST API and integrate it into the existing generate stage via a `--comfyui` flag. The end-to-end loop: `pnpm stage:generate -- --comfyui -c 1 --page 1` submits a job to the service, polls via WebSocket, and writes a correctly-named image to the output directory. The Gemini path remains intact. Overlay and assemble stages are unchanged.

</domain>

<decisions>
## Implementation Decisions

### Service startup
- Express service is **manually started** — user runs `pnpm start:service` in a separate terminal before running generate
- If `--comfyui` is used but service is not running: **fail immediately** with a clear error message (e.g., "Express service not running at port 3000 — run `pnpm start:service` first")
- Start command: `pnpm start:service` (separate npm script in pipeline/package.json)
- Service logging: **verbose** — logs every job request and response to the terminal

### Mode coexistence
- Default generate behavior (no mode flag): **fail with error** — require either `--comfyui` or `--gemini` explicitly. Forces a conscious choice per run.
- Output directory structure: **separate subdirectories per source** — `output/ch-01/raw/comfyui/` vs `output/ch-01/raw/gemini/`
- Image promotion on approval: **Claude's discretion** — pick the approach that requires least change to existing overlay/assemble stages
- Prompt data: **reuse existing prompt stage output** — `--comfyui` reads the same prompt JSON the current generate stage produces. One prompt pipeline, two generation backends.

### Failure handling
- Job timeout (~90s): **fail the run with a clear error** — exit 1, no image written, user re-runs manually
- Service crash mid-run: **generate stage surfaces the error** — connection error is caught and printed, loud and obvious
- `/health` endpoint when ComfyUI unreachable: **returns 503** (non-200) — makes health check CI-compatible
- `POST /jobs` validation errors: **400 with structured error body** — `{ error: "missing field: prompt", field: "prompt" }`

### Workflow templates
- Template location: `pipeline/src/comfyui/workflows/`
- Phase 7 creates: `txt2img-lora.json` (active) + `img2img-lora-controlnet.json` (stub scaffold for Phase 10)
- LoRA node: **not included in Phase 7 templates** — Phase 9 modifies templates to add the LoRA node
- Template format: **Claude's discretion** — pick between static JSON with placeholder tokens vs TypeScript builder functions, whichever is cleaner to maintain

### Claude's Discretion
- Image promotion strategy on approval (stay in subdirectory vs promote to raw/) — minimize changes to overlay/assemble stages
- Template format (static JSON tokens vs TS builder functions)
- WebSocket job completion detection implementation details
- Port configuration (3000 is specified in success criteria — not configurable)

</decisions>

<specifics>
## Specific Ideas

- Success criteria specifies WebSocket for job completion (not polling) — `POST /jobs` establishes WebSocket before posting workflow, detects completion via WS event
- `/health` must return `{ status: "ok", comfyui: true, mps: true }` per success criteria
- Resolution validation: `POST /jobs` returns 400 if `resolution.width > 512` or `resolution.height > 768`
- Output naming must follow existing convention: `ch01_pNNN_vN.png`

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-comfyui-express-integration*
*Context gathered: 2026-02-19*
