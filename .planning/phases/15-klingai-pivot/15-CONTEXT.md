# Phase 15: Kling AI Pivot — Manga/Anime Generation

## Decision

Abandon v3.0 Blender 3D pipeline and pivot to Kling AI for consistent manga/anime panel generation.

## Why

| Previous Approach | Problem |
|---|---|
| v1.0 Gemini | No character consistency — prompt fingerprints drift |
| v2.0 ComfyUI + LoRA | Better but LoRA can't handle asymmetric details (Spyke's bracer, pauldron) |
| v3.0 Blender 3D | Deterministic but extremely slow pipeline — manual model refinement, rigging, weight painting |

**Kling AI solves character consistency natively** via multi-reference images:
- Up to 10 reference images per generation (Kling Image O3 / Omni O1)
- `<<<image_1>>>` template syntax tags reference images in prompts
- Subject and face reference modes with fidelity sliders (0–1)
- Sequential image generation (2–9 related images) with narrative consistency
- Native manga/anime style understanding

## What We Keep

| Module | Reason |
|---|---|
| `overlay/renderer.ts` | Programmatic text overlay — never bake text into AI images |
| `overlay/balloon.ts` | SVG speech balloons work great |
| `overlay/text-measure.ts` | Text sizing for balloons |
| `overlay/sfx.ts` | Sound effect rendering |
| `assembly/strip-builder.ts` | Webtoon vertical strip assembly |
| `assembly/slicer.ts` | Strip slicing for platform limits |
| `assembly/output.ts` | Output file management |
| `config/paths.ts` | Path resolution (adapted for Kling output) |
| `types/overlay.ts` | Overlay type definitions |
| `types/manga.ts` | Chapter/Page/Panel domain types |

## What We Replace

| Old Module | Replacement |
|---|---|
| `generation/gemini-client.ts` | New `generation/kling-client.ts` |
| `comfyui/*` (entire directory) | Removed |
| `templates/*` (Nunjucks prompts) | Simplified Kling prompt builder |
| Character YAML `fingerprint` field | Reference images on disk |
| `stages/prompt.ts` | New Kling-aware prompt stage |
| `stages/generate.ts` | New Kling generation stage |

## Stack

- **Image generation:** Kling AI via `kling-api` npm package
- **Auth:** JWT (KLING_ACCESS_KEY + KLING_SECRET_KEY in .env)
- **Models:** `kling-v2-1` (image gen), `kling-image-o1` (omni/multi-ref)
- **Reference images:** Stored in `pipeline/data/characters/<id>/references/`
- **Text overlay:** Sharp (unchanged)
- **Assembly:** Sharp (unchanged)

## API Details

### Authentication
```
KLING_ACCESS_KEY=your-access-key
KLING_SECRET_KEY=your-secret-key
```
JWT tokens auto-generated with 30-min expiry.

### Image Generation Endpoint
```
POST https://api.klingai.com/v1/images/generations
```

### Multi-Reference (Omni Image)
```typescript
const task = await api.omniImage({
  prompt: 'Manga panel: <<<image_1>>> stands on rooftop overlooking flooded city',
  model_name: 'kling-image-o1',
  images: ['./refs/spyke-front.png', './refs/spyke-side.png'],
  aspect_ratio: '3:4'  // portrait panels
});
```

### Single Reference (Face/Subject)
```typescript
const task = await api.imageGeneration({
  prompt: 'Manga panel description...',
  model_name: 'kling-v2-1',
  image: './refs/spyke-front.png',
  image_reference_type: 'subject',
  image_fidelity: 0.85
});
```
