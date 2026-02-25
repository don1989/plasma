# Plasma Manga Pipeline

## What This Is

A production pipeline that converts Plasma story chapters into Webtoon-style digital manga, end to end. v1.0 delivered Gemini-based AI generation with programmatic text overlay. v2.0 added local ComfyUI + LoRA inference for character consistency. The project is now pivoting to Blender 3D rendering (v3.0) for deterministic character consistency — a 3D model IS the character, same face and proportions every time.

## Core Value

A repeatable system that transforms any Plasma story chapter into publish-ready Webtoon manga pages with consistent character visuals across panels.

## Current Milestone: v3.0 Blender 3D Rendering Pipeline

**Goal:** Replace AI image generation with Blender 3D rendering for characters and backgrounds. Spyke's 3D model (blockout scripts from v2.0 Phase 9) is built, refined, and rendered through a fully automated script-driven pipeline that feeds into the existing TypeScript post-processing stages.

**Target features:**
- Spyke 3D model: built from existing scripts, refined to render-ready quality
- Script-driven posing: pose library defined in code, automated rendering
- Mixed backgrounds: full 3D for establishing shots, stylized for action/dialogue
- Integration: Blender renders → existing TypeScript pipeline (overlay + assembly)
- Blender 5.0.1 on M1 Pro with EEVEE toon shading

## Current State (v2.0 Shipped)

- **Pipeline:** TypeScript, ~6,600 LOC (pipeline/src), 224 tracked files
- **3D Models:** Python, ~1,900 LOC (3d_models/), blockout scripts ready but not yet run
- **Stack:** Node.js + Commander CLI, Sharp, Express + ComfyUI integration, Blender Python API
- **Chapter 1:** 28 prompts, ComfyUI generation working with LoRA, overlay + assembly working
- **Character system:** 5 YAML fingerprints + Spyke LoRA (v3, 0.8 strength) + 3D blockout scripts
- **Infrastructure:** ComfyUI at ~/tools/ComfyUI (MPS, 15s/image), kohya_ss at ~/tools/kohya_ss
- **Known limitation:** AI generation (even with LoRA) still has inconsistency issues — motivating Blender pivot

## Requirements

### Validated (v1.0)

- ✓ Panel-by-panel manga scripts generated from story chapters — v1.0
- ✓ Gemini-optimized art prompts generated from scripts (per panel/page) — v1.0
- ✓ Character visual fingerprint system with verbatim prompt injection — v1.0
- ✓ Art images generated via Gemini (manual copy-paste + API workflows) — v1.0
- ✓ Dialogue and SFX integrated via programmatic overlay (SVG balloons) — v1.0
- ✓ Vertical-scroll Webtoon assembly from individual panels — v1.0
- ✓ Pipeline handles new chapters as story continues — v1.0

### Validated (v2.0)

- ✓ Local image generation via ComfyUI (Metal/MPS on M1 Pro) — v2.0
- ✓ HTTP API service (Express) wrapping ComfyUI with job management — v2.0
- ✓ Seed locking for reproducible outputs — v2.0
- ✓ 3D character blockout model scripts (Spyke) with toon shaders — v2.0

### Active (v3.0)

- [ ] Spyke 3D model built and refined to render-ready quality
- [ ] Script-driven pose library for automated panel rendering
- [ ] Blender → TypeScript pipeline integration (renders feed into overlay/assembly)
- [ ] Mixed background approach (3D establishing shots + stylized action/dialogue backgrounds)
- [ ] End-to-end: Blender render → overlay → Webtoon assembly for Chapter 1 panels

### Out of Scope

- Game development — separate future project
- Story writing — chapters already exist and are written separately
- Print-ready formatting — digital-first (Webtoon vertical scroll only)
- Animation or motion manga — static panels
- Multiple character 3D models — Spyke only for v3.0 (prove pipeline first)
- Manual Blender posing workflow — script-driven automation only
- SDXL/Flux locally — M1 Pro memory constraints

## Context

The Plasma universe is a deeply developed story set in 3031 on flooded Earth and alien planet Terra. 15 chapters are written (~5000 lines), with the story ongoing.

**v1.0 delivered:** Full TypeScript pipeline (5 CLI stages, Gemini generation, overlay, assembly)
**v2.0 delivered:** Local ComfyUI + LoRA inference, Express API service, Spyke LoRA trained, 3D model scripts bootstrapped
**v3.0 pivot motivation:** Even with LoRA fine-tuning, AI generation cannot maintain perfect character consistency (asymmetric costume details). A 3D model renders identically every time — same face, proportions, and outfit.

**Hardware:** MacBook Pro 16" 2021, M1 Pro, 16GB RAM, Blender 5.0.1

## Constraints

- **Local-first:** M1 Pro 16GB
- **Blender 5.0.1:** EEVEE rendering required for toon shading (Shader to RGB)
- **Format:** Webtoon vertical scroll — 800px wide, vertical stacking
- **Existing pipeline:** v3.0 replaces generate stage with Blender renders; overlay + assemble stages reused
- **Spyke only:** Prove pipeline with one character before adding more

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript pipeline (not Python/Rust) | Familiarity, strong tooling, Sharp for image processing | ✓ Good — delivered in 3 days |
| Programmatic text overlay | AI-generated text is garbled/unreliable | ✓ Good — SVG balloons work well |
| Intermediate artifacts at each stage | Enables re-running any stage without losing work | ✓ Good — raw/processed/lettered/webtoon |
| Character fingerprint verbatim injection | Paraphrasing causes style drift in Gemini | ✓ Good — consistent style, not consistent geometry |
| ComfyUI + kohya_ss for v2.0 | Local inference, LoRA fine-tuning, seed lock | ⚠️ Revisit — LoRA helps but doesn't solve asymmetric detail consistency |
| Blender 3D for v3.0 | 3D model IS the character — deterministic consistency | — Pending (v3.0) |
| Script-driven posing (not manual) | Fully automated rendering, no Blender UI interaction per panel | — Pending (v3.0) |
| Mixed backgrounds (3D + stylized) | Balance effort vs impact — full 3D for key shots only | — Pending (v3.0) |
| EEVEE + Freestyle outlines | Toon shading + manga outlines native in Blender | — Pending (v3.0) |

---
*Last updated: 2026-02-25 after v2.0 milestone — pivoting to v3.0 Blender 3D rendering pipeline*
