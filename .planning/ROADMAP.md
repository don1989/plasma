# Roadmap: Plasma Manga Pipeline

## Milestones

- ✅ **v1.0 Gemini Pipeline MVP** — Phases 1–4 (shipped 2026-02-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Local ComfyUI + LoRA Pipeline** — Phases 5–10 (shipped 2026-02-25) — [archive](milestones/v2.0-ROADMAP.md)
- 🚧 **v3.0 Blender 3D Rendering Pipeline** — Phases 11–14 (in progress)

## Phases

<details>
<summary>✅ v1.0 Gemini Pipeline MVP (Phases 1–4) — SHIPPED 2026-02-19</summary>

- [x] Phase 1: Foundation (1/1 plans) — completed 2026-02-18
- [x] Phase 2: Scripts, Characters, and Prompts (5/5 plans) — completed 2026-02-19
- [x] Phase 3: Image Generation Workflow (3/3 plans) — completed 2026-02-19
- [x] Phase 4: Assembly and Publish (2/2 plans) — completed 2026-02-19

</details>

<details>
<summary>✅ v2.0 Local ComfyUI + LoRA Pipeline (Phases 5–10) — SHIPPED 2026-02-25</summary>

- [x] Phase 5: Environment Validation (4/4 plans) — completed 2026-02-19
- [x] Phase 6: Spyke Dataset Preparation (4/4 plans) — completed 2026-02-20
- [x] Phase 7: ComfyUI + Express Integration (3/3 plans) — completed 2026-02-19
- [x] Phase 8: Spyke LoRA Training (3/3 plans) — completed 2026-02-20
- [x] Phase 9: LoRA Integration + Reproducibility (4/4 plans) — completed 2026-02-20
- [~] Phase 10: ControlNet OpenPose — PIVOTED to v3.0 Blender milestone (context captured, no plans executed)

</details>

### 🚧 v3.0 Blender 3D Rendering Pipeline

- [ ] **Phase 11: Blender Environment Validation** — Fix Blender 5.0.1 API breaks, resolve EEVEE headless rendering on macOS, produce verified test render from blockout model
- [ ] **Phase 12: Spyke Model Refinement** — Retopologize face and body, weight paint armature deformation, add equipment detail, validate toon shader on refined mesh
- [ ] **Phase 13: Pose Library and Render Automation** — Validate existing poses on refined mesh, expand to 10+ poses, add panel-type mapping, implement CLI naming convention
- [ ] **Phase 14: TypeScript Pipeline Integration** — Connect Blender subprocess to generate stage, extend manifest, end-to-end Chapter 1 validation through overlay and assembly

## Phase Details

### Phase 11: Blender Environment Validation
**Goal**: The existing blockout model renders correctly through Blender 5.0.1 EEVEE on M1 Pro macOS, with all API fixes applied and the headless rendering question resolved
**Depends on**: Nothing (first v3.0 phase)
**Requirements**: ENV-01, ENV-02, ENV-03, ENV-04
**Success Criteria** (what must be TRUE):
  1. `build_spyke.py` runs without errors on Blender 5.0.1 and produces `3d_models/output/spyke/spyke.blend` with model, armature, shaders, cameras, and Freestyle outlines
  2. A test render at 800x1200 produces a correct RGBA PNG with toon shading (shade bands visible), Freestyle outlines (silhouette + crease lines), and transparent background
  3. EEVEE headless rendering behavior on M1 Pro macOS is documented — either `--background` works or the no-background workaround is confirmed and coded into the render scripts
  4. All Blender 5.0 API fixes are applied: engine identifier is `BLENDER_EEVEE`, ShaderNodeMix uses named socket access (`'A'`/`'B'`), deprecated shadow properties are guarded
**Plans**: TBD

### Phase 12: Spyke Model Refinement
**Goal**: Spyke's 3D model is refined from blockout to render-ready quality with proper mesh topology and armature deformation at joints
**Depends on**: Phase 11
**Requirements**: MDL-01, MDL-02, MDL-03, MDL-04, MDL-05
**Success Criteria** (what must be TRUE):
  1. Spyke's face has manga-style topology with edge loops around eyes and mouth that render cleanly at close-up framing (head fills frame)
  2. Body mesh has clean topology at shoulder, elbow, hip, and knee joints that produces correct toon shade bands without artifacts
  3. Posing the armature produces smooth joint deformation (no gaps, no rigid-block movement) at shoulder, elbow, hip, and knee
  4. Equipment details (cloak folds, sword pommel/guard, harness buckle, boot treads) are modeled at a level that holds up in close-up panels
  5. Toon shader renders correctly on the refined mesh — shade bands, rim light, and Freestyle outlines all confirmed after mesh changes
**Plans**: TBD

### Phase 13: Pose Library and Render Automation
**Goal**: A validated library of 10+ poses covers common manga panel types, with CLI arguments that produce correctly-named output files ready for TypeScript integration
**Depends on**: Phase 12
**Requirements**: POSE-01, POSE-02, POSE-03, POSE-04
**Success Criteria** (what must be TRUE):
  1. The 5 existing poses (neutral, standing, battle, iaijutsu, walking) render correctly on the refined weighted mesh with natural joint deformation and no gaps
  2. Pose library contains 10+ poses covering common manga panel types (crouching, reaction/surprise, sitting, running, sword swing, dialogue gesture added to existing 5)
  3. A TypeScript config maps shot type keywords and action descriptions to pose+camera combinations, enabling automated pose selection per panel
  4. `render_poses.py` accepts `--chapter`, `--page`, `--version` CLI args and outputs files following the `chNN_pNNN_vN.png` naming convention
**Plans**: TBD

### Phase 14: TypeScript Pipeline Integration
**Goal**: Blender renders feed into the existing TypeScript pipeline so that a single CLI command produces a Webtoon strip from Blender-rendered character panels
**Depends on**: Phase 13
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04
**Success Criteria** (what must be TRUE):
  1. `pnpm stage:generate -- --blender -c 1 --page 1` spawns Blender, selects pose+camera from panel metadata, and produces a correctly-named PNG in `output/ch-01/raw/`
  2. The generation manifest records Blender-specific fields (`source: 'blender'`, `blendFile`, `pose`, `camera`) for each Blender-generated panel
  3. End-to-end pipeline works: Blender render -> overlay stage adds dialogue -> assemble stage creates Webtoon strip, with overlay and assemble stages unchanged from v2.0
  4. Blender subprocess wrapper validates exit codes and output file existence, surfacing Blender errors as actionable TypeScript errors
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 1/1 | Complete | 2026-02-18 |
| 2. Scripts, Characters, and Prompts | v1.0 | 5/5 | Complete | 2026-02-19 |
| 3. Image Generation Workflow | v1.0 | 3/3 | Complete | 2026-02-19 |
| 4. Assembly and Publish | v1.0 | 2/2 | Complete | 2026-02-19 |
| 5. Environment Validation | v2.0 | 4/4 | Complete | 2026-02-19 |
| 6. Spyke Dataset Preparation | v2.0 | 4/4 | Complete | 2026-02-20 |
| 7. ComfyUI + Express Integration | v2.0 | 3/3 | Complete | 2026-02-19 |
| 8. Spyke LoRA Training | v2.0 | 3/3 | Complete | 2026-02-20 |
| 9. LoRA Integration + Reproducibility | v2.0 | 4/4 | Complete | 2026-02-20 |
| 10. ControlNet OpenPose | v2.0 | 0/0 | Pivoted | 2026-02-25 |
| 11. Blender Environment Validation | v3.0 | 1/? | In progress | - |
| 12. Spyke Model Refinement | v3.0 | 0/? | Not started | - |
| 13. Pose Library and Render Automation | v3.0 | 0/? | Not started | - |
| 14. TypeScript Pipeline Integration | v3.0 | 0/? | Not started | - |
