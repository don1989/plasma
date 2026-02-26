# Phase 9 Research: LoRA Integration + Reproducibility

## Summary

Deep codebase analysis complete. No external research needed — all required implementation context is in the existing codebase. The gaps between the current state and Phase 9 requirements are specific and clearly bounded.

## Critical Finding: Workflow Template Missing LoRA Nodes

The current `pipeline/src/comfyui/workflows/txt2img-lora.json` does NOT have a LoraLoader node. The `{{LORA_NAME}}` token is defined in `slot-fill.ts` and the slot-fill call in `comfyui-client.ts` passes `lora_name: ''`, but the template has no node that consumes this token. The template must be updated to add LoraLoader and CLIPSetLastLayer nodes.

**Current template graph (Phase 7):**
```
CheckpointLoaderSimple[1] → ModelComputeDtype[10] → KSampler[5]
CheckpointLoaderSimple[1] clip → CLIPTextEncode[2] (positive)
CheckpointLoaderSimple[1] clip → CLIPTextEncode[3] (negative)
EmptyLatentImage[4] → KSampler[5] → VAEDecode[6] → SaveImage[7]
```

**Required template graph (Phase 9):**
```
CheckpointLoaderSimple[1] → ModelComputeDtype[10] → LoraLoader[11] → KSampler[5]
CheckpointLoaderSimple[1] clip → LoraLoader[11] → CLIPSetLastLayer[12]
CLIPSetLastLayer[12] → CLIPTextEncode[2] (positive)
CLIPSetLastLayer[12] → CLIPTextEncode[3] (negative)
EmptyLatentImage[4] → KSampler[5] → VAEDecode[6] → SaveImage[7]
```

New nodes needed:
- `"11"`: LoraLoader — model: ["10", 0], clip: ["1", 1], lora_name: `"{{LORA_NAME}}"`, strength_model: 0.8, strength_clip: 0.8
- `"12"`: CLIPSetLastLayer — clip: ["11", 1], stop_at_clip_layer: -2

KSampler node `"5"` model input changes: `["10", 0]` → `["11", 0]`
CLIPTextEncode nodes `"2"` and `"3"` clip input changes: `["1", 1]` → `["12", 0]`

This structure is verified working — it matches `eval_lora.py` which successfully generates Spyke images.

## Gap Analysis: What Phase 9 Must Implement

### GEN-04: Wire LoRA name into workflow template
**Gap**: `comfyui-client.ts:137` has `lora_name: ''` (Phase 7 placeholder).
**Fix**: Pass `loraId` through the call chain: POST /jobs → router → submitJob → slotFill.
**Files**: router.ts (add loraId to jobRequestSchema), comfyui-client.ts (accept loraId in ComfyJobInput, use in slotFill), generate.ts (send loraId in POST /jobs body).
**Default**: `'spyke_plasma_v1_production'` when loraId not provided.

### PIPE-04: Extend GenerationLogEntry with inference params
**Gap**: `types/generation.ts` `GenerationLogEntry` is missing: `seed`, `sampler`, `scheduler`, `steps`, `cfg`, `loraId`, `controlnetStrength`, `workflowTemplate`.
**Current fields**: imageFile, promptFile, promptHash, model, timestamp, version, approved, notes, promptText, source, sourcePath.
**Fix**: Add all PIPE-04 fields as optional (backward-compatible for Gemini entries that don't have these).
**Recording challenge**: generate.ts submits POST /jobs and polls GET /jobs/:id. The final job state must include the inference params (seed, sampler, etc.) so generate.ts can record them in the manifest. Two options:
- A) Add inference params to JobState in job-store, return in GET /jobs/:id response — generate.ts reads them from final poll
- B) generate.ts captures them locally from POST /jobs request body
**Recommendation**: Option A — store resolved seed (which may differ from submitted seed) and all inference params in JobState. The resolved seed is critical for reproducibility — the router generates a random seed if none provided, and generate.ts needs the ACTUAL seed used.

### PIPE-05: Store workflow JSON alongside approved image
**Gap**: No workflow.json is written anywhere currently.
**Implementation approach**:
1. comfyui-client.ts returns `workflowJson: string` in ComfyJobResult (the filled JSON used)
2. router.ts stores it in JobState as `workflowJson`
3. GET /jobs/:id returns it
4. generate.ts stores it in GenerationLogEntry as `workflowTemplate`
5. In approve-and-copy (generate.ts), write the `workflowTemplate` from manifest entry as `chXX_pNNN_vN.workflow.json` to raw/ (alongside promoted image)
This approach writes the workflow.json only for approved images (no clutter for rejected attempts).

### GEN-06: POST /loras/train validation
**Gap**: `router.ts:183` — POST /loras/train returns 501. Must implement:
- `batch_size > 1` → HTTP 400
- Concurrent training job running → HTTP 409
**Implementation**: Simple in-memory flag `let trainingJobActive = false` in router module scope. POST /loras/train: validates batch_size, checks flag, sets flag, runs async stub, clears flag on complete/fail.
**Schema for POST /loras/train**:
```typescript
const loraTrainSchema = z.object({
  datasetDir: z.string().min(1),
  outputName: z.string().min(1),
  steps: z.number().int().min(100).max(2000).optional(),
  resolution: z.number().int().optional(),
  batch_size: z.number().int().optional(),
});
```

## Data Flow for PIPE-04/PIPE-05

```
POST /jobs {prompt_text, loraId, seed?, ...}
  → router.ts: validate, generate resolvedSeed = seed ?? randomInt(), create job
  → submitJob({..., loraName: loraId ?? 'spyke_plasma_v1_production', seed: resolvedSeed})
  → comfyui-client.ts: slotFill with loraName + resolvedSeed, returns {promptId, imagePath, imageFile, workflowJson}
  → router.ts: updateJob({status: 'complete', seed: resolvedSeed, loraId, sampler, steps, cfg, workflowJson, ...})
  → GET /jobs/:id returns all of the above
  → generate.ts: manifest entry includes seed, loraId, sampler, steps, cfg, workflowTemplate
  → approve-and-copy: writes chXX_pNNN_vN.workflow.json to raw/
```

## Files to Modify

| File | Change |
|------|--------|
| `pipeline/src/comfyui/workflows/txt2img-lora.json` | Add LoraLoader[11] + CLIPSetLastLayer[12], rewire KSampler + CLIPTextEncode |
| `pipeline/src/types/generation.ts` | Add PIPE-04 fields to GenerationLogEntry |
| `pipeline/src/comfyui/types.ts` | Add loraName to ComfyJobInput; add workflowJson + seed to ComfyJobResult; add inference params + workflowJson to JobState |
| `pipeline/src/comfyui/comfyui-client.ts` | Use loraName from input in slotFill; return workflowJson in result |
| `pipeline/src/comfyui/router.ts` | Add loraId to jobRequestSchema; pass to submitJob; store inference params in job; implement POST /loras/train |
| `pipeline/src/stages/generate.ts` | Send loraId in POST /jobs; record full manifest entry with params; write workflow.json in approve-and-copy |

## Reproducibility Definition

Per REQUIREMENTS.md: "given the same workflow JSON, same checkpoint, same LoRA version, and same seed, the generated image is visually consistent — same character, same pose, same composition — across multiple runs. Pixel-identical bit-exact identity is explicitly NOT required and NOT achievable on MPS."

Verification method: Run `eval_lora.py v3_final` with fixed seed (SEED=42) 3 times → compare visually. This is a human-run checkpoint — no automated pixel comparison needed.

## Existing Infrastructure That Phase 9 Can Reuse

- `slotFill()` — already has `{{LORA_NAME}}` token support; just needs lora_name passed as non-empty
- `jobRequestSchema` — already has seed, steps, cfg, sampler, scheduler fields; just add loraId
- `GenerationLogEntry.source` — already distinguishes 'comfyui' from 'gemini'; new fields are additive
- `approve-and-copy` logic in generate.ts — already finds manifest entry by imageFile; can read workflowTemplate from there
- `randomInt()` already imported in router.ts for seed generation

## No External Research Needed

The domain is fully understood:
- ComfyUI workflow format: already validated by eval_lora.py (working LoRA workflow)
- kohya_ss LoRA training: Phase 8 complete, production LoRA deployed
- TypeScript patterns: well-established in existing pipeline code (Zod, Express, WebSocket)
- Manifest format: existing pattern in generation.ts

## RESEARCH COMPLETE
