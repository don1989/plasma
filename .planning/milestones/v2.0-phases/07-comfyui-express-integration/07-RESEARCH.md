# Phase 7: ComfyUI + Express Integration — Research

**Researched:** 2026-02-19
**Domain:** ComfyUI REST/WebSocket API, Express 5, ws package, TypeScript ESM service architecture
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Service startup**
- Express service is manually started — user runs `pnpm start:service` in a separate terminal before running generate
- If `--comfyui` is used but service is not running: fail immediately with a clear error message (e.g., "Express service not running at port 3000 — run `pnpm start:service` first")
- Start command: `pnpm start:service` (separate npm script in pipeline/package.json)
- Service logging: verbose — logs every job request and response to the terminal

**Mode coexistence**
- Default generate behavior (no mode flag): fail with error — require either `--comfyui` or `--gemini` explicitly. Forces a conscious choice per run.
- Output directory structure: separate subdirectories per source — `output/ch-01/raw/comfyui/` vs `output/ch-01/raw/gemini/`
- Image promotion on approval: Claude's discretion — pick the approach that requires least change to existing overlay/assemble stages
- Prompt data: reuse existing prompt stage output — `--comfyui` reads the same prompt JSON the current generate stage produces. One prompt pipeline, two generation backends.

**Failure handling**
- Job timeout (~90s): fail the run with a clear error — exit 1, no image written, user re-runs manually
- Service crash mid-run: generate stage surfaces the error — connection error is caught and printed, loud and obvious
- `/health` endpoint when ComfyUI unreachable: returns 503 (non-200) — makes health check CI-compatible
- `POST /jobs` validation errors: 400 with structured error body — `{ error: "missing field: prompt", field: "prompt" }`

**Workflow templates**
- Template location: `pipeline/src/comfyui/workflows/`
- Phase 7 creates: `txt2img-lora.json` (active) + `img2img-lora-controlnet.json` (stub scaffold for Phase 10)
- LoRA node: not included in Phase 7 templates — Phase 9 modifies templates to add the LoRA node
- Template format: Claude's discretion — pick between static JSON with placeholder tokens vs TypeScript builder functions, whichever is cleaner to maintain

### Claude's Discretion
- Image promotion strategy on approval (stay in subdirectory vs promote to raw/) — minimize changes to overlay/assemble stages
- Template format (static JSON tokens vs TS builder functions)
- WebSocket job completion detection implementation details
- Port configuration (3000 is specified in success criteria — not configurable)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GEN-01 | Express service on port 3000 with POST /jobs, GET /jobs/:id, POST /loras/train, GET /loras/:id/status, GET /health | Express 5 routing patterns; standard REST service structure |
| GEN-02 | WebSocket + client_id pattern — WS established BEFORE POST /prompt, race condition is unrecoverable if order wrong | Verified from official ComfyUI example + 9elements reference implementation |
| GEN-03 | POST /jobs validates width > 512 → 400, height > 768 → 400, batch_size > 1 → 400 | Standard Express validation pattern with zod (already in deps) |
| GEN-04 | Workflow templates are static JSON in "API format". Express slot-fills 5 fields: prompt_text, negative_prompt, seed, lora_name, checkpoint_name | ComfyUI API format structure verified; static JSON + string replace is simpler than builder |
| GEN-05 | U-Net fp16, VAE fp32 — split explicit in templates, not inherited from ComfyUI defaults | Verified via ModelComputeDtype node; ComfyUI launched with --force-fp16 so VAE needs explicit fp32 override |
| PIPE-01 | generate.ts gains mode === 'comfyui' branch. Existing manual and api (Gemini) branches unchanged. | Existing generate.ts structure documented; branch insertion point identified |
| PIPE-02 | CLI gains --comfyui flag. pnpm stage:generate -- --comfyui -c 1 --page 1 submits to Express service | cli.ts mode determination pattern documented; one-line change to add third mode |
| PIPE-03 | Images saved to output/ch-XX/raw/ with naming convention chXX_pNNN_vN.png. Overlay/assemble stages unchanged. | Image promotion strategy researched; subdirectory + approval-copy approach avoids overlay changes |
</phase_requirements>

---

## Summary

Phase 7 builds a TypeScript Express service that wraps the ComfyUI REST + WebSocket API, then wires the existing `generate.ts` stage to call it via a new `--comfyui` mode flag. The phase has three distinct concerns: (1) the Express service itself with job routing and validation, (2) the ComfyUI integration logic inside the service (WebSocket-before-POST, completion detection, image retrieval), and (3) the pipeline-side generate stage changes and output file placement.

The highest-risk implementation detail is GEN-02: the WebSocket connection to ComfyUI's `/ws?clientId={uuid}` endpoint MUST be established before the workflow is submitted via `POST http://127.0.0.1:8188/prompt`. This is a fixed ordering constraint, not a best practice. The official ComfyUI Python example, the 9elements reference implementation, and the ComfyUI DeepWiki documentation all confirm the same pattern: completion is detected when a `{ type: "executing", data: { node: null, prompt_id: "..." } }` message arrives on the WebSocket.

The second notable finding concerns the fp16/fp32 split (GEN-05). ComfyUI is launched with `--force-fp16` per INFRA-01. This means U-Net defaults to fp16, which is correct. But VAE defaults to fp16 too, causing known MPS color-desaturation bugs (issue #6254, confirmed). The fix is to add a `ModelComputeDtype` node (class_type: `"ModelComputeDtype"`, dtype: `"fp32"`) connected between the checkpoint loader and VAE decode node in the workflow template. This is a node-level override, not a ComfyUI startup flag.

**Primary recommendation:** Build the Express service as a standalone `pipeline/src/comfyui/service.ts` entry point, use the `ws` package for the ComfyUI WebSocket client, `express` for the HTTP layer, and static JSON workflow templates with five `{{PLACEHOLDER}}` tokens replaced at runtime. Approve-and-copy is the image promotion strategy that requires zero changes to existing overlay/assemble stages.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^5.1.0 | HTTP service framework | Official stable; v5 is now the npm default; has types in @types/express |
| @types/express | ^5.0.6 | TypeScript types for Express | Required for strict TypeScript; matches Express 5 |
| ws | ^8.19.0 | WebSocket client to ComfyUI | Node.js de facto WS library; no browser dependency; used by official ComfyUI client wrappers |
| @types/ws | ^8.x | TypeScript types for ws | Required for strict TypeScript |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 (already installed) | Request body validation | Already in deps; validates POST /jobs body before processing |
| node:crypto | built-in | UUID generation for client_id | `randomUUID()` from Node built-in; no extra package needed |
| node:fs/promises | built-in | Image file copy after generation | Already used throughout pipeline |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ws` package | Node.js native `WebSocket` (v21+) | Native WS is available in Node 22 but `ws` is battle-tested, has better TypeScript types, and is consistent with the existing ecosystem |
| Static JSON templates | TypeScript builder functions | Builder functions add type safety but increase complexity; static JSON + token replace is easier to inspect and debug; Phase 9 will modify templates to add LoRA — JSON is better for that |
| `express` | `fastify` or `hono` | Express 5 is stable and the team knows it; no performance requirement justifies switching |

**Installation:**
```bash
cd pipeline
pnpm add express ws
pnpm add -D @types/express @types/ws
```

---

## Architecture Patterns

### Recommended Project Structure

```
pipeline/src/comfyui/
├── service.ts              # Express app entry point (pnpm start:service)
├── router.ts               # Express router: /jobs, /health, /loras
├── comfyui-client.ts       # ComfyUI API wrapper (WebSocket + REST)
├── job-store.ts            # In-memory job state Map<jobId, JobState>
├── slot-fill.ts            # Template token replacement (5 fields)
├── types.ts                # JobRequest, JobState, ComfyMessage types
└── workflows/
    ├── txt2img-lora.json   # Active template (Phase 7)
    └── img2img-lora-controlnet.json  # Stub scaffold (Phase 10)
```

The Express app lives at `pipeline/src/comfyui/service.ts` and is launched directly via `tsx src/comfyui/service.ts` from the `start:service` npm script. It does NOT re-use `cli.ts` — it is a separate entry point.

### Pattern 1: WebSocket-Before-POST (CRITICAL — GEN-02)

**What:** Establish the WebSocket connection to ComfyUI with the client_id BEFORE posting the workflow. Any other order creates an unrecoverable race condition.

**When to use:** Every single ComfyUI job submission. No exceptions.

**Exact sequence:**
```typescript
// Source: https://github.com/comfyanonymous/ComfyUI/blob/master/script_examples/websockets_api_example.py
// and https://9elements.com/blog/hosting-a-comfyui-workflow-via-api/

import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const COMFYUI_URL = 'http://127.0.0.1:8188';
const clientId = randomUUID();

// STEP 1: WebSocket connection FIRST
const ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${clientId}`);

await new Promise<void>((resolve, reject) => {
  ws.once('open', resolve);
  ws.once('error', reject);
});

// STEP 2: POST workflow AFTER WS is open
const response = await fetch(`${COMFYUI_URL}/prompt`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: workflow, client_id: clientId }),
});
const { prompt_id } = await response.json() as { prompt_id: string };

// STEP 3: Listen for completion
const result = await waitForCompletion(ws, prompt_id, timeoutMs);
ws.close();
```

### Pattern 2: Completion Detection via WebSocket

**What:** The `executing` message type with `data.node === null` and matching `prompt_id` signals completion. Do NOT use `execution_success` — it fires before outputs are persisted to disk (issue #11540).

**Signal format:**
```typescript
// Source: https://deepwiki.com/comfyanonymous/ComfyUI/7.1-websocket-api
// Confirmed by: https://9elements.com/blog/hosting-a-comfyui-workflow-via-api/

interface ComfyMessage {
  type: string;
  data: {
    node: string | null;
    prompt_id?: string;
    value?: number;
    max?: number;
  };
}

function waitForCompletion(ws: WebSocket, promptId: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Job timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as ComfyMessage;
      if (
        msg.type === 'executing' &&
        msg.data.node === null &&
        msg.data.prompt_id === promptId
      ) {
        clearTimeout(timer);
        resolve();
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
```

### Pattern 3: Image Retrieval from History

**What:** After completion, fetch image metadata from `/history/{prompt_id}` and copy the file from ComfyUI's output directory.

**History response structure:**
```typescript
// Source: https://9elements.com/blog/hosting-a-comfyui-workflow-via-api/
// and https://github.com/9elements/comfyui-api/blob/main/basic_api.py

interface HistoryEntry {
  outputs: Record<string, {
    images: Array<{
      filename: string;
      subfolder: string;
      type: 'output' | 'temp' | 'input';
    }>;
  }>;
  status: { completed: boolean };
}

// Retrieval pattern
const historyRes = await fetch(`${COMFYUI_URL}/history/${promptId}`);
const history = await historyRes.json() as Record<string, HistoryEntry>;
const entry = history[promptId];
const images = entry.outputs['SAVE_NODE_ID']?.images ?? [];
const img = images[0]!;

// File lives at: ~/tools/ComfyUI/output/{subfolder}/{filename}
const comfyOutputDir = `${process.env.HOME}/tools/ComfyUI/output`;
const srcPath = path.join(comfyOutputDir, img.subfolder, img.filename);
```

Note: The save node ID in the workflow template determines the key in `outputs`. If the SaveImage node is `"7"`, the key is `"7"`. Use a known constant for the save node ID.

### Pattern 4: Static JSON Template Slot-Fill

**What:** Workflow templates are static JSON exported from ComfyUI GUI. Five tokens are replaced at runtime using string replacement.

**Token convention:**
```typescript
// Source: Pattern derived from GEN-04 requirement + ComfyUI API format research

const TOKENS = {
  prompt_text: '{{PROMPT_TEXT}}',
  negative_prompt: '{{NEGATIVE_PROMPT}}',
  seed: '{{SEED}}',
  lora_name: '{{LORA_NAME}}',
  checkpoint_name: '{{CHECKPOINT_NAME}}',
};

function slotFill(templateJson: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((acc, [key, val]) => {
    return acc.replaceAll(`{{${key.toUpperCase()}}}`, String(val));
  }, templateJson);
}
```

Static JSON is recommended over TypeScript builder functions because:
1. Easier to inspect and debug — open the JSON in the ComfyUI GUI
2. Phase 9 will modify templates to add the LoRA node — a JSON edit, not a code change
3. `replaceAll` on 5 tokens in a ~50-node JSON takes microseconds

### Pattern 5: Image Promotion Strategy (Claude's Discretion — Resolution)

**Problem:** Images generated by ComfyUI are stored in `raw/comfyui/chXX_pNNN_vN.png`. The overlay stage reads from `raw/` directly using:
```typescript
const rawImagePath = path.join(chapterPaths.raw, approvedEntry.imageFile);
```
And `getApprovedEntry` uses `parsePanelImageFilename(entry.imageFile)` which requires a bare filename (the regex `^ch(\d{2})_p(\d{3})_v(\d+)\.` would not match `comfyui/ch01_p001_v1.png`).

**Recommended approach — approve-and-copy:**
- Generation: write image to `output/ch-XX/raw/comfyui/chXX_pNNN_vN.png`
- Manifest `imageFile`: store as bare `chXX_pNNN_vN.png` (not the subdirectory path)
- Approval action: copy from `raw/comfyui/chXX_pNNN_vN.png` to `raw/chXX_pNNN_vN.png`

This requires one addition to the existing `--approve` flow in `generate.ts`: after setting `approved: true` in the manifest, copy the file from `raw/comfyui/` to `raw/` if it's a comfyui-sourced image. The manifest entry can carry a `sourcePath` field or a `source: 'comfyui'` discriminator.

**Overlay/assemble stages: zero changes required.** They already read from `raw/chXX_pNNN_vN.png` and that is exactly what approval produces.

### Pattern 6: Express Service Entry Point

**What:** Separate entry point from `cli.ts`, launched via its own npm script.

```typescript
// pipeline/src/comfyui/service.ts
import express from 'express';
import { createJobRouter } from './router.js';

const app = express();
app.use(express.json());
app.use('/', createJobRouter());

const PORT = 3000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[service] ComfyUI Express bridge listening on http://127.0.0.1:${PORT}`);
  console.log(`[service] ComfyUI target: http://127.0.0.1:8188`);
});
```

```json
// Addition to pipeline/package.json scripts
"start:service": "tsx src/comfyui/service.ts"
```

### Pattern 7: Express 5 + ESM Compatibility

The existing pipeline uses `"type": "module"` and `tsx` for execution. Express 5 is CommonJS-built but works fine when imported as ESM via `import express from 'express'` with `esModuleInterop: true` in tsconfig (already set). `tsx` handles this transparently — no configuration changes needed.

Confirmed: `tsx` with `"type": "module"` + Express 5 is the recommended pattern for 2025 Node.js TypeScript projects. The existing `tsconfig.json` (`module: NodeNext`, `esModuleInterop: true`) is already correctly configured.

### Anti-Patterns to Avoid

- **WS after POST:** Posting the workflow before the WebSocket is open creates a race condition where completion messages are missed. There is no recovery mechanism. Always WS-first.
- **Using `execution_success` event for completion:** This event fires before outputs are written to disk (ComfyUI issue #11540). Use `executing` + `node: null` instead.
- **Polling GET /history instead of WebSocket:** The existing `gen-reg.ts` script uses polling — this works but wastes 2-second intervals and is slower. Phase 7 requires WebSocket per GEN-02.
- **Assembling workflow JSON programmatically in TypeScript:** ComfyUI's node graph uses inter-node references like `["1", 0]` that are easy to get wrong. Static JSON exported from the GUI is validated by ComfyUI itself.
- **Storing subdirectory path in manifest `imageFile`:** The `parsePanelImageFilename` regex requires a bare filename. Storing `comfyui/ch01_p001_v1.png` will silently break `getApprovedEntry` page matching.
- **`bf16` dtype on MPS:** ComfyUI issue #6254 confirms `bf16` is not supported on MPS. Never use `bf16` in template nodes. Only `fp16` or `fp32`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random string | `randomUUID()` from `node:crypto` | Already Node built-in; collision-safe |
| Request body validation | Manual field checks | `zod` (already installed) | Already in deps; handles nested types, coercion, error messages |
| WebSocket client | Raw TCP socket | `ws` package | Handles protocol framing, ping/pong, error events |
| JSON template parsing | Custom format parser | Static JSON + `replaceAll` | Five tokens; any more complex and use handlebars/nunjucks (also already in deps) |

**Key insight:** The ComfyUI API surface is small and well-documented. The hard part is the ordering constraint (WS before POST), not the HTTP/WS mechanics.

---

## Common Pitfalls

### Pitfall 1: WebSocket Race Condition (CRITICAL)

**What goes wrong:** The ComfyUI job completes and the `executing+node:null` message is sent before the Express service's WebSocket listener is attached. The completion is missed, the job hangs until timeout (90s), then fails.

**Why it happens:** `POST /prompt` is sent before `ws.once('open', ...)` resolves. On a local loopback, ComfyUI can process short jobs faster than you expect.

**How to avoid:** Always `await` the WebSocket `open` event before calling `fetch(COMFYUI_URL + '/prompt', ...)`. See Pattern 1 above.

**Warning signs:** Jobs consistently timing out on fast/cached generations but succeeding on slow ones.

### Pitfall 2: VAE Color Desaturation on MPS

**What goes wrong:** Images come out washed-out, desaturated, or wrong-colored. This is a known MPS issue.

**Why it happens:** `--force-fp16` launch flag makes ComfyUI run VAE in fp16 on MPS. Some operations in VAE decode are numerically unstable at fp16 precision on Metal.

**How to avoid:** Add a `ModelComputeDtype` node (class_type: `"ModelComputeDtype"`, dtype: `"fp32"`) between the checkpoint output and the VAE decode node in every workflow template. This is the node-level fix; it does not require modifying ComfyUI launch parameters.

**Template node insertion:**
```json
"10": {
  "class_type": "ModelComputeDtype",
  "inputs": {
    "model": ["1", 0],
    "dtype": "fp32"
  }
}
```
Connect node `"10"` output to KSampler's `model` input instead of the checkpoint loader directly. This forces VAE-related operations through fp32. The UNet KSampler itself runs fp16 via the ComfyUI global flag.

**Warning signs:** Images look "digital watercolor washed out" or have incorrect hue shifts.

### Pitfall 3: `execution_success` Fires Before Outputs Are Persisted

**What goes wrong:** Service detects completion via `execution_success` WebSocket event, immediately calls `GET /history/{prompt_id}`, gets empty outputs or missing images, then fails to retrieve the image.

**Why it happens:** ComfyUI issue #11540 documents that `execution_success` is emitted before the SaveImage node has finished writing to disk. This is a confirmed ComfyUI bug as of early 2025.

**How to avoid:** Use `executing` + `data.node === null` as the completion signal, NOT `execution_success`. Add a small guard: after detecting completion, call `GET /history/{prompt_id}` and verify the output images array is non-empty before proceeding.

**Warning signs:** Intermittent "no output images in history" errors even though the generation visually completed.

### Pitfall 4: ESM Import of CommonJS Express

**What goes wrong:** TypeScript error: "This module is declared with 'export =', and can only be used with a default import when using the 'esModuleInterop' flag."

**Why it happens:** Express is a CommonJS module. ESM projects need `esModuleInterop: true` to use default imports.

**How to avoid:** The existing `tsconfig.json` already has `esModuleInterop: true`. Use `import express from 'express'` (default import), not `import * as express from 'express'`. No tsconfig changes needed.

**Warning signs:** TypeScript compile errors on express import; run `pnpm typecheck` immediately after adding express.

### Pitfall 5: History Output Node ID Mismatch

**What goes wrong:** `entry.outputs['7']` is undefined even though generation succeeded. Image lookup fails silently.

**Why it happens:** The SaveImage node ID in the template JSON and the lookup key in the service code must match exactly. If the template is re-exported from ComfyUI GUI and node IDs are renumbered, the lookup breaks.

**How to avoid:** Use a semantic constant for the save node ID. Define `const SAVE_NODE_ID = '7'` at the top of the comfyui-client module. When re-exporting templates, verify the SaveImage node still has the same ID. Alternative: scan all output nodes for `images` arrays instead of hardcoding the ID.

### Pitfall 6: Manifest `imageFile` Contains Subdirectory Path

**What goes wrong:** `getApprovedEntry` never finds the image for the page. Overlay stage silently skips pages with "no approved image found."

**Why it happens:** `parsePanelImageFilename` uses `^ch(\d{2})_...` regex. `comfyui/ch01_p001_v1.png` starts with `comfyui/` — no match.

**How to avoid:** Always store the bare filename in `imageFile` field (e.g., `ch01_p001_v1.png`). Track the source subdirectory in a separate manifest field (`source: 'comfyui'` or `sourcePath: 'raw/comfyui/ch01_p001_v1.png'`). The approve-and-copy flow uses `sourcePath` to find the file to copy.

---

## Code Examples

Verified patterns from official sources and codebase analysis:

### ComfyUI Workflow API Format (Static JSON)

```json
{
  "1": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "{{CHECKPOINT_NAME}}"
    }
  },
  "2": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "{{PROMPT_TEXT}}",
      "clip": ["1", 1]
    }
  },
  "3": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "{{NEGATIVE_PROMPT}}",
      "clip": ["1", 1]
    }
  },
  "4": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": 512,
      "height": 768,
      "batch_size": 1
    }
  },
  "5": {
    "class_type": "KSampler",
    "inputs": {
      "model": ["1", 0],
      "positive": ["2", 0],
      "negative": ["3", 0],
      "latent_image": ["4", 0],
      "seed": "{{SEED}}",
      "steps": 20,
      "cfg": 7,
      "sampler_name": "euler_ancestral",
      "scheduler": "normal",
      "denoise": 1
    }
  },
  "6": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["5", 0],
      "vae": ["1", 2]
    }
  },
  "7": {
    "class_type": "SaveImage",
    "inputs": {
      "images": ["6", 0],
      "filename_prefix": "plasma"
    }
  }
}
```

Note: GEN-05 requires adding a `ModelComputeDtype` node for VAE fp32. The template above is the base structure — the ModelComputeDtype node insertion is documented in Pitfall 2 above. The `seed` field must be a number (integer), not a string — so slot-fill must produce `"seed": 12345` not `"seed": "12345"`. Use `parseInt` when building the replacement value.

### POST /jobs Request/Response

```typescript
// Source: GEN-01, GEN-03 requirements

// Request body
interface JobRequest {
  prompt_text: string;
  negative_prompt?: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  resolution: { width: number; height: number };
  checkpoint_name?: string;
}

// Success response (202 Accepted)
interface JobResponse {
  jobId: string;
  status: 'queued';
}

// 400 Error response
interface ValidationError {
  error: string;
  field?: string;
}
```

### Existing Pipeline Integration Points

```typescript
// In cli.ts — current mode determination (line 104-105):
const mode: 'manual' | 'api' = options.api ? 'api' : 'manual';

// CHANGE TO:
const mode: 'manual' | 'api' | 'comfyui' =
  options.comfyui ? 'comfyui' : options.api ? 'api' : 'manual';

// Require explicit mode:
if (!options.manual && !options.api && !options.comfyui && !options.import && !options.approve) {
  console.error('Error: specify --comfyui, --api, or --manual explicitly');
  process.exit(1);
}
```

```typescript
// In generate.ts — existing GenerateOptions interface:
export interface GenerateOptions extends StageOptions {
  mode?: 'manual' | 'api';  // ADD 'comfyui'
  // ...existing fields...
}

// New ComfyUI branch added after the 'api' mode block:
if (mode === 'comfyui') {
  // 1. Check service health — fail fast if not running
  // 2. Read prompt file from chapterPaths.prompts
  // 3. POST to http://127.0.0.1:3000/jobs
  // 4. Poll GET /jobs/:id until complete or timeout
  // 5. Copy image to raw/comfyui/, record in manifest
}
```

### Service Health Check (generate.ts side)

```typescript
// Fast-fail before reading prompts — better UX
async function checkServiceRunning(port: number = 3000): Promise<void> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      throw new Error(`Service returned ${res.status}`);
    }
  } catch {
    throw new Error(
      `Express service not running at port ${port} — run \`pnpm start:service\` first`
    );
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling GET /history every 2s | WebSocket `executing+node:null` detection | ComfyUI WebSocket API has existed since initial releases | 2-20x faster completion detection; no polling overhead |
| Express 4.x | Express 5.1.0 (now npm default) | March 2025 | Async error handling built-in; no `express-async-errors` wrapper needed |
| ts-node for TypeScript execution | tsx | ~2023 | tsx is the recommended runner for 2025 Node.js projects; already in use here |
| Programmatic workflow assembly | Static JSON API-format templates | ComfyUI best practice | GUI-validated JSON; no assembly bugs; easy to inspect |

**Deprecated/outdated:**
- `execution_success` WebSocket event for completion detection: Use `executing+node:null` instead (issue #11540).
- ComfyUI `--force-fp32` global flag for VAE fix: Use `ModelComputeDtype` node in template instead — more surgical, works alongside `--force-fp16` for UNet.

---

## Open Questions

1. **Seed as number vs string in workflow JSON**
   - What we know: The `gen-reg.ts` script passes seed as a number (`seed: number`). The slot-fill replaces `"{{SEED}}"` (a JSON string value) with the seed value.
   - What's unclear: When `"{{SEED}}"` is replaced with `"12345"` (a string), ComfyUI may accept it or may fail with a type error.
   - Recommendation: Replace `"{{SEED}}"` (with quotes) with the raw integer `12345` (no quotes) in the JSON string before parsing. Do: `templateStr.replace('"{{SEED}}"', String(seed))`. Test on first integration.

2. **ComfyUI `/health` endpoint existence**
   - What we know: The ComfyUI REST API documentation does not explicitly document a `/health` endpoint. The Express service's `/health` endpoint checks ComfyUI reachability by calling ComfyUI's `/system_stats` or another known-good endpoint.
   - What's unclear: Whether ComfyUI exposes a dedicated `/health` route.
   - Recommendation: In the Express `/health` handler, call `GET http://127.0.0.1:8188/system_stats`. If that returns 200, ComfyUI is up. Return `{ status: "ok", comfyui: true, mps: true }`. If it times out or errors, return `503 { status: "error", comfyui: false }`. The `mps: true` field can be hardcoded as true for this phase (Phase 5 already confirmed MPS is active).

3. **In-memory job store vs file-based**
   - What we know: `GET /jobs/:id` requires job state to be queryable after submission. The service is short-lived (manually started per session).
   - What's unclear: Whether in-memory `Map<jobId, JobState>` is sufficient for the use case.
   - Recommendation: Use in-memory `Map`. The service is manually started per terminal session; no persistence needed. Job state evaporates when the service is restarted, which is acceptable for this phase.

---

## Sources

### Primary (HIGH confidence)

- [ComfyUI official WebSocket example](https://github.com/comfyanonymous/ComfyUI/blob/master/script_examples/websockets_api_example.py) — WS-before-POST pattern, completion detection via `executing+node:null`
- [ComfyUI DeepWiki — WebSocket API](https://deepwiki.com/comfyanonymous/ComfyUI/7.1-websocket-api) — WebSocket message types and completion protocol
- [ComfyUI DeepWiki — Workflow JSON format](https://deepwiki.com/Comfy-Org/ComfyUI/7.3-workflow-json-format) — API format node structure
- [9elements comfyui-api basic_api.py](https://github.com/9elements/comfyui-api/blob/main/basic_api.py) — Reference implementation confirming WS pattern and history retrieval
- [ComfyUI nodes_model_advanced.py](https://github.com/comfyanonymous/ComfyUI/blob/master/comfy_extras/nodes_model_advanced.py) — `ModelComputeDtype` node definition (fp32/fp16/bf16 options)
- Existing codebase: `pipeline/src/scripts/gen-reg.ts` — ComfyUI REST API pattern already working in this project

### Secondary (MEDIUM confidence)

- [9elements blog: Hosting a ComfyUI Workflow via API](https://9elements.com/blog/hosting-a-comfyui-workflow-via-api/) — Completion detection pattern, history response format
- [ViewComfy: Building a Production-Ready ComfyUI API](https://www.viewcomfy.com/blog/building-a-production-ready-comfyui-api) — WebSocket integration patterns
- [ComfyUI issue #6254: VAEDecode BFloat16 not supported on MPS](https://github.com/Comfy-Org/ComfyUI/issues/6254) — Confirms bf16/MPS incompatibility
- [ComfyUI issue #11540: execution_success fires before outputs persisted](https://github.com/Comfy-Org/ComfyUI/issues/11540) — Confirms not to use execution_success
- [runcomfy.com: ModelComputeDtype](https://www.runcomfy.com/comfyui-nodes/ComfyUI/model-compute-dtype) — dtype options and node behavior
- [Express 5.1.0 announcement](https://expressjs.com/2025/03/31/v5-1-latest-release.html) — Express 5 is now npm default
- [ws npm package](https://www.npmjs.com/package/ws) — Current version 8.19.0

### Tertiary (LOW confidence)

- WebSearch results on Express + ESM + tsx compatibility — consistent with existing project setup but not officially tested for this exact combination

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — express, ws, @types are well-documented packages; versions verified from npm
- Architecture: HIGH — ComfyUI WS pattern verified from official Python example and reference implementation; existing codebase patterns studied directly
- Pitfalls: HIGH (WS race condition, VAE dtype) — backed by official ComfyUI GitHub issues; MEDIUM (history node ID mismatch) — derived from implementation analysis
- Image promotion: HIGH — derived from direct code reading of overlay.ts and manifest.ts; constraint is explicit in `parsePanelImageFilename` regex

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (ComfyUI API is stable; Express 5 is stable)
