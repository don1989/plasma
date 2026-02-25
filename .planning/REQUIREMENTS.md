# Requirements: Plasma Manga Pipeline v3.0

**Defined:** 2026-02-25
**Core Value:** A repeatable system that transforms any Plasma story chapter into publish-ready Webtoon manga pages with consistent character visuals across panels.

## v3.0 Requirements

Requirements for the Blender 3D rendering pipeline milestone. Each maps to roadmap phases.

### ENV — Environment Validation

- [ ] **ENV-01**: Blender 5.0.1 API fixes applied — engine identifier corrected to `BLENDER_EEVEE`, `ShaderNodeMix` socket access changed to named (`'A'`/`'B'`), deprecated shadow properties guarded
- [ ] **ENV-02**: EEVEE headless rendering validated on M1 Pro macOS — confirmed whether `--background` produces correct output or requires workaround (no `--background` flag)
- [ ] **ENV-03**: `build_spyke.py` runs successfully on Blender 5.0.1 and produces `3d_models/output/spyke/spyke.blend` with blockout model, armature, toon shaders, cameras, and Freestyle outlines
- [ ] **ENV-04**: A test render of the blockout at 800×1200 produces a correct RGBA PNG with toon shading, Freestyle outlines, and transparent background

### MDL — Model Refinement

- [ ] **MDL-01**: Spyke face retopology — manga-style face with edge loops around eyes and mouth that support close-up rendering and expression (replacing UV sphere blockout head)
- [ ] **MDL-02**: Body mesh retopology — clean topology at joints (shoulder, elbow, hip, knee) that produces correct shade bands under toon shader
- [ ] **MDL-03**: Weight painting for armature deformation — vertex groups assigned to bones at shoulder, elbow, hip, and knee joints minimum, enabling non-rigid pose deformation
- [ ] **MDL-04**: Equipment detail pass — cloak folds, sword pommel/guard, harness buckle detail, boot treads. Improves close-up panel quality
- [ ] **MDL-05**: Toon shader validated on refined mesh — shade bands, rim light, and Freestyle outlines confirmed correct after mesh changes

### POSE — Pose Library

- [ ] **POSE-01**: Existing 5 poses (neutral, standing, battle, iaijutsu, walking) validated on refined weighted mesh — no joint gaps, natural deformation
- [ ] **POSE-02**: Pose library expanded to 10+ poses covering common manga panel types — crouching, reaction/surprise, sitting, running, sword swing, dialogue gesture
- [ ] **POSE-03**: Panel-type to pose mapping — TypeScript config that maps shot type keywords and action descriptions to pose+camera combinations
- [ ] **POSE-04**: Pipeline naming convention — `render_poses.py` accepts `--chapter`, `--page`, `--version` CLI args and outputs files as `chNN_pNNN_vN.png`

### INTG — Pipeline Integration

- [ ] **INTG-01**: `generate.ts` gains a `--blender` mode branch that spawns Blender subprocess, selects pose+camera based on panel metadata, and produces correctly-named PNG in `output/ch-XX/raw/`
- [ ] **INTG-02**: Blender subprocess wrapper (`blender-runner.ts`) spawns Blender via `child_process.execFile()`, passes pose/camera/output as CLI args, validates exit code and output file existence
- [ ] **INTG-03**: Generation manifest extended with Blender-specific fields — `source: 'blender'`, `blendFile`, `pose`, `camera` recorded per generation entry
- [ ] **INTG-04**: End-to-end validation — `pnpm stage:generate -- --blender -c 1 --page 1` produces PNG, overlay stage adds dialogue, assemble stage creates Webtoon strip. All stages work unchanged on Blender output.

## Future Requirements

### Backgrounds

- **BG-01**: One 3D establishing shot environment (dojo or flooded street) for Chapter 1 opener
- **BG-02**: Sharp-based background compositing — Blender character RGBA PNG composited over 3D or stylized backgrounds

### Additional Characters

- **CHAR-01**: June 3D model (requires canonical reference art creation first)
- **CHAR-02**: Draster 3D model (requires canonical reference art creation first)

### Advanced Features

- **ADV-01**: BVH motion capture retargeting (Mixamo/CMU mocap → Spyke rig)
- **ADV-02**: Grease Pencil Line Art modifier (replace Freestyle with higher-control outlines)
- **ADV-03**: Custom normals for toon shading (Geometry Nodes technique)
- **ADV-04**: `.blend` file versioning (lock model version per chapter)

## Out of Scope

| Feature | Reason |
|---------|--------|
| IK rigging | Not deterministically scriptable — violates automation goal |
| Manual Blender UI workflow per panel | Destroys automation; script-driven only |
| Cycles engine for character rendering | Breaks Shader-to-RGB toon system (EEVEE-only) |
| Multiple characters per .blend file | Memory and complexity problems on M1 Pro 16GB |
| SDXL/Flux image generation | Superseded by Blender 3D approach |
| Facial expressions/animation | Static poses only for v3.0 |
| Cloth simulation | Too complex for v3.0; static cloak sculpting instead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | TBD | Pending |
| ENV-02 | TBD | Pending |
| ENV-03 | TBD | Pending |
| ENV-04 | TBD | Pending |
| MDL-01 | TBD | Pending |
| MDL-02 | TBD | Pending |
| MDL-03 | TBD | Pending |
| MDL-04 | TBD | Pending |
| MDL-05 | TBD | Pending |
| POSE-01 | TBD | Pending |
| POSE-02 | TBD | Pending |
| POSE-03 | TBD | Pending |
| POSE-04 | TBD | Pending |
| INTG-01 | TBD | Pending |
| INTG-02 | TBD | Pending |
| INTG-03 | TBD | Pending |
| INTG-04 | TBD | Pending |

**Coverage:**
- v3.0 requirements: 17 total
- Mapped to phases: 0
- Unmapped: 17 (pending roadmap creation)

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after initial definition*
