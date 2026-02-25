# Project Research Summary

**Project:** Plasma Manga Pipeline — v3.0 Blender 3D Rendering
**Domain:** Script-driven 3D manga rendering pipeline (Blender EEVEE toon shading + TypeScript automation)
**Researched:** 2026-02-25
**Confidence:** HIGH (stack and architecture verified against official Blender 5.0 docs and direct source inspection; pitfalls sourced from official bug tracker)

## Executive Summary

The v3.0 milestone replaces AI image generation (Gemini/ComfyUI) with script-driven Blender 3D rendering to solve the character consistency problem that has plagued the pipeline through v1.0 and v2.0. The approach is well-proven in professional NPR (non-photorealistic rendering) pipelines: Blender EEVEE with Shader-to-RGB toon shading plus Freestyle outlines produces clean manga aesthetics, and the existing TypeScript pipeline needs only one modified stage (`generate.ts`) plus three new modules (`blender-runner.ts`, `pose-map.ts`, `render_panel.py`). The overlay and assemble stages are entirely unchanged — they are agnostic to how the raw PNG was produced.

The recommended approach is a child-process boundary model: TypeScript spawns Blender via `child_process.execFile()`, passes pose and camera as CLI args, and polls for the output file. Blender is stateless — each invocation loads `spyke.blend` fresh, applies one pose, renders one PNG to the specified output path, and exits. This keeps both subsystems simple and testable independently, and avoids the complexity of a persistent Blender server pattern. The `spyke.blend` file is the build artifact of `build_spyke.py` and is treated as a versioned binary: regenerated rarely, rendered against repeatedly.

The dominant risk is EEVEE headless rendering on macOS. EEVEE requires a display context on macOS (Metal API limitation), which means `blender --background` mode may produce black renders or hang on M1 Pro. This must be validated in Phase 1 before any automation architecture is committed to. The secondary risk cluster is Blender 5.0 API breaks in the existing scripts (`BLENDER_EEVEE_NEXT` engine identifier, removed shadow properties, fragile socket index access) — all are low-effort targeted fixes that must land in Phase 1. The third risk is that the model is a blockout with rigid armature parenting and no weight painting, which means action poses will look incorrect until Phase 2 mesh refinement completes.

## Key Findings

### Recommended Stack

The v3.0 stack adds only two new components to an existing TypeScript pipeline: Blender 5.0.1 (already installed, `bpy` embedded Python) and a lightweight TypeScript subprocess module. No new npm packages are required. The existing Sharp + Commander + SVG overlay + Webtoon assembler remain unchanged.

Blender must be invoked without the `--background` flag on macOS because EEVEE requires a Metal display context — but on a development machine with a display always available, this is not a problem. For any future CI/headless requirements, Cycles + Toon BSDF is the escape hatch (at 10–20x render time cost). EEVEE on M1 Pro renders a toon-shaded 800×1200 panel in approximately 3–15 seconds, giving acceptable batch throughput for 28 panels per chapter (~5–10 minutes total).

**Core technologies:**
- Blender 5.0.1 + `bpy` (embedded Python 3.11): scene scripting, posing, rendering — the only API for Blender automation; no alternative
- EEVEE render engine: toon cel-shading via Shader-to-RGB node (EEVEE-exclusive); use `'BLENDER_EEVEE'` identifier in Blender 5.0+
- Freestyle outline system: post-process silhouette/crease line rendering; stable API in 5.0, already configured in `render_setup.py`
- Node.js `child_process.execFile()`: TypeScript to Blender subprocess bridge; no npm package needed
- Sharp (existing): alpha compositing of transparent Blender PNGs over backgrounds; handles RGBA correctly

**Critical version note:** Blender 5.0 changed the EEVEE engine identifier from `BLENDER_EEVEE_NEXT` back to `BLENDER_EEVEE`. The existing `manga_shader.py` has a version check that is now backwards for 5.0 — this is a one-line fix required before any render output can be trusted.

### Expected Features

The feature set divides cleanly into three tiers by when each must be done for Chapter 1 end-to-end validation. The P1 tier is entirely about making the existing blockout render correctly; P2 is about polish and automation quality; P3 is future-milestone work.

**Must have (P1 — Chapter 1 gate):**
- Face retopology — UV sphere head cannot render convincing manga character at close-up scale
- Weight painting for critical joints (shoulder, elbow, hip, knee) — enables non-rigid pose deformation
- Verified toon shader output at 800px — Shader-to-RGB ColorRamp tuned, shade bands confirmed
- Freestyle outlines verified — 2px weight, correct crease angle, no interior geometry lines
- Standing + 2 action poses validated post-weight-paint (standing_relaxed, battle_ready, drawing_katana)
- Pipeline naming convention (`--chapter`, `--page`, `--version` CLI args added to `render_poses.py`)
- TypeScript subprocess integration (`generate --blender` mode, Blender spawned, manifest written)
- Transparent background compositing end-to-end — Blender RGBA PNG through overlay through assemble confirmed

**Should have (P2 — add after first successful Chapter 1 render):**
- Extended pose library (5+ additional poses — cheap once weight painting is solid)
- Panel-type to pose mapping table in TypeScript config (eliminates per-panel manual pose selection)
- One 3D establishing shot environment (dojo interior or flooded street for Chapter 1 opening panels)
- Equipment detail pass (cloak folds, sword pommel — affects close-up panels only)
- `.blend` file versioning (lock model version per chapter to prevent retroactive render changes)

**Defer (P3 — future milestones):**
- BVH motion capture retargeting (Mixamo/CMU mocap import to Spyke rig)
- Grease Pencil Line Art modifier (replace Freestyle with higher-control outline system)
- Custom normals for toon shading (Geometry Nodes smooth-normal technique from Blender Studio)
- Additional character models (June, Draster — one character at a time)

**Anti-features to explicitly avoid:** IK rigging (not deterministically scriptable), manual Blender UI workflow per panel (destroys automation), Cycles engine for character rendering (breaks Shader-to-RGB toon system), multiple characters per `.blend` file (memory and complexity problems on M1 Pro 16GB).

### Architecture Approach

The integration adds a single new directory (`pipeline/src/blender/`) with three files, modifies three existing files additively, and creates one new Blender Python script (`render_panel.py`). The critical insight is that `overlay.ts` and `assemble.ts` need zero changes: they read the manifest for `imageFile` and `approved` only, and do not inspect `source`. Blender renders land at `output/ch-NN/raw/chNN_pNNN_vN.png` — identical path and naming convention as Gemini/ComfyUI renders.

**Major components:**
1. `render_panel.py` (Blender Python) — single-panel renderer: receives `--pose`, `--camera`, `--output` as CLI args; applies pose to `Spyke_Armature`, sets camera, renders one 800×1200 RGBA PNG and exits; imports `POSES` and `apply_pose()` from existing `render_poses.py`
2. `blender-runner.ts` (TypeScript) — subprocess wrapper: spawns Blender via `child_process.execFile()` with 120s timeout; verifies output file exists after exit; surfaces Blender errors as thrown Error
3. `pose-map.ts` (TypeScript) — translation layer: maps `Panel.shotType` + `Panel.action` (keyword match) to `{pose, camera}` tuple; is the only coupling point between TypeScript and Python pose names
4. `generate.ts` (modified, additive) — new `mode === 'blender'` branch that reads `script.json`, calls pose-map and runner per panel, writes manifest entries with `source: 'blender'`

**Key patterns:**
- Child-process boundary: communication is CLI args in, filesystem out; no stdout parsing for results
- Blender as stateless renderer: `.blend` loaded fresh per invocation, never mutated by pipeline
- Pose map as code (TypeScript), not config file: type-safe, testable, co-located with changes

### Critical Pitfalls

1. **EEVEE headless rendering fails on macOS** — EEVEE requires a Metal display context; `blender --background` on M1 Pro produces black renders or hangs. Prevention: drop `--background` flag for local dev (display always present). Blender window flashes open briefly then exits — acceptable for local automation. For true headless, switch to Cycles (breaks Shader-to-RGB toon system, requires shader rewrite, 10–20x slower). Must validate in Phase 1 before committing to automation architecture.

2. **`BLENDER_EEVEE_NEXT` engine identifier invalid in Blender 5.0** — `manga_shader.py` version check `bpy.app.version >= (4, 0, 0)` is now backwards: on 5.0.1 it sets `BLENDER_EEVEE_NEXT` which no longer exists; engine silently falls back to wrong renderer. Fix: use `scene.render.engine = 'BLENDER_EEVEE'` unconditionally for this project (5.0+ only). One-line fix, Phase 1.

3. **EEVEE-Next toon shadow stippling** — EEVEE Next (4.2+, including 5.0) ray-traced shadow system produces sub-pixel noise at shadow edges that the toon ColorRamp CONSTANT interpolation amplifies into visible stippled artifacts. Not a bug Blender will fix. Prevention: disable cast shadows per-light and rely on self-shadowing through Shader-to-RGB; or set `shadow_maximum_resolution = 0.001` on each light. Test at 800px actual render resolution before finalizing lighting setup.

4. **Rigid armature parenting produces no joint deformation** — `generate_spyke.py` uses `obj.parent = armature` (object parent), not Armature Deform with vertex groups. Posing the rig moves discrete mesh objects as rigid units; wide action poses show gaps at joints. Acceptable for blockout reference renders. Must add Armature modifier + weight painting before production action panels.

5. **ShaderNodeMix socket index access is fragile** — `manga_shader.py` accesses `mix.inputs[6]` and `mix.inputs[7]` by integer index. Socket layout is version-sensitive. Fix: use `mix.inputs['A']` and `mix.inputs['B']` (named access is stable). Silent wrong-connection failure with no Python error. Phase 1 audit required.

## Implications for Roadmap

Based on combined research, the dependency structure is clear: shader and render-environment correctness must precede model refinement, which must precede production posing, which must precede pipeline integration. This maps to four focused phases with a fifth for post-Chapter-1 polish.

### Phase 1: Blender Environment Validation and Shader Fixes

**Rationale:** All five critical pitfalls either fully manifest or must be discovered in this phase. EEVEE headless behavior on macOS is the highest-risk unknown — if `--background` silently fails, the entire integration architecture must pivot. The API fixes (`BLENDER_EEVEE`, socket names, shadow properties) are low-effort but must be done before any render output is trusted as ground truth. This phase has no dependency on mesh refinement — it validates the render environment with the existing blockout.

**Delivers:** A verified render of the current blockout at 800×1200 RGBA with correct toon shading, Freestyle outlines, and correct EEVEE engine setup. Confirms headless or near-headless rendering works on M1 Pro. All Blender 5.0 API fixes applied to `manga_shader.py` and `render_setup.py`.

**Addresses features:** Transparent background PNG output, verified toon shader, Freestyle outlines verified, consistent camera framing.

**Avoids pitfalls:** EEVEE headless on macOS (discovery), engine identifier bug, ShaderNodeMix index access, EEVEE shadow property removal, toon shadow stippling.

### Phase 2: Model Refinement (Retopology and Weight Painting)

**Rationale:** The blockout produced by `generate_spyke.py` uses primitive meshes with rigid armature parenting. This is adequate for standing poses at medium-wide framing but fails for action poses and close-up face panels. This phase is the highest-cost human-art phase — retopology and weight painting cannot be automated and require 3–7 days of skilled Blender work. It is sequenced after Phase 1 because shader validation must be confirmed on the existing mesh before committing to a new one.

**Delivers:** A render-ready Spyke model with manga-appropriate face topology (eye/mouth edge loops), joint deformation via weight painting (shoulder, elbow, hip, knee minimum), confirmed shade band quality on the refined mesh.

**Addresses features:** Face retopology (P1), weight painting for critical joints (P1), standing + action poses validated (P1).

**Avoids pitfalls:** Armature parenting produces no deformation (addressed by adding Armature modifier + vertex weights), auto-retopology shortcut (avoid Remesh modifier for deformation areas).

### Phase 3: Pose Library and Pipeline Naming

**Rationale:** With a render-correct model in hand, the pose library can be validated and extended cheaply. Each pose is a Python dict of bone rotations — 30–60 minutes of work per pose once weight painting is complete. The pipeline naming convention is a required prerequisite for TypeScript integration in Phase 4. This phase has no user-visible output but establishes all content that Phase 4 automation depends on.

**Delivers:** Validated standing + 2 action poses producing correct renders. Pipeline naming convention (`--chapter`, `--page`, `--version` args) added to `render_poses.py`. 3–5 additional poses added (walking, crouching, reaction). Pose reset verified.

**Addresses features:** Standing/idle pose, action/combat poses, per-panel pose selection via script (prerequisite), pipeline naming convention (P1).

**Avoids pitfalls:** Pose library broken (each pose must produce a visually different result), camera naming stability across `.blend` save/reload cycles.

### Phase 4: TypeScript Pipeline Integration

**Rationale:** This is the integration phase connecting the validated Blender rendering system to the existing TypeScript pipeline. It is sequenced last because it depends on Phase 1 (render environment confirmed), Phase 3 (pose names finalized and CLI args in place). The three new modules and `render_panel.py` are fully specified in ARCHITECTURE.md — this is execution against a complete spec.

**Delivers:** `pnpm stage:generate -- --blender -c 1 --page 3` produces a correctly-named PNG in `output/ch-01/raw/` and a manifest entry with `source: 'blender'`. End-to-end: Blender render through approval through overlay through assemble through Webtoon strip confirmed working.

**Addresses features:** TypeScript subprocess integration (P1), render output naming convention (P1), generation log manifest entry (P1), transparent background compositing end-to-end (P1).

**Avoids pitfalls:** Blender stdout parsing for results (use output file existence check only), persistent Blender process session (one `execFile` per panel), hard-coded pose names in generate.ts (all names go through `pose-map.ts`), Sharp alpha compositing (EEVEE outputs straight non-premultiplied alpha — handle correctly in Sharp composite call).

### Phase 5: P2 Polish (Post-Chapter 1 Validation)

**Rationale:** Once Chapter 1 produces an end-to-end Webtoon strip via Blender rendering, the remaining P2 features improve quality and automation without blocking the core workflow. Sequence these after the first successful chapter to avoid premature optimization.

**Delivers:** Extended pose library (5+ additional poses), panel-type to pose mapping TypeScript config, one 3D establishing shot environment, equipment detail pass on model, `.blend` file versioning.

**Addresses features:** All P2 features from FEATURES.md prioritization matrix.

### Phase Ordering Rationale

- Phase 1 before Phase 2: A working render environment is needed to validate that model changes produce correct output. Discovering EEVEE headless failure during mesh refinement would be expensive.
- Phase 2 before Phase 3: Poses cannot be validated until the mesh deforms correctly at joints. Validating poses on a blockout with rigid parenting gives false confidence.
- Phase 3 before Phase 4: TypeScript integration depends on stable pose names and CLI args. Finalizing the Python API in Phase 3 prevents churn in the TypeScript layer.
- Phase 4 delivers the P1 acceptance criteria: end-to-end Blender render through Webtoon assembly.
- Phase 5 is additive polish that does not block Chapter 1 release.

### Research Flags

Phases with prescribed fixes and no further research needed:
- **Phase 1:** All pitfalls are identified and fixes are specified. Execution only.
- **Phase 2:** Retopology and weight painting are human art tasks, not research tasks.
- **Phase 3:** Pose authoring is craft work. No unknowns.
- **Phase 4:** Full TypeScript architecture with code samples is in ARCHITECTURE.md. No ambiguity.

Phase that may benefit from a brief research spike:
- **Phase 5 (establishing shots):** The character-plus-environment compositing workflow (separate `.blend` files rendered independently then composited in Sharp) has not been fully validated. A one-session spike on Sharp layer compositing and Blender environment camera alignment would reduce risk before committing the environment modeling effort.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All claims verified against official Blender 5.0 release notes and API docs. No speculation. Blender 5.0.1 confirmed installed. |
| Features | HIGH for API; MEDIUM for mesh workflow | Blender API features are verified. Retopology and weight painting timelines (3–7 days) are community estimates with real variance depending on skill level. |
| Architecture | HIGH | Based on direct source inspection of all existing TypeScript and Python scripts. Data flow and integration points are unambiguous. |
| Pitfalls | HIGH for API bugs; MEDIUM for EEVEE/macOS behavior | API-level pitfalls sourced from official release notes and bug tracker. EEVEE headless on macOS may have partial fixes in 5.0.1 that research could not confirm — treat as HIGH risk until validated in Phase 1. |

**Overall confidence:** HIGH

### Gaps to Address

- **EEVEE headless on macOS 15 + Blender 5.0.1 exact behavior:** Bug #132664 (open as of early 2026) covers M1 crash/shadow buffer issues on macOS 15. Phase 1's first task should be a minimal render test to determine whether `--background` works, produces black output, or crashes. Recovery paths are defined — just need to know which applies before building automation.

- **Weight painting time estimate uncertainty:** 3–7 days is a wide range. Phase 2 should include a one-day timeboxed weight painting spike on the shoulder joint only before committing to the full scope estimate.

- **`--background` vs. no-`--background` reconciliation:** ARCHITECTURE.md uses `--background` in the Blender runner args; PITFALLS.md says this may fail on macOS. These must be reconciled at Phase 1 — if `--background` fails, `blender-runner.ts` must be updated to launch without it before Phase 4 integration.

## Sources

### Primary (HIGH confidence)
- [Blender 5.0 Python API Release Notes](https://developer.blender.org/docs/release_notes/5.0/python_api/) — engine identifier changes, removed shadow properties, legacy action API removal
- [Blender 5.0 EEVEE Limitations](https://docs.blender.org/manual/en/latest/render/eevee/limitations/limitations.html) — headless rendering not supported on macOS/Windows
- [ShaderNodeMix bpy API docs](https://docs.blender.org/api/current/bpy.types.ShaderNodeMix.html) — named socket access `'A'`/`'B'` for RGBA data type
- [Blender 5.0 Freestyle documentation](https://docs.blender.org/manual/en/latest/render/freestyle/index.html) — Freestyle stability confirmed
- [Blender 5.0 Shader to RGB node](https://docs.blender.org/manual/en/latest/render/shader_nodes/color/shader_to_rgb.html) — EEVEE-exclusive confirmed
- [SceneEEVEE bpy API docs](https://docs.blender.org/api/current/bpy.types.SceneEEVEE.html) — `taa_render_samples` confirmed in 5.0
- Direct source inspection: all existing `pipeline/src/` TypeScript and `3d_models/` Python scripts

### Secondary (MEDIUM confidence)
- [Bug #127033](https://projects.blender.org/blender/blender/issues/127033) — EEVEE under Apple Silicon renders Blender unresponsive during headless render
- [Bug #132664](https://projects.blender.org/blender/blender/issues/132664) — M1 crash/shadow buffer issues on macOS 15, open as of early 2026
- [EEVEE Next toon shader stippling thread](https://blenderartists.org/t/did-eevee-next-break-everyone-elses-toon-shaders/1539334) — shadow PCF artifacts confirmed, acknowledged by devs as deliberate trade-off
- [Blender NPR Project announcement](https://code.blender.org/2025/05/npr-project/) — NPR improvements post-5.0, not yet available in 5.0.1
- [Anime face topology conventions](https://animecglab.com/en/4-categories-of-anime-3d-model/) — retopology workflow guidance
- [Blender Studio custom normals](https://studio.blender.org/blog/cartoon-character-shading-with-geometry-nodes/) — Geometry Nodes toon shading technique (P3 future feature)

### Tertiary (LOW confidence)
- Retopology time estimates (3–7 days): community consensus from multiple forum threads — individual variance is high; treat as rough planning guidance only

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
