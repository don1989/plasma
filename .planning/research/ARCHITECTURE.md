# Architecture Research: ComfyUI + LoRA Pipeline

**Domain:** Local AI image generation service — ComfyUI + LoRA integration for TypeScript manga pipeline
**Researched:** 2026-02-19
**Confidence:** MEDIUM — ComfyUI API behaviour based on training data (cutoff Aug 2025) + direct inspection of existing pipeline codebase. WebSearch/WebFetch unavailable. Verify ComfyUI API endpoint shape at `http://127.0.0.1:8188/` before implementing.

---

## Data Flow

```
CLI (pipeline/src/cli.ts)
    │
    │  pnpm stage:generate -- --comfyui -c 1 --page 3
    ▼
generate.ts (stage)
    │  mode = 'comfyui'
    │  reads prompt file: output/ch-01/prompts/page-03.txt
    │  reads base image (optional): output/ch-01/processed/ch01_p003_v1.png
    ▼
comfyui-client.ts  (new, replaces gemini-client.ts for this mode)
    │  POST http://localhost:3000/jobs
    │  body: { promptText, chapter, page, version, baseImagePath? }
    ▼
Express service  (pipeline/service/)
    │
    ├── POST /jobs  → JobManager.enqueue(job)
    │       │
    │       ▼  immediately returns { jobId, status: 'queued' }
    │
    ├── GET  /jobs/:id  → returns { status, outputPath?, error? }
    │
    └── JobManager (in-memory queue, single active job)
            │
            │  1. resolve workflow template for job type
            │  2. inject prompt text, LoRA name, ControlNet image
            │  3. POST http://127.0.0.1:8188/prompt  { prompt: workflowJSON, client_id }
            │  4. listen on WebSocket ws://127.0.0.1:8188/  for execution events
            │  5. on "executed" event: GET http://127.0.0.1:8188/view?filename=&subfolder=&type=output
            │  6. copy image to ./outputs/images/<jobId>.png
            │  7. write ./outputs/images/<jobId>.json  (metadata)
            │  8. mark job complete
            ▼
output/ch-01/raw/ch01_p003_v2.png   (copied back by generate.ts after polling)
output/ch-01/generation-log.json    (manifest updated by generate.ts)
```

**LoRA training data flow (separate from generation):**

```
CLI
    │  pnpm stage:train-lora -- --character kael --images ./ref-images/kael/
    ▼
Express service
    │
    ├── POST /loras/train  → spawn kohya_ss child process
    │       │  streams stdout/stderr to ./outputs/logs/<jobId>.log
    │       │  returns { loraJobId, status: 'training' }
    │
    ├── GET  /loras/:id/status  → { status, progress?, outputPath? }
    │
    └── kohya_ss exits → .safetensors written to ComfyUI models/loras/
                          → POST /loras/:id complete
```

---

## New Components

| Component | Path | Responsibility |
|-----------|------|----------------|
| Express service entry | `pipeline/service/index.ts` | Bootstrap Express app, mount routes, start HTTP server on port 3000 |
| Jobs router | `pipeline/service/routes/jobs.ts` | `POST /jobs`, `GET /jobs/:id` — image generation jobs |
| LoRA router | `pipeline/service/routes/loras.ts` | `POST /loras/train`, `GET /loras/:id/status` — training jobs |
| JobManager | `pipeline/service/job-manager.ts` | In-memory job queue, single-worker serial execution, job state map |
| ComfyUI HTTP client | `pipeline/service/comfyui/http-client.ts` | `submitWorkflow(workflowJSON)`, `getImage(filename, subfolder, type)` wrappers around fetch |
| ComfyUI WebSocket client | `pipeline/service/comfyui/ws-client.ts` | Connect to `ws://127.0.0.1:8188/`, emit events when jobs complete or error |
| Workflow template loader | `pipeline/service/workflows/loader.ts` | Load JSON template files, return parsed objects for injection |
| Workflow injector | `pipeline/service/workflows/injector.ts` | Fill node inputs (prompt, LoRA name, ControlNet image path, seed) into template object |
| Workflow templates (JSON) | `pipeline/service/workflows/*.json` | Static workflow definitions: `txt2img-lora.json`, `img2img-lora-controlnet.json` |
| kohya_ss runner | `pipeline/service/training/kohya-runner.ts` | `spawnTraining(config)` — child_process.spawn, log streaming, completion detection |
| Pipeline ComfyUI client | `pipeline/src/generation/comfyui-client.ts` | Called by `generate.ts` — POSTs job to Express service, polls until done, copies image to raw/ |

---

## Modified Components

| File | Nature of Change | What Changes |
|------|-----------------|--------------|
| `pipeline/src/stages/generate.ts` | Additive — new mode branch | Add `mode === 'comfyui'` branch that calls `comfyui-client.ts` instead of `gemini-client.ts`. Existing `manual` and `api` branches remain untouched. |
| `pipeline/src/cli.ts` | Additive — new flags | Add `--comfyui` flag to the `generate` command. Add new `train-lora` subcommand. |
| `pipeline/src/types/generation.ts` | Additive — new field | Add `generationBackend: 'gemini' | 'comfyui' | 'manual'` field to `GenerationLogEntry`. Existing entries without this field are treated as `'manual'`. |
| `pipeline/src/config/defaults.ts` | Additive — new constants | Add `DEFAULT_COMFYUI_SERVICE_URL = 'http://localhost:3000'` and `DEFAULT_COMFYUI_PORT = 8188`. |
| `pipeline/.env` | New key added | Add `COMFYUI_SERVICE_URL=http://localhost:3000` (optional override). |

**gemini-client.ts is NOT deleted or modified.** The Gemini API mode (`--api`) continues to work. ComfyUI is a new alternative mode, not a replacement.

---

## Express Service Structure

### Directory Layout

```
pipeline/service/
├── index.ts                          # app bootstrap, listen on PORT (default 3000)
├── routes/
│   ├── jobs.ts                       # POST /jobs, GET /jobs/:id
│   └── loras.ts                      # POST /loras/train, GET /loras/:id/status
├── job-manager.ts                    # in-memory job state, serial queue
├── comfyui/
│   ├── http-client.ts                # thin fetch wrappers for ComfyUI REST API
│   └── ws-client.ts                  # WebSocket client for execution events
├── workflows/
│   ├── loader.ts                     # read + parse JSON templates from disk
│   ├── injector.ts                   # fill node inputs into template
│   ├── txt2img-lora.json             # SD 1.5 text-to-image + LoRA template
│   └── img2img-lora-controlnet.json  # SD 1.5 img2img + LoRA + ControlNet template
├── training/
│   └── kohya-runner.ts               # spawn kohya_ss training process
├── outputs/                          # runtime output directory (gitignored)
│   ├── images/                       # <jobId>.png, <jobId>.json
│   ├── loras/                        # symlinks or copies of trained .safetensors
│   └── logs/                         # <jobId>.log for training jobs
└── package.json                      # separate from pipeline/ package.json
```

### Route Contracts

```
POST /jobs
  Body: {
    promptText: string,       // full art prompt text
    chapter: number,
    page: number,
    version: number,
    workflowType: 'txt2img-lora' | 'img2img-lora-controlnet',
    loraName?: string,        // filename without extension, e.g. "kael-v2"
    baseImagePath?: string,   // absolute path to ControlNet/img2img source
    seed?: number             // omit for random
  }
  Response 202: { jobId: string, status: 'queued' }
  Response 503: { error: 'ComfyUI not reachable' }

GET /jobs/:id
  Response 200: {
    jobId: string,
    status: 'queued' | 'running' | 'complete' | 'failed',
    outputPath?: string,      // absolute path to .png when complete
    error?: string,
    durationMs?: number
  }
  Response 404: { error: 'Job not found' }

POST /loras/train
  Body: {
    characterId: string,
    imageDir: string,         // absolute path to training images folder
    baseModel: string,        // e.g. "v1-5-pruned-emaonly.ckpt"
    steps?: number            // default 1500
  }
  Response 202: { loraJobId: string, status: 'training' }

GET /loras/:id/status
  Response 200: {
    loraJobId: string,
    status: 'training' | 'complete' | 'failed',
    outputPath?: string,      // path to .safetensors when complete
    progress?: number,        // 0-100 parsed from kohya stdout
    logPath: string           // path to streaming log file
  }
```

### Middleware Stack

```typescript
app.use(express.json({ limit: '1mb' }))   // body parsing
app.use(requestLogger)                     // simple console logging
app.use('/jobs', jobsRouter)
app.use('/loras', lorasRouter)
app.use(errorHandler)                      // catches unhandled errors, returns 500
```

---

## ComfyUI Workflow JSON Structure

ComfyUI workflow JSON uses a **node graph format** — each node has a numeric string ID, a `class_type`, and `inputs`. Node inputs can reference another node's output via `["nodeId", outputIndex]`.

### Nodes Required for SD 1.5 txt2img + LoRA

```json
{
  "1": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": { "ckpt_name": "v1-5-pruned-emaonly.ckpt" }
  },
  "2": {
    "class_type": "LoraLoader",
    "inputs": {
      "model": ["1", 0],
      "clip": ["1", 1],
      "lora_name": "{{LORA_NAME}}.safetensors",
      "strength_model": 0.8,
      "strength_clip": 0.8
    }
  },
  "3": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "{{POSITIVE_PROMPT}}",
      "clip": ["2", 1]
    }
  },
  "4": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "low quality, blurry, extra limbs, text, watermark",
      "clip": ["2", 1]
    }
  },
  "5": {
    "class_type": "KSampler",
    "inputs": {
      "model": ["2", 0],
      "positive": ["3", 0],
      "negative": ["4", 0],
      "latent_image": ["6", 0],
      "seed": "{{SEED}}",
      "steps": 20,
      "cfg": 7.0,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1.0
    }
  },
  "6": {
    "class_type": "EmptyLatentImage",
    "inputs": { "width": 800, "height": 1067, "batch_size": 1 }
  },
  "7": {
    "class_type": "VAEDecode",
    "inputs": { "samples": ["5", 0], "vae": ["1", 2] }
  },
  "8": {
    "class_type": "SaveImage",
    "inputs": { "images": ["7", 0], "filename_prefix": "{{FILENAME_PREFIX}}" }
  }
}
```

### Additional Nodes for img2img + ControlNet

Replace node `6` (EmptyLatentImage) with:

```json
"6": {
  "class_type": "LoadImage",
  "inputs": { "image": "{{BASE_IMAGE_FILENAME}}" }
},
"6b": {
  "class_type": "VAEEncode",
  "inputs": { "pixels": ["6", 0], "vae": ["1", 2] }
},
"9": {
  "class_type": "ControlNetLoader",
  "inputs": { "control_net_name": "control_v11p_sd15_lineart.pth" }
},
"10": {
  "class_type": "ControlNetApply",
  "inputs": {
    "conditioning": ["3", 0],
    "control_net": ["9", 0],
    "image": ["6", 0],
    "strength": 0.9
  }
}
```

And change KSampler node `5` to:
- `"latent_image": ["6b", 0]`
- `"positive": ["10", 0]`
- `"denoise": 0.7` (img2img denoising strength)

### Template Injection Points

The workflow injector (`injector.ts`) performs string replacement on the parsed JSON object. Injection points use `{{PLACEHOLDER}}` tokens. This is simpler than a template engine — ComfyUI workflows are already JSON; string replacement on parsed objects avoids double-serialization issues.

| Placeholder | Source | Node |
|-------------|--------|------|
| `{{POSITIVE_PROMPT}}` | Job request `promptText` | CLIPTextEncode positive |
| `{{LORA_NAME}}` | Job request `loraName` or default | LoraLoader `lora_name` |
| `{{SEED}}` | Random or job request `seed` | KSampler `seed` |
| `{{FILENAME_PREFIX}}` | Derived from `ch{N}_p{N}_v{N}` | SaveImage |
| `{{BASE_IMAGE_FILENAME}}` | Basename of `baseImagePath` after upload to ComfyUI input dir | LoadImage |

**Note on base images:** ComfyUI's `LoadImage` node reads from its own `input/` directory. The Express service must copy the base image to the ComfyUI input folder before submitting the workflow. This is a simple `fs.copyFile` from the pipeline's `output/ch-NN/processed/` path to `[COMFYUI_DIR]/input/`.

---

## Job Management Approach

**Recommendation: In-memory Map with serial queue. No Redis, no file-based queue.**

**Rationale for single-user local service:**
- ComfyUI on M1 Pro with 16GB RAM runs one generation job at a time. Concurrent submissions would queue in ComfyUI anyway, but tracking state in the Express service allows the CLI to poll without querying ComfyUI directly.
- File-based queue adds fsync latency and complexity for no benefit — there is no crash recovery requirement for a dev tool.
- Redis requires a separate process, adds infrastructure overhead. Unjustified for a service that runs locally alongside the pipeline CLI.

### In-Memory Job State

```typescript
// job-manager.ts

type JobStatus = 'queued' | 'running' | 'complete' | 'failed';

interface Job {
  jobId: string;
  status: JobStatus;
  request: JobRequest;
  outputPath?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  comfyPromptId?: string;   // ComfyUI's internal prompt ID, for WS correlation
}

const jobs = new Map<string, Job>();
let activeJob: Job | null = null;
const queue: Job[] = [];
```

**Worker loop:** When a job completes (or fails), the worker immediately dequeues the next job. No polling interval needed — the WebSocket event from ComfyUI triggers the transition.

**Lifetime:** Jobs stay in the Map until the service restarts. For a dev tool this is fine — the CLI can retrieve results within the same session.

**If persistence is later needed** (across restarts): add `appendFileSync` writes to `outputs/images/<jobId>.json` when job state changes. The CLI can reconstruct state from those files on startup. This is a 30-line addition, not an architectural change.

---

## ComfyUI API — Key Endpoints

These are the ComfyUI endpoints the Express service calls directly:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/prompt` | POST | Submit a workflow for execution. Body: `{ prompt: workflowJSON, client_id: string }`. Returns `{ prompt_id: string }`. |
| `/queue` | GET | List pending and running prompts. |
| `/history/:prompt_id` | GET | Get execution history and output filenames for a completed prompt. |
| `/view` | GET | Download an output image. Params: `filename`, `subfolder`, `type=output`. Returns image bytes. |
| `/upload/image` | POST | Upload an image to ComfyUI's input directory. Multipart form. Required before using `LoadImage` node. |
| `/system_stats` | GET | Health check — confirm ComfyUI is running. |

**WebSocket events** on `ws://127.0.0.1:8188/`:
- `{ type: 'executing', data: { node: null, prompt_id } }` — job started
- `{ type: 'progress', data: { value, max } }` — step-level progress
- `{ type: 'executed', data: { node, output, prompt_id } }` — individual node done
- `{ type: 'execution_success', data: { prompt_id } }` — entire workflow complete (HIGH confidence this event exists; verify event name)
- `{ type: 'execution_error', data: { prompt_id, error } }` — workflow failed

**Confidence note:** The ComfyUI API has been stable in its core structure since 2023, but event names and `/history` response shape should be verified against a running instance before finalising the WebSocket client.

---

## Pipeline Integration Point: generate.ts

**Decision: The existing `generate.ts` calls the Express service via HTTP. generate.ts is NOT restructured.**

This is the correct integration point because:
1. The stage interface (`StageOptions → StageResult`) stays unchanged. The CLI (`cli.ts`) needs no changes to the generate command's structure beyond adding a `--comfyui` flag.
2. `comfyui-client.ts` follows the same pattern as `gemini-client.ts`: a thin async function that takes a prompt and returns an image buffer (or writes a file). generate.ts calls whichever client matches the selected mode.
3. The Express service is an **optional sidecar** — the pipeline continues to work without it. If the service is not running, the ComfyUI mode fails with a clear error; manual and Gemini API modes are unaffected.

### generate.ts Integration Pattern

```typescript
// In generate.ts, the new mode='comfyui' branch:
if (mode === 'comfyui') {
  const serviceUrl = process.env['COMFYUI_SERVICE_URL'] ?? DEFAULT_COMFYUI_SERVICE_URL;

  // Check service is alive
  const healthy = await pingComfyUiService(serviceUrl);
  if (!healthy) {
    return { stage: 'generate', success: false, errors: ['ComfyUI service not running at ' + serviceUrl], ... };
  }

  for (const file of filteredFiles) {
    const promptText = await readFile(promptFilePath, 'utf-8');
    const version = nextVersion(chapterPaths.raw, options.chapter, pageNum);
    const filename = panelImageFilename(options.chapter, pageNum, version);
    const destPath = path.join(chapterPaths.raw, filename);

    // Submit job and poll
    const result = await generateViaComfyUi({
      serviceUrl,
      promptText,
      chapter: options.chapter,
      page: pageNum,
      version,
      baseImagePath: options.baseImagePath,  // new CLI option
      loraName: options.loraName,            // new CLI option
    });

    // result.outputPath is the Express service's local image path
    await copyFile(result.outputPath, destPath);

    // Manifest entry (same structure as Gemini mode, backend field added)
    const entry: GenerationLogEntry = {
      imageFile: filename,
      promptFile: ...,
      promptHash: hashPrompt(promptText),
      model: options.loraName ?? 'sd-1.5',
      generationBackend: 'comfyui',   // new field
      timestamp: new Date().toISOString(),
      version,
      approved: false,
    };
    await addEntry(chapterPaths.root, manifest, entry);
  }
}
```

### comfyui-client.ts Polling Pattern

```typescript
// pipeline/src/generation/comfyui-client.ts

export async function generateViaComfyUi(opts: ComfyUiGenerateOptions): Promise<{ outputPath: string }> {
  // 1. Submit job
  const { jobId } = await submitJob(opts.serviceUrl, opts);

  // 2. Poll with timeout
  const POLL_INTERVAL_MS = 2000;
  const TIMEOUT_MS = 300_000;  // 5 minutes
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const status = await getJobStatus(opts.serviceUrl, jobId);

    if (status.status === 'complete') return { outputPath: status.outputPath! };
    if (status.status === 'failed') throw new Error(`ComfyUI job failed: ${status.error}`);
    // 'queued' | 'running' → continue polling
  }

  throw new Error(`ComfyUI job ${jobId} timed out after ${TIMEOUT_MS}ms`);
}
```

---

## LoRA Output Handling

**kohya_ss output directory:** By default, kohya_ss writes trained `.safetensors` to a directory specified in the training config JSON (the `output_dir` field). The recommended path to set in the training config:

```
[COMFYUI_DIR]/models/loras/<characterId>/
```

e.g., `/path/to/ComfyUI/models/loras/kael/kael-v1.safetensors`

**Why this directory:** ComfyUI's `LoraLoader` node scans `models/loras/` recursively. Placing the output directly in ComfyUI's model directory means the LoRA is immediately available to workflows without a copy step.

**ComfyUI finds it:** After training completes, ComfyUI detects new model files either on next workflow submission or via a model refresh. ComfyUI does NOT need to be restarted. The `lora_name` in the workflow JSON is the relative path from `models/loras/`, e.g. `"kael/kael-v1.safetensors"`.

**The Express service should record** the final LoRA path in `outputs/loras/<loraJobId>.json`:

```json
{
  "loraJobId": "lora-abc123",
  "characterId": "kael",
  "status": "complete",
  "outputPath": "/path/to/ComfyUI/models/loras/kael/kael-v1.safetensors",
  "loraName": "kael/kael-v1",
  "completedAt": "2026-02-19T12:00:00Z"
}
```

**The pipeline CLI** reads this JSON when constructing a generation job to automatically populate `loraName`.

---

## Process Management: kohya_ss Training

```typescript
// pipeline/service/training/kohya-runner.ts

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';

export function spawnTraining(opts: TrainingOpts): ChildProcessHandle {
  const logStream = createWriteStream(opts.logPath, { flags: 'a' });

  const child = spawn('python', [
    opts.kohyaScriptPath,           // e.g. /path/to/kohya_ss/train_network.py
    '--config_file', opts.configPath
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  // Parse progress from stdout lines like "steps: 150/1500"
  child.stdout.on('data', (chunk: Buffer) => {
    const line = chunk.toString();
    const match = /steps:\s*(\d+)\/(\d+)/.exec(line);
    if (match) {
      const progress = Math.round((parseInt(match[1]!) / parseInt(match[2]!)) * 100);
      opts.onProgress?.(progress);
    }
  });

  child.on('exit', (code) => {
    logStream.close();
    if (code === 0) opts.onComplete(opts.expectedOutputPath);
    else opts.onError(new Error(`kohya_ss exited with code ${code}`));
  });

  return { pid: child.pid!, kill: () => child.kill('SIGTERM') };
}
```

**Key constraints on M1 Pro:**
- kohya_ss on Apple Silicon uses MPS (Metal Performance Shaders). Requires `accelerate` config with `mps` device.
- Training 1500 steps on M1 Pro with 16GB takes approximately 20-60 minutes depending on dataset size and resolution. The Express service must not time out the HTTP response for training jobs — respond immediately with `202 Accepted` and poll via `GET /loras/:id/status`.
- Only ONE training job at a time. The JobManager should reject a second training request if one is active, returning `409 Conflict`.

---

## Build Order

Build order is determined by dependency: each layer depends on the one below it.

**Layer 1: ComfyUI Client (no dependencies on Express)**
Build and test `comfyui/http-client.ts` and `comfyui/ws-client.ts` as standalone modules. Verify they can submit a hand-crafted workflow JSON to a running ComfyUI and retrieve the output image. This validates the ComfyUI API shape before building anything around it.

**Layer 2: Workflow Templates + Injector**
Build `workflows/loader.ts`, `workflows/injector.ts`, and the JSON templates. Unit-testable without ComfyUI running: inject known values, assert the resulting JSON has correct node input values.

**Layer 3: JobManager**
Build `job-manager.ts`. Test with mock ComfyUI client. Verify serial queue behaviour: second job queued while first is running; second runs after first completes.

**Layer 4: Express Routes + Service Entry**
Wire `routes/jobs.ts` and `service/index.ts`. Integration test with a real running ComfyUI instance. Submit one job, poll to completion, verify image appears at expected path.

**Layer 5: pipeline/src/generation/comfyui-client.ts**
Build the pipeline-side client that calls the Express service. Test end-to-end: CLI → comfyui-client.ts → Express service → ComfyUI → image in output/ch-NN/raw/.

**Layer 6: generate.ts modification**
Add the `comfyui` mode branch to the existing generate stage. The branch is a thin wrapper around comfyui-client.ts. Regression test: verify `--manual` and `--api` modes still work unchanged.

**Layer 7: LoRA training (independent of 1-6)**
Build `training/kohya-runner.ts` and `routes/loras.ts`. This is independent of the image generation path and can be built after Layers 1-6 are working. kohya_ss training requires a separate setup step (Python environment, kohya_ss installation) that may need its own research spike.

### Phase Summary

| Phase | Components | Deliverable |
|-------|-----------|-------------|
| 1 | ComfyUI HTTP + WS clients | Submit a workflow, retrieve output image from ComfyUI directly |
| 2 | Workflow templates + injector | Correct JSON for SD 1.5 txt2img + LoRA |
| 3 | JobManager | Serial queue with state tracking |
| 4 | Express service (routes + entry) | Working HTTP API at port 3000 |
| 5 | comfyui-client.ts | Pipeline CLI can generate via ComfyUI |
| 6 | generate.ts mode branch | Full end-to-end: `pnpm stage:generate -- --comfyui -c 1` works |
| 7 | kohya_ss runner + LoRA routes | Training pipeline operational |

---

## Constraints Specific to M1 Pro / Single-User

- **No GPU VRAM limit concerns** — M1 Pro uses unified memory. 16GB is shared between CPU and GPU. SD 1.5 inference uses approximately 4-6GB; LoRA training uses 8-12GB. Cannot run generation and training simultaneously.
- **ComfyUI input directory** — When a base image is needed for img2img/ControlNet, the Express service must upload it to ComfyUI via `POST /upload/image` (multipart form) before submitting the workflow. Alternatively, copy the file to `[COMFYUI_DIR]/input/` directly via filesystem — simpler and avoids HTTP overhead for large images.
- **File paths** — All paths between the Express service and ComfyUI should be absolute. ComfyUI's output filenames are returned by the history endpoint as relative names within ComfyUI's output directory; the Express service needs to know ComfyUI's output directory path (configured via env var `COMFYUI_OUTPUT_DIR`).
- **Port conflicts** — Express at 3000, ComfyUI at 8188. Both configurable via env vars. Document clearly.
- **COMFYUI_DIR env var** — The service needs to know the absolute path to ComfyUI's installation directory to: (a) copy images to `input/`, (b) locate `models/loras/` for training output, (c) read images from `output/`. Make this a required env var with no default.

---

## Environment Variables

```
# pipeline/service/.env  (new file, gitignored)
COMFYUI_URL=http://127.0.0.1:8188
COMFYUI_DIR=/path/to/ComfyUI
EXPRESS_PORT=3000
OUTPUTS_DIR=/path/to/plasma/pipeline/service/outputs
KOHYA_SCRIPT=/path/to/kohya_ss/train_network.py
KOHYA_PYTHON=/path/to/kohya_venv/bin/python

# pipeline/.env  (existing file, add one line)
COMFYUI_SERVICE_URL=http://localhost:3000
```

---

## Sources

- Direct inspection of `/Users/dondemetrius/Code/plasma/pipeline/src/stages/generate.ts` — existing stage interface and mode branching pattern
- Direct inspection of `/Users/dondemetrius/Code/plasma/pipeline/src/generation/gemini-client.ts` — existing client pattern to replicate for ComfyUI
- Direct inspection of `/Users/dondemetrius/Code/plasma/pipeline/src/types/pipeline.ts` — `StageOptions`, `StageResult` interface contracts
- Direct inspection of `/Users/dondemetrius/Code/plasma/pipeline/src/types/generation.ts` — `GenerationLogEntry`, `GenerationManifest`
- Direct inspection of `/Users/dondemetrius/Code/plasma/pipeline/src/cli.ts` — command structure, flag patterns
- Direct inspection of `/Users/dondemetrius/Code/plasma/pipeline/src/config/paths.ts` — `PATHS.chapterOutput`, output directory structure
- ComfyUI HTTP API (`/prompt`, `/view`, `/history`, `/upload/image`, WebSocket events): training data — MEDIUM confidence, verify against running instance
- ComfyUI workflow JSON node graph format: training data — HIGH confidence, core format stable since 2023
- kohya_ss `train_network.py` CLI and `output_dir` config field: training data — MEDIUM confidence, verify kohya_ss version installed before implementing runner
- M1 Pro MPS device support in accelerate/kohya_ss: training data — MEDIUM confidence, known to work but setup is non-trivial

---

*Architecture research for: ComfyUI + LoRA integration into TypeScript manga pipeline*
*Researched: 2026-02-19*
