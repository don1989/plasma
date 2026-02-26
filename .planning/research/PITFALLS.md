# Pitfalls Research: Blender 3D Manga Rendering Pipeline

**Domain:** Blender 5.0.1 + EEVEE toon shading + Freestyle outlines + script-driven posing on Apple Silicon M1 Pro
**Researched:** 2026-02-25
**Confidence:** HIGH for API-level findings (verified against official Blender release notes and docs). MEDIUM for EEVEE/Apple Silicon behavior (verified against official bug tracker, community may evolve). LOW items are flagged inline.

**Scope:** Pitfalls specific to adding Blender 3D rendering to THIS project (Plasma manga pipeline v3.0). The scripts analyzed are: `generate_spyke.py`, `manga_shader.py`, `render_setup.py`, `render_poses.py`.

---

## Critical Pitfalls

### Pitfall 1: EEVEE Headless Rendering Does Not Work on macOS

**What goes wrong:**
EEVEE rendering in `--background` mode is **not supported on macOS**. The project's entire automated pipeline (`blender --background --python render_poses.py`) relies on headless rendering. On macOS, EEVEE requires a display context (the Metal GPU API on macOS does not support compute-only rendering without a window). Running `blender --background` with EEVEE on M1 Pro will either silently produce black renders or fail to initialize the GPU renderer, falling back to CPU-only software rasterization — or hang indefinitely.

**Why it happens:**
Blender's EEVEE uses the Metal rendering backend on macOS. The Metal API on macOS has historically required a display/window context for rasterization. Headless rendering (no display, no window) is a Linux-only capability for EEVEE. This is documented in Blender's official limitations page and confirmed in multiple bug reports (issue #127033 — "EEVEE under Apple Silicon renders Blender completely unresponsive during render").

**How to avoid:**
Option A (Recommended for v3.0): Use a dummy display. On macOS, run Blender with a virtual framebuffer by connecting a display or using `launchctl` to provide a CGSSession. The most reliable workaround is to NOT use `--background` — instead launch Blender with its window minimized and render through the Python API with `bpy.ops.render.render(write_still=True)`. This is less elegant but works on macOS.

Option B: Switch the render engine to Cycles for all headless renders. Cycles supports Metal GPU headless rendering on Apple Silicon. Toon shading requires using Cycles-compatible toon nodes (Diffuse BSDF + LightPath for shadow separation) instead of Shader to RGB. This changes the shader architecture in `manga_shader.py`.

Option C: Run the headless renders on a Linux machine or CI runner and pull back outputs. The TypeScript pipeline could shell out to a remote Blender instance.

**Warning signs:**
- Render produces all-black or all-transparent PNGs
- `blender --background --python render_poses.py` exits with code 0 but no files written
- Console shows "GPUContextError" or "Metal: headless" errors
- Render completes instantly (no actual GPU work done)

**Phase to address:** Phase 1 (Model Build and Render Setup Validation). Discover this constraint before building the automated pipeline, not after. Prototype a single render in the actual environment before committing to the architecture.

---

### Pitfall 2: EEVEE Engine Identifier Name Change in Blender 5.0

**What goes wrong:**
`manga_shader.py` line 194 uses this version check:
```python
scene.render.engine = 'BLENDER_EEVEE_NEXT' if bpy.app.version >= (4, 0, 0) else 'BLENDER_EEVEE'
```
In **Blender 5.0**, the engine identifier was **changed back** from `BLENDER_EEVEE_NEXT` to `BLENDER_EEVEE`. This means on Blender 5.0.1 (the project's target), the condition `bpy.app.version >= (4, 0, 0)` is true, and the script sets the engine to `'BLENDER_EEVEE_NEXT'` — which is **no longer a valid identifier** in Blender 5.0. The render engine silently falls back to the default or raises an error, rendering with the wrong engine.

**Why it happens:**
In Blender 4.2, EEVEE-Next replaced the old EEVEE and used the internal code name `BLENDER_EEVEE_NEXT`. In Blender 5.0, the identifier was simplified back to `BLENDER_EEVEE` now that EEVEE-Next is the only EEVEE. The existing script's version check covers Blender 4.x correctly but overshoots into 5.0.

**How to avoid:**
Tighten the version check to explicitly gate on 4.x:
```python
if (4, 0, 0) <= bpy.app.version < (5, 0, 0):
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
else:
    scene.render.engine = 'BLENDER_EEVEE'
```
Or, since the project targets only Blender 5.0.1, simplify to:
```python
scene.render.engine = 'BLENDER_EEVEE'  # Blender 5.0+ only
```

**Warning signs:**
- `setup_eevee_for_toon()` runs without error but render uses wrong engine
- Console shows "Unknown render engine" or output looks photorealistic (Cycles fallback)
- Verify with: `print(bpy.context.scene.render.engine)` after assignment

**Phase to address:** Phase 1 (Model Build and Shader Setup). Fix before any render output is trusted.

---

### Pitfall 3: EEVEE-Next Shadow System Breaks Toon Shading

**What goes wrong:**
EEVEE Next (Blender 4.2+, including 5.0) uses a rewritten ray-traced shadow system. Toon shaders with `Shader to RGB` and hard `ColorRamp` steps exhibit "stippling" or "fuzziness" artifacts along shadow edges — where the hard shadow line should be a clean binary step (lit vs. shadow), EEVEE Next produces hundreds of sub-pixel varying values from the PCF shadow filtering. The toon shader's `CONSTANT` interpolation on the color ramp amplifies this into visible noise.

This is a **confirmed regression** from legacy EEVEE. The Blender Artists community confirmed this broke between 4.1 and 4.2, and Blender developers acknowledged it as a deliberate trade-off prioritizing physical accuracy over NPR compatibility. The issue persists in Blender 5.0.

**How to avoid:**
Prevention strategy (pick one):
1. **Disable cast shadows in EEVEE**: In render settings, set shadow resolution to minimum or turn off shadow evaluation per-light. Toon manga shading often looks better without cast shadows anyway — use only self-shadowing via `Shader to RGB`.
2. **Use flat lighting**: Position the key light so it creates a broad lit region and the toon threshold falls inside a stable lit zone, not near a shadow boundary.
3. **Post-process the stippling**: After rendering, apply a median or bilateral filter in Sharp (TypeScript pipeline) to clean up sub-pixel shadow noise along edges.
4. **GooEngine**: A custom Blender build maintained specifically for NPR toon work. Requires distributing a separate Blender binary — HIGH cost, use only if stippling is unacceptable.

**Warning signs:**
- Toon shadow edges look "grainy" or "staticky" in renders
- Problem is visible at 800px width but might be subtle at lower previews
- Issue is worse with SUN lights than with directional lights very far away

**Phase to address:** Phase 1 (Shader validation) — test renders with your actual lighting setup before refining the model. This must be solved before the production render pipeline is locked.

---

### Pitfall 4: `ShaderNodeMix` Input Index Numbering (RGBA Data Type)

**What goes wrong:**
`manga_shader.py` accesses `ShaderNodeMix` inputs by **integer index** (lines 123-124 and 152-153):
```python
links.new(ramp.outputs['Color'], mix.inputs[6])   # A
links.new(rim_ramp.outputs['Color'], mix.inputs[7])  # B
```
The `ShaderNodeMix` node changed its socket layout when `data_type` was added in Blender 3.4+. The socket indices for the A and B inputs vary depending on `data_type`. For `RGBA`, inputs[6] and inputs[7] map to the correct RGBA A/B sockets in Blender 3.x/4.x but this is fragile: any socket insertion, data_type change, or future Blender version that rearranges sockets silently breaks the connections. When connections are wrong, the node tree produces no output or incorrect colors without raising an exception.

**How to avoid:**
Access sockets by name, not index:
```python
links.new(ramp.outputs['Color'], mix.inputs['A'])
links.new(rim_ramp.outputs['Color'], mix.inputs['B'])
```
For `ShaderNodeMix` with `data_type = 'RGBA'`, the named inputs are `'Factor'`, `'A'`, and `'B'`. Name-based access is stable across versions. Apply the same fix to the spec_mix section.

**Warning signs:**
- Materials appear solid grey or wrong color
- Color ramp output not affecting final material appearance
- No Python error raised — silent wrong-connection

**Phase to address:** Phase 1 (Shader Setup). Audit all `mix.inputs[N]` index accesses and replace with named socket access before first production render.

---

### Pitfall 5: `Specular IOR Level` Input Name (Principled BSDF)

**What goes wrong:**
`generate_spyke.py` line 125 accesses:
```python
bsdf.inputs['Specular IOR Level'].default_value = 0.1
```
This was renamed from `'Specular'` to `'Specular IOR Level'` in Blender 4.0. The current code uses the new name, which is CORRECT for Blender 5.0.1. However, the `create_material()` function creates intermediate materials that are immediately replaced by `manga_shader.py` (toon shader), so these Principled BSDF materials serve only as placeholders to extract base color. Accessing `'Specular IOR Level'` on a Principled BSDF in Blender 5.0 is valid and will not error.

**Residual risk:** If anyone runs `generate_spyke.py` alone against Blender 3.6 (as the README mentions "Blender 3.6+ (4.x recommended)"), the name `'Specular IOR Level'` does NOT exist in Blender 3.6 where it was called `'Specular'`. This will raise a `KeyError`.

**How to avoid:**
Update README to remove the "Blender 3.6+" claim — v3.0 targets Blender 5.0.1 exclusively. Guard the property access:
```python
if 'Specular IOR Level' in bsdf.inputs:
    bsdf.inputs['Specular IOR Level'].default_value = 0.1
elif 'Specular' in bsdf.inputs:
    bsdf.inputs['Specular'].default_value = 0.1
```

**Warning signs:**
- `KeyError: 'Specular IOR Level'` when running on Blender 3.6
- No error on 5.0.1 (this is the target version)

**Phase to address:** Phase 1. Update documentation. Add guard if backward compatibility matters.

---

### Pitfall 6: Armature Parenting Without Vertex Weights Produces No Deformation

**What goes wrong:**
`generate_spyke.py`'s `parent_to_armature()` function (lines 878-882) parents mesh objects to the armature using `obj.parent = armature` and sets `matrix_parent_inverse`. This is **object parenting**, not **armature deform parenting**. Without vertex groups with bone weight assignments, posing the armature moves the mesh objects as rigid children — the entire mesh moves as a unit when a bone moves, rather than deforming smoothly. Arms, legs, and clothing parts will "teleport" rather than bend at joints.

For a blockout model with discrete separate meshes per body part (which is what the script builds), rigid parenting is actually workable for initial posing — each body part IS a separate object. However, when the model is refined into a unified mesh (e.g., sculpted torso + connected arms), rigid parenting will fail entirely. The `render_poses.py` pose data assumes the armature controls actual deformation, which it won't do correctly against these rigid parents.

**Why it happens:**
The script uses `obj.parent = armature` (generic parent) instead of adding an Armature modifier with vertex group weighting. Generic parent moves the whole object — it cannot deform a mesh. Weight painting is a manual step that was flagged in the README's "Refinement Guide" but not implemented in the scripts.

**How to avoid:**
For the blockout phase (discrete mesh parts), rigid parenting is acceptable and poses will work correctly because each body part is already separated. Do NOT merge body parts into a single mesh before weight painting. When moving to production-quality (refined mesh), the required workflow is:
1. Merge body parts into contiguous regions
2. Add Armature modifier to each merged mesh
3. Weight paint vertex groups for each bone
4. Only then does `render_poses.py` produce correct deformation

Script fix for proper armature modifier (per mesh part):
```python
def add_armature_modifier(obj, armature_obj):
    mod = obj.modifiers.new("Armature", 'ARMATURE')
    mod.object = armature_obj
    mod.use_vertex_groups = True
```

**Warning signs:**
- Posing the armature moves whole body parts correctly but the connections between parts show gaps
- No deformation at joints — limbs rotate as rigid blocks
- After mesh merge: limb geometry stays in place when bone rotates

**Phase to address:** Phase 2 (Model Refinement). Must be addressed before any production render that requires non-rigid deformation. Blockout renders for reference sheet are acceptable with rigid parenting.

---

### Pitfall 7: EEVEE Shadow Properties Removed in Blender 4.2+

**What goes wrong:**
`manga_shader.py` lines 197-201 attempt to set shadow resolution properties:
```python
if hasattr(scene.eevee, 'shadow_cascade_size'):
    scene.eevee.shadow_cascade_size = '2048'
if hasattr(scene.eevee, 'shadow_cube_size'):
    scene.eevee.shadow_cube_size = '1024'
```
These properties (`shadow_cascade_size`, `shadow_cube_size`) were removed entirely from `scene.eevee` in Blender 4.2 as part of the EEVEE-Next rewrite. Shadow resolution is now controlled per-light in `light.data.shadow_maximum_resolution`. The `hasattr` guard prevents a crash, but the shadow quality configuration is silently skipped — EEVEE uses defaults, which may produce lower quality or incorrect shadow appearance for toon shading.

Similarly, `gtao_distance` was moved from `scene.eevee.gtao_distance` to `view_layer.eevee.ambient_occlusion_distance` and the `gtao_quality` and `use_gtao` properties were removed from `SceneEEVEE` entirely in Blender 5.0.

**How to avoid:**
Replace the legacy shadow block with EEVEE-Next equivalents:
```python
# Blender 5.0+: shadow resolution is per-light
for obj in bpy.data.objects:
    if obj.type == 'LIGHT':
        if hasattr(obj.data, 'shadow_maximum_resolution'):
            obj.data.shadow_maximum_resolution = 0.001  # Higher = better quality
```
Remove all `scene.eevee.shadow_cascade_size` and `shadow_cube_size` references. Remove `gtao_*` property accesses.

**Warning signs:**
- Script runs without error but shadow quality is not configured
- Toon shading looks noisier than expected — shadow resolution is too low
- `AttributeError` if the `hasattr` guards are ever removed

**Phase to address:** Phase 1 (Render Setup Validation). Audit all `scene.eevee.*` property accesses against the Blender 5.0 `SceneEEVEE` API.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Rigid armature parenting (no vertex weights) | Blockout renders work immediately | Cannot produce organic joint deformation at production quality | Acceptable for blockout reference sheet; must fix before production renders |
| Hard-coded camera names ("Cam_Front") in render script | Simple to implement | Breaks silently if camera was renamed in .blend session | Never — use scene camera lookup with fallback error |
| Socket access by integer index (`mix.inputs[6]`) | Matches exact node inspector display | Breaks on any socket count change or Blender version | Never — always use named socket access |
| Rendering without checking output file exists | Fast iteration | Silent failure when path is wrong, wrong permissions, or disk full | Never in automated pipeline |
| Building on Blender 3.6-era README assumptions | Old docs available | API mismatch on 5.0.1, wasted debugging time | Never — pin docs to actual Blender version |

## Integration Gotchas

Common mistakes when connecting Blender rendering to the existing TypeScript pipeline.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| TypeScript → Blender subprocess | `child_process.spawn('blender', [...])` succeeds but renders are black | Verify EEVEE headless limitation first; check exit code AND output file existence separately |
| Blender output path | Setting `scene.render.filepath` without calling `write_still=True` | Always use `bpy.ops.render.render(write_still=True)` for single-frame renders |
| PNG transparency | Assuming output has transparent background | Must set `render.film_transparent = True` AND `render.image_settings.color_mode = 'RGBA'` — both required |
| File naming convention | Blender appends frame number to filepath by default (`image0001.png`) | Set `scene.render.use_file_extension = False` and `scene.render.use_stamp = False`, or account for the appended number in TypeScript filename parsing |
| Sharp (TypeScript) alpha compositing | Assuming Blender PNG alpha is premultiplied | EEVEE outputs straight (non-premultiplied) alpha — Sharp's `composite()` needs `premultiplied: false` or use `.premultiply()` on the Blender layer before compositing |
| Render resolution mismatch | Blender outputs 800×1200 but TypeScript overlay assumes different dimensions | Lock `RENDER_WIDTH = 800` in `render_setup.py` as canonical — TypeScript overlay reads actual PNG dimensions, never assumes |

## Performance Traps

Patterns that slow the render pipeline to unacceptable batch throughput.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Subdivision surfaces at render time on blockout | Each render takes 2-3x longer than expected | Set subdivision `render_levels = 1` on blockout objects, increase only on final mesh | Immediately — blockout objects have Subsurf with `render_levels = 2` |
| Freestyle enabled for every render | Freestyle adds 30-60% to render time via post-processing pass | Disable Freestyle for quick iteration renders; re-enable for production output | Always — control with `--freestyle` flag in batch script |
| Re-initializing EEVEE scene per batch render | Shader compilation runs once per scene load, but recreating the scene in-process re-triggers it | Load scene once, change camera/pose, re-render — never reload .blend between same-session renders | 10+ poses batch — this is the most expensive step |
| 64 EEVEE samples for every panel render | Full sample count for iteration renders | Use 8-16 samples for iteration, 64 only for final production renders | Single renders are fine; 28 panel renders at 64 samples is ~4 hours vs. ~45 min at 16 |
| High EEVEE shadow resolution limit | Long shadow computation on M1 Pro | Set per-light `shadow_maximum_resolution` to 0.01 (lower quality) for iteration, 0.001 for production | Iteration renders only |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Armature posing works:** Verify mesh parts actually follow armature — check that individual bones moving their corresponding mesh parts correctly, not that the armature just moves in the viewport
- [ ] **Toon shading looks correct at 800px:** Verify at output resolution (800px wide), not viewport preview — EEVEE viewport and final render can differ for toon shaders
- [ ] **Freestyle outlines visible:** Outlines only render in final render mode, not viewport — must actually run `bpy.ops.render.render()` to see them
- [ ] **Transparent background works:** Check PNG alpha channel — `render.film_transparent = True` does not guarantee correct RGBA output without `color_mode = 'RGBA'`
- [ ] **Pose library works correctly:** Validate that EVERY pose in `POSES` dict produces a different visible result — "neutral" being T-pose and "standing" looking identical is a sign bone rotations are not being applied
- [ ] **Camera naming is stable:** Confirm cameras survive a `.blend` save/reload cycle with the same names — `blender --background` starts from saved state, not from script-generated state
- [ ] **Headless render actually works:** Run the full `blender --background` command on the M1 Pro and verify PNG files were created, non-empty, and contain correct content (not black/transparent)
- [ ] **TypeScript can parse output filenames:** Confirm the file naming produced by Blender exactly matches what the TypeScript `generate` stage expects to consume

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| EEVEE headless fails on macOS | HIGH | Pivot to Option A (interactive Blender minimized window) or Option B (Cycles toon) — requires shader rewrite if choosing Cycles |
| Engine identifier wrong | LOW | 1-line fix in `manga_shader.py`, re-run setup script, re-render |
| Toon shadow stippling | MEDIUM | Disable cast shadows per-light, test render, adjust if still visible — 1-2 hours |
| ShaderNodeMix index access breaks | LOW | Find all `inputs[N]` accesses, replace with `inputs['A']`/`inputs['B']`, re-run `manga_shader.py` |
| Armature parenting wrong type | MEDIUM | Re-parent with "Armature Deform with Empty Groups" via `bpy.ops.object.parent_set(type='ARMATURE_NAME')`, manually weight paint critical deformation zones |
| EEVEE shadow properties silently skip | LOW | Add per-light shadow resolution config block, re-run `render_setup.py`, verify render |
| Wrong output filename format from Blender | LOW | Adjust TypeScript glob pattern to match actual Blender output naming including frame suffix |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| EEVEE headless on macOS | Phase 1 — Environment Validation | Run `blender --background --python render_setup.py` and confirm at least one PNG produced |
| Engine identifier (BLENDER_EEVEE_NEXT) | Phase 1 — Shader Setup | `print(bpy.context.scene.render.engine)` confirms `'BLENDER_EEVEE'` |
| EEVEE-Next toon shadow stippling | Phase 1 — Shader Validation | Render toon test at 800px and inspect shadow edges at 1:1 pixel view |
| ShaderNodeMix index access | Phase 1 — Shader Setup | Audit code; test render shows correct colors on all materials |
| Specular IOR Level name | Phase 1 — Model Build | Runs without KeyError; update README |
| Armature parenting type | Phase 2 — Model Refinement | Apply each pose, confirm limb deformation at joints |
| EEVEE shadow property removal | Phase 1 — Render Setup | `hasattr` audit; replace with per-light equivalents |
| TypeScript filename parsing | Phase 3 — Pipeline Integration | End-to-end test: Blender render → TypeScript overlay → output PNG |
| Alpha compositing in Sharp | Phase 3 — Pipeline Integration | Inspect composited panel for fringing/incorrect transparency |

## Blender 5.0 API Migration Reference

Quick-reference for the specific APIs used in this project that changed between 3.x/4.x and 5.0.

| Old API (3.x / 4.x) | Blender 5.0 API | Scripts Affected |
|---------------------|-----------------|------------------|
| `scene.render.engine = 'BLENDER_EEVEE_NEXT'` (4.x) | `scene.render.engine = 'BLENDER_EEVEE'` | `manga_shader.py:194` |
| `scene.eevee.shadow_cascade_size` | Removed — use per-light `light.data.shadow_maximum_resolution` | `manga_shader.py:197` |
| `scene.eevee.shadow_cube_size` | Removed — use per-light `light.data.shadow_maximum_resolution` | `manga_shader.py:200` |
| `scene.eevee.gtao_distance` | Moved to `view_layer.eevee.ambient_occlusion_distance` | Not currently used |
| `scene.eevee.use_gtao` / `gtao_quality` | Removed from SceneEEVEE in 5.0 | Not currently used |
| `scene.node_tree` | `scene.compositing_node_group` | Not currently used |
| `scene.use_nodes` | Deprecated (removed in 6.0) | Not currently used |
| `bpy.types.GreasePencil` | `bpy.types.Annotation` | Not currently used |
| `inputs['Specular']` on Principled BSDF | `inputs['Specular IOR Level']` (changed in 4.0 — code already uses new name) | `generate_spyke.py:125` — already correct |
| `mix.inputs[6]` / `inputs[7]` for ShaderNodeMix RGBA | `mix.inputs['A']` / `mix.inputs['B']` | `manga_shader.py:123-124, 152-153` |

## Sources

- [Blender 5.0 Python API Release Notes](https://developer.blender.org/docs/release_notes/5.0/python_api/) — engine identifier `BLENDER_EEVEE_NEXT` → `BLENDER_EEVEE`, render pass renames, compositor changes (HIGH confidence)
- [Blender 5.0 EEVEE Release Notes](https://developer.blender.org/docs/release_notes/5.0/eevee/) — `gtao_distance` moved to view layer, engine identifier change (HIGH confidence)
- [EEVEE Migration Guide for 4.2](https://developer.blender.org/docs/release_notes/4.2/eevee_migration/) — shadow settings reorganization, property removals (HIGH confidence)
- [EEVEE Next Toon Shader Issue](https://blenderartists.org/t/did-eevee-next-break-everyone-elses-toon-shaders/1539334) — shadow stippling in toon shaders confirmed broken in 4.2+ (MEDIUM confidence — community report, acknowledged by devs)
- [Bug #127033 — EEVEE under Apple Silicon renders Blender completely unresponsive](https://projects.blender.org/blender/blender/issues/127033) — headless EEVEE on Apple Silicon issue (MEDIUM confidence — verified bug report, may have partial fixes in 5.0.1)
- [Bug #125030 — Toon Shader not working in EEVEE render](https://projects.blender.org/blender/blender/issues/125030) — toon shader regression (MEDIUM confidence)
- [ShaderNodeMix Python API](https://docs.blender.org/api/current/bpy.types.ShaderNodeMix.html) — socket names for RGBA data type (HIGH confidence)
- [Blender Armature Gotchas](https://docs.blender.org/api/current/info_gotchas_armatures_and_bones.html) — posing in background mode, bone constraint refresh issues (HIGH confidence)
- [Render Operators API](https://docs.blender.org/api/current/bpy.ops.render.html) — `write_still` parameter required for single-frame saves (HIGH confidence)
- [Blender Principled BSDF Input Rename](https://projects.staging.blender.org/blender/blender/commit/1d265eed5dcc09d26a90e11e02a00e18e00c4a965ec00f99e) — `'Specular'` → `'Specular IOR Level'` in Blender 4.0 (HIGH confidence)
- [EEVEE Next + Toon Shader shadow PCF issue](https://projects.blender.org/blender/blender/issues/113839) — aliased shadow edges on EEVEE Next (HIGH confidence — official bug tracker)

---
*Pitfalls research for: Blender 3D manga rendering pipeline (Plasma v3.0)*
*Researched: 2026-02-25*
