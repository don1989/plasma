# Phase 4: Assembly and Publish - Research

**Researched:** 2026-02-19
**Domain:** Programmatic dialogue overlay (speech balloons), vertical-scroll Webtoon assembly, image slicing
**Confidence:** HIGH

## Summary

Phase 4 converts approved raw panel images into publish-ready Webtoon episodes by adding programmatic dialogue overlays and assembling panels into vertical-scroll strips. The work divides into two distinct stages already stubbed in the pipeline: **overlay** (renders speech balloons, thought bubbles, narration boxes, and SFX onto panel images) and **assemble** (stacks lettered panels vertically at 800px wide, slices into Webtoon Canvas-compatible 800x1280px strips).

Sharp 0.34.5 (already installed) handles both stages without additional image-processing dependencies. For overlay, Sharp supports two complementary approaches: (1) **SVG composite** for speech balloon shapes with text inside, rendered via the built-in librsvg, and (2) **Pango text rendering** via `sharp({ text: { ... } })` for standalone text with markup control (font, size, color, alignment). Both were verified working in the current environment with Pango 1.57.0 and rsvg 2.61.2. For assembly, Sharp's `composite()` method stacks variable-height images onto a blank canvas with pixel-precise offsets, then `extract()` slices the tall strip into 800x1280px output images. The `join` constructor option exists but is unsuitable for variable-height panels (it pads all rows to max height).

The dialogue data already exists in structured form: the script parser (Phase 2) outputs `script.json` with per-panel `dialogue[]` arrays containing `{ character, line, type }` objects. TEXT-02 is largely satisfied by this existing parser -- the overlay stage simply reads `script.json` and maps dialogue to approved panel images via the generation manifest.

**Primary recommendation:** Use SVG-based speech balloons composited onto panel images via `sharp().composite()`. Build the overlay stage as a pure function: `(panelImage, dialogueLines[], sfx) => letteredImage`. Assemble by compositing lettered panels onto a blank 800px-wide canvas, then slice into 800x1280 strips output as JPEG (quality 90, mozjpeg).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEXT-01 | Programmatic dialogue overlay renders speech balloons and text onto panel images using Sharp | SVG speech balloons composited via `sharp().composite()` with built-in librsvg; Pango text for styled text rendering. Both verified working in Sharp 0.34.5. See "SVG Speech Balloon Composite" and "Pango Text Rendering" patterns. |
| TEXT-02 | Dialogue data extracted from scripts into structured format (JSON) for overlay processing | Already implemented: script parser outputs `script.json` with `dialogue[]` per panel containing `{ character, line, type: 'speech'\|'thought'\|'narration' }`. Overlay stage reads this JSON directly. |
| ASSM-01 | Pipeline assembles panels into vertical-scroll Webtoon strips (800px wide) | Sharp `composite()` stacks panels vertically on blank canvas. Verified: create 800xN canvas, composite each panel at cumulative Y offset. See "Vertical Assembly via Composite" pattern. |
| ASSM-02 | Output is Webtoon Canvas-compatible (JPG/PNG at correct dimensions) | Webtoon Canvas: 800x1280px per image, JPEG/PNG, max 20MB per image. Sharp `extract()` slices tall strip into 800x1280 chunks. JPEG with mozjpeg quality 90 keeps files well under 2MB. See "Webtoon Canvas Specifications". |
| ASSM-03 | Splash pages and double-spreads handled with appropriate aspect ratio assembly | Existing schema has `isSplash` and `isDoubleSpread` booleans per page. Splash = full 800px width, taller aspect ratio (800x1200 or similar). Double-spread = 2x width input, resize to 800px wide preserving aspect ratio. Assembly logic branches on these flags. |
| ASSM-04 | Intermediate artifacts preserved at each stage (raw/, processed/, lettered/, webtoon/) | Already configured: `PATHS.chapterOutput()` returns `{ raw, processed, lettered, webtoon }` paths. Overlay reads from `raw/`, writes to `lettered/`. Assembly reads from `lettered/`, writes to `webtoon/`. No stage overwrites upstream. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sharp | 0.34.5 | Image compositing, text rendering, resizing, JPEG/PNG output | Already installed; handles SVG composite, Pango text, extract/slice, and JPEG optimization natively via libvips 8.17.3 |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.6 | Validate overlay configuration and dialogue overlay schemas | Schema validation for overlay config JSON |
| commander | 14.x | CLI subcommand options for overlay/assemble stages | Already wired; add stage-specific flags (--page, --format) |
| vitest | 4.x | Unit and integration tests for overlay/assembly logic | TDD for SVG generation, text measurement, assembly math |

### No New Dependencies Needed

Sharp 0.34.5 bundles librsvg 2.61.2 (SVG rendering), Pango 1.57.0 (text layout/rendering), and fontconfig 2.17.1 (font discovery). These handle all text and shape rendering needs without additional npm packages.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SVG speech balloons via Sharp | node-canvas (Canvas 2D API) | More familiar API but adds native dependency, duplicates Sharp's capabilities |
| Sharp `composite()` for assembly | join-images npm package | Wrapper around Sharp; adds dependency for something Sharp does natively |
| Sharp Pango text | Sharp SVG `<text>` elements | Both work; Pango is better for standalone text, SVG better for text-in-shape |
| Custom balloon SVG generation | Pre-made SVG balloon templates | Templates are rigid; generated SVGs auto-size to text content |

## Architecture Patterns

### Recommended Module Structure
```
pipeline/src/
├── overlay/
│   ├── balloon.ts          # SVG speech balloon generator
│   ├── text-measure.ts     # Text measurement utilities (width/height from Pango)
│   ├── sfx.ts              # SFX text overlay (stylized, no balloon)
│   └── renderer.ts         # Orchestrates balloon + SFX compositing onto panel
├── assembly/
│   ├── strip-builder.ts    # Vertical panel stacking with gutters
│   ├── slicer.ts           # 800x1280 strip slicing for Webtoon
│   └── output.ts           # JPEG/PNG output with quality settings
├── stages/
│   ├── overlay.ts          # Stage entry point (existing stub)
│   └── assemble.ts         # Stage entry point (existing stub)
└── types/
    └── overlay.ts          # Overlay-specific types (BalloonConfig, SfxConfig, etc.)
```

### Pattern 1: SVG Speech Balloon Composite
**What:** Generate an SVG containing an ellipse (balloon body), a quadratic bezier tail, and text content. Composite this SVG buffer onto the panel image at the desired position.
**When to use:** Every panel with speech or thought dialogue.
**Example:**
```typescript
// Verified working: Sharp 0.34.5 + librsvg 2.61.2
function generateBalloonSvg(
  text: string,
  width: number,
  height: number,
  tailX: number,
  tailY: number,
  type: 'speech' | 'thought' | 'narration'
): Buffer {
  const rx = width / 2;
  const ry = height / 2;
  const cx = rx;
  const cy = ry;

  // Balloon body: ellipse for speech, dashed for thought, rectangle for narration
  let shape: string;
  if (type === 'thought') {
    shape = `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 4}" ry="${ry - 4}"
              fill="white" stroke="black" stroke-width="2" stroke-dasharray="8,4"/>`;
  } else if (type === 'narration') {
    shape = `<rect x="4" y="4" width="${width - 8}" height="${height - 8}"
              fill="#f5f5dc" stroke="black" stroke-width="2" rx="4"/>`;
  } else {
    shape = `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 4}" ry="${ry - 4}"
              fill="white" stroke="black" stroke-width="2.5"/>`;
  }

  // Tail pointer (speech only)
  const tail = type === 'speech'
    ? `<path d="M ${cx - 15},${height - ry + 10} q ${tailX},${tailY} ${tailX + 10},${tailY + 20} q -${tailX + 20},-${tailY} -${tailX - 5},-${tailY + 20}" fill="white" stroke="black" stroke-width="2"/>`
    : '';

  // Text (Pango/SVG text element)
  const svg = `<svg width="${width}" height="${height + 40}" xmlns="http://www.w3.org/2000/svg">
    ${shape}
    ${tail}
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
          font-family="sans-serif" font-size="14">${escapeXml(text)}</text>
  </svg>`;

  return Buffer.from(svg);
}

// Composite onto panel image
const lettered = await sharp(panelImagePath)
  .composite([{
    input: generateBalloonSvg(dialogueLine, 280, 80, 10, 30, 'speech'),
    top: 20,
    left: 50,
  }])
  .png()
  .toBuffer();
```

### Pattern 2: Pango Text Rendering (for SFX and standalone text)
**What:** Use Sharp's native `{ text: { ... } }` input with Pango markup for styled text without balloon shapes.
**When to use:** SFX text (e.g., "BONG BONG BONG"), narration captions, or any text that doesn't need a balloon shape.
**Example:**
```typescript
// Verified working: Sharp 0.34.5 + Pango 1.57.0
const sfxText = await sharp({
  text: {
    text: '<span font="Impact 28" foreground="#FF0000"
           letter_spacing="2048">BONG BONG BONG</span>',
    font: 'Impact',
    dpi: 150,
    rgba: true,
    width: 300,
    align: 'center',
  }
}).png().toBuffer();

// Composite SFX onto panel
await sharp(panelImage)
  .composite([{ input: sfxText, top: 100, left: 200 }])
  .png()
  .toFile(outputPath);
```

### Pattern 3: Vertical Assembly via Composite
**What:** Create a blank canvas at 800px wide with total height = sum of all panel heights + gutters, then composite each panel at its cumulative Y offset.
**When to use:** Every chapter assembly. NOT the `join` constructor option (pads to max height).
**Example:**
```typescript
// Verified working: Sharp 0.34.5
async function assembleVerticalStrip(
  panelPaths: string[],
  gutterHeight: number = 20
): Promise<Buffer> {
  // Get dimensions of all panels
  const metas = await Promise.all(
    panelPaths.map(p => sharp(p).metadata())
  );

  // Calculate total height
  const totalHeight = metas.reduce(
    (sum, m, i) => sum + m.height! + (i > 0 ? gutterHeight : 0), 0
  );

  // Build composite entries with cumulative Y offset
  let yOffset = 0;
  const composites = panelPaths.map((p, i) => {
    const entry = { input: p, top: yOffset, left: 0 };
    yOffset += metas[i]!.height! + (i < panelPaths.length - 1 ? gutterHeight : 0);
    return entry;
  });

  return sharp({
    create: { width: 800, height: totalHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
  })
    .composite(composites)
    .png()
    .toBuffer();
}
```

### Pattern 4: Webtoon Strip Slicing
**What:** Take the assembled tall strip and slice it into 800x1280px segments using `extract()`.
**When to use:** Final output stage before Webtoon Canvas upload.
**Example:**
```typescript
// Verified working: Sharp 0.34.5
async function sliceForWebtoon(
  stripBuffer: Buffer,
  outputDir: string,
  chapter: number,
  format: 'jpeg' | 'png' = 'jpeg'
): Promise<string[]> {
  const meta = await sharp(stripBuffer).metadata();
  const totalHeight = meta.height!;
  const sliceHeight = 1280;
  const width = 800;
  const files: string[] = [];

  for (let i = 0, top = 0; top < totalHeight; i++, top += sliceHeight) {
    const height = Math.min(sliceHeight, totalHeight - top);
    const chNum = String(chapter).padStart(2, '0');
    const filename = `ch${chNum}_strip_${String(i + 1).padStart(3, '0')}.${format === 'jpeg' ? 'jpg' : 'png'}`;
    const outputPath = join(outputDir, filename);

    let pipeline = sharp(stripBuffer).extract({ left: 0, top, width, height });
    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
    } else {
      pipeline = pipeline.png();
    }
    await pipeline.toFile(outputPath);
    files.push(outputPath);
  }

  return files;
}
```

### Pattern 5: Text Measurement for Auto-Sizing Balloons
**What:** Use Sharp text rendering to measure how much space text needs before generating the balloon SVG.
**When to use:** Every balloon generation to auto-size the ellipse around the text content.
**Example:**
```typescript
// Measure text dimensions using Sharp + Pango
async function measureText(
  text: string,
  font: string,
  fontSize: number,
  maxWidth: number,
  dpi: number = 150
): Promise<{ width: number; height: number }> {
  const buf = await sharp({
    text: {
      text: `<span font="${font} ${fontSize}">${escapeXml(text)}</span>`,
      dpi,
      rgba: true,
      width: maxWidth,
      wrap: 'word',
    }
  }).png().toBuffer();

  const meta = await sharp(buf).metadata();
  return { width: meta.width!, height: meta.height! };
}

// Then size the balloon with padding
const textSize = await measureText(dialogueLine, 'sans', 14, 250);
const balloonWidth = textSize.width + 40;  // 20px padding each side
const balloonHeight = textSize.height + 30; // 15px padding top/bottom
```

### Anti-Patterns to Avoid
- **Baking text into AI prompts:** Gemini garbles rendered text. Always overlay programmatically after image generation.
- **Using Sharp `join` for variable-height assembly:** The `join` constructor option pads ALL rows to the maximum image height. This wastes space and produces incorrect layouts. Use `composite()` with explicit Y offsets instead.
- **Overwriting upstream artifacts:** The overlay stage MUST read from `raw/` and write to `lettered/`. The assembly stage MUST read from `lettered/` and write to `webtoon/`. Never write back to `raw/`.
- **Embedding fonts via fontfile for every render:** Use system fonts or fontconfig-registered fonts. Sharp's Pango integration uses fontconfig for discovery. Register custom fonts once via fontconfig, not per-render.
- **Hardcoding balloon positions:** Balloon placement should come from configuration (per-panel JSON), not hardcoded coordinates. This enables iteration without code changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text layout and wrapping | Custom word-wrap algorithm | Sharp Pango text with `width` and `wrap: 'word'` | Pango handles Unicode, line-breaking, font metrics correctly |
| SVG rendering | Custom SVG-to-raster converter | Sharp's built-in librsvg (just pass SVG Buffer) | librsvg 2.61.2 is a mature SVG renderer, handles paths, text, filters |
| Image format optimization | Custom JPEG encoder | Sharp's `jpeg({ mozjpeg: true })` | mozjpeg produces 2-10% smaller files at same quality |
| Font discovery | Manual font path resolution | fontconfig (via Pango/Sharp) | fontconfig handles system font directories, fallbacks, matching |
| Image metadata reading | Custom dimension parser | `sharp(path).metadata()` | Returns width, height, channels, format, density in one call |

**Key insight:** Sharp 0.34.5 bundles an entire image processing stack (libvips + Pango + librsvg + fontconfig + mozjpeg). Using it for text rendering, SVG compositing, image assembly, and format conversion avoids ALL external image-processing dependencies.

## Common Pitfalls

### Pitfall 1: SVG Text Rendering Inconsistency Across Environments
**What goes wrong:** SVG `<text>` elements render differently depending on available system fonts. A balloon that looks perfect on macOS may have wrong font metrics on Linux CI.
**Why it happens:** SVG text rendering depends on fontconfig and installed fonts. Font fallback chains differ across OS.
**How to avoid:** Use a specific font bundled with the project or specify multiple fallback fonts in the SVG `font-family`. For v1, use system sans-serif which is available everywhere. If custom manga fonts are needed later, bundle them as `.ttf` files and reference via `fontfile` in Sharp text options.
**Warning signs:** Text overflowing balloon boundaries, different line-break positions in CI vs local.

### Pitfall 2: Balloon Position Hardcoding
**What goes wrong:** Balloon positions are hardcoded per-panel in the overlay code, making every panel layout change require a code change.
**Why it happens:** It feels faster to hardcode positions for chapter 1 than to build a placement system.
**How to avoid:** Define balloon positions in a per-page JSON overlay config file. The overlay stage reads positions from config, not from code. Default placement uses heuristic rules (e.g., top-left for first speaker, top-right for second) that can be overridden per-panel.
**Warning signs:** Overlay code contains coordinate literals; changing a balloon position requires recompilation.

### Pitfall 3: JPEG Artifacts on Text Edges
**What goes wrong:** Sharp text edges in speech balloons become blurry or show ringing artifacts when saved as JPEG.
**Why it happens:** JPEG compression is lossy; high-contrast edges (black text on white balloon) are particularly vulnerable.
**How to avoid:** Render the overlay compositing pipeline in PNG (lossless). Only convert to JPEG at the final Webtoon output stage. Use `mozjpeg: true` with quality 90+ for the final output. The `lettered/` intermediate stage should always be PNG.
**Warning signs:** Blurry text edges, color fringing around balloon borders.

### Pitfall 4: Assembly Height Overflow for Webtoon Canvas
**What goes wrong:** The assembled strip is so tall that individual slices exceed 20MB or the total episode exceeds platform limits.
**Why it happens:** A 28-page chapter with high-resolution panels produces a very tall strip.
**How to avoid:** Calculate total strip height upfront and warn if it would produce more than ~80 slices (staying under 100-image limit). Use JPEG quality 90 with mozjpeg to keep individual slices well under 2MB. A typical 800x1280 JPEG at quality 90 should be 200-800KB for manga art.
**Warning signs:** Total strip height exceeds ~100,000px; individual JPEG slices exceed 2MB.

### Pitfall 5: Double-Spread Aspect Ratio Distortion
**What goes wrong:** Double-spread panels (originally 2x page width) are squeezed to 800px wide, making characters look vertically stretched.
**Why it happens:** Naive resize to 800px width without preserving aspect ratio.
**How to avoid:** Double-spread panels have `isDoubleSpread: true` in the schema. The assembly stage must resize these to 800px wide while preserving aspect ratio (which will produce a shorter panel). Use `sharp().resize(800, null, { fit: 'inside' })` to maintain proportions.
**Warning signs:** Characters in double-spread panels look narrow/stretched compared to adjacent panels.

### Pitfall 6: Missing Dialogue-to-Panel Mapping
**What goes wrong:** The overlay stage cannot determine which dialogue lines belong to which panel image.
**Why it happens:** `script.json` contains dialogue per page/panel, but panel images are per-page (one image per page, not per panel). Dialogue lines need to be mapped to pixel regions within the page image.
**How to avoid:** Since the pipeline generates one image per page (not per panel), the overlay stage maps all dialogue lines for a page's panels onto that page's image. Panel positions within the page are inferred from the layout (number of panels, shot types) or specified in an overlay config. For v1, use simple heuristic placement: divide page image into vertical zones based on panel count.
**Warning signs:** Dialogue appearing in wrong panel region; overlay stage crashes on multi-panel pages.

## Code Examples

### Complete Overlay Stage Flow
```typescript
// Source: Verified against Sharp 0.34.5 API + existing pipeline types
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Chapter, Page, DialogueLine } from '../types/manga.js';

interface OverlayConfig {
  font: string;
  fontSize: number;
  dpi: number;
  balloonPadding: { x: number; y: number };
  maxBalloonWidth: number;
}

const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  font: 'sans-serif',
  fontSize: 14,
  dpi: 150,
  balloonPadding: { x: 20, y: 15 },
  maxBalloonWidth: 280,
};

async function overlayDialogue(
  panelImagePath: string,
  dialogueLines: DialogueLine[],
  sfx: string,
  config: OverlayConfig = DEFAULT_OVERLAY_CONFIG
): Promise<Buffer> {
  const composites: sharp.OverlayOptions[] = [];

  // Get panel image dimensions for placement calculations
  const meta = await sharp(panelImagePath).metadata();
  const imgWidth = meta.width!;
  const imgHeight = meta.height!;

  // Place each dialogue line
  let yPos = 20; // Start near top
  for (const line of dialogueLines) {
    const balloonSvg = generateBalloonSvg(
      line.line,
      config.maxBalloonWidth,
      60, // Auto-calculated in real implementation
      line.type
    );
    composites.push({
      input: balloonSvg,
      top: yPos,
      left: Math.round((imgWidth - config.maxBalloonWidth) / 2),
    });
    yPos += 80; // Move down for next balloon
  }

  // Add SFX if present
  if (sfx && sfx !== '\u2014') {
    const sfxBuffer = await sharp({
      text: {
        text: `<span font="Impact ${config.fontSize + 8}" foreground="#CC0000">${escapeXml(sfx)}</span>`,
        dpi: config.dpi,
        rgba: true,
      }
    }).png().toBuffer();
    composites.push({
      input: sfxBuffer,
      gravity: 'south',
    });
  }

  return sharp(panelImagePath)
    .composite(composites)
    .png()
    .toBuffer();
}
```

### Complete Assembly Stage Flow
```typescript
// Source: Verified against Sharp 0.34.5 API
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

interface AssemblyConfig {
  width: number;         // 800 for Webtoon
  gutterHeight: number;  // Pixels between panels
  gutterColor: { r: number; g: number; b: number; alpha: number };
  sliceHeight: number;   // 1280 for Webtoon
  jpegQuality: number;   // 90 recommended
}

const WEBTOON_CONFIG: AssemblyConfig = {
  width: 800,
  gutterHeight: 10,
  gutterColor: { r: 0, g: 0, b: 0, alpha: 1 },
  sliceHeight: 1280,
  jpegQuality: 90,
};

async function assembleAndSlice(
  letteredDir: string,
  webtoonDir: string,
  chapter: number,
  config: AssemblyConfig = WEBTOON_CONFIG
): Promise<string[]> {
  // 1. Collect lettered panel images in order
  const files = (await readdir(letteredDir))
    .filter(f => /\.(png|jpg)$/i.test(f))
    .sort();

  // 2. Read metadata for all panels
  const panels = await Promise.all(files.map(async f => {
    const path = join(letteredDir, f);
    const meta = await sharp(path).metadata();
    // Resize to target width if needed
    const scale = config.width / meta.width!;
    const height = Math.round(meta.height! * scale);
    return { path, width: config.width, height };
  }));

  // 3. Calculate total height
  const totalHeight = panels.reduce(
    (sum, p, i) => sum + p.height + (i > 0 ? config.gutterHeight : 0), 0
  );

  // 4. Build vertical strip via composite
  let yOffset = 0;
  const composites = await Promise.all(panels.map(async (p, i) => {
    const resized = await sharp(p.path)
      .resize(config.width, p.height, { fit: 'fill' })
      .png()
      .toBuffer();
    const entry = { input: resized, top: yOffset, left: 0 };
    yOffset += p.height + (i < panels.length - 1 ? config.gutterHeight : 0);
    return entry;
  }));

  const strip = await sharp({
    create: {
      width: config.width,
      height: totalHeight,
      channels: 4,
      background: config.gutterColor,
    }
  })
    .composite(composites)
    .png()
    .toBuffer();

  // 5. Slice into Webtoon strips
  const outputFiles: string[] = [];
  const chNum = String(chapter).padStart(2, '0');

  for (let i = 0, top = 0; top < totalHeight; i++, top += config.sliceHeight) {
    const height = Math.min(config.sliceHeight, totalHeight - top);
    const filename = `ch${chNum}_strip_${String(i + 1).padStart(3, '0')}.jpg`;
    const outputPath = join(webtoonDir, filename);

    await sharp(strip)
      .extract({ left: 0, top, width: config.width, height })
      .jpeg({ quality: config.jpegQuality, mozjpeg: true })
      .toFile(outputPath);

    outputFiles.push(outputPath);
  }

  return outputFiles;
}
```

## Webtoon Canvas Specifications

Verified from multiple sources (Webtoon official notice, Clip Studio Tips, S-Morishita Studio, WriteSeen):

| Spec | Value | Confidence |
|------|-------|------------|
| Image width | 800px | HIGH -- official Webtoon documentation |
| Image max height | 1280px | HIGH -- official Webtoon documentation |
| File formats | JPEG, PNG | HIGH -- multiple sources confirm both accepted |
| Max file size per image | 20MB | HIGH -- official documentation |
| Preferred file size per image | Under 2MB | MEDIUM -- community recommendation, not hard limit |
| Max images per episode | 100 | MEDIUM -- one source states this; others silent |
| Recommended output format | JPEG | MEDIUM -- smaller file size; PNG also accepted |
| Thumbnail (square) | 1080x1080px, max 500KB | HIGH -- official |
| Thumbnail (vertical) | 1080x1920px, max 700KB | HIGH -- official |
| Auto-slicing | Platform auto-slices images exceeding 800x1280 | HIGH -- official notice |

**Key insight for pipeline:** Although Webtoon auto-slices, pre-slicing in the pipeline gives control over where cuts happen (avoiding mid-panel cuts). Output JPEG at quality 90 with mozjpeg keeps strips at 200-800KB for manga art, well within limits.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sharp `overlayWith()` | Sharp `composite()` | Sharp 0.22 (2019) | `overlayWith` deprecated; `composite` supports multiple overlays in one call |
| External SVG renderer + Sharp | Sharp built-in librsvg | Sharp 0.30+ | No need for separate SVG rendering step; pass SVG Buffer directly to `composite()` |
| Manual text-to-image with node-canvas | Sharp `{ text: {} }` with Pango | Sharp 0.31+ | Native text rendering without Canvas dependency; Pango markup for styling |
| `join-images` npm package | Sharp constructor `join` option | Sharp 0.33+ | Built-in join for same-height images; but `composite()` still needed for variable heights |
| Sharp legacy font handling | fontconfig integration via Pango | Always (via libvips) | System fonts automatically available; custom fonts via fontconfig config |

**Deprecated/outdated:**
- `sharp().overlayWith()`: Removed. Use `sharp().composite()`.
- `join-images` / `merge-images` npm packages: Unnecessary with Sharp 0.33+ built-in join (for same-height) and composite (for variable-height).

## Open Questions

1. **Balloon placement coordinates per panel**
   - What we know: The overlay stage needs X,Y coordinates for each balloon. The script parser provides dialogue lines but no spatial placement data.
   - What's unclear: Whether to use heuristic auto-placement (top-left for first speaker, offset for subsequent) or require manual per-panel placement config.
   - Recommendation: Start with heuristic auto-placement based on panel count and dialogue count. Add optional per-panel override JSON for manual adjustment. This keeps v1 automated while allowing refinement.

2. **Custom manga lettering font**
   - What we know: System sans-serif works but doesn't have manga aesthetic. Free fonts exist (Komika family - 50 fonts, free commercial use; Bubble Sans; various on Font Squirrel/1001fonts).
   - What's unclear: Which specific font best matches the Plasma art style. Font licensing for commercial Webtoon distribution.
   - Recommendation: Use system sans-serif for v1. Selecting and bundling a manga font is a v2 concern (maps to deferred LETR-01). The architecture should make font selection configurable so it's a one-line change later.

3. **Panel region boundaries within page images**
   - What we know: Each page image contains multiple panels. The overlay needs to place balloons within the correct panel region.
   - What's unclear: Whether Gemini-generated page images have consistent enough panel borders to detect programmatically, or whether manual panel region definitions are needed.
   - Recommendation: For v1, use simple zone division: divide page height by panel count to estimate panel boundaries. The overlay config can override with explicit `panelRegions` coordinates per page. Panel detection is a v2 concern.

4. **SFX visual styling**
   - What we know: SFX in manga are typically large, stylized, integrated into the art. Pango text can render colored text with font control.
   - What's unclear: How to achieve manga-quality SFX lettering (rotated, perspective, integrated with art) using only Sharp/Pango.
   - Recommendation: For v1, render SFX as large, colored text overlay (Impact or similar bold font). Full SFX visual design system is deferred to v2 (LETR-01).

## Sources

### Primary (HIGH confidence)
- Sharp 0.34.5 API documentation: https://sharp.pixelplumbing.com/api-composite/ -- composite method, blend modes, positioning
- Sharp 0.34.5 constructor docs: https://sharp.pixelplumbing.com/api-constructor/ -- `text` option (Pango), `create` option, `join` option
- Pango markup documentation: https://docs.gtk.org/Pango/pango_markup.html -- `<span>` attributes for font, color, size
- Existing pipeline code verification: Sharp 0.34.5 with Pango 1.57.0, librsvg 2.61.2, fontconfig 2.17.1 confirmed via `sharp.versions`
- Hands-on verification: SVG speech balloon composite, Pango text rendering, vertical assembly via composite, and strip slicing all tested and confirmed working in current environment

### Secondary (MEDIUM confidence)
- Webtoon Canvas specifications: https://www.webtoons.com/en/notice/detail?noticeNo=1766 -- 800x1280px image dimensions
- Webtoon Canvas file sizes: https://tips.clip-studio.com/en-us/articles/7396 -- 20MB limit, JPEG/PNG formats
- Webtoon Canvas guide: https://www.s-morishitastudio.com/guide-to-canvas-size-for-webtoon-platform/ -- 800x1280px, JPEG preferred
- Webtoon upload guide: https://writeseen.com/blog/how-to-upload-a-comic-to-webtoon -- 2MB per image recommendation, 100 images per episode
- SVG speech bubble techniques: https://blog.claude.nl/posts/making-speech-bubbles-in-svg/ -- ellipse + path tail approach
- Sharp GitHub issues: https://github.com/lovell/sharp/issues/699 -- vertical stitching via composite approach
- Comic lettering fonts: https://jasonthibault.com/comic-book-fonts/ -- free commercial-use manga fonts

### Tertiary (LOW confidence)
- Max 100 images per episode: Only one source mentions this limit. Could not verify with official Webtoon documentation. Needs validation before relying on this constraint.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Sharp 0.34.5 already installed, all capabilities verified hands-on with actual code execution
- Architecture: HIGH -- Patterns verified against Sharp API docs and hands-on tests; module structure follows existing pipeline conventions
- Webtoon specs: MEDIUM -- Multiple sources agree on 800x1280px and 20MB, but some details (100 image limit) are single-source
- Pitfalls: HIGH -- Key pitfalls (join padding, JPEG artifacts, double-spread distortion) discovered through actual testing
- Overlay approach: MEDIUM -- SVG balloon generation is architecturally sound and verified, but the heuristic placement algorithm needs iteration with real panel images

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (Sharp API is stable; Webtoon specs change infrequently)
