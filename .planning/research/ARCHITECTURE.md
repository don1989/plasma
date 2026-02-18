# Architecture Research

**Domain:** AI manga production pipeline (story-to-Webtoon)
**Researched:** 2026-02-18
**Confidence:** MEDIUM — Architecture inferred from existing project artifacts and domain knowledge. Web research tools unavailable; findings based on direct inspection of existing pipeline artifacts and general AI image pipeline patterns. Flag: validate image assembly tooling choices before implementation.

---

## Standard Architecture

### System Overview

The pipeline is a **linear transformation chain** — each stage produces artifacts consumed by the next. No stage needs to know about stages beyond its immediate input and output. This makes the pipeline testable in isolation and replaceable at any stage (e.g., swapping Gemini for a different generator later without touching the assembler).

```
┌──────────────────────────────────────────────────────────────────┐
│                     SOURCE LAYER (Existing)                       │
├───────────────┬──────────────────┬───────────────────────────────┤
│  Plasma.md    │   01_bible/      │   03_manga/                   │
│  (story)      │   (canon rules)  │   (manga-script.md,           │
│               │                  │    dialogue-pass.md,           │
│               │                  │    prompts/character-sheets.md)│
└───────┬───────┴────────┬─────────┴───────────────────────────────┘
        │                │
        ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    STAGE 1: SCRIPT GENERATOR                      │
│   Input:  Story chapter (Plasma.md Ch.N) + story bible           │
│   Output: Panel-by-panel manga script                             │
│   Tool:   Claude (structured prompt using manga-script.md rules) │
│   Format: 03_manga/chapter-NN-script.md                          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    STAGE 2: PROMPT GENERATOR                      │
│   Input:  chapter-NN-script.md + character-sheets.md             │
│   Output: Gemini-optimized art prompts, one per page             │
│   Tool:   Claude (structured expansion of panel notes)           │
│   Format: 03_manga/prompts/ch-NN-pages-XX-to-YY.md              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼ (manual hand-off initially)
┌──────────────────────────────────────────────────────────────────┐
│                    STAGE 3: IMAGE GENERATOR                       │
│   Input:  Art prompts (copy-pasted to Gemini / API call)         │
│   Output: Raw PNG images, one per page                            │
│   Tool:   Gemini (Imagen backend)                                 │
│   Format: 03_manga/raw/ch-NN/page-XX.png                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    STAGE 4: POST-PROCESSOR                        │
│   Input:  Raw page images                                         │
│   Output: Cropped, resized, consistency-checked images           │
│   Tool:   Python (Pillow) or manual review                        │
│   Format: 03_manga/processed/ch-NN/page-XX.png                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    STAGE 5: DIALOGUE OVERLAY                      │
│   Input:  Processed images + dialogue from script                 │
│   Output: Images with speech balloons / text overlaid            │
│   Tool:   Python (Pillow + font rendering) or Webtoon Studio     │
│   Format: 03_manga/lettered/ch-NN/page-XX.png                    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    STAGE 6: WEBTOON ASSEMBLER                     │
│   Input:  Lettered images (all pages for chapter)                │
│   Output: Single tall vertical-scroll image strip per chapter    │
│   Tool:   Python (Pillow vertical stitch)                         │
│   Format: 03_manga/output/ch-NN-webtoon.png (or series of PNGs)  │
└──────────────────────────────────────────────────────────────────┘
```

---

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Script Generator | Convert prose narrative to structured panel scripts with shot types, dialogue, SFX, composition notes | Claude with manga-script.md as system context |
| Prompt Generator | Expand panel scripts into self-contained Gemini art prompts with full character descriptions embedded | Claude with character-sheets.md injected |
| Image Generator | Produce panel art from prompts | Gemini (manual copy-paste or Gemini API) |
| Post-Processor | Resize to consistent Webtoon width (800px), crop bad generations, flag consistency failures | Python/Pillow; manual review gate |
| Dialogue Overlay | Place speech balloons, thought bubbles, SFX text, and narration boxes onto panel images | Python/Pillow with custom font rendering; or Clip Studio/Webtoon Studio for manual phase |
| Webtoon Assembler | Stitch individual panel images into a single vertical-scroll strip optimized for mobile reading | Python/Pillow vertical concatenation |

---

## Recommended Project Structure

This structure extends the existing repo without disrupting existing organization:

```
plasma/
├── 01_bible/                    # Existing — canon, unchanged
├── 02_planning/                 # Existing — outlines, unchanged
├── 03_manga/
│   ├── manga-script.md          # Existing — scripting rules
│   ├── dialogue-pass.md         # Existing — voice profiles
│   ├── chapter-01-script.md     # Existing — Ch.1 panel script
│   ├── prompts/
│   │   ├── character-sheets.md  # Existing — character reference prompts
│   │   ├── pages-01-to-15.md    # Existing — Ch.1 prompts
│   │   └── pages-16-to-29.md    # Existing — Ch.1 prompts
│   ├── concept/                 # Existing — concept art images
│   └── pipeline/                # NEW — pipeline tooling
│       ├── scripts/             # Python scripts for each stage
│       │   ├── post_process.py  # Stage 4: crop/resize
│       │   ├── overlay.py       # Stage 5: dialogue overlay
│       │   └── assemble.py      # Stage 6: webtoon stitch
│       ├── fonts/               # Font files for text overlay
│       ├── config/
│       │   └── webtoon.json     # Target dimensions, margins, font sizes
│       └── README.md            # Pipeline operation guide
├── output/                      # NEW — final deliverables by chapter
│   └── ch-01/
│       ├── raw/                 # Stage 3 output: raw Gemini images
│       ├── processed/           # Stage 4 output: cropped/resized
│       ├── lettered/            # Stage 5 output: dialogue overlaid
│       └── webtoon/             # Stage 6 output: final strip(s)
```

### Structure Rationale

- **`03_manga/pipeline/`:** Keeps tooling co-located with manga production assets. The pipeline scripts are not a standalone app — they are tools serving the manga workflow.
- **`output/ch-NN/` per chapter:** Preserves all intermediate stages. This is critical: if Stage 6 assembly fails, you have the lettered images. If Stage 5 dialogue needs a fix, you have the processed images. Never overwrite upstream stages.
- **Flat prompt files per chapter range:** Matches existing `pages-01-to-15.md` pattern. One file per ~15 pages is manageable for manual copy-paste workflow without being overwhelming.

---

## Architectural Patterns

### Pattern 1: Self-Contained Prompts (CHARACTER EMBEDDING)

**What:** Every Gemini art prompt includes the full character visual description inline, not by reference. The prompt is a standalone document readable by Gemini with no surrounding context.

**When to use:** Always — for every panel prompt. Gemini has no session memory. Each generation call is stateless.

**Trade-offs:** Prompts are verbose (200-400 words each). This is the correct trade-off: verbose prompts that work beat short prompts that produce inconsistent characters.

**Example (from existing `pages-01-to-15.md`):**
```
Colored manga page, cel-shaded, clean linework, vibrant colors, dynamic panel layout.

PANEL 3 (MEDIUM-WIDE — bottom right): A young man (age 21) — Spyke (spiky ginger hair
with tips reaching his traps, red bandana tied in his hair with tails trailing, green eyes,
white knee-length cloak with sleeves cut and a decorative pattern along the bottom hem
flowing behind him as he runs, a dojo emblem visible on the cloak's back, red fingerless
glove on left hand with red bracer on left wrist, armoured full-fingered steel grey glove
on right hand...)
```

This is the pattern already established and validated in the existing repo. Build on it.

---

### Pattern 2: One Page Per Generation Call (PAGE-LEVEL GRANULARITY)

**What:** Each Gemini call generates one manga page (multi-panel layout described in the prompt). Not one panel per call, not one chapter per call.

**When to use:** Default. Generating a full page produces coherent panel composition and natural panel-to-panel flow within a page. Generating individual panels loses inter-panel spatial relationships.

**Trade-offs:** Some pages will have one panel that's wrong. Accept this — the regeneration cost of one bad page is lower than the complexity of stitching individually generated panels.

**Exception:** Splash pages (single full-page panel) and key character reference shots may warrant individual panel calls for maximum quality.

---

### Pattern 3: Intermediate Artifact Preservation (NEVER DESTRUCTIVE)

**What:** Each pipeline stage writes to its own output folder and never overwrites upstream artifacts. Processing is always additive.

**When to use:** Always. The pipeline produces expensive artifacts (AI-generated images). Overwriting `raw/` with `processed/` would destroy work that may take hours to regenerate.

**Trade-offs:** More disk space. Acceptable — manga pages are typically 1-3MB PNG files. A full 15-chapter run is manageable on a modern machine.

```
output/ch-01/raw/page-01.png     → kept forever
output/ch-01/processed/page-01.png → kept forever
output/ch-01/lettered/page-01.png  → kept forever
output/ch-01/webtoon/ch-01.png     → final deliverable
```

---

### Pattern 4: Manual Checkpoint Gates (HUMAN-IN-THE-LOOP)

**What:** The pipeline has explicit human review gates between image generation (Stage 3) and post-processing (Stage 4), and between post-processing and dialogue overlay (Stage 5).

**When to use:** Always in the initial manual workflow. These gates exist because AI-generated images require human judgment calls: Is this panel close enough? Does Spyke's hair look right? Is this scene too dark?

**Trade-offs:** Slower throughput. This is appropriate — quality control is the hardest problem in AI manga production.

**Operationally:** Implement as a simple review folder + a `manifest.json` or checklist file per chapter that tracks which pages have been approved at each stage.

---

## Data Flow

### Full Chapter Flow (Manual Workflow)

```
[Plasma.md Ch.N]
      +
[01_bible/ + manga-script.md rules]
      |
      ▼ Claude (Stage 1)
[03_manga/chapter-NN-script.md]
      |
      ▼ Claude (Stage 2)
[03_manga/prompts/ch-NN-pages-XX-to-YY.md]
      |
      ▼ MANUAL: Copy-paste to Gemini UI, save images
[output/ch-NN/raw/page-XX.png × N pages]
      |
      ▼ HUMAN REVIEW GATE
      |
      ▼ Post-process script (Stage 4)
[output/ch-NN/processed/page-XX.png × N pages]
      |
      ▼ HUMAN REVIEW GATE (approve dialogue positions)
      |
      ▼ Overlay script (Stage 5)
[output/ch-NN/lettered/page-XX.png × N pages]
      |
      ▼ Assemble script (Stage 6)
[output/ch-NN/webtoon/ch-NN-strip-01.png ... ch-NN-strip-K.png]
      |
      ▼ PUBLISH
[Webtoon platform upload]
```

### Dialogue Data Flow (Stage 5 Detail)

Dialogue does NOT live inside the AI-generated images. This is the critical decision — baking text into Gemini prompts produces garbled, unreadable, or hallucinated text. TEXT MUST BE OVERLAID PROGRAMMATICALLY.

```
[chapter-NN-script.md]
      ↓ parse dialogue by page/panel
[dialogue_map.json]  — {page: 01, panel: 3, speaker: "SPYKE", text: "Shit. I'm gonna be late..."}
      +
[output/ch-NN/processed/page-01.png]
      |
      ▼ overlay.py (place speech balloon SVG + text)
[output/ch-NN/lettered/page-01.png]
```

### API Upgrade Path (Future)

When the Gemini API is integrated, Stage 3 transitions from manual to automated. The pipeline structure does not change — only the implementation of Stage 3 changes from "human copies prompt to UI" to "Python calls `google-genai` SDK with prompt string."

```
[Stage 2 output: prompt files]
      ↓ read prompt text
      ↓ POST to Gemini API (google-genai Python SDK)
      ↓ receive base64 image
      ↓ write to output/ch-NN/raw/page-XX.png
[Same downstream stages]
```

---

## Scaling Considerations

This is a single-author production pipeline, not a multi-user platform. Scaling considerations apply to pipeline throughput, not concurrent users.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Ch.1 (29 pages) | Manual workflow is fine. All stages can run sequentially in one session. No automation needed to validate quality. |
| Ch.1-5 (~150 pages) | Manual workflow becomes painful. Stage 3 automation (Gemini API) is the first priority. Post-processing batch script becomes essential. |
| Ch.1-15 (~750 pages) | API automation required for all scriptable stages. Consider a simple task queue (JSON file tracking page status) to track pipeline state across sessions. A dedicated pipeline runner script (`run_chapter.py`) that orchestrates all stages becomes valuable. |

### Scaling Priorities

1. **First bottleneck: Stage 3 (image generation).** Manual copy-paste of 29 prompts per chapter is the dominant time cost. Automate this first when Gemini API access is confirmed.
2. **Second bottleneck: Stage 5 (dialogue overlay).** Manual balloon placement is tedious at scale. A programmatic overlay with configurable balloon positions (read from `dialogue_map.json`) is the right investment after Stage 3 automation.
3. **Not a bottleneck: Stages 1-2.** Claude is fast. Generating the script and prompts for a chapter takes one session regardless of chapter count.

---

## Anti-Patterns

### Anti-Pattern 1: Generate Text Inside the AI Image

**What people do:** Include speech balloon text and dialogue directly in the Gemini prompt, expecting the model to render readable text inside panels.

**Why it's wrong:** Gemini (Imagen) and all current diffusion-based image models cannot reliably render coherent text strings. The result is garbled, misspelled, or hallucinated text that must be manually corrected or regenerated — which costs more time than programmatic overlay.

**Do this instead:** Instruct Gemini prompts to leave speech balloon areas blank or show empty balloon shapes. Extract dialogue from the script file programmatically and overlay it with Python/Pillow using a manga-appropriate font (e.g., Bangers, Wild Words, or Anime Ace). This is the industry-standard approach for AI-assisted manga production.

---

### Anti-Pattern 2: One Panel Per Generation Call

**What people do:** Generate each panel individually, then stitch panels into a page layout.

**Why it's wrong:** Individual panel generation loses the page-level composition — relative sizes, panel borders, panel flow direction. Stitching individually-generated panels into a coherent page layout is significantly harder than having the model compose the full page in one generation. Panel borders and spacing become inconsistent.

**Do this instead:** Describe the full page layout in one prompt (as already established in `pages-01-to-15.md`). Use panel-level generation only for splash pages or key hero shots where quality of a single panel matters more than page composition.

---

### Anti-Pattern 3: Overwrite Upstream Artifacts

**What people do:** Post-process images in-place, writing processed output back to the raw image path.

**Why it's wrong:** If post-processing introduces a problem (wrong crop, bad resize), the original raw image is gone. Regenerating from Gemini costs API quota, time, and may not produce the same output. Intermediate artifacts are expensive.

**Do this instead:** Always write to a new folder for each stage (`raw/`, `processed/`, `lettered/`, `webtoon/`). Disk space is cheap; AI image generation is not.

---

### Anti-Pattern 4: Character Sheet as Separate Reference (Not Embedded)

**What people do:** Keep a single character reference image and instruct the model to reference it, assuming Gemini maintains visual consistency from a reference sheet.

**Why it's wrong:** Without fine-tuning or a reference image injection in every call, Gemini has no memory of previous character appearances. A character reference sheet image can be injected as a multi-modal input alongside text prompts — but this requires API access and proper implementation. Before API access, the only reliable consistency strategy is dense text description embedded in every prompt.

**Do this instead:** Embed the full character visual description text in every prompt (already done in the existing prompts). When API access is available, inject the approved concept art image alongside the text description as a multi-modal reference in each generation call.

---

### Anti-Pattern 5: Building the Assembler Before Validating Generation Quality

**What people do:** Build the full pipeline (all 6 stages automated) before generating and reviewing a single chapter manually.

**Why it's wrong:** If Stage 3 produces unusable output (wrong style, wrong characters, garbled panels), stages 4-6 are wasted engineering. The pipeline's value depends entirely on acceptable generation quality, which must be empirically validated before automation is built.

**Do this instead:** Build and validate Stage 3 manually (copy-paste workflow) first. Get one full chapter's pages to a state you'd publish. Then build stages 4-6 automation. This is the correct build order.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Gemini (Imagen) — manual | Copy-paste text prompt to Gemini web UI; save output PNG | Current workflow. No API key required. Rate limited by manual throughput. |
| Gemini API (`google-generativeai` Python SDK) | POST prompt + optional reference image; receive base64 PNG; write to file | Future workflow. Requires Gemini Pro API key. Image generation via `gemini-2.0-flash-exp` or Imagen 3 model. Confidence: MEDIUM — verify current image generation API endpoint and model ID before implementing. |
| Webtoon Platform | Manual upload of final assembled strips via Creator Studio web UI | Webtoon has no public API for programmatic upload as of training cutoff. Confirm before automating upload step. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Stage 1 → Stage 2 | File read (`chapter-NN-script.md`) | Stage 2 only reads Stage 1 output; no shared state |
| Stage 2 → Stage 3 | File read (`prompts/ch-NN-pages-XX-YY.md`) | Human manually opens file and copies prompts to Gemini in current workflow |
| Stage 3 → Stage 4 | File system (`output/ch-NN/raw/`) | Human downloads images from Gemini UI and places in `raw/` folder |
| Stage 4 → Stage 5 | File system (`output/ch-NN/processed/` + `dialogue_map.json`) | Dialogue data extracted from script; image locations from processed folder |
| Stage 5 → Stage 6 | File system (`output/ch-NN/lettered/`) | Assembler reads all images in folder in sorted order |

### Dialogue Map Schema

Stage 5 requires structured dialogue data extracted from the script. The recommended intermediate format:

```json
{
  "chapter": "01",
  "pages": [
    {
      "page": 1,
      "panels": [
        {
          "panel": 3,
          "balloons": [
            {
              "type": "thought",
              "speaker": "SPYKE",
              "text": "Shit. I'm gonna be late...",
              "position": "top-right"
            }
          ]
        }
      ]
    }
  ]
}
```

This can be generated by Claude (Stage 1.5: dialogue extraction pass) from the structured script, or hand-authored alongside the script. It decouples the overlay tool from markdown parsing complexity.

---

## Suggested Build Order

Build order is determined by stage dependencies and risk mitigation:

**Phase 1 — Validate Generation Quality (no tooling needed)**
Manual execution of Stages 1-3 for Chapter 1. Accept that Chapter 1 scripts and prompts already exist. Focus is on generating all 29 pages manually and reviewing output quality. This is the proof-of-concept gate. Everything else depends on Gemini producing acceptable images.

**Phase 2 — Assembly Tooling (Stages 4-6)**
Build post-processing, overlay, and assembly scripts. These are deterministic Python scripts and can be built and tested without Gemini API access. Use the manually-generated Chapter 1 images as test input.

**Phase 3 — Process Codification (Stage 1-2 templates)**
Formalize Stage 1 and Stage 2 as repeatable Claude prompts with consistent input/output contracts. Template for each stage: what context to inject, what format to request, how to validate output.

**Phase 4 — API Automation (Stage 3 automation)**
Integrate the Gemini API for automated image generation. Requires confirmed API access and validated prompt format from Phase 1.

**Phase 5 — Chapter 2+ Repeatability**
Run the full pipeline on Chapter 2. The pipeline is considered proven when Chapter 2 produces publishable output with less manual effort than Chapter 1.

---

## Sources

- Direct inspection of `/Users/dondemetrius/Code/plasma/03_manga/prompts/pages-01-to-15.md` — existing Gemini prompt format (MEDIUM confidence — source is the project's own established pattern)
- Direct inspection of `/Users/dondemetrius/Code/plasma/03_manga/chapter-01-script.md` — script structure and panel format
- Direct inspection of `/Users/dondemetrius/Code/plasma/.planning/PROJECT.md` — stated pipeline stages and constraints
- Architecture patterns for AI image pipeline stages: domain knowledge from AI art production workflows (LOW confidence on specific tool choices — verify Pillow API, Gemini API endpoint, and font rendering libraries before implementation)
- Webtoon format: 800px wide, vertical scroll optimized for mobile — well-established Webtoon Creator guidelines (MEDIUM confidence — verify current Webtoon Creator upload specifications at creators.webtoons.com before finalizing image dimensions)

---
*Architecture research for: AI manga production pipeline (story-to-Webtoon)*
*Researched: 2026-02-18*
