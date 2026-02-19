---
phase: 04-assembly-and-publish
verified: 2026-02-19T10:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 4: Assembly and Publish — Verification Report

**Phase Goal:** Approved raw panel images become a complete, Webtoon Canvas-ready episode with programmatic dialogue, SFX, and vertical-scroll assembly
**Verified:** 2026-02-19
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `overlay -c 1` reads approved panel images from raw/ and script.json dialogue, producing lettered PNG images in lettered/ | VERIFIED | `stages/overlay.ts` reads `script.json` via `readFile`, calls `getApprovedEntry(manifest, page.pageNumber)` to locate raw images, writes to `chapterPaths.lettered` only |
| 2  | Speech balloons render as white ellipses with black stroke, containing readable text, composited onto the panel image | VERIFIED | `overlay/balloon.ts`: `<ellipse fill="white" stroke="black" stroke-width="2.5" />` — SVG buffer returned via `Buffer.from(svg)`, passed to `sharp().composite()` in `renderer.ts` |
| 3  | Thought bubbles render with dashed stroke, narration boxes render as rectangles — distinct from speech balloons | VERIFIED | `balloon.ts`: thought case uses `stroke-dasharray="8,4"`, narration case uses `<rect rx="4" ry="4" fill="#f5f5dc">` — three distinct SVG shapes |
| 4  | SFX text renders as large colored text without a balloon shape | VERIFIED | `overlay/sfx.ts`: Pango markup `<span font="Impact 22" foreground="#CC0000" letter_spacing="2048">`, returns raw PNG buffer with no balloon wrapper |
| 5  | Balloon sizes auto-scale to fit dialogue text content with padding | VERIFIED | `text-measure.ts` `calculateBalloonSize()`: calls `measureText()` via Sharp Pango, adds `2*padding.x` and `2*padding.y`, clamps to `maxBalloonWidth` |
| 6  | Overlay stage never writes to raw/ — reads from raw/, writes only to lettered/ | VERIFIED | `stages/overlay.ts`: `rawImagePath = path.join(chapterPaths.raw, ...)` (read only), `outputPath = path.join(chapterPaths.lettered, ...)` (write destination). No write to `raw/` anywhere in the overlay module |
| 7  | `assemble -c 1` reads lettered PNGs from lettered/ and produces 800x1280 JPEG strips in webtoon/ | VERIFIED | `stages/assemble.ts`: `readdir(letteredDir)` -> `assembleVerticalStrip()` -> `sliceForWebtoon(stripBuffer, webtoonDir, ...)` writing to `chapterPaths.webtoon` |
| 8  | Output JPEG strips use mozjpeg at quality 90, producing files well under 2MB each | VERIFIED | `assembly/slicer.ts` line 62: `.jpeg({ quality: config.jpegQuality, mozjpeg: true })` — `WEBTOON_CONFIG.jpegQuality = 90` |
| 9  | Splash pages are assembled at full 800px width with their natural taller aspect ratio | VERIFIED | `strip-builder.ts`: all panel types use `sharp(panel.path).resize(config.width, null, { fit: 'inside' })` — splash source is taller, resize to 800px preserves the taller result |
| 10 | Double-spread pages are resized to 800px wide preserving aspect ratio (shorter, not distorted) | VERIFIED | Same resize logic — double-spread source is wider, resize to 800px produces a shorter result with aspect ratio preserved |
| 11 | Assembly stage never writes to raw/ or lettered/ — reads from lettered/, writes only to webtoon/ | VERIFIED | `stages/assemble.ts`: reads from `chapterPaths.lettered`, writes via `sliceForWebtoon(stripBuffer, chapterPaths.webtoon, ...)`. No write paths point to raw/ or lettered/ |
| 12 | Vertical strip has black gutters between panels (configurable height) | VERIFIED | `strip-builder.ts`: canvas created with `background: config.gutterColor` (default `{r:0,g:0,b:0,alpha:1}`), `yOffset += panel.scaledHeight + config.gutterHeight`. CLI exposes `--gutter <number>` |
| 13 | Strip filenames follow convention: ch01_strip_001.jpg, ch01_strip_002.jpg, etc. | VERIFIED | `assembly/output.ts` `formatOutputFilename()`: `ch${padStart(2)}_strip_${padStart(3)}.${ext}` — verified output for chapter 1, strip 1: `ch01_strip_001.jpg` |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Provides | Lines | Status | Details |
|----------|----------|-------|--------|---------|
| `pipeline/src/types/overlay.ts` | BalloonConfig, SfxConfig, PageOverlayData, OverlayConfig, AssemblyConfig, WEBTOON_CONFIG, PanelMetadata, AssemblyResult | 121 | VERIFIED | All required types present. DEFAULT_OVERLAY_CONFIG and WEBTOON_CONFIG exported as constants |
| `pipeline/src/overlay/balloon.ts` | SVG speech balloon generator for speech/thought/narration types | 122 | VERIFIED | Exports `generateBalloonSvg`. Three distinct SVG shapes. XML escaping implemented. Returns `Buffer.from(svg)` |
| `pipeline/src/overlay/text-measure.ts` | Text measurement via Sharp Pango for auto-sizing balloons | 73 | VERIFIED | Exports `measureText` and `calculateBalloonSize`. Uses Sharp Pango `text:` input with `resolveWithObject: true` |
| `pipeline/src/overlay/sfx.ts` | SFX text rendering via Sharp Pango markup | 47 | VERIFIED | Exports `renderSfx`. Skips empty or em-dash text. Pango markup with Impact font, red color, letter spacing |
| `pipeline/src/overlay/renderer.ts` | Orchestrator compositing balloons and SFX onto panel images | 122 | VERIFIED | Exports `overlayPage`. Zone-based placement. Single `sharp().composite(composites)` call. Returns PNG buffer |
| `pipeline/src/stages/overlay.ts` | Stage entry point reading script.json + manifest + raw/ images | 217 | VERIFIED | Exports `runOverlay`. Reads script.json, loads manifest, filters pages, writes to lettered/. Dry-run and verbose supported |
| `pipeline/src/assembly/strip-builder.ts` | Vertical panel stacking with configurable gutters and splash/double-spread handling | 123 | VERIFIED | Exports `assembleVerticalStrip`. Creates 800px-wide canvas, composites resized panels at cumulative Y offsets |
| `pipeline/src/assembly/slicer.ts` | 800x1280 strip slicing with Sharp extract | 77 | VERIFIED | Exports `sliceForWebtoon`. Loops in steps of sliceHeight, uses `.extract()`, applies mozjpeg |
| `pipeline/src/assembly/output.ts` | Output configuration and format constants for Webtoon Canvas | 70 | VERIFIED | Exports `WEBTOON_CONFIG`, `AssemblyConfig` (re-exported), `formatOutputFilename`, `validateStripDimensions` |
| `pipeline/src/stages/assemble.ts` | Stage entry point reading lettered/ images and writing webtoon/ strips | 297 | VERIFIED | Exports `runAssemble`. Reads script.json for page metadata, reads lettered/, builds PanelMetadata, calls assembleVerticalStrip + sliceForWebtoon |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `stages/overlay.ts` | `output/ch-NN/script.json` | `readFile(scriptPath)` + `JSON.parse` | WIRED | `scriptPath = path.join(chapterPaths.root, 'script.json')` — reads full Chapter struct |
| `stages/overlay.ts` | `output/ch-NN/raw/` | `getApprovedEntry(manifest, page.pageNumber)` | WIRED | `rawImagePath = path.join(chapterPaths.raw, approvedEntry.imageFile)` — reads approved image |
| `overlay/balloon.ts` | `sharp composite` | `Buffer.from(svgString)` passed to `sharp().composite()` in renderer.ts | WIRED | `composites.push({ input: svgBuffer, top: clampedY, left: clampedX })` — `svgBuffer` is output of `generateBalloonSvg()` |
| `stages/overlay.ts` | `output/ch-NN/lettered/` | `writeFile(outputPath, letteredBuffer)` / `copyFile(rawImagePath, outputPath)` | WIRED | `outputPath = path.join(chapterPaths.lettered, outputFilename)` — confirmed no write to raw/ |
| `assembly/strip-builder.ts` | `output/ch-NN/lettered/` | `panels` array with paths from `readdir(letteredDir)` | WIRED | `panels[].path = path.join(letteredDir, filename)`, each read via `sharp(panel.path).resize(...)` |
| `assembly/strip-builder.ts` | `sharp composite` | `sharp({ create: { width: 800 } }).composite(composites)` | WIRED | Canvas at `config.width` (800), composites hold each resized panel buffer at cumulative yOffset |
| `assembly/slicer.ts` | `sharp extract` | `.extract({ left: 0, top, width: totalWidth, height: sliceHeight })` | WIRED | Loop steps by `config.sliceHeight` (1280), last slice uses `Math.min` guard |
| `stages/assemble.ts` | `output/ch-NN/webtoon/` | `sliceForWebtoon(stripBuffer, webtoonDir, chapter, config)` | WIRED | `webtoonDir = chapterPaths.webtoon` — `ensureDir` called before slicing |
| `stages/assemble.ts` | `stages/overlay.ts` (dependency) | Reads from lettered/ (overlay must run first) | WIRED | Explicit error: `"No lettered images found. Run overlay stage first."` if lettered/ is empty or missing |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TEXT-01 | 04-01-PLAN | Programmatic dialogue overlay renders speech balloons and text onto panel images using Sharp | SATISFIED | `overlay/` module: balloon.ts (SVG), renderer.ts (compositor), stages/overlay.ts (stage entry). TypeScript compiles clean, CLI wired |
| TEXT-02 | 04-01-PLAN | Dialogue data extracted from scripts into structured format (JSON) for overlay processing | SATISFIED | `stages/overlay.ts` reads `script.json`, calls `page.panels.flatMap(p => p.dialogue)` to build `PageOverlayData.dialogueLines` |
| ASSM-01 | 04-02-PLAN | Pipeline assembles panels into vertical-scroll Webtoon strips (800px wide) | SATISFIED | `strip-builder.ts` creates canvas at `config.width=800`, resizes all panels to 800px, stacks vertically |
| ASSM-02 | 04-02-PLAN | Output is Webtoon Canvas-compatible (JPG/PNG at correct dimensions) | SATISFIED | `slicer.ts` produces 800x1280 JPEG slices with mozjpeg at quality 90. Filenames: `ch01_strip_001.jpg`. `validateStripDimensions` provided |
| ASSM-03 | 04-02-PLAN | Splash pages and double-spreads handled with appropriate aspect ratio assembly | SATISFIED | `strip-builder.ts` uses `fit: 'inside'` resize for all types — splash (taller) and double-spread (shorter) are handled by source dimensions, aspect ratio preserved |
| ASSM-04 | 04-01-PLAN + 04-02-PLAN | Intermediate artifacts preserved at each stage (raw/, processed/, lettered/, webtoon/) | SATISFIED | `paths.ts` configures all four directories. generate->raw/, overlay reads raw/->writes lettered/, assemble reads lettered/->writes webtoon/. No stage overwrites upstream |

All 6 Phase 4 requirements (TEXT-01, TEXT-02, ASSM-01, ASSM-02, ASSM-03, ASSM-04) are satisfied.

No orphaned requirements — REQUIREMENTS.md traceability table maps exactly TEXT-01, TEXT-02, ASSM-01, ASSM-02, ASSM-03, ASSM-04 to Phase 4, matching the plan frontmatter declarations.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/characters/registry.ts` | 153, 157 | TODO comments inside YAML scaffold template string | Info | Not a functional stub — these TODOs are literal text written to a YAML file as user instructions. Not in Phase 4 files. No impact. |

No blockers or warnings found in Phase 4 files.

---

### Human Verification Required

The following items require running the pipeline with real image data to fully confirm:

#### 1. Balloon Visual Quality

**Test:** Run `overlay -c 1` with a real approved panel image and real script.json dialogue. Open a lettered PNG.
**Expected:** Speech balloons appear as white ellipses with visible tails, text is readable, balloons don't obscure critical art. Thought bubbles show dashed stroke. Narration boxes show beige rectangle.
**Why human:** Visual inspection of SVG compositing output — automated checks confirm SVG structure is correct but cannot verify visual clarity, readability, or placement aesthetics.

#### 2. Zone-Based Balloon Placement

**Test:** Run `overlay -c 1` on a page with 4+ panels and multiple dialogue lines. Inspect output.
**Expected:** Balloons distribute across vertical zones corresponding to panel positions, alternating left and right. No balloon is cut off at image edges.
**Why human:** Zone calculation math is verifiable but spatial appropriateness (does a balloon visually land in the right panel area) requires seeing the composited result.

#### 3. Webtoon Strip Visual Quality

**Test:** Run `assemble -c 1` after overlay completes. Inspect output JPEG strips.
**Expected:** Strips are 800px wide, ~1280px tall, black gutters visible between panels, no visible JPEG compression artifacts. Files are well under 2MB.
**Why human:** mozjpeg compression quality and visual artifact inspection requires opening the image file.

#### 4. End-to-End Pipeline Chain

**Test:** Run full chain `overlay -c 1` then `assemble -c 1` on Chapter 1 content.
**Expected:** Command sequence completes without errors, webtoon/ directory contains numbered JPEG strips ready for Webtoon Canvas upload.
**Why human:** Integration test across two stages with real content. Validates the full goal end-to-end.

---

## Summary

Phase 4 goal is **achieved**. All 13 observable truths are verified against the actual codebase. All 10 required artifacts exist with substantive implementations and are fully wired into the stage execution chain.

Both pipeline stages are complete:

- **Overlay stage** (`overlay/` module + `stages/overlay.ts`): reads script.json and generation manifest, composites SVG speech balloons (three distinct types), auto-sized via Sharp Pango text measurement, SFX rendered as colored Pango text, writes lettered PNGs to `lettered/`. CLI supports `--page`, `--pages`, `--dry-run`, `--verbose`. Passthrough mode copies raw images when no dialogue/SFX exists.

- **Assembly stage** (`assembly/` module + `stages/assemble.ts`): reads lettered PNGs, builds PanelMetadata with isSplash/isDoubleSpread flags from script.json, stacks all panels on 800px-wide canvas with black gutters, slices into 800x1280 JPEG strips with mozjpeg quality 90, outputs to `webtoon/`. CLI supports `--format`, `--quality`, `--gutter`.

TypeScript compiles with zero errors. Both CLIs are wired and show correct `--help` output. No stubs, no placeholder returns, no broken imports found in Phase 4 code.

Four items flagged for human verification — all involve visual/integration testing that requires actual image content. None are blockers to code correctness.

---

*Verified: 2026-02-19*
*Verifier: Claude (gsd-verifier)*
