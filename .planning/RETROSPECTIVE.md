# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Gemini Pipeline MVP

**Shipped:** 2026-02-19
**Phases:** 4 | **Plans:** 11

### What Was Built
- Full TypeScript pipeline: script parsing → prompt generation → image generation → overlay → assembly
- 5 character YAML fingerprints with verbatim prompt injection
- SVG balloon dialogue overlay system
- Webtoon vertical strip assembler (800×1280px mozjpeg)

### What Worked
- TypeScript + Sharp choice delivered fast — entire pipeline in ~3 days
- Commander subcommand-per-stage pattern kept CLI clean and extensible
- Intermediate artifacts at each stage enabled re-running without data loss
- Programmatic text overlay was the right call — AI text is garbled

### What Was Inefficient
- Gemini character consistency was a known risk from the start; time spent on fingerprint optimization only delayed the inevitable conclusion that LoRA/3D was needed
- Manual copy-paste workflow, while pragmatic, required significant human involvement per panel

### Patterns Established
- Stage pipeline architecture (generate → overlay → assemble)
- `output/ch-XX/` directory structure with raw/processed/lettered/webtoon substages
- Character YAML fingerprints as canonical visual descriptions
- `chXX_pNNN_vN.png` naming convention

### Key Lessons
1. Programmatic text overlay is non-negotiable — no AI reliably renders text in images
2. Character consistency requires more than prompt engineering — it requires fine-tuning or deterministic models
3. Intermediate artifact preservation makes the pipeline resilient to iteration

---

## Milestone: v2.0 — Local ComfyUI + LoRA Pipeline

**Shipped:** 2026-02-25
**Phases:** 6 (5 executed + 1 pivoted) | **Plans:** 18

### What Was Built
- ComfyUI installed with Metal/MPS acceleration (15s/image on M1 Pro)
- Express service wrapping ComfyUI with job management, Zod validation, WebSocket completion
- Spyke LoRA trained (v3, pose-only captions, 0.8 strength) and deployed
- Full pipeline integration with `--comfyui` flag and PIPE-04/PIPE-05 traceability
- 3D character model scripts bootstrapped (Spyke blockout, toon shaders, render setup)

### What Worked
- Smoke test pattern (5-step training before full run) caught configuration issues early
- Sidecar installation pattern (~/tools/) kept repo clean
- WebSocket-first completion detection was correct from the start — no polling needed
- Express service as thin wrapper over ComfyUI was clean and maintainable
- Plan-per-capability decomposition kept each plan focused and fast (median ~5 min)

### What Was Inefficient
- LoRA training took 3 iterations (v1 detailed captions → v2 adjusted → v3 pose-only) before finding the right caption strategy. Lesson: character LoRA captions should describe pose/composition ONLY — appearance must be learned visually, not described in text
- Flip augmentation was applied then removed — asymmetric costume makes horizontal flips destructive
- Dataset TOML num_repeats + folder prefix were additive (20 repeats not 10) — resulted in 1840 steps instead of planned 920
- Phase 10 (ControlNet) was planned but never executed — entire approach pivoted to Blender after realizing 3D is the correct solution for deterministic consistency

### Patterns Established
- LoRA caption strategy: pose/composition only + asymmetric details; general appearance learned visually
- MPS training constraints: `mixed_precision: no`, `batch_size: 1`, `AdamW` not `AdamW8bit`
- `accelerate launch --num_cpu_threads_per_process=4` required for MPS training speed
- Workflow template slot-fill pattern: static JSON exported from ComfyUI GUI, 5 injectable tokens
- Hardware constraint validation at API layer (512×768 max, batch_size=1)

### Key Lessons
1. LoRA improves consistency but doesn't fully solve it — asymmetric details still occasionally flip. 3D rendering is the deterministic solution.
2. Caption strategy matters more than training steps for character LoRA. Describe what changes (pose), not what's constant (appearance).
3. Always run `--max_train_steps=5` smoke test before committing to a full training run.
4. MPS on Apple Silicon is viable for SD 1.5 inference and LoRA training, but with specific constraints (no fp16 mixed precision, no 8bit optimizers).
5. The pivot to Blender was the right strategic call — AI generation can supplement but 3D is the backbone for character consistency.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 4 | 11 | Established stage pipeline architecture |
| v2.0 | 6 | 18 | Added local AI infra + discovered 3D as the consistency solution |

### Top Lessons (Verified Across Milestones)

1. Programmatic text overlay is non-negotiable — confirmed in both v1.0 (Gemini) and v2.0 (ComfyUI)
2. Character consistency requires deterministic rendering — v1.0 fingerprints and v2.0 LoRA both fell short; 3D is the answer
3. Intermediate artifacts at each stage make the pipeline resilient and debuggable
4. Sidecar tool installation (~/tools/) keeps the repo clean and tools independently updatable
