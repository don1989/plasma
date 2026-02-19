# Plasma Manga Pipeline

## What This Is

A production pipeline that converts Plasma story chapters into Webtoon-style digital manga, end to end. Takes written narrative chapters and outputs fully assembled vertical-scroll manga pages with art generated via AI image generation and dialogue overlaid programmatically — repeatable for each chapter as the story grows.

v1.0 delivered the full Gemini-based pipeline: script parsing → character fingerprints → prompt generation → image generation (manual + API) → dialogue overlay → Webtoon assembly. The pipeline is now pivoting to a local ComfyUI + LoRA stack (v2.0) for deterministic, GPU-accelerated generation with true character consistency via fine-tuning.

## Core Value

A repeatable system that transforms any Plasma story chapter into publish-ready Webtoon manga pages with consistent character visuals across panels.

## Current State (v1.0 Shipped)

- **Pipeline:** TypeScript, ~28,500 LOC, 135 files
- **Stack:** Node.js + Commander CLI, Sharp (image processing), Nunjucks (templates), `@google/genai` SDK
- **Stages built:** script → prompt → generate → overlay → assemble
- **Chapter 1:** 28 prompts generated; manual + API image generation working; dialogue overlay + Webtoon assembly working
- **Character system:** 5 characters with locked YAML fingerprints; image-to-image reference support added
- **Known limitation:** Gemini text-to-image has poor asymmetric detail consistency (knee pads, bracers flip sides despite explicit prompting)

## Requirements

### Validated (v1.0)

- ✓ Panel-by-panel manga scripts generated from story chapters — v1.0
- ✓ Gemini-optimized art prompts generated from scripts (per panel/page) — v1.0
- ✓ Character visual fingerprint system with verbatim prompt injection — v1.0
- ✓ Art images generated via Gemini (manual copy-paste + API workflows) — v1.0
- ✓ Dialogue and SFX integrated via programmatic overlay (SVG balloons) — v1.0
- ✓ Vertical-scroll Webtoon assembly from individual panels — v1.0
- ✓ Pipeline handles new chapters as story continues — v1.0

### Active (v2.0)

- [ ] Local image generation via ComfyUI (Metal/MPS on M1 Pro) — no cloud dependency
- [ ] LoRA training on character reference images for pixel-accurate consistency
- [ ] img2img workflow with base image + ControlNet OpenPose pose conditioning
- [ ] Seed locking for reproducible outputs
- [ ] Model preset switching: "anime" vs "realistic" via checkpoint selection
- [ ] HTTP API service (Express) wrapping ComfyUI with job management
- [ ] TS service exposes: POST /train-lora, POST /generate, GET /jobs/:id, GET /health

### Out of Scope

- Game development — separate future project
- Story writing — chapters already exist and are written separately
- Print-ready formatting — digital-first (Webtoon vertical scroll only)
- Hiring/managing human artists — AI generation only
- Animation or motion manga — static panels
- SDXL/Flux locally — M1 Pro memory constraints; upgrade path documented only

## Context

The Plasma universe is a deeply developed story set in 3031 on flooded Earth and alien planet Terra. 15 chapters are written (~5000 lines), with the story ongoing. The story bible, character profiles, glossary, and lore consistency rules are all established.

**v1.0 delivered:**
- Full TypeScript pipeline: 5 CLI stages, 135 files, ~28,500 LOC
- Chapter 1: 28 art prompts, Gemini API image generation working with `--reference` image-to-image
- 5 character YAML fingerprints (Spyke, June, Draster, Hood/Morkain, Punks)
- Dialogue overlay (SVG balloons) + Webtoon strip assembler (mozjpeg 800×1280px)

**v2.0 pivot motivation:**
- Gemini has no fine-tuning → asymmetric character details (knee pads, bracers) flip sides despite explicit prompting
- Local ComfyUI + LoRA = train on Spyke_Final.png → deterministic character consistency
- Lock seed + ControlNet = reproducible pose-anchored panels
- No per-call API cost for 28 pages × multiple iterations

**Hardware:** MacBook Pro 16" 2021, M1 Pro, 16GB RAM

## Constraints

- **Local-first:** M1 Pro 16GB — default 512×512 or 512×768, batch size 1, steps 20-30
- **SD 1.5 only for training:** SDXL training not feasible locally
- **Format:** Webtoon vertical scroll — 800px wide, vertical stacking
- **Existing pipeline:** v2.0 replaces generate stage; overlay + assemble stages reused
- **Ongoing Story:** Pipeline must be reusable across all chapters

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript pipeline (not Python/Rust) | Familiarity, strong tooling, Sharp for image processing | ✓ Good — delivered in 3 days |
| Programmatic text overlay | AI-generated text is garbled/unreliable | ✓ Good — SVG balloons work well |
| Manual Gemini workflow as first-class path | De-risked API dependency for initial build | ✓ Good — both paths worked |
| Intermediate artifacts at each stage | Enables re-running any stage without losing work | ✓ Good — raw/processed/lettered/webtoon |
| Character fingerprint verbatim injection | Paraphrasing causes style drift in Gemini | ✓ Good — consistent style, not consistent geometry |
| Gemini for art generation | Pro account available, fast to start | ⚠️ Revisit — poor asymmetric detail consistency; pivoting to ComfyUI+LoRA |
| Text overlay (not baked-in) | Gemini garbles text in images | ✓ Good — confirmed correct approach |
| ComfyUI + kohya_ss for v2.0 | Local inference, LoRA fine-tuning, ControlNet, seed lock | — Pending (v2.0) |

---
*Last updated: 2026-02-19 after v1.0 milestone — pivoting to v2.0 ComfyUI+LoRA pipeline*
