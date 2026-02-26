# Plan 01: Blender 5.0.1 API Fixes and Build Validation

```yaml
phase: 11
plan: 1
title: "Blender 5.0.1 API Fixes and Build Validation"
wave: 1
depends_on: []
requirements:
  - ENV-01
  - ENV-03
files_modified:
  - 3d_models/common/manga_shader.py
  - 3d_models/build_spyke.py
  - .gitignore
autonomous: true
```

## Goal

Fix all Blender 5.0.1 API breaks in existing Python scripts and validate that `build_spyke.py` runs successfully, producing a complete `spyke.blend` file with model, armature, toon shaders, cameras, and Freestyle outlines.

## Context

The existing 3D model scripts were written for Blender 4.x and have never been run on Blender 5.0.1. Research identified 4 confirmed API breaks in `manga_shader.py` and 0-1 possible breaks in other files. All breaks are surgical — localized changes, not rewrites.

**User decisions (locked):**
- Target Blender 5.0.1 ONLY — no version guards, no backward compatibility
- Fail fast on first error with clear message
- Verbose progress output (print each step)
- `.blend` files are build artifacts — add to `.gitignore`, never commit
- Refactoring scope is Claude's discretion

**Blender binary location:** `/Applications/Blender.app/Contents/MacOS/Blender`

## Tasks

<task id="01.1" title="Fix manga_shader.py API breaks for Blender 5.0.1">

### What
Apply all 4 confirmed API fixes to `manga_shader.py`:

1. **Engine identifier (line 194):** Change `'BLENDER_EEVEE_NEXT' if bpy.app.version >= (4, 0, 0) else 'BLENDER_EEVEE'` to just `'BLENDER_EEVEE'`. Blender 5.0 renamed the engine back to `BLENDER_EEVEE`.

2. **ShaderNodeMix socket access (lines 123-124):** Change `mix.inputs[6]` to `mix.inputs['A']` and `mix.inputs[7]` to `mix.inputs['B']`. Numeric indices are fragile and break across versions.

3. **ShaderNodeMix socket access — specular path (lines 152-153, 155, 157):** Same fix for the metallic specular mix node:
   - `spec_mix.inputs[6]` -> `spec_mix.inputs['A']`
   - `spec_mix.inputs[7]` -> `spec_mix.inputs['B']`
   - `spec_mix.outputs[2]` -> `spec_mix.outputs['Result']`
   - `mix.outputs[2]` -> `mix.outputs['Result']`

4. **Shadow properties (lines 197-200):** Already guarded with `hasattr()`. Add a comment explaining these properties were removed in Blender 4.2+ (Virtual Shadow Maps replaced shadow maps). No code change needed, just documentation.

5. **ShaderNodeBsdfGlossy (line 129):** Validate that `nodes.new('ShaderNodeBsdfGlossy')` still works in 5.0.1. If it raises an error during the build test (Task 01.3), replace with `ShaderNodeBsdfAnisotropic` or a `ShaderNodeBsdfPrincipled` configured for glossy (high metallic, low roughness).

6. **Update docstring:** Change "Works with Blender 3.x and 4.x" to "Targets Blender 5.0.1".

### Files
- `3d_models/common/manga_shader.py`

### Acceptance
- All 4 confirmed fixes applied
- No version conditionals remain (no `bpy.app.version` checks)
- All ShaderNodeMix socket access uses named identifiers (`'A'`, `'B'`, `'Factor'`, `'Result'`)
- Engine identifier is hardcoded `'BLENDER_EEVEE'`

</task>

<task id="01.2" title="Add fail-fast error handling and verbose progress to build_spyke.py">

### What
Wrap `build_spyke.py`'s pipeline steps in try/except with fail-fast behavior:

1. **Fail-fast wrapper:** Each step (`generate_spyke.main()`, `manga_shader.main()`, `render_setup.main()`, save) should be wrapped in try/except. On any exception, print a clear error message with the step name, print the full traceback, and `sys.exit(1)`.

2. **Verbose progress:** The script already prints step names. Ensure each step prints `>>> {step_name}...` before execution and `<<< {step_name} complete` after. Add timing for each step.

3. **Blender version check:** At the very start of `main()`, print the Blender version (`bpy.app.version_string`) and verify it starts with `5.`. If not, print a warning (not an error — don't block, just warn).

The structure should follow this pattern:
```python
import time

steps = [
    ("Generating character blockout", generate_spyke.main),
    ("Applying manga toon shaders", manga_shader.main),
    ("Setting up render pipeline", render_setup.main),
]
for step_name, step_fn in steps:
    print(f"\n>>> {step_name}...")
    t0 = time.time()
    try:
        step_fn()
    except Exception as e:
        print(f"\nFATAL: '{step_name}' failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    elapsed = time.time() - t0
    print(f"<<< {step_name} complete ({elapsed:.1f}s)")
```

The save step should also be wrapped in the same pattern.

### Files
- `3d_models/build_spyke.py`

### Acceptance
- Each pipeline step wrapped in try/except with `sys.exit(1)` on failure
- Blender version printed at startup
- Timing shown for each step
- Script fails immediately on first error with clear message and traceback

</task>

<task id="01.3" title="Update .gitignore and run build validation">

### What

1. **Update `.gitignore`:** Add these entries:
   ```
   # Blender build artifacts
   *.blend
   *.blend1
   3d_models/output/
   ```
   Note: `output/` at root level is already covered. `3d_models/output/` is a separate directory that needs explicit coverage. `*.blend` covers all Blender files project-wide. `*.blend1` covers Blender backup files.

2. **Run build validation:** Execute the build with Blender:
   ```bash
   /Applications/Blender.app/Contents/MacOS/Blender --background --python 3d_models/build_spyke.py
   ```
   Working directory must be the project root (`/Users/dondemetrius/Code/plasma`).

3. **Verify output:** After build completes:
   - Confirm `3d_models/output/spyke/spyke.blend` exists and is non-empty
   - Check that the Blender output shows all 4 steps completed without errors
   - If `shade_smooth()` produces warnings about auto-smooth modifiers, note it but don't block — it's a cosmetic issue

4. **Fix any additional breaks:** If the build fails on an unexpected API break not identified in research, fix it. The research identified `ShaderNodeBsdfGlossy` and `shade_smooth()` as possible issues. Apply surgical fixes.

5. **Re-run if needed:** If fixes were applied, re-run the build and verify it succeeds.

### Files
- `.gitignore`

### Acceptance
- `.gitignore` updated with `*.blend`, `*.blend1`, and `3d_models/output/` entries
- `build_spyke.py` runs to completion on Blender 5.0.1 without errors
- `3d_models/output/spyke/spyke.blend` exists (file size > 0)
- Console output shows all steps completed with timing

</task>

## Verification

After all tasks complete, these must ALL be true:

- [ ] `manga_shader.py` has no numeric socket indices for ShaderNodeMix — all use named access (`'A'`, `'B'`, `'Result'`)
- [ ] `manga_shader.py` sets engine to `'BLENDER_EEVEE'` unconditionally (no `bpy.app.version` check)
- [ ] `build_spyke.py` has fail-fast error handling on every pipeline step
- [ ] `.gitignore` contains `*.blend`, `*.blend1`, and `3d_models/output/`
- [ ] Running `blender --background --python 3d_models/build_spyke.py` exits 0 and produces `3d_models/output/spyke/spyke.blend`

## must_haves

These are the non-negotiable outputs this plan must produce, derived from the phase goal:

1. **All Blender 5.0.1 API breaks fixed in manga_shader.py** — engine identifier, ShaderNodeMix sockets, shadow property comments (ENV-01)
2. **build_spyke.py runs without errors on Blender 5.0.1** — confirmed by actual execution, not just code review (ENV-03)
3. **spyke.blend produced** — file exists at `3d_models/output/spyke/spyke.blend` with model, armature, shaders, cameras, Freestyle (ENV-03)
4. **.blend files excluded from git** — `.gitignore` updated per user decision
