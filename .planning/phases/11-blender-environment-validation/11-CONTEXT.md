# Phase 11: Blender Environment Validation - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix Blender 5.0.1 API breaks in existing scripts, resolve EEVEE headless rendering behavior on M1 Pro macOS, and produce a verified test render from the blockout model. This phase proves the rendering pipeline works before any model refinement begins.

</domain>

<decisions>
## Implementation Decisions

### Headless Rendering Fallback
- Claude's discretion on which approach works (--background, visible window, or other)
- If visible Blender window is needed, that's acceptable — this is a dev machine, not CI
- The headless workaround must be **transparent to the TypeScript pipeline** — Python render scripts handle the mode internally, TypeScript just calls "render"
- Phase 11 must **document + recommend** the headless approach for Phase 14 integration (not just document what happened)

### Test Render Acceptance Bar
- Initial validation: **visual spot check** by user (toon shade bands visible, Freestyle outlines present, transparent background)
- Also create **automated pixel checks** for regression detection in later phases (alpha channel, edge detection for outlines, color histogram for shade bands)
- **Blockout quality is sufficient** — as long as toon shader produces visible shade bands and outlines on primitive geometry, that's a pass. Model refinement is Phase 12.
- Use **neutral pose** (default from build_spyke.py)
- Camera angle selection is Claude's discretion based on what existing scripts support

### Error Handling
- **Fail fast** on first Blender API error — clear message pointing to the broken call
- **Target Blender 5.0.1 only** — no version guards, no backward compatibility with 4.x
- **Verbose progress output** — print each step as it runs (creating armature, applying shader, etc.)
- Refactoring scope is Claude's discretion — surgical fixes vs small refactors judged per file

### Output Organization
- Establish a **new output convention** (don't just use existing 3d_models/output/spyke/ as-is)
- Pipeline renders (PNGs for TypeScript) go to **output/ch-XX/raw/** — same location the existing pipeline expects
- **.blend files are build artifacts** — generated on demand, added to .gitignore. Not committed to git.
- Test render location is Claude's discretion

### Claude's Discretion
- Headless rendering approach (whatever works on macOS M1 Pro)
- Camera angle(s) for test render
- Test render output directory
- Whether to refactor or surgically fix each script file

</decisions>

<specifics>
## Specific Ideas

- Research identified 3 specific bugs to fix: engine identifier (`BLENDER_EEVEE` not `BLENDER_EEVEE_NEXT`), ShaderNodeMix socket access (named `'A'`/`'B'` not integer index), deprecated shadow properties
- EEVEE headless on macOS is tracked as Blender Bug #127033 and #132664
- Existing scripts have never been run on Blender 5.0.1 — expect additional undocumented breaks
- The current blockout uses rigid armature parenting (`obj.parent = armature`) — weight painting is Phase 12's problem, but Phase 11 should confirm the armature exists and poses can be set even if deformation is rigid

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-blender-environment-validation*
*Context gathered: 2026-02-26*
