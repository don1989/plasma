# Pitfalls Research: ComfyUI + LoRA on Apple Silicon

**Domain:** Local AI image generation pipeline — ComfyUI + kohya_ss on M1 Pro 16GB
**Researched:** 2026-02-19
**Confidence:** MEDIUM overall — training data through Aug 2025, no live web search available this session. Apple Silicon / MPS behavior patterns are well-documented in the community through mid-2025; flag specifics for verification against current ComfyUI and kohya_ss changelogs.

**Note on confidence calibration:**
- HIGH = stable behavior confirmed across multiple sources in training data, unlikely to have changed
- MEDIUM = documented behavior as of mid-2025, may have improved in recent releases
- LOW = community anecdote, single source, or extrapolated from adjacent behavior

---

## Apple Silicon / Metal Pitfalls

### Pitfall 1: MPS Fallback to CPU for Unsupported Operations (CRITICAL)

**What goes wrong:**
PyTorch MPS does not implement every CUDA operation. When ComfyUI or a sampler calls an unsupported op, PyTorch silently falls back to CPU for that op (or raises an error), causing generation to run 3-10x slower than expected. You may not notice this without profiling — the output looks normal but takes 5 minutes for a 512x512 image instead of 45 seconds.

**Why it happens:**
MPS backend coverage has been growing steadily but is not 100% CUDA-equivalent. Certain attention variants, some custom nodes, and specific sampler math hit unimplemented ops. Silent fallback is the default behavior (MPS_FALLBACK_ENABLED).

**Consequences:**
- "GPU acceleration" that is actually mostly CPU
- Generation times that feel wrong (first 5-10 steps fast, then dramatically slow)
- Battery drain and thermal throttling masking the real problem

**Prevention:**
- Set `PYTORCH_ENABLE_MPS_FALLBACK=1` explicitly (prevents errors vs the alternative which is a crash)
- Set `PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.0` to help with memory management
- Time a known reference run (512x512, 20 steps, Euler a) after setup — benchmark is ~30-60s on M1 Pro. If it takes 5+ minutes, something is falling back to CPU.
- Install ComfyUI and run `python main.py --force-fp16` — fp16 has better MPS coverage than fp32

**Detection:**
```bash
# Check if Metal is actually being used
python -c "import torch; print(torch.backends.mps.is_available()); print(torch.backends.mps.is_built())"
# Activity Monitor → GPU History — should show GPU load during generation
```

**Confidence:** HIGH — well-documented MPS limitation, fundamental to PyTorch MPS architecture.

---

### Pitfall 2: Unified Memory Exhaustion Kills the Process (CRITICAL)

**What goes wrong:**
On M1 Pro 16GB, RAM is shared between CPU, GPU, and OS. ComfyUI + the model + your Node.js service + macOS UI can together exhaust RAM, causing macOS to kill the Python process mid-generation with a cryptic error, or swap to disk causing 10-100x slowdown.

**Why it happens:**
SD 1.5 fp16 model: ~2GB. VAE: ~335MB. ControlNet model: ~1.4GB. Sampler working memory: 1-4GB for 512x512. OS baseline: 3-5GB. Node.js service: 200-400MB. That's 8-12GB for a basic generation run, leaving only 4-8GB buffer. At 768x768 or with multiple ControlNets loaded simultaneously, the buffer disappears.

**Consequences:**
- OOM kill during generation (the worst case — you get a corrupt partial output or nothing)
- macOS memory pressure causing thermal throttling across the whole system
- Generation quality degradation due to swap (some samplers behave differently when memory is paged)

**Prevention (requirements-level):**
- Maximum resolution: **512x768** as the hard default. Never attempt 768x768 or larger as a routine operation.
- Load ONE ControlNet at a time. Never chain two ControlNet models simultaneously in a workflow.
- Use fp16 everywhere: model, VAE, ControlNet. fp32 doubles VRAM usage.
- Close other heavy processes (Chrome tabs, VS Code with large TS projects) before training runs.
- Set ComfyUI `--lowvram` flag or `--medvram` flag to enable CPU offloading for model layers not in active use.

**Prevention (architecture-level):**
- Implement memory pressure detection in the Express service: poll `vm_stat` (macOS) before accepting a generation job. If swap usage is growing, queue rather than run.
- Limit ComfyUI to a single worker process (no parallel generation).

**Confidence:** HIGH — RAM math is deterministic; the limits are well understood.

---

### Pitfall 3: fp16 vs fp32 Correctness Bugs on MPS

**What goes wrong:**
Some MPS operations produce numerically incorrect results in fp16 that they do not in fp32 (or CUDA fp16). This manifests as NaN (not-a-number) propagation through the denoising steps, producing black images, pure gray images, or images with large corrupted patches. It's the most confusing failure mode because the pipeline runs without errors.

**Why it happens:**
MPS fp16 implementation has had correctness bugs in specific operations (LayerNorm, some attention variants) that produce NaN outputs in edge cases. These accumulate through the U-Net denoising loop.

**Consequences:**
- Black or gray output image with no error message
- Intermittent failures (only happens with certain seeds, schedulers, or step counts)
- Corrupted LoRA outputs during training

**Prevention:**
- If you see a black/gray output, first attempt: switch to fp32 for just that run to confirm the issue is fp16-related.
- Use `--force-fp16` for ComfyUI inference (generally works fine) but test the specific checkpoint + VAE combination.
- For **VAE specifically**: run VAE in fp32 even if the U-Net runs fp16. VAE fp16 on MPS has a documented history of producing washed-out or gray outputs. Set `--fp16-vae` only after explicitly testing.
- Some community members recommend `--upcast-sampling` for MPS — this runs the final sampling step in fp32 even in an fp16 workflow.

**Detection:**
- Black output → suspect fp16 NaN
- Washed out / gray output → suspect VAE fp16 issue
- Works on one seed, fails on another → fp16 numerical instability

**Confidence:** MEDIUM — documented through community reports mid-2025, may have improved in PyTorch 2.4+/2.5+.

---

### Pitfall 4: ComfyUI Custom Nodes That Require CUDA (MEDIUM)

**What goes wrong:**
Many popular ComfyUI custom nodes include inline CUDA kernels (`.cu` files) that will not compile or run on MPS. Installing them silently poisons the ComfyUI node graph — the node appears in the UI but fails at runtime.

**Why it happens:**
Custom node authors target NVIDIA first. CUDA extensions are common for performance-critical ops (fast attention, efficient sampling). The custom node manager may show the node as "installed" even though it cannot execute.

**Consequences:**
- Workflow that works on CUDA breaks silently on Mac
- Some nodes will error on load, crashing the whole ComfyUI server
- Dependency on a specific community node creates a portability cliff

**Prevention (requirements-level):**
- Maintain a whitelist of MPS-confirmed custom nodes. Only install from this whitelist.
- MPS-safe nodes as of mid-2025: ComfyUI-Manager (management only), ComfyUI_IPAdapter_plus (broadly tested on Mac), ComfyUI-Advanced-ControlNet (pure Python, MPS-compatible).
- Before installing any custom node, check its issues/README for "MPS support" or "Mac support" mention.

**Confidence:** MEDIUM — pattern is well-established; specific node compatibility list evolves.

---

### Pitfall 5: Thermal Throttling Under Sustained Load

**What goes wrong:**
M1 Pro is fanless in passive cooling conditions and has an aggressive thermal governor. During a 500-image training run or extended batch generation, the chip will thermal throttle, dropping from ~peak performance to ~60% after 20-40 minutes. Training that starts at 1 minute/iteration slows to 1.8 minutes/iteration by hour 2.

**Why it happens:**
The M1 Pro's efficiency cores and Neural Engine run hot under sustained ML workloads. macOS dynamically reduces clock speed to prevent thermal damage. The MBP fans do run but the M1 Pro was not designed for sustained 100% utilization.

**Consequences:**
- Training time estimates made from the first 10 iterations are optimistic by 30-50%
- Overnight training jobs can take 2x longer than expected

**Prevention:**
- Run training sessions in the evening (lower ambient temp, lid open)
- Use the `caffeinate` command to prevent sleep but accept the thermal cost
- Plan training time with a 1.5x buffer (e.g., if iteration 1 says "2 hours", plan for 3)
- Do NOT run ComfyUI generation during training — both compete for MPS and RAM

**Confidence:** HIGH — hardware thermal behavior is well understood.

---

## kohya_ss on Mac Pitfalls

### Pitfall 1: kohya_ss Installation Is Fragile on Mac (CRITICAL)

**What goes wrong:**
kohya_ss has complex Python dependency chains (PyTorch, bitsandbytes, xformers) that are not all available for Apple Silicon without manual patching. The standard install script targets CUDA Linux. Running it on Mac produces either: import errors at training start, or a silently degraded training path (CPU instead of MPS).

**Why it happens:**
- `bitsandbytes` (8-bit optimizer) requires CUDA and does not have an MPS backend. Attempting to use it causes immediate crash.
- `xformers` is CUDA-only. MPS uses standard PyTorch attention instead.
- The install script assumes CUDA and may pull wrong PyTorch builds.

**Consequences:**
- Training fails immediately at import time
- Training runs on CPU (takes 10x longer), and you may not notice

**Prevention (requirements-level):**
- Use the **simplified-trainer** alternative or use kohya_ss with explicit `--use_8bit_adam=False` and `--no_xformers` flags.
- Install PyTorch via the Apple Silicon-specific channel: `pip install torch torchvision torchaudio` from the Apple MPS wheel, NOT the CUDA wheel.
- Verify training is using MPS: monitor Activity Monitor → GPU History during the first training step.
- Consider **sd-scripts** (the upstream of kohya_ss) directly — it's easier to configure for MPS than the GUI wrapper.

**Prevention (architecture-level):**
- Wrap training in a shell script that sets environment variables before calling kohya_ss:
```bash
PYTORCH_ENABLE_MPS_FALLBACK=1 \
PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.0 \
python train_network.py --network_module networks.lora \
  --no_xformers \
  --mixed_precision no \
  ...
```

**Confidence:** MEDIUM — known issues documented widely; the ecosystem improves, so verify current state at implementation.

---

### Pitfall 2: LoRA Training OOM on 16GB Unified Memory (CRITICAL)

**What goes wrong:**
SD 1.5 LoRA training at typical settings (batch size 4, 512x512, fp16) requires approximately 8-12GB of unified memory, leaving almost no headroom. With the OS baseline (~3-5GB), you are right at the limit. macOS will swap or kill the process.

**Memory breakdown for SD 1.5 LoRA training (approximate):**
- Base model loaded for training: ~3-4GB
- Training optimizers and gradients: ~2-4GB
- Batch images and augmentation: ~1-2GB (scales with batch size)
- OS + background: ~3-5GB
- **Total: 9-15GB** — dangerously close to 16GB limit

**Consequences:**
- OOM mid-training (after 30-60 minutes) loses the entire run
- Swap-induced slowdown produces corrupted or low-quality LoRA weights

**Prevention (hard constraints):**
- **Batch size: 1.** Not 2, not 4. Batch size 1 is the only safe default on 16GB.
- **Resolution: 512x512.** Training at 768x768 doubles GPU memory for activations.
- **Mixed precision: bf16** if the PyTorch version supports it on MPS, otherwise fp32. fp16 on MPS has correctness issues noted above.
- **Gradient accumulation: 4-8** to compensate for batch size 1 (simulate larger effective batch without memory cost).
- Close all other heavy processes before training. Close Chrome, VS Code, Slack.
- Use a dedicated user session for training (log out of other accounts).

**Settings that cause OOM:**
```
--batch_size 2+          → OOM
--resolution 768         → OOM
--train_batch_size 4     → OOM
Multiple ControlNets     → OOM
```

**Confidence:** HIGH — memory math is deterministic; these limits are well-established for M1 Pro 16GB.

---

### Pitfall 3: Speed Expectations on Mac vs. Community Benchmarks (MEDIUM)

**What goes wrong:**
Community LoRA training tutorials reference speeds like "30 minutes for 1000 steps." Those benchmarks are on RTX 3090/4090 with CUDA. On M1 Pro MPS, expect **5-10x slower**. A 2000-step training run that "should take 30 minutes" takes 3-5 hours.

**Actual M1 Pro training estimates (LOW confidence — extrapolated):**
- 1000 steps, 512x512, batch 1: ~2-4 hours
- 2000 steps, 512x512, batch 1: ~4-8 hours

**Consequences:**
- Scheduling overnight runs that don't finish by morning
- Thermal throttling making estimates based on early steps inaccurate
- Abandoning training mid-run due to unexpected duration

**Prevention:**
- Run a 50-step test with the full training configuration and extrapolate: `50_step_time * (target_steps / 50) * 1.4` (for thermal overhead).
- Schedule 1000-step runs as the minimum (enough to produce a usable LoRA), 2000 steps as a quality target.
- Training does NOT need GPU while sleeping — do NOT close the lid (may suspend MPS).

**Confidence:** LOW on specific numbers — requires a hardware test to confirm. Use test run to calibrate.

---

### Pitfall 4: Dataset Size with Only 1-10 Images of Spyke (CRITICAL for this project)

**What goes wrong:**
LoRA training with fewer than 10-15 images of a character is insufficient to learn the character's identity robustly. With 1-5 reference images, the LoRA will overfit to those specific poses/expressions and fail to generalize to new compositions. The character will look correct only when the base prompt closely matches the training image's composition.

**Why it happens:**
LoRA is learning the "delta" that maps the base model's concept space to the target character. With too few images, it memorizes specific pixels rather than learning the underlying concept (face, outfit, body proportions).

**Consequences:**
- LoRA produces Spyke's face only when the pose exactly matches the reference
- Novel action poses (required for manga panels) produce a character-Spyke hybrid
- Overfitting: the training loss looks great but real-world outputs are wrong

**The project's reality:**
The project has `Spyke_Final.png` (a character reference sheet). That is likely 1-3 actual rendered views of the character. That is **below the minimum** for reliable LoRA.

**Prevention strategies:**
1. **Data augmentation from the reference sheet** — crop individual panels from the reference sheet (face closeup, upper body, full body) to produce 6-10 distinct training crops from one reference sheet.
2. **Synthetic augmentation** — generate 10-20 additional reference images of Spyke using Gemini (the v1.0 pipeline) before training. These don't need to be perfect — they're training data, not production output. Use existing fingerprints with varied poses/expressions/backgrounds.
3. **Use the manga script panels** — any panel images that were generated in v1.0 that show Spyke can become training data. Even imperfect generations help if they're consistent on key features.
4. **Target 15-20 images minimum** — all showing the same character, varied poses and crops, consistent key visual features (white cloak, red bandana, ginger hair, massive broadsword).

**Confidence:** HIGH — LoRA data requirements are well-researched; these minimums are well-established.

---

### Pitfall 5: Caption Quality Determines LoRA Generalization

**What goes wrong:**
Training without captions (or with poor captions) teaches the LoRA to bake the training images' style/background/pose into the trigger word itself. The trigger word then only "works" in contexts similar to the training images. With well-captioned data, the LoRA learns only the character identity, leaving everything else to the prompt.

**Example of bad captioning:**
```
spyke_v2
(all training images get the same single trigger word with no description)
```

**Example of good captioning:**
```
spyke_v2, white cloak, red bandana, ginger hair, full body, standing, white background, simple background
```

**Consequences:**
- Trigger word also activates the training background (white background bleeds into all generations)
- Trigger word activates specific training pose (always standing, never sitting)
- NSFW or unintended concepts in training images get associated with the trigger word

**Prevention:**
- Caption every training image individually with: trigger word + character features present + pose + background type + framing (close-up / full body / bust).
- Use `--no_token_padding` and proper token budgets.
- Tools for auto-captioning: WD14-tagger (produces booru-style tags, good for anime characters) — run on each training image and manually review/edit output.
- If using a character reference sheet as a single image: caption the sheet as a whole, noting it's a reference sheet.

**Confidence:** HIGH — well-established LoRA training best practice.

---

### Pitfall 6: Trigger Word Bleeding (MEDIUM)

**What goes wrong:**
Choosing a trigger word that shares tokens with common SD 1.5 vocabulary contaminates the LoRA. A trigger word like `spyke` may partially activate if the base model has seen "spike" in training data. This causes the LoRA character to "bleed" into unrelated prompts at low strength.

**Prevention:**
- Choose an uncommon trigger token: `spyke_plasma_v1` or `sypke_lora` (deliberate misspelling) is better than `spyke` alone.
- Test the trigger word without the LoRA loaded — if the base model produces anything recognizable, choose a different word.
- Use LoRA at moderate strength (0.6-0.8) rather than 1.0 — reduces bleed while preserving character.

**Confidence:** MEDIUM — documented community behavior; severity varies by base model.

---

## Node.js to ComfyUI Integration Pitfalls

### Pitfall 1: WebSocket Race Condition on Job Completion (CRITICAL)

**What goes wrong:**
ComfyUI's API uses a two-channel pattern: you POST the workflow via HTTP, then listen for completion via WebSocket. If you connect to the WebSocket AFTER posting the job, you may miss the completion event entirely (the image was already done). If you connect BEFORE posting, you receive events from other clients' jobs mixed with yours.

**Consequences:**
- Job appears to hang indefinitely (Express service waiting for an event that already fired)
- Occasional spurious "completion" from a previous job

**Prevention (architecture-level):**
1. **Always connect WebSocket BEFORE submitting the prompt.** Use the client_id pattern: generate a UUID, connect WebSocket with `ws://localhost:8188/ws?clientId={uuid}`, THEN POST the prompt with that same `client_id` in the payload.
2. Filter WebSocket messages by `client_id` — ComfyUI sends all execution events to all connected clients; only process events matching your UUID.
3. Implement a timeout on the WebSocket listener (30-60 seconds for generation). If no completion event fires, poll `GET /queue` and `GET /history` to check job status.

**Reference pattern (TypeScript):**
```typescript
const clientId = crypto.randomUUID();
const ws = new WebSocket(`ws://localhost:8188/ws?clientId=${clientId}`);
await waitForOpen(ws);

// Only THEN submit the prompt
const response = await fetch('http://localhost:8188/prompt', {
  method: 'POST',
  body: JSON.stringify({ prompt: workflow, client_id: clientId })
});
const { prompt_id } = await response.json();

// Filter events
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'executing' && msg.data?.prompt_id === prompt_id && msg.data?.node === null) {
    // generation complete
  }
});
```

**Confidence:** HIGH — this is the documented ComfyUI API pattern; the race condition is a well-known integration mistake.

---

### Pitfall 2: ComfyUI HTTP API Has No Built-In Authentication or CORS (MEDIUM)

**What goes wrong:**
ComfyUI runs on localhost with no auth. If Node.js and ComfyUI are on the same machine (they are here), this is fine. The pitfall is if you ever try to expose the Express service beyond localhost — the ComfyUI API remains open and unauthenticated.

**Prevention:**
- Bind ComfyUI to `127.0.0.1` explicitly (not `0.0.0.0`): `python main.py --listen 127.0.0.1`
- Express service should be the only external entry point
- This is acceptable for single-developer local use; document the constraint

**Confidence:** HIGH — standard network security pattern.

---

### Pitfall 3: File Paths Between Node.js and ComfyUI (MEDIUM)

**What goes wrong:**
ComfyUI expects model paths relative to its own directory structure (`models/checkpoints/`, `models/lora/`, `models/controlnet/`). Your Node.js service will need to reference these paths to: trigger model loading, reference uploaded images for img2img, and locate output files after generation. Hardcoded absolute paths break when ComfyUI's install location changes.

**Consequences:**
- "Model not found" errors when ComfyUI's models directory path doesn't match what Node.js sends
- Generated images not found by Node.js because output path differs from what the workflow specified
- Workflow JSON files referencing wrong paths when copied between machines

**Prevention:**
- Store ComfyUI's base directory as a single env variable (`COMFYUI_BASE_PATH`).
- Derive all model paths from this base: `${COMFYUI_BASE_PATH}/models/lora/spyke_v1.safetensors`
- Use ComfyUI's `/object_info` API to discover available models at startup rather than hardcoding model names.
- For generated outputs: use ComfyUI's `SaveImage` node with a predictable filename pattern, then read from `${COMFYUI_BASE_PATH}/output/`.

**Confidence:** HIGH — basic path management; well-understood pattern.

---

### Pitfall 4: Long-Running Training Jobs and Process Management (MEDIUM)

**What goes wrong:**
Spawning a kohya_ss training job from Node.js via `child_process.spawn()` creates a long-running process (hours) that can:
- Silently die without triggering the Node.js `'exit'` event if killed by OOM
- Leave zombie processes if Node.js itself restarts
- Produce no meaningful status updates during training (only final loss curves)

**Prevention (implementation-level):**

```typescript
// Use spawn (not exec) for streaming output
const trainingProcess = spawn('python', ['train_network.py', ...args], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PYTORCH_ENABLE_MPS_FALLBACK: '1' }
});

// Stream logs to a file for inspection
const logStream = fs.createWriteStream(`training-${jobId}.log`);
trainingProcess.stdout.pipe(logStream);
trainingProcess.stderr.pipe(logStream);

// Parse progress from training output (kohya_ss outputs step/loss to stderr)
trainingProcess.stderr.on('data', (chunk) => {
  const line = chunk.toString();
  const match = line.match(/step (\d+)\/(\d+)/);
  if (match) updateJobProgress(jobId, parseInt(match[1]), parseInt(match[2]));
});

// Handle OOM kills (SIGKILL from macOS memory pressure)
trainingProcess.on('exit', (code, signal) => {
  if (signal === 'SIGKILL') {
    // macOS killed the process (OOM or manual)
    markJobFailed(jobId, 'OOM_KILL');
  }
});

// Persist PID for crash recovery
fs.writeFileSync(`training-${jobId}.pid`, trainingProcess.pid.toString());
```

**Recovery:**
- On Node.js restart, check for orphaned PID files. If the PID is still running, reattach. If not, mark job as failed.
- Partially completed training checkpoints are saved by kohya_ss — check `output_dir` for `*.safetensors` files at intermediate save intervals.

**Confidence:** MEDIUM — standard Node.js child process patterns; the OOM/SIGKILL detection is Mac-specific.

---

### Pitfall 5: ComfyUI Startup Time and Health Check Timing

**What goes wrong:**
ComfyUI takes 10-30 seconds to start (model loading), then additional time to load the first checkpoint into memory. If the Node.js service sends the first generation request before ComfyUI is ready, the request fails with a connection refused or a queue error.

**Prevention:**
- Implement a startup health check loop: poll `GET /system_stats` until it returns 200 before accepting any generation requests.
- Apply a backoff: check every 2 seconds for up to 60 seconds. If not up by 60s, fail loudly.
- Start ComfyUI as a managed background process that the Express service can restart: use a process manager (PM2, or simple Node.js spawn with restart logic) rather than assuming it's already running.

```typescript
async function waitForComfyUI(maxWaitMs = 60000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch('http://127.0.0.1:8188/system_stats');
      if (res.ok) return;
    } catch { /* not ready yet */ }
    await sleep(2000);
  }
  throw new Error('ComfyUI did not start within 60 seconds');
}
```

**Confidence:** HIGH — fundamental integration pattern for HTTP services with non-trivial startup time.

---

### Pitfall 6: WebSocket Reconnection on ComfyUI Crash

**What goes wrong:**
If ComfyUI crashes mid-generation (OOM, NaN propagation, manual kill), the WebSocket connection closes. If the Node.js service doesn't implement reconnection, it enters a dead state where all future generation requests hang waiting for a WebSocket that will never deliver results.

**Prevention:**
- Implement WebSocket reconnection with exponential backoff.
- Tag all in-flight jobs — on reconnect, query `GET /history` to check if the job completed before the crash.
- Implement a generation timeout: if a 512x768 image at 20 steps hasn't completed in 120 seconds, assume something failed and query the queue.

**Confidence:** HIGH — standard WebSocket resilience pattern.

---

## ControlNet on Mac Pitfalls

### Pitfall 1: Which ControlNet Models Are Safe on M1 Pro 16GB

**Memory overhead per ControlNet model loaded:** ~1.2-1.5GB (fp16 safetensors format).

**MPS-compatible ControlNet models (MEDIUM confidence — mid-2025 state):**

| Model | Memory | MPS Status | Notes |
|-------|---------|------------|-------|
| control_v11p_sd15_openpose | ~1.4GB | Compatible | Pure Python inference, well-tested on Mac |
| control_v11f1p_sd15_depth | ~1.4GB | Compatible | Depth estimation; MPS-compatible |
| control_v11p_sd15_canny | ~1.4GB | Compatible | Edge detection; low compute, safe on MPS |
| control_v11p_sd15_lineart | ~1.4GB | Compatible | Good for manga style; MPS-compatible |
| control_v11p_sd15_scribble | ~1.4GB | Compatible | Sketch input; low risk |
| T2I-Adapter (any) | ~300MB | Mostly compatible | Lighter than full ControlNet |

**Models to avoid on 16GB:**
- Do NOT load two ControlNet models simultaneously — 2 × 1.4GB + SD 1.5 2GB + working memory = OOM.
- Inpainting ControlNet variants tend to use more working memory.

**Recommended approach for this project:**
Use **OpenPose** as the primary ControlNet (poses drive manga panel composition). Lineart as secondary if needed for panel-to-panel style consistency. Never both at once.

**Confidence:** MEDIUM — model compatibility based on community reports through mid-2025.

---

### Pitfall 2: ControlNet Preprocessors Require Separate Models

**What goes wrong:**
ControlNet conditioning requires running a preprocessor first (OpenPose detection extracts pose data from an input image). The preprocessor models are separate downloads from the ControlNet weights. Forgetting to download them causes silent failures: ControlNet receives empty conditioning and has no effect on the output.

**Prevention:**
- OpenPose preprocessor: download `openpose.onnx` (or the PyTorch variant) to `models/controlnet/annotators/`.
- Test the preprocessor chain explicitly: upload a test image, verify pose skeleton is detected before connecting to generation workflow.
- ComfyUI-Advanced-ControlNet node handles the preprocessor call within the workflow — use this node rather than manual preprocessing.

**Confidence:** MEDIUM — documented requirement; specific file paths depend on ComfyUI-Advanced-ControlNet version.

---

### Pitfall 3: ControlNet Strength vs. Prompt Strength Balance

**What goes wrong:**
With ControlNet strength too high (> 0.8-0.9), the model follows the pose skeleton exactly but ignores the character prompt — generating the pose with wrong character features. With too low (< 0.4), the pose is ignored and the LoRA generates what it wants.

**For manga panels:**
Optimal range is typically 0.6-0.75 for pose conditioning. Test with reference pose images before production.

**Prevention:**
- Expose ControlNet strength as a configurable parameter per generation request (not hardcoded).
- Default to 0.65, allow per-call override.

**Confidence:** MEDIUM — these ranges are established community practice; may vary by model combination.

---

## LoRA Training Data Pitfalls

### Pitfall 1: The "1-10 Images" Dataset Problem (CRITICAL for this project)

This is covered in depth in the kohya_ss section. Short summary:

**Minimum viable dataset:** 15-20 images showing the character from varied angles and poses.
**For Spyke specifically:** The project likely has 1-3 reference images. You must augment.

**Augmentation strategy:**
1. Crop the character reference sheet (Spyke_Final.png) into: face closeup, bust, upper body, full body — 4-6 crops.
2. Use v1.0 Gemini pipeline to generate 10-15 additional Spyke images (varied poses, expressions, backgrounds). Quality doesn't need to be perfect — training data needs to be consistent on key features, not beautiful.
3. Aim for: 50% full-body, 30% upper-body/bust, 20% face closeup — this distribution teaches the LoRA to generalize across framing.

**Confidence:** HIGH — LoRA dataset requirements are well-researched.

---

### Pitfall 2: Overfitting to Training Images

**What goes wrong:**
With a small dataset (15-20 images), training too many steps causes the LoRA to memorize rather than generalize. At step 500, the character might look right in varied poses. At step 2000, it only looks right when the prompt closely matches the training image composition.

**Signs of overfitting:**
- Loss drops very low (< 0.001) before training ends
- Character looks correct only for training-image-like prompts
- Novel poses produce distorted anatomy while the character's face is still recognizable

**Prevention:**
- For datasets of 15-20 images: target **800-1200 training steps total** (not 2000+)
- Rule of thumb for small datasets: `(num_images * 100) = roughly correct step count`
- Use validation prompts (if supported) to check generalization during training
- Save checkpoints every 200 steps, test each checkpoint, use the one that generalizes best (not the final one)

**Confidence:** MEDIUM — the step count formula is a community heuristic, requires calibration to your specific data.

---

### Pitfall 3: Regularization Images and Why You Need Them

**What goes wrong:**
Training without regularization images causes "language drift" — the base model's understanding of common prompts degrades in the areas the LoRA affects. After training without regularization, prompts for unrelated concepts that share tokens with the training captions will produce distorted outputs.

**Prevention:**
- Generate 100-200 regularization images using the base SD 1.5 model (no LoRA) with a general prompt: `anime character, male, full body, white background`. These teach the model "here is what a normal character looks like — only update the delta for spyke_plasma_v1."
- kohya_ss supports this via `--reg_data_dir` parameter.
- With a tiny dataset (15-20 images), regularization images are critical — without them, the LoRA will corrupt the base model's concept space.

**Confidence:** HIGH — regularization is a standard LoRA training technique with well-understood effects.

---

## Seed Reproducibility Pitfalls

### Pitfall 1: MPS Seed Behavior Is NOT Fully Deterministic (CRITICAL)

**What goes wrong:**
Locking the seed in ComfyUI does NOT guarantee identical output on repeated runs on MPS the way it does on CUDA. Two runs with the same seed, same model, same workflow on M1 Pro may produce visually similar but not pixel-identical images. This undermines the "deterministic panel regeneration" requirement.

**Why it happens (MEDIUM confidence):**
- MPS does not guarantee operation ordering for some parallel operations — the same floating-point operations executed in different order produce different rounding
- Some PyTorch MPS kernels have non-deterministic behavior by default
- Thermal throttling changes the computation schedule (less likely to affect output, but theoretically possible)

**Practical impact:**
- Seed locking provides **strong consistency** (same character, same pose, very similar composition) but NOT **pixel-identical reproducibility**.
- For manga panel production, "visually equivalent" is sufficient — you don't need pixel-identical outputs.
- If you need to regenerate a panel weeks later and it looks "same enough to be consistent," seeds work adequately.
- If you need to prove pixel-level reproducibility (e.g., for detecting unauthorized copies), MPS cannot guarantee this.

**Prevention:**
- Document that seed locking provides "character and composition consistency" not "bit-exact reproducibility."
- In requirements: define "reproducible" as "same character, same pose, visually indistinguishable" rather than "pixel-identical."
- Store the full workflow JSON (not just the seed) for every approved panel, so any regeneration uses the exact same workflow.
- Test: run the same seed 3 times and visually compare — if the outputs are consistent enough for your use case, you're fine.

**Confidence:** MEDIUM — MPS non-determinism is documented for some ops; the degree of variance in practice depends on the specific workflow and PyTorch version.

---

### Pitfall 2: Seeds From Community Are CUDA Seeds — They Do Not Transfer

**What goes wrong:**
Online resources share "good seeds" for specific styles or character types. These seeds are generated on CUDA hardware. Due to MPS non-determinism and different random number generation paths, CUDA seeds do not produce the same output on MPS. Don't waste time trying to replicate CUDA seed outputs on Mac.

**Prevention:**
- Develop your own seed library through testing on your hardware.
- Run 50-100 generations with random seeds, save the ones that produce good character consistency, catalog them.
- Your seed library is hardware-specific: `seeds-m1pro.json`.

**Confidence:** HIGH — fundamental difference in random number generation between CUDA and MPS.

---

### Pitfall 3: Workflow JSON Must Be Versioned for Reproducibility

**What goes wrong:**
Storing only the seed is insufficient for reproducibility. If the model checkpoint changes (updated safetensors), the LoRA is retrained (new version), or any node in the ComfyUI workflow is updated, the same seed produces a different result.

**Prevention:**
- Store the complete workflow JSON alongside every approved generation: `ch01_p003_v1.workflow.json`
- Record: checkpoint name + hash, LoRA name + version + strength, ControlNet model + strength, sampler, steps, CFG scale, seed
- This is the production-traceability requirement — equivalent to committing a lock file

**Confidence:** HIGH — standard reproducibility practice.

---

## Model File Management Pitfalls

### Pitfall 1: VAE Is Not Optional for SD 1.5 (CRITICAL)

**What goes wrong:**
Some SD 1.5 checkpoints do not bake in a VAE (or include an older/lower-quality VAE). Generating with no VAE or the wrong VAE produces desaturated, washed-out images with blown-out highlights — a symptom often blamed on fp16 issues but actually a VAE mismatch.

**The correct VAE for SD 1.5 anime-style outputs:**
Use `vae-ft-mse-840000-ema-pruned.safetensors` (MSE-trained VAE). This is the standard VAE for SD 1.5 and produces correct color saturation. Size: ~335MB.

**Prevention:**
- Always load the VAE explicitly in the ComfyUI workflow (do not rely on the checkpoint's baked VAE).
- Add VAE selection to the Express service API — make it a required parameter, not optional.
- If outputs look washed out or desaturated: first check VAE before blaming fp16 or generation settings.

**Confidence:** HIGH — VAE requirement for SD 1.5 is well-established, specific file name confirmed.

---

### Pitfall 2: Model File Integrity on Download (MEDIUM)

**What goes wrong:**
Large model files (2-7GB) downloaded from HuggingFace or CivitAI can be partially corrupted during download. A corrupted safetensors file may load without error but produce garbage outputs. This is particularly frustrating because the error appears to be in the generation settings, not the file.

**Prevention:**
- Always verify SHA256 hashes after downloading: most models publish expected hashes on their HuggingFace/CivitAI page.
- If you get consistently wrong outputs that don't respond to prompt changes: re-download the model.
- Use `huggingface-cli download` or `aria2c` for large files (handles interrupted downloads and resumes).

**Confidence:** HIGH — standard file integrity issue for large downloads.

---

### Pitfall 3: fp16 vs fp32 for Inference on Mac

**Recommendation:**
- Checkpoint (U-Net): fp16. Saves ~2GB RAM with minimal quality difference for inference.
- VAE: **fp32**. As noted in the MPS section, VAE fp16 has known correctness issues on MPS.
- ControlNet: fp16. Same reasoning as checkpoint.
- LoRA: stored in fp16 (standard), loaded at the precision of the base model.

**The `--fp16` flag in ComfyUI** applies to the U-Net, not the VAE. VAE precision is controlled separately.

**Concrete risk:** If you set everything to fp16 including VAE, you may get washed-out images that look like a style problem but are actually a VAE computation error. Test VAE fp32 explicitly if you see color issues.

**Confidence:** MEDIUM — behavior observed through mid-2025 on MPS; may have improved in PyTorch 2.4+.

---

### Pitfall 4: Checkpoint Format — .ckpt vs .safetensors

**Recommendation:** Always use `.safetensors` format. Avoid `.ckpt` files.

**Why:**
- `.ckpt` files can execute arbitrary Python code during loading (security risk, even for local use)
- `.safetensors` loading is ~5-10x faster and does not allow code execution
- Modern checkpoints are distributed in `.safetensors` format; `.ckpt` is legacy

**On Mac specifically:** `.ckpt` loading with MPS can trigger memory management issues during deserialization. `.safetensors` is strictly better.

**Confidence:** HIGH — well-established recommendation, not controversial.

---

## Prevention Checklist

### Requirements Phase (Before Writing Any Code)

- [ ] **Define "reproducible"** as "visually consistent" not "pixel-identical" — update requirements doc accordingly
- [ ] **Hard-cap resolution** at 512x768 for generation, 512x512 for training — document this as a hardware constraint, not a quality choice
- [ ] **Hard-cap training batch size** at 1 — document this as the only safe value for 16GB
- [ ] **Plan dataset augmentation** before requirements sign-off — 15-20 images minimum for Spyke LoRA
- [ ] **Specify VAE explicitly** in the generation API spec — required field, not optional
- [ ] **Define ComfyUI startup dependency** — Express service health check must gate on ComfyUI readiness
- [ ] **List which ControlNets** will be used — budget their memory into the 16GB budget explicitly

### Architecture Phase (Before Implementation Planning)

- [ ] **WebSocket + client_id pattern** designed before any integration code — prevents the race condition from being baked in
- [ ] **Process management design** for training jobs — how OOM kills are detected and surfaced to the job status API
- [ ] **Path resolution strategy** — single env variable for ComfyUI base, all paths derived from it
- [ ] **Model version tracking** — how checkpoint/LoRA version is recorded alongside every generated image
- [ ] **Memory pressure monitoring** — architecture for detecting swap/memory pressure before accepting jobs
- [ ] **Workflow JSON storage** — where approved generation workflows are persisted alongside output images
- [ ] **LoRA trigger word naming convention** — decided before any training runs

### Implementation Phase (Code-Level)

- [ ] **PyTorch MPS verification** — health check endpoint confirms `torch.backends.mps.is_available()` returns True
- [ ] **WebSocket reconnection** implemented before integration testing — not added later as a "nice to have"
- [ ] **Training job log streaming** — stdout/stderr piped to files, not buffered in memory
- [ ] **Generation timeout** — hardcoded 120s timeout for 512x768 at 20 steps; fail loudly rather than hang
- [ ] **VAE fp32 / U-Net fp16** — workflow defaults are explicitly set, not inherited from ComfyUI defaults
- [ ] **PYTORCH_ENABLE_MPS_FALLBACK=1** — set in the environment before any Python subprocess is spawned
- [ ] **Batch size validation** — training API endpoint rejects batch_size > 1 rather than letting it silently OOM
- [ ] **Checkpoint hash logging** — log the safetensors hash when a model is loaded for the first time

### Warning Signs to Watch During Development

| Symptom | Likely Cause | First Check |
|---------|--------------|-------------|
| Generation takes > 3 minutes for 512x512/20 steps | CPU fallback from MPS | Check GPU History in Activity Monitor |
| Black or gray output image | fp16 NaN or wrong VAE | Test fp32 VAE first |
| Washed out / desaturated output | VAE fp16 issue | Switch VAE to fp32 |
| Training loses progress mid-run | OOM kill | Check macOS Console for "killed by jetsam" |
| WebSocket hangs indefinitely | Missed completion event | Check if client_id is in POST body |
| ComfyUI responses time out on first request | Not started yet | Implement startup health check |
| LoRA produces correct face but wrong pose | Overfitting or too few training steps | Test earlier checkpoints |
| Trigger word bleeds into unrelated prompts | Token collision | Change trigger word to more unique string |
| Model load time > 60s | Likely loading fp32 model | Verify checkpoint is fp16 safetensors |

---

## Phase-to-Pitfall Mapping

| Phase | Pitfalls to Address | Priority |
|-------|--------------------|---------|
| Requirements | MPS memory limits, dataset size minimum, "reproducible" definition, VAE requirement | Critical — requirements must encode these as hard constraints |
| Architecture | WebSocket race condition, process management, path resolution, memory pressure monitoring | Critical — architecture mistakes here cause rewrites |
| ComfyUI Setup | fp16/fp32 correctness, MPS verification, model file integrity, VAE loading | High — catch before writing any integration code |
| LoRA Data Prep | Dataset augmentation strategy, caption quality, regularization images, trigger word | Critical — wrong data means wasted training time |
| LoRA Training | OOM prevention (batch size 1), step count, checkpoint interval, speed expectations | High — training runs are the longest operations |
| Integration | WebSocket reconnection, timeout handling, log streaming, health check timing | High — integration bugs cause the most confusing failures |
| ControlNet | Single model at a time, preprocessor download, strength calibration | Medium — important but easier to fix post-implementation |
| Reproducibility | Workflow JSON storage, seed library, version tracking | Medium — correctness issue but not a blocker |

---

## Sources

- Training data (MEDIUM confidence, through Aug 2025): PyTorch MPS documentation, Apple Silicon ML community reports, ComfyUI GitHub issues, kohya_ss README and issues
- Hardware specifications: MacBook Pro M1 Pro 16GB unified memory architecture — deterministic RAM math (HIGH confidence)
- ComfyUI API pattern (client_id + WebSocket): ComfyUI official API documentation examples (HIGH confidence — this is the documented integration pattern)
- LoRA training data requirements: Well-established community consensus across multiple LoRA training guides (HIGH confidence on minimums)
- MPS non-determinism: PyTorch MPS documentation noting non-deterministic behavior for some operations (MEDIUM confidence — may have improved)
- VAE fp32 recommendation: Multiple community reports of VAE fp16 issues on MPS (MEDIUM confidence)
- Safety note: ALL speed benchmarks are LOW confidence — require a hardware test on this specific machine to calibrate

**Verification priorities at implementation time:**
1. Confirm current PyTorch version's MPS coverage (may have improved since mid-2025)
2. Verify kohya_ss current Mac/MPS install instructions against the current README
3. Test actual generation speed (512x512, 20 steps) to calibrate timeout values
4. Verify ComfyUI-Advanced-ControlNet current MPS compatibility

---
*Pitfalls research for: ComfyUI + LoRA pipeline on Apple Silicon (v2.0 milestone)*
*Researched: 2026-02-19*
*Context: Adding local ComfyUI + kohya_ss to existing TypeScript manga pipeline — M1 Pro 16GB*
