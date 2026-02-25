# Stack Research: Blender 3D Manga Rendering Pipeline

**Project:** Plasma Manga Pipeline — v3.0 Blender 3D Rendering milestone
**Researched:** 2026-02-25
**Scope:** Stack additions for Blender 3D rendering only. Existing TypeScript pipeline (Sharp, Commander, SVG overlay, Webtoon assembler) not re-researched. ComfyUI/LoRA stack (v2.0) not re-researched.
**Confidence:** MEDIUM-HIGH — Blender 5.0 API changes verified via official release notes; EEVEE headless macOS limitation confirmed from official docs and multiple community sources.

---

## Hardware Context

| Property | Value |
|----------|-------|
| Chip | Apple M1 Pro |
| RAM | 16 GB unified memory |
| macOS | Sequoia (macOS 15.x) |
| Blender | 5.0.1 (installed) |
| GPU backend | Metal (Apple Silicon) |

---

## Core Technologies

### Blender 5.0.1 Python Scripting (bpy)

**What it is:** Blender's embedded Python interpreter and the `bpy` module are the only way to script Blender. No external process calls into Blender's internals — scripts run inside Blender's Python environment.

**Version:** 5.0.1 (Python 3.11 embedded — do not mix with system Python)

**No additional packages required.** All needed modules (`bpy`, `bmesh`, `mathutils`) are built into Blender's Python. The existing `3d_models/` scripts already use these correctly.

**Why bpy:** It is the only scripting interface. Not a choice — it is the API.

### Blender CLI Render Invocation

The TypeScript pipeline invokes Blender as a subprocess. Pattern:

```bash
# Build: generate model, apply shaders, set up render
blender --background --python 3d_models/build_spyke.py

# Render specific pose from specific camera
blender 3d_models/output/spyke/spyke.blend --background \
  --python 3d_models/render/render_poses.py -- \
  --poses standing_relaxed --views front,three_quarter \
  --output output/ch01/raw/
```

**CRITICAL CONSTRAINT — EEVEE on macOS headless rendering:**

EEVEE does NOT support headless background rendering on macOS or Windows (confirmed in Blender 5.0 official documentation and community reports). EEVEE requires a GPU context backed by a display, which `--background` mode does not initialize on macOS.

**This affects the existing `render_setup.py` and `render_poses.py` scripts.** Running `blender --background --python render_poses.py` with EEVEE as render engine will fail silently or produce empty output on macOS.

**Confirmed mitigations (choose one):**

| Mitigation | How | Tradeoff |
|-----------|-----|---------|
| Open Blender with UI, render via script | `blender spyke.blend --python render_poses.py` (no `--background`) | Requires display, but this machine always has one |
| Use Cycles with toon shading | Switch render engine to `CYCLES`, use Toon BSDF shader | Slower renders (~5–20x), supports true headless |
| Use `bpy.ops.render.render()` with display context | Already in render_poses.py — works when Blender has display | No code change needed for local M1 Pro work |

**Recommendation for v3.0:** Drop `--background` from render invocations. On the M1 Pro dev machine (always has display), launch Blender with the UI suppressed but still display-connected:

```bash
# Works on macOS — display available, no UI shown
blender spyke.blend --python 3d_models/render/render_poses.py -- \
  --poses standing_relaxed --views front \
  --output output/ch01/raw/
```

The UI window will flash open briefly then Blender exits. Acceptable for local automation. If true headless is ever needed (CI, server), switch to Cycles.

### TypeScript → Blender Integration (child_process)

The TypeScript pipeline spawns Blender as a child process using Node.js `child_process.spawn`. No npm package needed.

```typescript
import { spawn } from 'child_process';

function renderPose(
  blendFile: string,
  pose: string,
  views: string[],
  outputDir: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      blendFile,
      '--python', '3d_models/render/render_poses.py',
      '--',
      '--poses', pose,
      '--views', views.join(','),
      '--output', outputDir,
    ];

    const proc = spawn('/Applications/Blender.app/Contents/MacOS/Blender', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (d) => process.stdout.write(d));
    proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('close', (code) => {
      code === 0 ? resolve() : reject(new Error(`Blender exited with code ${code}`));
    });
  });
}
```

**Blender binary path on macOS:** `/Applications/Blender.app/Contents/MacOS/Blender`

This replaces the ComfyUI HTTP client pattern. No WebSocket, no API — just a subprocess.

---

## Blender 5.0.1 API — What Changed, What Breaks

The existing `3d_models/` scripts were written targeting Blender 3.6/4.x. Several API changes in Blender 5.0 require fixes before the scripts will run correctly.

### Breaking Change 1: EEVEE Engine Identifier

**Old (4.x):**
```python
scene.render.engine = 'BLENDER_EEVEE_NEXT'
```

**New (5.0+):**
```python
scene.render.engine = 'BLENDER_EEVEE'
```

The existing `manga_shader.py` has a conditional that handles this:
```python
scene.render.engine = 'BLENDER_EEVEE_NEXT' if bpy.app.version >= (4, 0, 0) else 'BLENDER_EEVEE'
```
This condition is now backwards — 5.0 uses `BLENDER_EEVEE` (same as the old pre-4.x name). Fix: use `'BLENDER_EEVEE'` unconditionally for 5.0+.

**Confirmed:** Official Blender 5.0 release notes — [https://developer.blender.org/docs/release_notes/5.0/python_api/](https://developer.blender.org/docs/release_notes/5.0/python_api/)

### Breaking Change 2: SceneEEVEE Shadow Properties Removed

**Removed in 4.2 (non-functional since then, fully removed in 5.0):**
```python
# These no longer exist:
scene.eevee.shadow_cascade_size = '2048'   # REMOVED
scene.eevee.shadow_cube_size = '1024'      # REMOVED
scene.eevee.gtao_quality                   # REMOVED
scene.eevee.use_gtao                       # REMOVED
```

The existing `manga_shader.py` uses `hasattr()` guards for these — that pattern is correct and will gracefully skip them on 5.0.

**What replaced them:** Shadow resolution is now configured per-light via the light object's shadow settings, not globally.

**Ambient occlusion distance moved:**
```python
# Old:
scene.eevee.gtao_distance = 0.2   # REMOVED

# New (view layer, not scene):
bpy.context.view_layer.eevee.ambient_occlusion_distance = 0.2
```

### Breaking Change 3: Legacy Action API Removed

**Old (pre-5.0):**
```python
action.fcurves     # REMOVED
action.groups      # REMOVED
action.id_root     # REMOVED
```

**New (5.0):**
```python
# Access via channelbag on the action slot
from bpy_extras import anim_utils
channelbag = anim_utils.action_ensure_channelbag_for_slot(action, action_slot)
channelbag.fcurves.new("rotation_euler", index=0, group_name="BoneName")
```

**Impact on this project:** The current `render_poses.py` does NOT use action/fcurve API. It directly sets `bone.rotation_euler` on pose bones, which is unaffected. This breaking change only matters if keyframe-based animation is added later.

### Breaking Change 4: Bone Selection Now Per-Instance

`pose_bone.bone.select` behavior changed. Now stored per pose bone instance rather than shared globally. Impact: negligible for this project since the scripts don't rely on bone selection state for rendering.

### Confirmed Stable in 5.0

| API | Status | Notes |
|-----|--------|-------|
| `bone.rotation_euler` on pose bones | STABLE | Used in render_poses.py — confirmed unchanged |
| `bpy.ops.object.mode_set(mode='POSE')` | STABLE | Mode switching unchanged |
| `bpy.ops.render.render(write_still=True)` | STABLE | Core render op unchanged |
| `scene.render.filepath` | STABLE | Output path unchanged |
| `view_layer.use_freestyle` | STABLE | Freestyle enable unchanged |
| `freestyle.linesets.new()` | STABLE | Lineset creation unchanged |
| `lineset.linestyle` / `style.thickness` | STABLE | Line style properties unchanged |
| `ShaderNodeShaderToRGB` | STABLE | EEVEE-only, still works |
| `ShaderNodeValToRGB` | STABLE | Color ramp unchanged |
| `ShaderNodeMix` with `data_type='RGBA'` | STABLE | Mix node unchanged |
| `ShaderNodeEmission` | STABLE | Emission shader unchanged |
| `scene.eevee.taa_render_samples` | STABLE | Render samples property confirmed in 5.0 API |
| `render.film_transparent` | STABLE | Alpha background unchanged |
| `render.image_settings.file_format = 'PNG'` | STABLE | Output format unchanged |

---

## Render Pipeline Architecture

### EEVEE + Freestyle (Recommended for v3.0)

EEVEE is the correct engine for manga toon shading. Shader to RGB node converts diffuse shading into discrete color bands — this node is EEVEE-exclusive and cannot be replicated in Cycles without significant complexity.

```
Diffuse BSDF → Shader to RGB → ColorRamp (CONSTANT interpolation) → Emission → Output
                                          ↑
                               2 stops: shadow dark / lit base color
```

**Why EEVEE over Cycles for this project:**
- Shader to RGB node is EEVEE-exclusive — the existing toon shader system requires it
- EEVEE renders at ~2–5 seconds per frame vs Cycles at ~30–120 seconds on M1 Pro
- EEVEE + Freestyle produces clean manga outlines in one render pass
- Cycles toon shading requires Toon BSDF (a different, less flexible approach) and a separate line rendering pass

**EEVEE shadow artifact caveat:** EEVEE Next (4.2+) introduced ray-traced shadow maps that produce "stippled/staticky" artifacts where toon shaders expect hard edges. Confirmed unfixed as of 5.0 by Blender developers (classified as a limitation, not a bug).

**Mitigation for toon shadow artifacts:**
```python
# Reduce shadow resolution limit on each light object:
light.data.shadow_resolution_limit = 0.001  # Default is too coarse for toon
# Or switch lighting to AREA lights with no hard shadows for flat cel-shading
```

The safest approach for manga: use a single directional key light, keep shadow hard but accept that Freestyle outlines carry most of the visual weight. Flat lit areas look better than fighting shadow artifacts.

### Freestyle Outline Configuration (Confirmed Stable)

```python
view_layer.use_freestyle = True
freestyle = view_layer.freestyle_settings
freestyle.crease_angle = math.radians(134)  # Detect sharp edges

lineset = freestyle.linesets.new("Manga_Outlines")
lineset.select_silhouette = True
lineset.select_border = True
lineset.select_crease = True
lineset.select_external_contour = True
lineset.select_material_boundary = True

style = lineset.linestyle
style.color = (0.0, 0.0, 0.0)
style.thickness = 2.0
style.caps = 'ROUND'
```

Freestyle adds a post-process outline pass on top of EEVEE's color output. The combined result (cel-shaded color + black outlines) is the manga aesthetic. This is the existing approach in `render_setup.py` and it is correct.

### Output Format

```python
render.image_settings.file_format = 'PNG'
render.image_settings.color_mode = 'RGBA'   # Transparent background
render.film_transparent = True               # Alpha channel output
render.resolution_x = 800
render.resolution_y = 1200
```

PNG with RGBA (transparent background) is correct. The TypeScript pipeline composites renders over backgrounds before Webtoon assembly — transparency is required.

**Naming convention integration:**
Blender output: `output/ch01/raw/spyke_standing_relaxed_front.png`
Pipeline expects: `ch01_p003_v1.png` (chapter, page, version)

The TypeScript `generate` stage will need to rename/move Blender renders to match the existing naming convention. This is a simple file copy+rename — Sharp can handle it, or Node.js `fs.rename()` directly.

---

## Pose Library Data Format

### Current Approach (Inline in render_poses.py)

Poses are defined as Python dicts in `render_poses.py`:

```python
POSES = {
    "standing_relaxed": {
        "description": "Relaxed standing — arms at sides, slight weight shift",
        "bones": {
            "UpperArm.R": (-70, 0, 10),   # (x_rot, y_rot, z_rot) in degrees
            "UpperArm.L": (-70, 0, -10),
            ...
        },
    },
}
```

**This approach is correct for v3.0.** Keep it. Reasons:
- No external dependencies (no YAML parser needed inside Blender's Python)
- Bone rotations in Euler degrees are readable by artists
- Dicts are fast to iterate; no file I/O per pose
- Adding poses = editing one file, no schema concerns

**Alternative: External YAML files** (defer to v4.0 if needed). Would require adding PyYAML to Blender's Python or using Blender's built-in JSON module. Not worth the complexity for the current pose count.

### Pose Application Pattern (Works in 5.0)

```python
# Set pose bone rotation directly — no action/fcurve required
bpy.context.view_layer.objects.active = armature_obj
bpy.ops.object.mode_set(mode='POSE')

for bone_name, rotation in pose_data["bones"].items():
    if bone_name in armature_obj.pose.bones:
        bone = armature_obj.pose.bones[bone_name]
        bone.rotation_mode = 'XYZ'
        bone.rotation_euler = Euler((
            math.radians(rotation[0]),
            math.radians(rotation[1]),
            math.radians(rotation[2]),
        ), 'XYZ')

bpy.ops.object.mode_set(mode='OBJECT')
```

This pattern uses `pose.bones[name].rotation_euler` directly — the only API affected in 5.0 was the legacy action fcurve API and per-instance bone selection, neither of which this touches. Confirmed stable.

---

## Supporting Libraries (TypeScript Pipeline)

No new npm packages are required. The integration is a subprocess call. The only additions to `pipeline/src/`:

| TypeScript Addition | Purpose | Implementation |
|---------------------|---------|----------------|
| `blender-render.ts` | Spawn Blender subprocess, handle exit codes | Node.js `child_process.spawn` |
| `blender-manifest.ts` | Track which panels have been rendered | Extend existing manifest pattern |

The existing pipeline stages (overlay, assemble) remain unchanged. Blender renders drop into `output/ch01/raw/` — the same directory the overlay stage reads from.

---

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Blender 5.0.1 UI | Manual pose refinement, shader inspection, weight painting | Open `.blend` file directly for iterative work |
| Blender Scripting tab | Interactive script testing | Faster than full build → render cycle for shader tweaks |
| Blender Python console | API exploration, property inspection | `bpy.context.scene.eevee.` tab-completion reveals current properties |
| `bpy.app.version` | Version guard in scripts | `bpy.app.version >= (5, 0, 0)` for 5.0-specific paths |

---

## Installation

No new installations required. Blender 5.0.1 is already installed. The `bpy` module is Blender's embedded Python — no pip install.

**Blender binary path (macOS):**
```bash
/Applications/Blender.app/Contents/MacOS/Blender
```

**Verify Blender version from terminal:**
```bash
/Applications/Blender.app/Contents/MacOS/Blender --version
```

**TypeScript pipeline — no new packages needed:**
```bash
# Verify no new deps required
cd /Users/dondemetrius/Code/plasma/pipeline
# No npm install needed for Blender subprocess integration
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| EEVEE + Freestyle for rendering | Cycles + Toon BSDF | If headless CI rendering ever needed (Cycles supports true headless on macOS) |
| `child_process.spawn` (Node.js built-in) | blender-node npm package | blender-node is experimental, low stars, not maintained — avoid |
| Inline Python dicts for pose library | External YAML/JSON files | Only if poses grow beyond ~20 and need to be edited by non-programmers |
| Direct `bone.rotation_euler` | Keyframe/action API | Only if exporting animations (not applicable for static panel renders) |
| EEVEE render with display | EEVEE headless | Not possible on macOS — no workaround exists without virtual display server |
| EEVEE shadow mitigation (low resolution limit) | Cycles for shadow quality | Cycles shadows are clean but render time is prohibitive (30–120s vs 2–5s) |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `blender --background` with EEVEE on macOS | EEVEE requires display context — renders silently fail or produce empty files | Launch Blender without `--background` flag; or use Cycles if headless required |
| `scene.render.engine = 'BLENDER_EEVEE_NEXT'` | Renamed to `BLENDER_EEVEE` in Blender 5.0 | `scene.render.engine = 'BLENDER_EEVEE'` |
| `scene.eevee.shadow_cascade_size` | Removed in Blender 4.2, gone in 5.0 | Configure shadow resolution per light object |
| `scene.eevee.shadow_cube_size` | Same as above | Per-light shadow settings |
| `action.fcurves` / `action.groups` | Legacy action API removed in Blender 5.0 | `channelbag.fcurves` via `bpy_extras.anim_utils` (only needed if adding keyframes) |
| Blender's Shader to RGB with Cycles | Node is EEVEE-exclusive — Cycles will error | Use EEVEE for toon shading; use Cycles Toon BSDF if Cycles is required |
| System Python packages inside Blender scripts | Blender has its own embedded Python — pip installs to system Python are invisible | All imports must use Blender's embedded modules or be copied into the script directory |

---

## Version Compatibility

| Component | Version | Compatible With | Notes |
|-----------|---------|-----------------|-------|
| Blender | 5.0.1 | macOS 13.0+, Apple Silicon | Confirmed installed |
| EEVEE engine ID | `BLENDER_EEVEE` | 5.0+ (was `BLENDER_EEVEE_NEXT` in 4.0–4.x) | Breaking change from 4.x |
| `bpy.app.version` | tuple `(5, 0, 1)` | Use for version guards | Compare with `>=` tuples |
| `taa_render_samples` | exists in 5.0 | `scene.eevee.taa_render_samples` | Confirmed in 5.0 API docs |
| Freestyle lineset API | stable | No changes in 5.0 | `view_layer.freestyle_settings.linesets` |
| `ShaderNodeMix` RGBA | stable | `data_type='RGBA'`, inputs `[6]`/`[7]` | Unchanged in 5.0 |
| Pose bone `rotation_euler` | stable | Direct assignment works in 5.0 | Core posing API unchanged |
| `mathutils.Euler` | stable | `from mathutils import Euler` | Unchanged |
| Node.js `child_process` | Node 20.x | `spawn()` with stdio pipes | No version concerns |

---

## Stack Patterns by Variant

**If rendering single panel for pipeline (production):**
- Launch without `--background`, pass pose + view args
- Output to `output/ch01/raw/spyke_{pose}_{view}.png`
- TypeScript renames to `ch01_p003_v1.png` after render

**If debugging shader or pose interactively:**
- Open `.blend` file with Blender UI: `blender 3d_models/output/spyke/spyke.blend`
- Run scripts from Scripting tab
- Faster iteration than CLI round-trip

**If true headless rendering ever required (CI/CD):**
- Switch render engine to `CYCLES`
- Replace Shader to RGB node tree with Cycles Toon BSDF
- Freestyle still works with Cycles
- Accept 10–20x render time increase

**If shadow artifacts on EEVEE are unacceptable:**
- Set light shadow type to `AREA` with soft shadows
- Disable cast shadows on key light, rely on Freestyle outlines for depth
- Or: reduce `shadow_resolution_limit` to 0.001 on each Sun light

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| EEVEE engine ID changed to `BLENDER_EEVEE` in 5.0 | [Blender 5.0 Python API release notes](https://developer.blender.org/docs/release_notes/5.0/python_api/) | HIGH |
| `shadow_cascade_size` / `shadow_cube_size` removed | [Blender 5.0 Python API release notes](https://developer.blender.org/docs/release_notes/5.0/python_api/) + Blender 4.2 migration community reports | HIGH |
| EEVEE does NOT support headless render on macOS | [Blender 5.0 Manual EEVEE Limitations](https://docs.blender.org/manual/en/latest/render/eevee/limitations/limitations.html) + multiple community confirmations 2024–2025 | HIGH |
| Shader to RGB is EEVEE-exclusive | [Blender 5.0 Manual Shader to RGB](https://docs.blender.org/manual/en/latest/render/shader_nodes/color/shader_to_rgb.html) | HIGH |
| `taa_render_samples` exists in Blender 5.0 | [SceneEEVEE bpy API docs](https://docs.blender.org/api/current/bpy.types.SceneEEVEE.html) | HIGH |
| Legacy action API `action.fcurves` removed in 5.0 | [Blender 5.0 Python API release notes](https://developer.blender.org/docs/release_notes/5.0/python_api/) + community migration reports | HIGH |
| `bone.rotation_euler` direct assignment stable in 5.0 | [Blender 5.0 Animation & Rigging release notes](https://developer.blender.org/docs/release_notes/5.0/animation_rigging/) — no mention of pose bone rotation changes | HIGH |
| Freestyle lineset/linestyle API stable | [FreestyleSettings bpy API docs](https://docs.blender.org/api/current/bpy.types.FreestyleSettings.html) — no changes noted in 5.0 | HIGH |
| EEVEE Next toon shadow artifacts unresolved in 5.0 | [Blender issue #128913](https://projects.blender.org/blender/blender/issues/128913) — classified as limitation, not bug | HIGH |
| `child_process.spawn` for Blender subprocess | Node.js official docs + Blender CLI rendering documentation | HIGH |
| Bone selection now per-instance (5.0 breaking change) | [Blender 5.0 Animation & Rigging release notes](https://developer.blender.org/docs/release_notes/5.0/animation_rigging/) | HIGH |
| EEVEE shadow artifact mitigation via `shadow_resolution_limit` | [Blender Artists community thread](https://blenderartists.org/t/did-eevee-next-break-everyone-elses-toon-shaders/1539334) + official developer response | MEDIUM |
| EEVEE M1 crash/shadow buffer issues on macOS 15 | [Blender issue #132664](https://projects.blender.org/blender/blender/issues/132664) — open as of early 2026 | MEDIUM |

---

*Stack research for: v3.0 Blender 3D Rendering Pipeline (Blender 5.0.1, M1 Pro, EEVEE toon shading + Freestyle)*
*Researched: 2026-02-25*
