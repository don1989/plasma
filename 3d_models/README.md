# 3D Character Models — Plasma Manga Pipeline

3D models for consistent character rendering in the Plasma manga production pipeline. Uses Blender's Python API to generate, shade, and render characters in manga style.

## Why 3D Models?

AI image generation (Gemini) cannot maintain character consistency across panels. A 3D model **is** the character — same face, same proportions, same outfit, every time. Pose it, render it, done.

## Requirements

- **Blender 3.6+** (4.x recommended) — [blender.org/download](https://www.blender.org/download/)
- No addons required — everything uses Blender's built-in Python API

## Quick Start

### One command — generate Spyke, apply shaders, set up rendering:

```bash
blender --background --python 3d_models/build_spyke.py
```

This creates `3d_models/output/spyke/spyke.blend` with the complete scene.

### Render reference sheet:

```bash
blender 3d_models/output/spyke/spyke.blend --background \
  --python 3d_models/render/render_poses.py
```

### Render all poses (neutral, standing, battle, iaijutsu, walking):

```bash
blender 3d_models/output/spyke/spyke.blend --background \
  --python 3d_models/render/render_poses.py -- --all
```

### Open in Blender for manual refinement:

```bash
blender 3d_models/output/spyke/spyke.blend
```

## Directory Structure

```
3d_models/
├── build_spyke.py              # Master build (runs everything)
├── characters/
│   └── spyke/
│       └── generate_spyke.py   # Character blockout + armature + materials
├── common/
│   ├── manga_shader.py         # Cel-shaded toon material system
│   └── render_setup.py         # Camera, lighting, freestyle outlines
├── render/
│   └── render_poses.py         # Batch render with pose library
└── output/                     # Generated .blend files and renders
    └── spyke/
```

## Pipeline Scripts

| Script | Purpose |
|--------|---------|
| `generate_spyke.py` | Builds body blockout, hair, clothing, weapons, harness, armature |
| `manga_shader.py` | Converts materials to cel-shaded toon with hard shadow edges |
| `render_setup.py` | 6 cameras (front/3-4/side/back/portrait/upper), 2-light setup, freestyle outlines |
| `render_poses.py` | Batch render with 5 built-in poses, CLI args for custom output |
| `build_spyke.py` | Runs all of the above in sequence, saves .blend |

## Character: Spyke Tinwall

The blockout model includes all canonical elements from `pipeline/data/characters/spyke-tinwall.yaml`:

- **Body**: Slim athletic male (21), correct manga proportions (7.5 heads)
- **Hair**: Ginger, straight and layered, between traps and shoulders
- **Bandana**: Red forehead strip (not wrapping skull)
- **Outfit**: Black t-shirt, white knee-length cloak (crude cut-off sleeves), red belt
- **Arms (asymmetric)**: Right arm = red fingerless glove; Left arm = red metallic bracer to elbow
- **Legs**: Black combat pants, dark boots
- **Knee (asymmetric)**: Left knee = hexagonal metal pauldron; Right knee = bare
- **Broadsword**: Massive sheath on back (half body height), diagonal mount
- **Harness**: Brown leather X-pattern over cloak
- **Katana**: Sheathed on left hip

### Color Palette

| Element | Hex (approx) |
|---------|-------------|
| Skin | `#DEBD9E` |
| Hair (ginger) | `#BF4D14` |
| Eyes (green) | `#2EB838` |
| Bandana/glove/bracer | `#D91A1A` |
| Cloak | `#EBE6E0` |
| T-shirt/pants | `#0D0D0D` |
| Harness | `#664019` |
| Sword/sheath | `#595960` |

## Render Settings

- **Engine**: EEVEE (required for Shader to RGB toon shading)
- **Resolution**: 800×1200 (Webtoon format)
- **Outlines**: Freestyle, 2px black lines
- **Output**: PNG with transparency

## Workflow: 3D → Manga Panel

```
1. Pose armature (script or manual)
2. Select camera angle
3. Render → clean manga-style image with outlines
4. Feed into pipeline/ for text overlay and Webtoon assembly
5. Character is IDENTICAL every time
```

## Adding New Characters

1. Copy `characters/spyke/generate_spyke.py` as a template
2. Update proportions, colors, and equipment
3. Add a `build_<name>.py` master script
4. Character YAML in `pipeline/data/characters/` is the canonical source

## Refinement Guide

The generated model is a **blockout** — proportionally correct primitives with proper materials. To get production-quality renders:

1. **Sculpt**: Use Blender's sculpt mode to refine body shapes, face, hands
2. **Retopology**: Clean up mesh topology for better deformation
3. **Weight paint**: Assign mesh vertices to armature bones for posing
4. **Detail**: Add belt buckle geometry, cloak folds, boot treads, etc.
5. **UV unwrap**: For custom textures (dojo insignia, geometric patterns)

The materials, shaders, armature, cameras, and render pipeline are already set up — refinement only affects the meshes.
