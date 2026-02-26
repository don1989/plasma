# Milestones

## v1.0 Gemini Pipeline MVP (Shipped: 2026-02-19)

**Phases completed:** 4 phases, 11 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---


## v2.0 Local ComfyUI + LoRA Pipeline (Shipped: 2026-02-25)

**Phases completed:** 5 executed phases (5-9), 18 plans complete. Phase 10 (ControlNet OpenPose) pivoted to Blender v3.0 milestone.
**Timeline:** 7 days (2026-02-19 → 2026-02-25)
**Code:** ~4,500 lines added across pipeline TypeScript + 3D model Python

**Key accomplishments:**
- ComfyUI installed with Metal/MPS acceleration on M1 Pro, benchmarked at 15s/image (8x under 2-minute threshold)
- Express service (port 3000) wrapping ComfyUI with Zod-validated job management, WebSocket completion detection, and hardware constraint enforcement
- Spyke training dataset prepared: 19 crops from reference sheets, captions with trigger word, augmentation pipeline
- Spyke LoRA trained (v3, 1200 steps, pose-only captions) and deployed as spyke_plasma_v1_production.safetensors at strength 0.8
- Full pipeline integration: `--comfyui` CLI flag routes through Express service with PIPE-04/PIPE-05 parameter traceability (seed, sampler, workflow JSON)
- 3D character model pipeline bootstrapped: Spyke blockout scripts, manga toon shaders, multi-camera render setup, batch pose rendering

**Known gaps (proceeding with gaps):**
- CTRL-01, CTRL-02, CTRL-03, CTRL-04: ControlNet OpenPose — dropped, pivoting to Blender 3D rendering (v3.0 milestone)
- DATA-02, DATA-03: Dataset captions and regularization set — phases show complete on disk but traceability table not updated
- LORA-01, LORA-02, LORA-03, LORA-05: LoRA training requirements — work completed but traceability table not updated

---

