# Plan 02: Headless Render Validation, Test Render, and Automated Pixel Checks

```yaml
phase: 11
plan: 2
title: "Headless Render Validation, Test Render, and Automated Pixel Checks"
wave: 2
depends_on:
  - PLAN-01
requirements:
  - ENV-02
  - ENV-04
files_modified:
  - 3d_models/render/render_poses.py
  - 3d_models/validate_render.py (NEW)
  - 3d_models/HEADLESS_RENDERING.md (NEW)
autonomous: true
```

## Goal

Validate EEVEE headless rendering on M1 Pro macOS, produce a test render at 800x1200, create automated pixel validation for regression detection, and document the headless rendering recommendation for Phase 14 integration.

## Context

Plan 01 produced a working `spyke.blend` file. This plan validates that EEVEE can render from it, determines whether `--background` mode works on macOS M1 Pro, and establishes the output convention and automated checks.

**User decisions (locked):**
- Initial validation: visual spot check (toon shade bands, Freestyle outlines, transparent background)
- ALSO create automated pixel checks for regression detection
- Blockout quality is sufficient — visible shade bands + outlines on primitive geometry is a pass
- Use neutral pose (default from build_spyke.py)
- Camera angle is Claude's discretion (use `Cam_Front` — full body, neutral)
- Test render output location is Claude's discretion
- The headless workaround must be transparent to the TypeScript pipeline — Python scripts handle mode internally
- Phase 11 must document AND recommend the headless approach for Phase 14
- Pipeline renders go to `output/ch-XX/raw/` (same location existing pipeline expects)

**Headless rendering risk:** EEVEE on macOS historically does not support `--background` mode (no GPU context). Blender 5.0.1 may have fixed this on Apple Silicon. The approach is: try `--background` first, fall back to visible window if it fails. Either way, the render script must work in both modes.

**Blender binary:** `/Applications/Blender.app/Contents/MacOS/Blender`
**Input file:** `3d_models/output/spyke/spyke.blend` (produced by Plan 01)

## Tasks

<task id="02.1" title="Test EEVEE headless rendering and produce test render">

### What

Run a test render to validate EEVEE works on this system and determine the headless mode behavior.

**Step 1: Try headless render (`--background`)**

Run the existing `render_poses.py` in headless mode to render the front view in neutral pose:

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  3d_models/output/spyke/spyke.blend \
  --background \
  --python 3d_models/render/render_poses.py \
  -- --views front --output 3d_models/output/spyke/test_render
```

**Evaluate result:**
- If a PNG is produced at `3d_models/output/spyke/test_render/spyke_neutral_front.png`:
  - Check if it is all-black or all-transparent (headless failure mode)
  - If it contains visible content (character shape, colors), headless works
- If Blender crashes, hangs (>60s timeout), or produces no output: headless fails

**Step 2: If headless fails, try visible window render**

Run the same command without `--background`:

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  3d_models/output/spyke/spyke.blend \
  --python 3d_models/render/render_poses.py \
  -- --views front --output 3d_models/output/spyke/test_render
```

This will briefly open a Blender window, render, and exit. Verify the PNG is produced.

**Step 3: Copy the successful test render**

Whichever mode works, ensure the test render is at:
`3d_models/output/spyke/test_render/spyke_neutral_front.png`

This is the file the user will visually spot-check and the validation script (Task 02.2) will analyze.

**Step 4: Record findings**

Note which mode worked:
- Mode A: `--background` works (ideal for automation)
- Mode B: `--background` fails, visible window required
- Mode C: Neither works (critical blocker — escalate)

### Files
- No files modified — this is a validation/test task

### Acceptance
- A test render PNG exists at `3d_models/output/spyke/test_render/spyke_neutral_front.png`
- The render is 800x1200 pixels
- The render contains visible character content (not all-black, not all-transparent)
- The headless mode result (A, B, or C) is determined

</task>

<task id="02.2" title="Create automated pixel validation script">

### What

Create `3d_models/validate_render.py` — a standalone Python script (NOT Blender Python) that validates test render output for regression detection in later phases.

**Important:** This script runs with standard Python, NOT inside Blender. It uses Pillow (PIL) for image analysis. If Pillow is not available on the system Python, install it: `pip3 install Pillow numpy`.

The script performs 5 checks:

1. **Dimensions check:** Image is exactly 800x1200 pixels
2. **Transparency check:** Alpha channel has >10% transparent pixels (background is transparent, not solid)
3. **Content check:** Alpha channel has >5% opaque pixels (character is actually rendered, not blank)
4. **Outline check:** Among opaque pixels, some have near-black brightness (<30 value in 0-255 range). This indicates Freestyle outlines are rendering.
5. **Shade band check:** Standard deviation of brightness across opaque pixels is >20. This indicates toon shading produces distinct light/shadow bands, not flat color.

**Script structure:**

```python
#!/usr/bin/env python3
"""
Validate Blender test render output for manga pipeline quality.
Run with standard Python (not Blender): python3 validate_render.py [image_path]

Checks:
  1. Correct dimensions (800x1200)
  2. Has transparent background (alpha channel)
  3. Has non-transparent content (character rendered)
  4. Has dark outlines (Freestyle)
  5. Has shade bands (toon shading)

Exit code: 0 = all pass, 1 = any fail
"""
```

Include a `validate_render(image_path)` function that returns a dict of check_name -> bool, and a `__main__` block that prints results and exits with appropriate code.

Default image path if no argument: `3d_models/output/spyke/test_render/spyke_neutral_front.png`

**Run the validation** against the test render produced in Task 02.1. All 5 checks should pass. If any fail, investigate:
- Dimensions fail: render_setup.py config issue
- Transparency fail: `render.film_transparent` not set
- Content fail: render produced blank output (headless issue or shader issue)
- Outline fail: Freestyle not enabled or not rendering
- Shade band fail: toon shader not producing distinct bands

### Files
- `3d_models/validate_render.py` (NEW)

### Acceptance
- `validate_render.py` exists and runs with standard Python 3
- All 5 checks pass on the test render from Task 02.1
- Script exits 0 when all checks pass, exits 1 when any check fails
- Script prints clear PASS/FAIL for each check with the check name

</task>

<task id="02.3" title="Document headless rendering recommendation and output convention">

### What

Create `3d_models/HEADLESS_RENDERING.md` documenting the headless rendering findings and the recommended approach for Phase 14 TypeScript integration.

**Document must include:**

1. **Test results:** Which mode worked (A: `--background`, B: visible window, C: neither)
2. **Recommended invocation:** The exact Blender CLI command that Phase 14's `blender-runner.ts` should use
3. **Fallback strategy:** If `--background` works but is flaky, document both modes. If it doesn't work, document the visible-window approach.
4. **Transparency guarantee:** Explain that the Python render scripts are mode-agnostic — they call `bpy.ops.render.render(write_still=True)` regardless. The mode is controlled by the CLI invocation (presence/absence of `--background`), not by the Python script. This means TypeScript just needs to choose the right CLI command.
5. **Known issues:** Any warnings, performance notes, or stability concerns observed during testing (memory usage, rendering time, etc.)

**Output convention documentation** (in the same file or as a section):

6. **Test renders:** `3d_models/output/spyke/test_render/` — validation renders during development
7. **Pipeline renders:** `output/ch-XX/raw/` — production renders for TypeScript pipeline consumption (Phase 14)
8. **Build artifacts:** `3d_models/output/spyke/spyke.blend` — generated on demand, gitignored

### Files
- `3d_models/HEADLESS_RENDERING.md` (NEW)

### Acceptance
- Document exists with all 8 sections above
- Recommended CLI invocation is specific (exact command, not vague guidance)
- The document is actionable for Phase 14 — an implementer reading only this document can write the Blender subprocess invocation
- Output convention clearly separates test renders, pipeline renders, and build artifacts

</task>

## Verification

After all tasks complete, these must ALL be true:

- [ ] A test render PNG exists at `3d_models/output/spyke/test_render/spyke_neutral_front.png` at 800x1200 RGBA
- [ ] The test render shows: toon shade bands (visible light/dark areas), Freestyle outlines (dark edge lines), transparent background
- [ ] `python3 3d_models/validate_render.py` exits 0 (all 5 automated checks pass)
- [ ] EEVEE headless behavior is documented — either `--background` works or the visible-window workaround is confirmed and documented
- [ ] `3d_models/HEADLESS_RENDERING.md` contains an actionable recommendation for Phase 14 TypeScript integration
- [ ] Output convention is documented: test renders vs. pipeline renders vs. build artifacts

## must_haves

These are the non-negotiable outputs this plan must produce, derived from the phase goal:

1. **Test render at 800x1200 with correct visual properties** — toon shading, Freestyle outlines, transparent background, on the blockout model in neutral pose (ENV-04)
2. **EEVEE headless rendering behavior documented** — which mode works, recommended CLI invocation, fallback strategy (ENV-02)
3. **Automated pixel validation script** — 5 regression checks, runnable with standard Python, passing on test render (user decision from CONTEXT.md)
4. **Headless approach recommended for Phase 14** — not just documented, but with a specific recommendation that Phase 14 can act on (user decision from CONTEXT.md)
5. **Output convention established** — test renders, pipeline renders, and build artifacts clearly separated (user decision from CONTEXT.md)
