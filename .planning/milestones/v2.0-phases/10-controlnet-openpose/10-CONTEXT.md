# Phase 10: ControlNet OpenPose - Context

**Gathered:** 2026-02-25
**Status:** PIVOTED — Replaced by Blender 3D milestone (v3.0)

<domain>
## Phase Boundary

Phase 10 (ControlNet OpenPose) is being **dropped** in favor of a full Blender 3D rendering pipeline. The user has decided that AI image generation (ComfyUI/ControlNet) does not provide sufficient character consistency. Instead, a 3D model of Spyke rendered in Blender will replace the AI generation step entirely.

**This context document captures the pivot vision for the new milestone (v3.0).**

</domain>

<decisions>
## Implementation Decisions

### Pipeline Architecture
- Blender replaces AI image generation for characters AND backgrounds
- The existing TypeScript pipeline (text overlay, panel assembly, Webtoon strip creation) remains unchanged
- Blender outputs character/scene PNGs → TypeScript pipeline handles post-processing
- ComfyUI/Express pipeline from v2.0 is functional but superseded by this approach

### Character Scope
- Spyke only for v3.0 — prove the pipeline end-to-end with one character
- Additional characters are future milestone work
- Must render Spyke consistently across all panel types (action, dialogue, establishing)

### Backgrounds/Environments
- Mixed approach: key establishing shots get full 3D environments, action/dialogue panels get simple stylized backgrounds (gradients, speed lines, flat shapes)
- Classic manga style — characters are the focus, backgrounds support the mood

### Posing Workflow
- Script-driven poses — define poses in code/data files (bone rotations), render programmatically
- Build a library of common poses (standing, fighting, walking, sitting, dialogue gestures)
- Fully automated rendering pipeline — no manual Blender UI interaction required per panel

### Model Quality
- Claude's Discretion — determine minimum viable quality based on toon shader output
- The current blockout is primitives (never been built/run yet). Scripts exist from Phase 9 but `build_spyke.py` has not been executed
- Iterate based on render quality — let the cel-shading and freestyle outlines do the heavy lifting

### Blender Version
- Blender 5.0.1 installed on M1 Pro Mac
- Existing scripts target 3.6+ — need to verify API compatibility with 5.0
- EEVEE rendering (required for Shader to RGB toon shading)

### Claude's Discretion
- Model refinement level (how far beyond blockout)
- Blender 5.0 API compatibility adjustments
- Pose library design and data format
- Camera angle selection per panel type
- Environment complexity for establishing shots
- Render resolution and quality settings (current target: 800×1200 Webtoon format)

</decisions>

<specifics>
## Specific Ideas

- "Do it all in Blender" — the core motivation is character consistency. A 3D model IS the character — same face, proportions, outfit every time
- Existing Phase 9 work provides the foundation: `build_spyke.py`, `generate_spyke.py`, `manga_shader.py`, `render_setup.py`, `render_poses.py`
- The 3D→manga workflow: Pose armature → Select camera → Render → Feed into TypeScript pipeline for text overlay and Webtoon assembly
- Character is identical every render — the fundamental problem AI generation couldn't solve

</specifics>

<deferred>
## Deferred Ideas

- Multi-character scenes (need additional character models)
- Full 3D environments for every panel (only key shots in v3.0)
- Manual posing/refinement workflow for complex panels
- Rigging improvements for facial expressions
- Cloth simulation for dynamic cape/cloak movement
- Phase out TypeScript pipeline entirely (Python-only pipeline)

</deferred>

---

*Phase: 10-controlnet-openpose (PIVOTED to Blender v3.0)*
*Context gathered: 2026-02-25*
