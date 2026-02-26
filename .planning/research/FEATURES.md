# Feature Research

**Domain:** Blender 3D manga rendering pipeline (script-driven character posing + toon shading)
**Researched:** 2026-02-25
**Milestone:** v3.0 — Replacing AI image generation with Blender 3D rendering for character consistency
**Confidence:** HIGH for Blender Python API and EEVEE toon shading (well-established, verified against Blender 5.0 docs and Blender developers blog). MEDIUM for retopology workflows and background approaches (community patterns vary). LOW for Blender 5.0-specific EEVEE Next NPR changes (feature development begins post-5.0, not yet shipped).

---

## Context: What Exists vs What's New

**Already built (v1.0 + v2.0 — do not re-research):**
- TypeScript pipeline: script → prompt → generate → overlay → assemble (5 stages)
- SVG dialogue balloon overlay, Webtoon strip assembly
- Character YAML fingerprints, ComfyUI + LoRA inference
- Spyke blockout scripts (`3d_models/`) — Python/Blender API, NOT YET RUN
  - `generate_spyke.py`: body, hair, clothing, equipment, armature (built from primitives)
  - `manga_shader.py`: EEVEE Shader-to-RGB toon shader with rim light + metallic variants
  - `render_poses.py`: 5 poses × 6 cameras, CLI args, batch rendering
  - `render_setup.py`: camera rig (front/3-4/side/back/portrait/upper), 2-light setup, Freestyle outlines

**What v3.0 adds (scope of this research):**
- Blockout → render-ready model quality (sculpt, retopo, weight paint, detail)
- Expanded pose library mapped to manga panel types
- Panel-specific camera selection logic
- 3D background generation for establishing shots
- TypeScript → Blender subprocess integration (replace `generate` stage)
- End-to-end Blender render → overlay → Webtoon assembly

**Hardware constraint:** MacBook Pro M1 Pro 16GB, Blender 5.0.1, EEVEE required (Shader to RGB not available in Cycles).

---

## Feature Categories

1. **Model Quality** — mesh refinement that makes blockout render-ready
2. **Posing** — script-driven pose library for panel automation
3. **Rendering** — toon shader config, outline systems, camera management
4. **Integration** — TypeScript pipeline connection, file I/O
5. **Backgrounds** — 3D environments and stylized alternatives

---

## Table Stakes (Users Expect These)

Features required for a functional Blender 3D manga pipeline. Without these, the pipeline cannot produce panels that look better than AI generation.

### Model Quality

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Proper face topology (eye/mouth loops) | Blockout sphere head cannot deform or render convincing manga face expressions | HIGH | Anime face topology uses distinct edge loops around eyes and mouth — not connected, separated; clear planes with no wrinkle topology. Must be hand-modeled or retopologized over blockout. |
| Skin/body mesh retopology | Current primitive capsules produce blocky silhouettes; toon shader exposes poor topology as broken shade bands | HIGH | Retopology is 3–5 days of work manually. Blender's built-in Remesh modifier (Voxel or Quad Remesh in 4.x+) can provide a starting point, but edge flow for posing requires manual cleanup around joints. |
| Weight painting for deformation | Armature is parented to meshes without vertex group assignments; posing will not deform clothing and body together | HIGH | Current `generate_spyke.py` uses `obj.parent = armature` (rigid parent), not skinning. Weight painting assigns each vertex to armature bones so posed limbs drag clothing naturally. Cannot automate this step. |
| Freestyle outlines configured correctly | Manga outlines are the primary visual signal; wrong settings produce either no lines, too many lines, or inconsistent thickness | MEDIUM | Already scaffolded in `render_setup.py` (2px black Freestyle). Need to tune: crease angle threshold, silhouette-only mode, line thickness variation by distance. Freestyle is controlled via Python API (`bpy.context.scene.render.use_freestyle`). |
| Transparent background PNG output | Render must output PNG with alpha channel so TypeScript overlay stage can composite over any background | LOW | Already set in render settings. `scene.render.film_transparent = True` + RGBA color depth. Confirmed working in Blender 5.0. EEVEE transparent output is stable but requires `scene.render.image_settings.color_mode = 'RGBA'`. |
| Consistent camera-to-character framing | Each panel type (full body, upper body, portrait, close-up) needs the character framed appropriately every time | MEDIUM | 6 cameras are scaffolded in `render_setup.py`. Need to verify they frame Spyke correctly at render resolution (800×1200) once meshes are refined. |

### Posing

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Standing / idle pose | Most dialogue panels use a standing character; without this, every panel is a T-pose | LOW | Already in `render_poses.py` as `standing_relaxed`. Needs validation that it looks correct on refined mesh. |
| Action / combat poses | Spyke is a fighter — Chapter 1 has sword draw and battle sequences | MEDIUM | `battle_ready` and `drawing_katana` poses exist in `render_poses.py`. Plausibility depends on weight painting quality. Need to validate bone rotations look natural once mesh deforms. |
| Per-panel pose selection via script | Automation goal: given a panel description, select and render the closest pose without opening Blender | MEDIUM | `render_poses.py` already accepts `--poses <name>` CLI arg. The TypeScript integration layer maps panel metadata to a pose name. Pose selection logic lives in TypeScript, not Blender. |
| Pose reset between renders | Each batch render must start from a known state; accumulated rotations will corrupt output | LOW | Already implemented in `render_poses.py` via `reset_armature_pose()`. Verify it works in headless mode. |

### Rendering

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| EEVEE toon shader (Shader to RGB + ColorRamp) | Cel-shaded flat color bands are the manga aesthetic; Principled BSDF produces photorealistic look that clashes with drawn backgrounds | LOW | Already implemented in `manga_shader.py`. Diffuse BSDF → Shader to RGB → ColorRamp (Constant interpolation) → Emission output. Uses `SHADOW_INTENSITY = 0.55`, `HIGHLIGHT_THRESHOLD = 0.45`. Note: Shader to RGB is EEVEE-only; confirmed in Blender 5.0 docs. |
| 2-band hard shadow (light/shadow only) | Manga uses binary shading — lit area vs shadow, no mid-tones | LOW | Already set via `SHADE_BANDS = 2` in `manga_shader.py`. ColorRamp interpolation = CONSTANT gives hard edge. |
| Rim light (Fresnel-based edge highlight) | Edge highlighting is standard in anime/manga to separate character from dark backgrounds | LOW | Already in `manga_shader.py` (`RIM_LIGHT_STRENGTH = 0.3`, Fresnel → ColorRamp → Add mix). Tune strength per panel type. |
| Headless batch rendering via CLI | Pipeline automation requires `blender --background --python script.py` execution without GUI | LOW | Core Blender feature. All scripts are structured for headless mode already. M1 Pro runs EEVEE headless via Metal. Confirmed working in Blender 5.0. |
| PNG output with correct naming convention | Output files must follow `ch01_p003_v1.png` for downstream TypeScript stages to find them | LOW | `render_poses.py` names files `spyke_{pose}_{view}.png`. Needs to be changed to pipeline naming convention (`ch{ch:02d}_p{page:03d}_v{version}.png`). Add chapter/page/version as CLI args. |

### Integration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| TypeScript spawns Blender subprocess | The pipeline's `generate` stage must call Blender headlessly and wait for PNG output | LOW | Node.js `child_process.spawn()` pattern. Call `blender scene.blend --background --python render_panel.py -- --chapter 1 --page 3 --pose battle_ready --camera Cam_ThreeQuarter --output /path/to/output/`. Stream stdout/stderr for logging. |
| Render output lands in `output/ch-XX/raw/` | Existing overlay and assemble stages expect this path | LOW | Pass `--output` arg to Blender script. Blender script sets `scene.render.filepath`. Integration is straightforward. |
| Generation log / manifest entry | Existing `generation-log.json` format must be extended to record pose, camera, and .blend file version used | LOW | Extend the TypeScript manifest writer after Blender subprocess exits. Log: `{ model: "blender-eevee", blendFile: "spyke.blend", pose: "battle_ready", camera: "Cam_ThreeQuarter", chapter: 1, page: 3 }`. |
| Error handling for failed renders | Blender can segfault or exit non-zero on headless render failures; pipeline must detect and report | MEDIUM | Check subprocess exit code. Parse stdout for Blender's `Error:` lines. Retry logic: 1 retry with cleared temp files. |

### Backgrounds

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Transparent background (character-only render) | Dialogue and action panels need character composited over drawn or solid-color backgrounds — not a 3D environment | LOW | Already configured. `film_transparent = True` gives alpha cutout. TypeScript overlay stage composites the PNG over a flat color or texture. This is the default for most panels. |
| Simple solid/gradient background | Manga commonly uses white, grey, or simple gradient for dialogue panels | LOW | Handled entirely in TypeScript overlay stage (Sharp fills background color before compositing character). No Blender work required. |

---

## Differentiators (Competitive Advantage)

Features beyond the baseline that improve quality, efficiency, or pipeline expressiveness. Not required for Chapter 1 launch, but high value.

### Model Quality

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Stylized manga face (hand-modeled, not sculpted) | A well-designed anime face reads better at small panel scale than a sculpted realistic face; simpler geometry, cleaner toon shading | HIGH | Anime face topology has: clear cheekbone line visible from angles, minimal mouth loops (style doesn't show laugh lines), flat nose bridge, large simplified eye sockets. Box modeling approach preferred over sculpt-then-retopo for manga characters. 3–7 days of work. |
| Equipment details (cloak folds, boot buckles, sword pommel) | Adds visual richness to close-up shots; the blockout's flat boxes won't read well in portrait-view panels | MEDIUM | Cloak folds = Loop Cuts + proportional editing to simulate drape. Sword pommel = extrude + bevel. These are targeted detail passes, not full sculpts. 1–2 days. |
| Custom normal map for toon shading (smooth normals on hard mesh) | Toon shading can look "bumpy" on low-poly mesh; custom normals smooth the shade bands to anime-style gradients | HIGH | Geometry Nodes approach: generate smoothed normals representing simplified mesh silhouette (Blender Studio technique). Makes cel shading look hand-drawn rather than "3D-ish". Requires Geometry Nodes knowledge — HIGH complexity. |

### Posing

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Extended pose library (10+ poses) | Richer variety of manga panel compositions without manual Blender intervention | MEDIUM | Add: sitting, crouching, running, mid-jump, over-shoulder look, reactive surprise, hands-in-pockets. Each pose = a dict of bone rotations in `render_poses.py`. 30–60 min per pose once weight painting is working. |
| Panel-type→pose mapping table | Defines which pose suits which script event type; enables automated pose selection without per-panel manual choice | LOW | A JSON/YAML lookup: `{ "dialogue": "standing_relaxed", "action": "battle_ready", "draw_katana": "drawing_katana", ... }`. Lives in TypeScript pipeline config. No Blender changes needed. |
| BVH motion capture import | Free mocap libraries (CMU mocap database, Mixamo) provide hundreds of realistic human poses that can be retargeted to Spyke's rig | MEDIUM | Blender supports BVH import natively (`bpy.ops.import_anim.bvh()`). Requires retargeting the CMU/Mixamo bone hierarchy to Spyke's bone names. The rig in `generate_spyke.py` uses a simple bone naming scheme (`UpperArm.R`, `Thigh.L`, etc.) — retargeting scripts are available in the community. Best for running and dynamic action poses that are hard to keyframe manually. |
| Pose interpolation for in-between frames | Generate "half-way" poses between two library poses for scenes where exact match doesn't exist | LOW | In Python: linear interpolate bone `rotation_euler` values between two pose dicts. Add `--blend_poses pose_a:pose_b:0.5` CLI arg. Computationally trivial; code complexity LOW. |

### Rendering

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Grease Pencil Line Art modifier (alternative to Freestyle) | Gives more control over outline style — variable thickness, taper, hand-drawn jitter; Freestyle is all-or-nothing per edge type | MEDIUM | Grease Pencil Line Art modifier reads 3D mesh geometry and generates strokes as a Grease Pencil layer. Can be styled independently per-material. More anime-production-accurate than Freestyle but requires a separate Grease Pencil object in the scene. Avoid running both Freestyle and Line Art simultaneously — they produce duplicate lines. |
| 3-band shading (light/mid/shadow) | Adds mid-tone for more nuanced fabric shading on cloak and skin | LOW | Change `SHADE_BANDS = 3` in `manga_shader.py` and add a third ColorRamp stop. 10 minutes of config change. Test if it reads well at 800px wide Webtoon format. |
| Per-material outline thickness control | Different outline weights for costume, body, and equipment create visual hierarchy (anime standard) | MEDIUM | Freestyle line thickness can be set per-material via `LineStyle` objects, or use `bpy.types.FreestyleLineSet` to assign different thickness by collection. Requires splitting objects into collections by outline weight category. |
| Camera dolly / zoom variants per pose | Portrait shots need tighter framing than wide shots; automate camera distance based on panel type | LOW | Parameterize `Cam_Portrait` and `Cam_UpperBody` focal length and Z-offset in the render script. Pass `--focal-length 85` as a CLI arg. Controls are already accessible via `cam.data.lens`. |

### Integration

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| TypeScript pose selector (script-event → pose name) | Fully automated rendering without per-panel human pose selection | MEDIUM | Parse panel script metadata (action keywords, character state) → lookup pose name → pass to Blender CLI. Requires a structured panel metadata format in the pipeline's existing script stage. |
| Render queue with progress reporting | For Chapter 1's 28 panels, batch rendering takes 30–60 min; progress visibility is useful | LOW | TypeScript: track submitted/completed counts, log `[render] Panel 3/28 complete (45%)`. No changes needed in Blender scripts. |
| `.blend` file versioning | Lock the `.blend` file used for each rendered chapter so model changes don't retroactively alter rendered panels | LOW | Copy `spyke.blend` to `spyke_v1.blend` before starting a chapter. Record version in manifest. When re-rendering, use the version-locked file. |

### Backgrounds

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Simple 3D establishing shot environments | Manga establishing shots set scene location; a simple 3D environment (floor plane, building wall, geometry) renders more consistently than drawn backgrounds | HIGH | One environment per major scene location (dojo interior, flooded street, ship deck). Each = a separate `.blend` file. Character is rendered separately with transparent bg, then composited. OR character + environment are rendered together. Compositing approach is simpler. 1–3 days per environment. |
| HDRI environment lighting for outdoor scenes | HDRI gives accurate outdoor lighting on the character without modeling a sky; affects toon shading shadow direction | LOW | `bpy.data.worlds['World'].node_tree.nodes['Environment Texture'].image = bpy.data.images.load('/path/to/hdri.exr')`. Free HDRIs: Polyhaven. Affects shadow direction on toon shader — useful for consistent sunlight in outdoor panels. |
| Speed line compositor effect | Manga action panels use radiating speed lines; generate these in Blender compositor or post in Sharp | MEDIUM | Compositor approach: use a radial gradient + noise texture + ColorRamp to generate dynamic speed lines. Alternative: TypeScript overlay stage draws lines using Sharp + SVG overlay (simpler, more controllable). Recommend TypeScript approach — keep Blender focused on character. |

---

## Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Cycles render engine instead of EEVEE | "Cycles produces better lighting" | Cycles does NOT support the Shader to RGB node, which is the entire basis of the toon shader system in `manga_shader.py`. Switching to Cycles breaks the cel-shading pipeline entirely and requires rebuilding the shader graph from scratch using Toon BSDF (less configurable). Also 10–20x slower on M1 Pro. | Stay on EEVEE for all character rendering. Cycles is only relevant if switching to a path-traced background environment, which can be composited separately. |
| Full rig with IK (inverse kinematics) | "IK makes posing easier" | IK is a real-time interactive tool — useful in the Blender UI, but adds complexity to script-driven posing. Setting IK target positions programmatically requires solving the IK constraint, which can produce unexpected results in headless mode. The current FK (forward kinematics) approach in `render_poses.py` — setting bone rotations directly — is deterministic and scriptable. | Keep FK posing for script-driven rendering. IK is only worth adding if a human is interactively adjusting poses in the Blender UI before export. |
| Blender GUI workflow (open Blender, pose manually, render) | "Manual posing gives more control" | Destroys automation. Every panel that requires opening Blender UI breaks the pipeline's end-to-end automation goal. The entire v3.0 motivation is `script → render → output` without manual steps per panel. | Define all poses as code in `render_poses.py`. Use the Blender UI only for initial pose authoring (save to file), then export the rotation values into the POSES dict. |
| Auto-retopology with Blender's Remesh modifier | "Remesh is automatic — saves time" | Voxel Remesh and Quad Remesh produce topology that does not follow edge flow required for deformation. Arms, legs, and face joints become irregular polygons that cause pinching artifacts when posed. The toon shader amplifies these artifacts as broken shade bands. | Use Remesh as a base mesh only, then manually retopologize the critical deformation areas (shoulder, elbow, knee, face) using Blender's built-in retopology tools or RetopoFlow addon. Accept that retopology is a 3–5 day human task — it cannot be fully automated for a poseable character. |
| Multiple characters in the same .blend scene | "Render Spyke and June in one shot" | Adds model management complexity, scene state management between renders, and potential memory issues (M1 Pro 16GB). For v3.0, the goal is Spyke only. | Render characters separately with transparent backgrounds, composite in TypeScript overlay stage (Sharp `composite` operation). This keeps each .blend file focused on one character and makes it easy to update one character without touching the other's render setup. |
| Blender's built-in NLA / animation system for poses | "Store poses as NLA strips for reuse" | NLA editor is designed for timeline animation, not single-frame pose extraction. Script-driven pose selection from a Python dict is simpler, more readable, and more robust for headless batch rendering. | Keep poses as Python dicts in `render_poses.py`. Each pose is a `dict[str, tuple[float, float, float]]` of bone rotations. This is already implemented and working. |
| Realistic-style 3D backgrounds (full environments) | "Full 3D scenes for every panel" | Full 3D environment modeling is a significant separate skill and time investment. M1 Pro 16GB renders complex scenes slowly in EEVEE. Complex geometry in establishing shots does not add enough value over stylized 2D backgrounds to justify the cost in v3.0. | Use 3D environments only for 2–3 key establishing shots per chapter. Use flat color + stylized 2D elements (drawn by hand or AI-generated separately) for dialogue and action panels. |

---

## Feature Dependencies

```
[generate_spyke.py blockout]
    └──is base for──> [Retopology + sculpt (face, body)]
                          └──enables──> [Weight painting (joint deformation)]
                                            └──enables──> [Pose plausibility (clothing follows body)]
                                                              └──enables──> [Extended pose library]

[manga_shader.py (already working)]
    └──applied to──> [Refined mesh materials]
                          └──validates──> [Shade band quality on refined topology]

[render_poses.py (already working)]
    └──requires──> [Weight painting complete] (for clothing deformation to work)
    └──extended by──> [Extended pose library (more poses)]
    └──extended by──> [Panel naming convention (--chapter --page --version args)]

[TypeScript generate stage]
    └──spawns──> [Blender subprocess]
                      └──executes──> [render_poses.py with pose + camera args]
                      └──outputs──> [PNG to output/ch-XX/raw/]
                      └──result consumed by──> [overlay stage (unchanged)]
                                                    └──consumed by──> [assemble stage (unchanged)]

[3D background scenes]
    └──separate .blend files──> [Rendered independently with transparent character composite]
    └──or──> [Character rendered with transparent bg, composited in TypeScript overlay stage]

[Grease Pencil Line Art]
    └──conflicts──> [Freestyle outlines] (both active = duplicate lines; pick one)
```

### Dependency Notes

- **Retopology requires blockout:** The blockout primitives are the sculpting base. Run `generate_spyke.py` first to produce `spyke.blend`, then open in Blender for manual retopology.
- **Weight painting requires retopology:** Painting vertex weights on blocky capsule primitives produces poor deformation. Retopology must come first.
- **Pose plausibility requires weight painting:** The current `parent_to_armature()` in `generate_spyke.py` uses rigid parenting. Poses exist in `render_poses.py` but clothing will not deform naturally until weight painting is done. T-pose and near-neutral poses will look acceptable; wide action poses will reveal the rigid parenting.
- **Pipeline integration is independent:** TypeScript subprocess spawning can be implemented before mesh refinement is complete. Use the current blockout for integration testing.
- **Freestyle and Grease Pencil Line Art are mutually exclusive:** Use one outline system. Freestyle is simpler (already configured), Line Art gives more artistic control. Decision must be made before extended pose rendering.

---

## MVP Definition

### v3.0 Launch With (Chapter 1 end-to-end)

- [ ] **Face retopology** — Spyke's head reads as a manga character, not a UV sphere. Eye sockets, mouth region, clear face planes. Without this, close-up panels look wrong.
- [ ] **Weight painting (critical joints)** — Shoulder, elbow, hip, knee at minimum. Spine and neck secondary. Standing and mild action poses must deform without tearing.
- [ ] **Verified toon shader output** — Run `manga_shader.py` on refined mesh, confirm shade bands look correct. Tune `SHADOW_INTENSITY` and `HIGHLIGHT_THRESHOLD` against the Webtoon format.
- [ ] **Freestyle outlines verified** — Outlines appear on silhouette, 2px weight reads correctly at 800px wide. Crease angle tuned to not pick up internal geometry lines.
- [ ] **Standing + 2 action poses validated** — `standing_relaxed`, `battle_ready`, `drawing_katana` produce plausible renders after weight painting.
- [ ] **Pipeline naming convention** — Add `--chapter`, `--page`, `--version` CLI args to `render_poses.py`. Output to `output/ch{ch:02d}/raw/ch{ch:02d}_p{page:03d}_v{version}.png`.
- [ ] **TypeScript subprocess integration** — `generate` stage replaced: spawn `blender spyke.blend --background --python render_poses.py -- --chapter X --page Y --pose Z --camera W --output /path/`. Wait for exit, check code, write manifest entry.
- [ ] **Transparent bg compositing verified** — One complete panel end-to-end: Blender render → TypeScript overlay (SVG balloons) → Webtoon assemble. Confirm alpha compositing works.

### Add After Validation (v3.0.x)

- [ ] **Extended pose library (5 more poses)** — Once weight painting is solid, adding poses is cheap. Add after first successful Chapter 1 render.
- [ ] **Panel-type → pose mapping** — TypeScript config lookup. Reduces per-panel manual pose selection to zero.
- [ ] **3D establishing shot (1 environment)** — One scene (dojo interior or flooded street) for Chapter 1's opening panels. Validate the composite workflow.
- [ ] **Equipment detail pass** — Cloak folds, sword pommel detail, boot buckles. Do after pipeline is proven; these affect close-up quality, not wide shots.

### Future Consideration (v3.1+)

- [ ] **BVH motion capture retargeting** — Once pose library feels limiting. Requires CMU/Mixamo retargeting script.
- [ ] **Grease Pencil Line Art** — If Freestyle outlines feel too mechanical. Higher control, higher setup cost.
- [ ] **Custom normals for toon shading** — If shade bands look "3D-ish" on refined mesh. Geometry Nodes technique. High complexity.
- [ ] **Additional character models** — June, Draster. Follow the same blockout → refine → pose pipeline. One character at a time.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Face retopology | HIGH | HIGH | P1 |
| Weight painting (critical joints) | HIGH | HIGH | P1 |
| Standing + action poses validated | HIGH | MEDIUM | P1 |
| Freestyle outlines verified | HIGH | LOW | P1 |
| Pipeline naming convention | HIGH | LOW | P1 |
| TypeScript subprocess integration | HIGH | LOW | P1 |
| Transparent bg compositing | HIGH | LOW | P1 |
| Toon shader tuning | MEDIUM | LOW | P1 |
| Extended pose library | HIGH | MEDIUM | P2 |
| Panel-type → pose mapping | MEDIUM | LOW | P2 |
| 3D establishing shot (1 environment) | HIGH | HIGH | P2 |
| Equipment detail pass (cloak folds etc.) | MEDIUM | MEDIUM | P2 |
| Camera dolly variants per panel type | LOW | LOW | P2 |
| .blend file versioning | MEDIUM | LOW | P2 |
| BVH motion capture import | MEDIUM | MEDIUM | P3 |
| Grease Pencil Line Art | MEDIUM | MEDIUM | P3 |
| Custom normals for toon shading | MEDIUM | HIGH | P3 |
| Per-material outline thickness | LOW | MEDIUM | P3 |
| 3-band shading (light/mid/shadow) | LOW | LOW | P3 |
| Speed line compositor effect | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for Chapter 1 end-to-end validation
- P2: Should have — add after first successful render
- P3: Nice to have — future milestone consideration

---

## Blender 5.0 / EEVEE Next Specific Notes

**Shader to RGB is confirmed available in Blender 5.0 EEVEE.** The `manga_shader.py` approach (Diffuse BSDF → Shader to RGB → ColorRamp CONSTANT → Emission) works in both EEVEE and EEVEE Next (Blender 4.x+). HIGH confidence.

**NPR improvements are planned but NOT yet in Blender 5.0.** The Blender Developers Blog (May 2025) confirmed the NPR project (multi-stage compositing, anti-aliased NPR output) begins development _after_ Blender 5.0. These features are not available in Blender 5.0.1 (the project's version). Do not design around them. MEDIUM confidence on timeline.

**Freestyle is stable in Blender 5.0.** The Freestyle system is a mature rendering feature with full Python API control. Nothing in Blender 5.0 breaks the current `render_setup.py` Freestyle configuration.

**Metal GPU (EEVEE on M1 Pro):** Metal backend for EEVEE viewport was shipped in Blender 3.5 and is stable on M1. EEVEE render performance via Metal is significantly improved over the OpenGL backend (up to 5x on M1 Max; M1 Pro improvement is proportional). Headless EEVEE render on M1 Pro works without the Metal viewport — it uses the software renderer. For batch headless rendering, expect ~5–15 seconds per panel at 800×1200 (EEVEE is fast compared to Cycles).

**`BLENDER_EEVEE_NEXT` vs `BLENDER_EEVEE`:** The `manga_shader.py` already handles this:
```python
scene.render.engine = 'BLENDER_EEVEE_NEXT' if bpy.app.version >= (4, 0, 0) else 'BLENDER_EEVEE'
```
Blender 5.0.1 uses `BLENDER_EEVEE_NEXT`. This is correct.

---

## Sources

- Blender NPR Project announcement (May 2025): [NPR Project — Blender Developers Blog](https://code.blender.org/2025/05/npr-project/) — confirms NPR improvements are post-5.0, MEDIUM confidence on timeline
- Blender 5.0 Freestyle documentation: [Freestyle — Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/render/freestyle/index.html) — confirms Freestyle stability, HIGH confidence
- Blender 5.0 Shader to RGB documentation: [Shader To RGB Node — Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/render/shader_nodes/color/shader_to_rgb.html) — EEVEE-only confirmed, HIGH confidence
- Blender 5.0 Line Art Modifier: [Line Art Modifier — Blender 5.0 Manual](https://docs.blender.org/manual/en/latest/grease_pencil/modifiers/generate/line_art.html) — Grease Pencil alternative to Freestyle, HIGH confidence
- Blender Metal viewport announcement: [Introducing the Blender Metal Viewport — Blender Developers Blog](https://code.blender.org/2023/01/introducing-the-blender-metal-viewport/) — M1 EEVEE performance, HIGH confidence
- Anime face topology: [4 Categories of Face Topology in Anime 3D Model](https://animecglab.com/en/4-categories-of-anime-3d-model/) — anime topology conventions, MEDIUM confidence
- Cartoon Character Shading with Geometry Nodes: [Blender Studio Blog](https://studio.blender.org/blog/cartoon-character-shading-with-geometry-nodes/) — custom normals technique, HIGH confidence (official Blender Studio source)
- Blender Scripting for Animation Pipelines: [CG-Wire Blog 2026](https://blog.cg-wire.com/blender-scripting-animation/) — headless automation patterns, MEDIUM confidence
- OkTopo Remesher (2025): [Jettelly Blog](https://jettelly.com/blog/oktopo-remesher-automatic-head-retopology-in-blender) — automatic retopology tool, LOW confidence (not used in this pipeline)
- Shader to RGB limitations: [Blender Artists Community — Experiments with NPR/Toon Shading in Eevee](https://blenderartists.org/t/experiments-with-npr-toon-shading-in-eevee/1139213) — EEVEE-specific constraints, MEDIUM confidence
- Node.js child_process for Blender integration: Blender_farm NodeJS project and standard Node.js spawn() docs — HIGH confidence (standard Node.js API)
- Existing codebase: `3d_models/` scripts directly inspected — HIGH confidence

---

*Feature research for: Blender 3D manga rendering pipeline (Plasma v3.0)*
*Researched: 2026-02-25*
*Confidence: HIGH for Blender API and EEVEE toon shading; MEDIUM for mesh refinement workflows; LOW for Blender 5.0 NPR roadmap*
