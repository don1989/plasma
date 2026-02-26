# Phase 11: Blender Environment Validation - Research

**Researched:** 2026-02-26
**Domain:** Blender 5.0.1 Python API, EEVEE rendering, macOS M1 Pro headless rendering
**Confidence:** MEDIUM (API changes are HIGH confidence, headless rendering behavior is MEDIUM — must be validated empirically)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Claude's discretion on which approach works (--background, visible window, or other)
- If visible Blender window is needed, that's acceptable — this is a dev machine, not CI
- The headless workaround must be **transparent to the TypeScript pipeline** — Python render scripts handle the mode internally, TypeScript just calls "render"
- Phase 11 must **document + recommend** the headless approach for Phase 14 integration (not just document what happened)
- Initial validation: **visual spot check** by user (toon shade bands visible, Freestyle outlines present, transparent background)
- Also create **automated pixel checks** for regression detection in later phases (alpha channel, edge detection for outlines, color histogram for shade bands)
- **Blockout quality is sufficient** — as long as toon shader produces visible shade bands and outlines on primitive geometry, that's a pass. Model refinement is Phase 12.
- Use **neutral pose** (default from build_spyke.py)
- Camera angle selection is Claude's discretion based on what existing scripts support
- **Fail fast** on first Blender API error — clear message pointing to the broken call
- **Target Blender 5.0.1 only** — no version guards, no backward compatibility with 4.x
- **Verbose progress output** — print each step as it runs (creating armature, applying shader, etc.)
- Refactoring scope is Claude's discretion — surgical fixes vs small refactors judged per file
- Establish a **new output convention** (don't just use existing 3d_models/output/spyke/ as-is)
- Pipeline renders (PNGs for TypeScript) go to **output/ch-XX/raw/** — same location the existing pipeline expects
- **.blend files are build artifacts** — generated on demand, added to .gitignore. Not committed to git.
- Test render location is Claude's discretion

### Claude's Discretion
- Headless rendering approach (whatever works on macOS M1 Pro)
- Camera angle(s) for test render
- Test render output directory
- Whether to refactor or surgically fix each script file

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENV-01 | Blender 5.0.1 API fixes applied — engine identifier corrected to `BLENDER_EEVEE`, `ShaderNodeMix` socket access changed to named (`'A'`/`'B'`), deprecated shadow properties guarded | Detailed API break analysis in "API Break Audit" section with exact line numbers and fixes |
| ENV-02 | EEVEE headless rendering validated on M1 Pro macOS — confirmed whether `--background` produces correct output or requires workaround | "Headless Rendering" section documents the fundamental limitation and recommended workaround |
| ENV-03 | `build_spyke.py` runs successfully on Blender 5.0.1 and produces `spyke.blend` with blockout model, armature, toon shaders, cameras, and Freestyle outlines | Script audit in "API Break Audit" identifies all fixes needed across all 4 Python files |
| ENV-04 | A test render of the blockout at 800x1200 produces a correct RGBA PNG with toon shading, Freestyle outlines, and transparent background | Render settings audit confirms existing render_setup.py configuration is mostly correct, with specific fixes identified |
</phase_requirements>

## Summary

Phase 11 requires fixing the existing Blender Python scripts (`build_spyke.py`, `generate_spyke.py`, `manga_shader.py`, `render_setup.py`, `render_poses.py`) to work with Blender 5.0.1, then validating that the full pipeline (model generation, shader application, render setup, and image rendering) produces correct output on macOS M1 Pro.

The research identified **5 confirmed API breaks** and **2 probable breaks** in the existing code. The three breaks originally called out (engine identifier, ShaderNodeMix sockets, shadow properties) are confirmed, plus additional issues with `shade_smooth` operator changes and potential `ShaderNodeBsdfGlossy` deprecation. The fixes are surgical — each is a localized change, not a rewrite.

The most significant finding is that **EEVEE headless rendering (`--background` mode) is fundamentally unsupported on macOS**, and has been since EEVEE's inception. On macOS, EEVEE requires a GPU context that is only available when a display connection exists. However, **`--background` mode on macOS with Metal backend does appear to work for some users on Apple Silicon in recent Blender versions (4.2+/5.0)**, though with known stability issues (freezing, memory leaks). The recommended approach is to **try `--background` first** and fall back to a visible-window workaround if it fails. Either way, the Python scripts must handle this transparently.

**Primary recommendation:** Fix all 5 confirmed API breaks, run `build_spyke.py` with `--background` to test, and implement a fallback rendering mode if `--background` produces errors or blank output. The test render should use `Cam_Front` (neutral pose, full body) at 800x1200.

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Blender | 5.0.1 | 3D modeling, rendering, Python scripting host | Installed on user's machine, target version per requirements |
| Python (Blender-embedded) | 3.12+ | Script execution via `bpy` API | Ships with Blender 5.0.1, no external Python needed |
| EEVEE | (built into Blender 5.0.1) | Real-time renderer with Shader-to-RGB for toon shading | Only renderer that supports Shader-to-RGB node (Cycles cannot) |
| Freestyle | (built into Blender 5.0.1) | Vector outline rendering | Built-in manga outline system, no addon needed |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Pillow (PIL) | any recent | Automated pixel validation of test renders | For alpha channel checks, edge detection, histogram analysis |
| Sharp (in pipeline/) | existing | Image processing in TypeScript pipeline | Already installed — for downstream Webtoon assembly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Freestyle outlines | Grease Pencil Line Art modifier | More control but deferred to ADV-02 requirement |
| EEVEE | Cycles | Cycles cannot do Shader-to-RGB — incompatible with toon pipeline |
| Pillow for validation | OpenCV | Overkill for pixel spot checks; Pillow is lighter |

**Installation:**
No installation needed — all tools are either built into Blender or already in the project. If Pillow is needed for automated pixel checks, it can be installed in Blender's Python:
```bash
/Applications/Blender.app/Contents/Resources/5.0/python/bin/python3 -m pip install Pillow
```
Or use a standalone Python with Pillow to validate the output PNGs independently of Blender.

## Architecture Patterns

### Recommended Script Structure
```
3d_models/
├── build_spyke.py              # Master orchestrator — runs all steps
├── characters/spyke/
│   └── generate_spyke.py       # Model geometry + armature
├── common/
│   ├── manga_shader.py         # Toon shader conversion
│   └── render_setup.py         # Cameras, lighting, Freestyle, render config
└── render/
    └── render_poses.py         # Batch rendering with pose application
```

This structure already exists and is well-organized. No restructuring needed.

### Pattern 1: Fail-Fast Error Handling
**What:** Wrap each pipeline step in try/except, print the step name before execution, and abort on first error with a clear message.
**When to use:** Every step in `build_spyke.py` and `render_poses.py`.
**Example:**
```python
def main():
    steps = [
        ("Generating character blockout", generate_spyke.main),
        ("Applying manga toon shaders", manga_shader.main),
        ("Setting up render pipeline", render_setup.main),
    ]
    for step_name, step_fn in steps:
        print(f"\n>>> {step_name}...")
        try:
            step_fn()
        except Exception as e:
            print(f"\nFATAL: '{step_name}' failed: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
    print("\nAll steps completed successfully.")
```

### Pattern 2: Headless Rendering Abstraction
**What:** The render script detects whether it has a valid GPU context and adjusts behavior accordingly, transparent to callers.
**When to use:** In `render_poses.py` or a new render wrapper.
**Example:**
```python
def can_render_eevee():
    """Check if EEVEE rendering is possible in current context."""
    try:
        # Attempt a tiny test render
        scene = bpy.context.scene
        old_x, old_y = scene.render.resolution_x, scene.render.resolution_y
        scene.render.resolution_x = 8
        scene.render.resolution_y = 8
        scene.render.filepath = "/tmp/blender_eevee_test"
        bpy.ops.render.render(write_still=True)
        scene.render.resolution_x = old_x
        scene.render.resolution_y = old_y
        return True
    except Exception:
        return False
```

### Pattern 3: Named Socket Access for ShaderNodeMix
**What:** Always use named socket identifiers (`'A'`, `'B'`, `'Factor'`, `'Result'`) instead of numeric indices when connecting ShaderNodeMix nodes.
**When to use:** All shader node connection code.
**Example:**
```python
# WRONG (fragile, breaks across Blender versions):
links.new(ramp.outputs['Color'], mix.inputs[6])    # A
links.new(rim_ramp.outputs['Color'], mix.inputs[7]) # B

# CORRECT (stable named access):
links.new(ramp.outputs['Color'], mix.inputs['A'])
links.new(rim_ramp.outputs['Color'], mix.inputs['B'])

# For output:
links.new(mix.outputs['Result'], next_node.inputs['Color'])
```

### Anti-Patterns to Avoid
- **Numeric socket indexing on ShaderNodeMix:** Socket indices change between Blender versions. Always use named access (`inputs['A']`, not `inputs[6]`).
- **Version-conditional engine identifiers:** The user decided "target 5.0.1 only" — do not write `if bpy.app.version >= (4, 0, 0)` guards. Hardcode `BLENDER_EEVEE`.
- **Accessing removed shadow properties without guards:** `shadow_cascade_size` and `shadow_cube_size` were removed in the EEVEE rewrite (4.2+). Use `hasattr()` only as a safety net, not as version detection.
- **Committing `.blend` files:** Per user decision, these are build artifacts. Add `*.blend` to `.gitignore`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toon shading | Custom fragment shader | Shader-to-RGB + ColorRamp (existing approach) | Blender's built-in Shader-to-RGB is the only stable way in EEVEE |
| Outline rendering | Custom edge detection | Freestyle (existing approach) | Freestyle produces clean vector outlines at any resolution |
| Image validation | Manual pixel inspection | Pillow/PIL for automated checks | Reproducible, scriptable, catches regressions |
| Headless detection | Complex platform checks | Simple try-render approach | Only reliable way to know if EEVEE works is to try it |

**Key insight:** The existing scripts already use the right approach for toon shading (Shader-to-RGB + ColorRamp) and outlines (Freestyle). The work is about fixing API breaks, not redesigning the rendering strategy.

## Common Pitfalls

### Pitfall 1: ShaderNodeMix Socket Indexing Breaks Silently
**What goes wrong:** The ShaderNodeMix node's socket indices depend on the `data_type` property. When `data_type='RGBA'`, the node creates different sockets than when `data_type='FLOAT'`. Numeric indices like `inputs[6]` and `inputs[7]` worked in specific Blender versions but may shift when socket internals change.
**Why it happens:** ShaderNodeMix is a polymorphic node — its sockets change based on `data_type` and `factor_mode` settings. Blender does not guarantee stable numeric indices across versions.
**How to avoid:** Always use named socket access: `inputs['A']`, `inputs['B']`, `inputs['Factor']`, `outputs['Result']`.
**Warning signs:** `KeyError` or `IndexError` on `node.inputs[N]`, or links connecting to wrong sockets (visible as incorrect shader results).

### Pitfall 2: EEVEE Headless Rendering Produces Blank/Black Images
**What goes wrong:** On macOS, EEVEE requires a Metal GPU context. In `--background` mode, the GPU context may not initialize properly, resulting in black or completely transparent renders.
**Why it happens:** EEVEE is fundamentally a rasterization engine that needs GPU access. On macOS, headless mode may not establish the Metal context needed for rendering.
**How to avoid:** Test render a small image first. If it fails or produces blank output, fall back to launching Blender without `--background` (visible window). The Python script should detect the failure and report it clearly.
**Warning signs:** Output PNG is all-black, all-transparent, or missing entirely. Blender crashes or hangs during render.

### Pitfall 3: EEVEE Engine Identifier Mismatch (Silent Fallback)
**What goes wrong:** Using `BLENDER_EEVEE_NEXT` (the identifier from Blender 4.0-4.5) on Blender 5.0 may cause a silent fallback to a different renderer or raise an error.
**Why it happens:** Blender 5.0 renamed the engine identifier back to `BLENDER_EEVEE` (dropping the `_NEXT` suffix that was used during the rewrite period).
**How to avoid:** Set `scene.render.engine = 'BLENDER_EEVEE'` unconditionally (per user's "no version guards" decision).
**Warning signs:** Render output looks different than expected (wrong shading style), or `scene.render.engine` doesn't match after setting it.

### Pitfall 4: Shadow Properties Cause AttributeError
**What goes wrong:** The existing `manga_shader.py` accesses `scene.eevee.shadow_cascade_size` and `scene.eevee.shadow_cube_size`. These properties were removed in EEVEE's ray-traced shadow rewrite (Blender 4.2+). Accessing them throws `AttributeError`.
**Why it happens:** EEVEE switched from shadow maps to Virtual Shadow Maps in 4.2. The old shadow map size properties no longer exist.
**How to avoid:** The existing code already uses `hasattr()` guards. Verify these guards are in place and that the code path degrades gracefully (simply skips the property if missing).
**Warning signs:** `AttributeError: 'SceneEEVEE' object has no attribute 'shadow_cascade_size'`.

### Pitfall 5: shade_smooth() Operator May Behave Differently
**What goes wrong:** `bpy.ops.object.shade_smooth()` in Blender 4.1+ may add an auto-smooth modifier instead of just setting smooth shading. This could affect how the toon shader interacts with mesh normals.
**Why it happens:** Blender 4.1 overhauled auto-smooth to be modifier-based. The `shade_smooth` operator's behavior changed.
**How to avoid:** Test that the existing `shade_smooth()` calls in `generate_spyke.py` produce acceptable results. If meshes have incorrect normals (visible as weird shading bands), the smooth shading may need adjustment.
**Warning signs:** Unexpected shading artifacts on the blockout model, extra modifiers on mesh objects.

### Pitfall 6: Blender Freezes During EEVEE Render on Apple Silicon
**What goes wrong:** Bug #127033 reports that EEVEE rendering on Apple Silicon can make Blender completely unresponsive, with memory usage climbing until freeze.
**Why it happens:** Metal GPU driver interaction issue on Apple Silicon, especially during long renders.
**How to avoid:** Render single still images (not animations). Keep render resolution reasonable (800x1200 is fine). Set a timeout when spawning Blender from TypeScript pipeline (Phase 14 concern).
**Warning signs:** Blender process becomes unresponsive, memory usage climbs, render never completes.

## Code Examples

### Fix 1: Engine Identifier (manga_shader.py line 194)
```python
# BEFORE (broken on Blender 5.0.1):
scene.render.engine = 'BLENDER_EEVEE_NEXT' if bpy.app.version >= (4, 0, 0) else 'BLENDER_EEVEE'

# AFTER (Blender 5.0.1 only):
scene.render.engine = 'BLENDER_EEVEE'
```
Source: [Blender 5.0 Release Notes - EEVEE](https://developer.blender.org/docs/release_notes/5.0/eevee/)

### Fix 2: ShaderNodeMix Socket Access (manga_shader.py lines 123-124, 152-153)
```python
# BEFORE (fragile numeric indexing):
links.new(ramp.outputs['Color'], mix.inputs[6])       # A
links.new(rim_ramp.outputs['Color'], mix.inputs[7])    # B
# ...
links.new(mix.outputs[2], spec_mix.inputs[6])
links.new(spec_ramp.outputs['Color'], spec_mix.inputs[7])
final_color_output = spec_mix.outputs[2]
# ...
final_color_output = mix.outputs[2]

# AFTER (named socket access):
links.new(ramp.outputs['Color'], mix.inputs['A'])
links.new(rim_ramp.outputs['Color'], mix.inputs['B'])
# ...
links.new(mix.outputs['Result'], spec_mix.inputs['A'])
links.new(spec_ramp.outputs['Color'], spec_mix.inputs['B'])
final_color_output = spec_mix.outputs['Result']
# ...
final_color_output = mix.outputs['Result']
```
Source: [ShaderNodeMix API](https://docs.blender.org/api/current/bpy.types.ShaderNodeMix.html), [Blender 5.0 Python API](https://developer.blender.org/docs/release_notes/5.0/python_api/)

### Fix 3: Shadow Properties Guard (manga_shader.py lines 197-200)
```python
# BEFORE (may crash if properties removed):
if hasattr(scene.eevee, 'shadow_cascade_size'):
    scene.eevee.shadow_cascade_size = '2048'
if hasattr(scene.eevee, 'shadow_cube_size'):
    scene.eevee.shadow_cube_size = '1024'

# AFTER (same logic, but these properties definitely don't exist in 5.0.1):
# These properties were removed in Blender 4.2 (Virtual Shadow Maps replaced shadow maps).
# The hasattr guards already handle this correctly — the code will silently skip.
# No change needed, but add a comment explaining why:
# NOTE: shadow_cascade_size and shadow_cube_size were removed in Blender 4.2+
# (EEVEE switched to Virtual Shadow Maps). These guards are kept for documentation.
if hasattr(scene.eevee, 'shadow_cascade_size'):
    scene.eevee.shadow_cascade_size = '2048'
if hasattr(scene.eevee, 'shadow_cube_size'):
    scene.eevee.shadow_cube_size = '1024'
```
Source: [Blender 5.0 EEVEE Release Notes](https://developer.blender.org/docs/release_notes/5.0/eevee/)

### Fix 4: ShaderNodeBsdfGlossy Deprecation Check (manga_shader.py line 129)
```python
# CURRENT (may need updating):
glossy = nodes.new('ShaderNodeBsdfGlossy')

# The Glossy BSDF was merged into the Principled BSDF in Blender 4.0,
# but ShaderNodeBsdfGlossy still exists as a standalone node.
# VALIDATION NEEDED: Confirm 'ShaderNodeBsdfGlossy' still works in 5.0.1.
# If deprecated, replace with ShaderNodeBsdfPrincipled configured for glossy.
```
Source: [Blender 4.0 Python API](https://developer.blender.org/docs/release_notes/4.0/python_api/) — MEDIUM confidence, needs empirical validation.

### Automated Pixel Validation Script
```python
"""Validate test render output — run with standard Python (not Blender)."""
from PIL import Image
import numpy as np
import sys

def validate_render(image_path):
    img = Image.open(image_path).convert('RGBA')
    pixels = np.array(img)
    width, height = img.size

    results = {}

    # Check 1: Correct dimensions
    results['dimensions'] = (width == 800 and height == 1200)

    # Check 2: Has transparent background (alpha channel not all 255)
    alpha = pixels[:, :, 3]
    transparent_ratio = np.sum(alpha < 128) / alpha.size
    results['has_transparency'] = transparent_ratio > 0.1  # At least 10% transparent

    # Check 3: Has non-transparent content (character is rendered)
    opaque_ratio = np.sum(alpha > 128) / alpha.size
    results['has_content'] = opaque_ratio > 0.05  # At least 5% opaque

    # Check 4: Has dark outlines (Freestyle) — look for near-black pixels
    opaque_mask = alpha > 128
    if np.any(opaque_mask):
        rgb = pixels[:, :, :3]
        brightness = np.mean(rgb, axis=2)
        dark_pixels = np.sum((brightness < 30) & opaque_mask)
        results['has_outlines'] = dark_pixels > 100  # Some dark outline pixels

    # Check 5: Has shade bands (toon shading produces distinct color clusters)
    # Simple check: variance in brightness across opaque region
    if np.any(opaque_mask):
        opaque_brightness = brightness[opaque_mask]
        results['has_shade_bands'] = np.std(opaque_brightness) > 20

    return results

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else '3d_models/output/spyke/test_render.png'
    results = validate_render(path)
    all_pass = all(results.values())
    for check, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"  [{status}] {check}")
    sys.exit(0 if all_pass else 1)
```

## API Break Audit — Complete Script Analysis

### File: `manga_shader.py` (4 breaks)

| Line | Issue | Severity | Fix |
|------|-------|----------|-----|
| 194 | Engine identifier uses version conditional returning `BLENDER_EEVEE_NEXT` | HIGH — will set wrong engine | Hardcode `'BLENDER_EEVEE'` |
| 123-124 | `mix.inputs[6]` / `mix.inputs[7]` — numeric socket access | HIGH — likely wrong sockets | Use `mix.inputs['A']` / `mix.inputs['B']` |
| 152-153 | `spec_mix.inputs[6]` / `spec_mix.inputs[7]` — same issue | HIGH — same fix | Use `spec_mix.inputs['A']` / `spec_mix.inputs['B']` |
| 155, 157 | `spec_mix.outputs[2]` / `mix.outputs[2]` — numeric output | HIGH — likely wrong output | Use `.outputs['Result']` |
| 197-200 | `shadow_cascade_size` / `shadow_cube_size` — removed properties | LOW — already guarded with `hasattr()` | No change needed, add comment |
| 129 | `ShaderNodeBsdfGlossy` — may be deprecated | MEDIUM — needs validation | Test in 5.0.1, replace if needed |

### File: `generate_spyke.py` (0-1 breaks)

| Line | Issue | Severity | Fix |
|------|-------|----------|-----|
| 155, 214-216, etc. | `bpy.ops.object.shade_smooth()` — behavior changed in 4.1+ | LOW — likely still works but may add auto-smooth modifier | Test; if problematic, use `obj.data.polygons.foreach_set('use_smooth', [True] * len(obj.data.polygons))` |
| 125 | `inputs['Specular IOR Level']` — correct for 4.0+ | NONE — already updated | No change needed |

### File: `render_setup.py` (0 breaks)

| Line | Issue | Severity | Fix |
|------|-------|----------|-----|
| (all) | No deprecated API usage detected | NONE | Freestyle API unchanged in 5.0.1 |
| 248 | `scene.eevee.taa_render_samples` | NONE — confirmed still exists | No change needed |

### File: `render_poses.py` (0 breaks)

| Line | Issue | Severity | Fix |
|------|-------|----------|-----|
| (all) | No deprecated API usage detected | NONE | Pose bone manipulation API unchanged |

### File: `build_spyke.py` (0 breaks)

| Line | Issue | Severity | Fix |
|------|-------|----------|-----|
| (all) | Orchestrator script — delegates to modules | NONE | Only needs fail-fast error wrapping |

**Summary: 4-5 confirmed breaks, all in `manga_shader.py`. 1 possible break in `generate_spyke.py` (shade_smooth behavior). Other files are clean.**

## Headless Rendering — Deep Dive

### The Problem

EEVEE is a GPU-accelerated rasterization engine. It requires a Metal GPU context on macOS. The `--background` flag tells Blender to run without a UI, but whether this establishes a GPU context on macOS has been inconsistent across versions.

### What the Evidence Says

| Source | Finding | Confidence |
|--------|---------|------------|
| [Blender bug #125333](https://projects.blender.org/blender/blender/issues/125333) | EEVEE command-line rendering on Mac freezes with increasing memory usage (Blender 4.2, M2) | HIGH |
| [Blender bug #127033](https://projects.blender.org/blender/blender/issues/127033) | EEVEE under Apple Silicon renders Blender completely unresponsive during render | HIGH |
| [GPU rendering docs](https://surf-visualization.github.io/blender-course/basics/rendering_lighting_materials/gpu_rendering/) | "EEVEE doesn't support headless rendering on Windows and macOS" | MEDIUM |
| [Bug #125333 resolution](https://projects.blender.org/blender/blender/issues/125333) | Fix expected in Blender 4.3 / 4.2.4 | MEDIUM |

### Recommended Approach

**Strategy: Try `--background` first, fall back to visible window.**

1. **Primary:** Run Blender with `--background --python render_script.py`. If EEVEE renders correctly (non-empty PNG, correct dimensions, has opaque pixels), use this mode.

2. **Fallback:** If `--background` produces blank output or crashes, run Blender without `--background` (launches with visible window). The render script calls `bpy.ops.render.render(write_still=True)` and then quits. The window appears briefly but closes automatically.

3. **Implementation:** The render Python script should be mode-agnostic — it renders regardless of whether Blender was started with `--background` or not. The **calling convention** (how TypeScript spawns Blender) is what changes, not the render script itself.

```python
# In render script — always works regardless of mode:
bpy.ops.render.render(write_still=True)

# The difference is in the CLI invocation:
# Mode A (headless):  blender --background file.blend --python render.py
# Mode B (visible):   blender file.blend --python render.py
```

4. **Phase 11 deliverable:** Document which mode works. Recommend for Phase 14.

### Empirical Test Plan

The headless question **cannot be fully answered by research alone**. Phase 11 implementation must:

1. Run: `blender --background --python 3d_models/build_spyke.py` — does it build the .blend?
2. Run: `blender 3d_models/output/spyke/spyke.blend --background --python 3d_models/render/render_poses.py -- --views front` — does it produce a valid PNG?
3. If step 2 fails (blank/black/crash), retry without `--background`
4. Document findings for Phase 14 integration

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `BLENDER_EEVEE` → `BLENDER_EEVEE_NEXT` | `BLENDER_EEVEE` (returned to original name) | Blender 5.0 (2025) | Engine identifier in scripts must use `BLENDER_EEVEE` |
| Shadow map size properties (`shadow_cascade_size`, `shadow_cube_size`) | Virtual Shadow Maps (no user-facing size controls) | Blender 4.2 (2024) | Properties removed; `hasattr()` guard needed |
| `ShaderNodeMixRGB` (legacy) | `ShaderNodeMix` with `data_type` property | Blender 3.4 (2023) | Scripts already use `ShaderNodeMix` — correct |
| `mesh.use_auto_smooth` property | Smooth By Angle modifier | Blender 4.1 (2024) | `shade_smooth()` operator behavior may differ |
| Principled BSDF `Specular` input | `Specular IOR Level` input | Blender 4.0 (2023) | Scripts already use new name — correct |

**Deprecated/outdated:**
- `BLENDER_EEVEE_NEXT`: Was the identifier during the EEVEE rewrite (4.0-4.5 era). Replaced with `BLENDER_EEVEE` in 5.0.
- `shadow_cascade_size` / `shadow_cube_size`: Removed with Virtual Shadow Maps in 4.2.
- `mesh.use_auto_smooth`: Removed in 4.1, replaced by modifier.

## Open Questions

1. **Does `--background` mode actually render EEVEE output on Blender 5.0.1 + macOS M1 Pro?**
   - What we know: Historically unsupported. Recent versions may have fixed this. Bug #125333 expected fix in 4.3.
   - What's unclear: Whether Blender 5.0.1 specifically works on this specific hardware.
   - Recommendation: **Empirical test required** in Phase 11 Wave 1. Cannot be resolved through research alone.

2. **Is `ShaderNodeBsdfGlossy` still a valid node type in Blender 5.0.1?**
   - What we know: The Glossy BSDF was merged into Principled BSDF in 4.0, but the standalone node may still exist for backward compatibility.
   - What's unclear: Whether `nodes.new('ShaderNodeBsdfGlossy')` raises an error in 5.0.1.
   - Recommendation: Test during implementation. If it fails, replace with `ShaderNodeBsdfPrincipled` configured with high metallic/low roughness.

3. **Does `bpy.ops.object.shade_smooth()` produce unexpected modifiers in 5.0.1?**
   - What we know: Blender 4.1+ changed auto-smooth to be modifier-based. The `shade_smooth` operator may add a "Smooth by Angle" modifier.
   - What's unclear: Whether this affects toon shader appearance on blockout geometry.
   - Recommendation: Run the script, check for extra modifiers on mesh objects. If problematic, use per-polygon smooth setting instead.

## .gitignore Updates Needed

Per user decision, `.blend` files are build artifacts. The following additions are needed:

```gitignore
# Blender build artifacts
*.blend
*.blend1
3d_models/output/
```

Note: `output/` is already gitignored at the root level, but `3d_models/output/` is a separate directory that needs explicit coverage. The test render output location should also be covered.

## Sources

### Primary (HIGH confidence)
- [Blender 5.0 Release Notes - EEVEE](https://developer.blender.org/docs/release_notes/5.0/eevee/) — engine identifier change confirmed
- [Blender 5.0 Release Notes - Python API](https://developer.blender.org/docs/release_notes/5.0/python_api/) — API breaking changes overview
- [Blender 5.0.1 Corrective Releases](https://developer.blender.org/docs/release_notes/5.0/corrective_releases/) — 132 bug fixes in 5.0.1
- [ShaderNodeMix API docs](https://docs.blender.org/api/current/bpy.types.ShaderNodeMix.html) — socket naming reference
- [Blender 4.0 Python API](https://developer.blender.org/docs/release_notes/4.0/python_api/) — Principled BSDF socket renames
- [Blender 4.1 Modeling Release Notes](https://developer.blender.org/docs/release_notes/4.1/modeling/) — auto-smooth modifier change

### Secondary (MEDIUM confidence)
- [Blender bug #125333](https://projects.blender.org/blender/blender/issues/125333) — EEVEE command-line rendering freeze on Mac (fix expected in 4.3/4.2.4)
- [Blender bug #127033](https://projects.blender.org/blender/blender/issues/127033) — EEVEE Apple Silicon unresponsiveness
- [GPU rendering course docs](https://surf-visualization.github.io/blender-course/basics/rendering_lighting_materials/gpu_rendering/) — headless EEVEE limitation documented

### Tertiary (LOW confidence)
- [devtalk.blender.org headless EEVEE thread](https://devtalk.blender.org/t/blender-2-8-unable-to-open-a-display-by-the-rendering-on-the-background-eevee/1436) — historical context, may not reflect 5.0.1 behavior
- [Shader node socket feedback thread](https://devtalk.blender.org/t/feedback-on-breaking-python-api-changes-for-shader-nodes/23281) — discusses planned socket API changes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Blender 5.0.1 is installed, EEVEE + Freestyle is the only viable approach for this project
- Architecture: HIGH — existing script structure is sound, only needs API fixes
- API breaks: HIGH — 4 confirmed breaks with exact line numbers and fixes
- Headless rendering: MEDIUM — documented as unsupported historically, may work in 5.0.1, requires empirical validation
- Pitfalls: MEDIUM — based on official docs and bug reports, but macOS-specific behavior needs testing

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (Blender API is stable within point releases; 5.0.1 is current)
