# Project Research Summary

**Project:** Plasma — AI-Powered Manga Production Pipeline
**Domain:** Webtoon-format digital comics using Gemini image generation
**Researched:** 2026-02-18
**Confidence:** MEDIUM

## Executive Summary

Plasma is a 15-chapter Webtoon comic with existing story prose, a world bible, and character designs. The goal is a repeatable production pipeline that transforms story chapters into publishable Webtoon episodes using Gemini for panel art generation. This is a structured transformation chain — not a platform or product — with six discrete stages: script generation, prompt generation, image generation (Gemini), post-processing, dialogue overlay, and vertical assembly. Research confirms this approach is sound, that the existing project artifacts (chapter-01-script.md, character sheets, 29 page prompts) are already validated input for the pipeline, and that the remaining engineering work is well-scoped Python tooling around Pillow and the Gemini API.

The recommended approach is to build the pipeline in the same order as data flows through it, but validate before automating. Chapter 1 pages 1-29 already exist in prompt form; completing prompts for pages 30-48 and then generating all panels manually is the correct first milestone. This generates real output to QC, proves the visual style is achievable, and de-risks the pipeline before any tooling is built. Programmatic stages (post-processing, dialogue overlay, assembly) can then be built using the Chapter 1 images as test data. Gemini API automation is explicitly Phase 4, not Phase 1 — the manual workflow is a feature, not a limitation.

The dominant risks are character drift across panels, garbled AI-rendered text, and manual workflow version chaos. All three are preventable at low cost if addressed before production begins: locked character prompt fingerprints, a decision to never bake dialogue into AI art (always programmatic overlay), and a naming convention enforced from the first generated panel. Failing to address these in Phase 1 creates exponentially more expensive rework when discovered after a full chapter is assembled.

---

## Key Findings

### Recommended Stack

The pipeline is a Python-first toolchain. Python 3.11 (already on system), Pillow 11.2.1 (already installed), and the `google-generativeai` SDK are the core. Jinja2 handles prompt templating to prevent the copy-paste errors that come from maintaining 48 per-panel prompts manually. Click provides a clean CLI so each pipeline stage is independently invokable. `python-dotenv` handles the Gemini API key from Day 1. No JavaScript, no custom ML training, no Stable Diffusion — the project constraint is Gemini and that is the correct constraint.

Note: Gemini image generation via the `google-generativeai` SDK (model name referenced in repo as "Nano Banana" — consistent with Gemini 2.0 Flash Experimental) is MEDIUM confidence. API access status for image generation is unconfirmed. The pipeline must be designed so manual image generation (copy-paste to Gemini web UI) is a fully functional path — API automation is a drop-in upgrade, not a prerequisite.

**Core technologies:**
- Python 3.11.9: Pipeline scripting — already installed via pyenv
- Pillow 11.2.1: Image manipulation, text overlay, vertical strip assembly — already installed
- google-generativeai (>=0.8): Gemini API client for Stage 3 automation — install when API access confirmed
- Jinja2 3.x: Prompt template engine — prevents copy-paste errors across 48-panel chapter prompts
- Click 8.x: CLI for pipeline stages — makes each stage independently runnable
- PyYAML / TOML: Character reference and chapter config storage
- python-dotenv 1.x: API key management — required from Day 1, not later

**What NOT to use:** Wand/ImageMagick (C dependency breaks on macOS), Stable Diffusion (wrong project), any tool that isn't scriptable and repeatable.

### Expected Features

The pipeline's features are defined by the 6-stage data flow. Every table-stakes feature is a stage or a prerequisite to a stage. All 8 table-stakes features must be complete for Chapter 1 to be publishable.

**Must have (table stakes — v1, Chapter 1):**
- Manga script generation from prose — already exists for Ch.1; must be templated for Ch.2+
- Art prompt generation per panel — 29 of 48 Ch.1 prompts exist; need pages 30-48
- Character reference sheet prompts — exist for Ch.1 cast (Spyke, June, Draster, Hood, Punks)
- Style guide embedded in every prompt — exists; must be locked verbatim and never paraphrased
- Dialogue/SFX text overlay — CRITICAL PATH DECISION: programmatic Pillow overlay (never AI-rendered text)
- Panel vertical strip assembly — 800px wide Webtoon format, Python/Pillow stitching
- Panel QC / consistency review checklist — per-panel approval gate before assembly
- Output format compatible with Webtoon Canvas — JPG/PNG at correct dimensions

**Should have (competitive — v1.x, pipeline systematization):**
- Prompt template library — character blocks and style prefixes as Jinja2 templates, not copy-paste
- New character introduction workflow — structured process for Ch.2+ characters (Jairek, Hector, Micki, etc.)
- Batch prompt generation — full chapter in one pass
- Splash/spread handling — distinct assembly logic for full-page and double-page spreads (Ch.1 p.23, p.25-26)
- Narrative-to-script validation — check script conforms to manga-script.md rules before prompt generation
- Visual continuity checking — structured review against reference sheets

**Defer (v2+):**
- Gemini API integration — replace copy-paste with API calls; needs confirmed API access first
- Visual continuity automation — AI-assisted panel vs. reference sheet comparison
- SFX visual design system — curated manga-style SFX font library
- Dialogue balloon placement map — per-panel balloon position in script

**Anti-features to reject explicitly:**
- Fully automated end-to-end generation (no review loops = garbage output)
- AI-rendered dialogue text in panels (garbled, always)
- Custom model training for character consistency (months of ML work, out of scope)
- Print-ready formatting (stated out of scope in PROJECT.md)
- Animation / interactive branching (separate future projects)

### Architecture Approach

The pipeline is a linear transformation chain. Each stage reads from the previous stage's output folder and writes to its own output folder. No stage knows about stages beyond its immediate I/O boundary. This makes every stage independently testable, replaceable (e.g., swap Gemini for a different generator), and rerunnable without touching upstream artifacts. Human review gates sit between Stage 3→4 (image QC) and Stage 4→5 (dialogue placement approval). All intermediate artifacts are preserved — raw images are never overwritten by processed images.

The critical architectural decision already validated by the existing prompts: each Gemini call generates one full page (multi-panel), not individual panels. This preserves panel-to-panel composition coherence within a page. Individual panel generation is reserved for splash pages and hero character shots.

Dialogue is extracted from the script into a structured `dialogue_map.json` per chapter, then programmatically overlaid in Stage 5 using Pillow/ImageDraw. This decouples text editing from art regeneration.

**Major pipeline stages:**
1. Script Generator — story prose + bible → panel-by-panel manga script (Claude-assisted, using manga-script.md rules)
2. Prompt Generator — manga script + character sheets → Gemini art prompts (Claude-assisted, Jinja2 templates)
3. Image Generator — art prompts → raw panel images (Gemini web UI manually, or API when available)
4. Post-Processor — raw images → cropped/resized 800px panels + human QC gate (Python/Pillow)
5. Dialogue Overlay — processed images + dialogue_map.json → lettered panels (Python/Pillow + manga fonts)
6. Webtoon Assembler — lettered panels → vertical Webtoon strip (Python/Pillow vertical stitch)

**Recommended project structure extension:**
```
03_manga/pipeline/       — Python scripts for stages 4-6
output/ch-NN/raw/        — Stage 3 output, never overwritten
output/ch-NN/processed/  — Stage 4 output
output/ch-NN/lettered/   — Stage 5 output
output/ch-NN/webtoon/    — Stage 6 final deliverable
```

### Critical Pitfalls

Research identified 8 pitfalls with first-hand evidence from this repo's concept art generation history. Top 5 to address before production:

1. **Character drift across generations** — Each Gemini call re-rolls the character from scratch. Prevention: generate and lock a tested prompt "fingerprint" per character (tested over 5+ consecutive runs against reference sheets) before any production panel generation. Never paraphrase the fingerprint. Evidence from repo: Spyke's age appeared as 16 instead of 21 in two early runs; June's prompt produced blue/teal despite specifying dark pink in 2 of 3 attempts.

2. **Garbled AI text in panels** — AI image models treat text as visual texture. Readable dialogue in AI-generated panels is not reliable. Prevention: generate all panels as art-only (no dialogue in panel prompt). Overlay ALL text — dialogue, SFX, narration, captions — programmatically in Stage 5. This decision must be made before generating any production panels; reversing it requires regenerating every panel.

3. **Manual workflow version chaos** — Without a naming convention, 30-50 images per chapter with generic Gemini filenames make it impossible to track which prompt produced which approved image. Prevention: enforce `ch01_p003_panel2_v1.png` naming from the first generated production panel. Maintain a per-chapter prompts.md that records the exact approved prompt for each panel.

4. **Style inconsistency across a chapter** — Subtle prompt variation produces visible style drift across 30+ panels. Prevention: lock one tested style prefix string verbatim and paste it into every prompt without modification. "Clean linework" and "crisp linework" produce different outputs.

5. **Wrong aspect ratio panels** — Gemini defaults to square/landscape output; Webtoon requires tall vertical panels at 800px wide. Prevention: determine exact per-panel resolution spec before any production generation and confirm Gemini's actual output dimensions match the spec. Discovering wrong dimensions after assembling a full chapter requires complete regeneration.

---

## Implications for Roadmap

Based on the combined research, the architecture's suggested build order maps cleanly to a 5-phase roadmap. The ordering is driven by three constraints: (1) validate generation quality before building automation, (2) address infrastructure pitfalls before production volume, (3) defer API automation until the manual pipeline is proven.

### Phase 1: Foundation and Generation Validation

**Rationale:** The pipeline's entire value depends on Gemini producing acceptable panel art. This must be empirically validated before building any tooling. Simultaneously, the three Phase 1 pitfalls (character drift, version chaos, aspect ratio) must be resolved before generating any production panels — fixing them retroactively is expensive. This phase has no tooling prerequisites.

**Delivers:** Complete Chapter 1 raw panel images (all 48 pages), approved against character reference sheets, with locked character fingerprints and style prefix.

**Addresses (from FEATURES.md):**
- Complete art prompt generation for Ch.1 pages 30-48 (29 already exist)
- Character reference sheet validation against concept art
- Style guide locked as verbatim prefix
- Webtoon output format specification confirmed

**Avoids (from PITFALLS.md):**
- Character drift (locked fingerprints tested before production)
- Style inconsistency (style prefix locked before production)
- Wrong aspect ratio (Webtoon spec confirmed before first panel)
- Manual version chaos (naming convention enforced from first panel)

**Research flag:** Needs phase-specific research — Gemini API image generation capabilities (aspect ratio control, available output dimensions, multimodal reference image input). Run `/gsd:research-phase` before implementation.

---

### Phase 2: Assembly Tooling (Stages 4-6)

**Rationale:** Once Chapter 1 raw images are approved and in hand, Stages 4-6 can be built and tested against real data. These are deterministic Python scripts with no dependency on Gemini. Building them with real input is significantly better than building them speculatively. This phase delivers a complete publishable Chapter 1 episode.

**Delivers:** Complete publishable Chapter 1 Webtoon episode — processed, lettered, assembled, Webtoon Canvas-ready.

**Addresses (from FEATURES.md):**
- Dialogue/SFX text overlay (programmatic, never AI-rendered) — CRITICAL PATH
- Panel vertical strip assembly at Webtoon format
- Splash/spread handling (Ch.1 p.23, p.25-26)
- Output format compatibility with Webtoon Canvas
- Panel QC checklist formalized

**Implements (from ARCHITECTURE.md):**
- `post_process.py` — Stage 4: crop, resize to 800px
- `overlay.py` — Stage 5: Pillow + manga font text overlay, dialogue_map.json input
- `assemble.py` — Stage 6: vertical stitch into Webtoon strip
- `dialogue_map.json` schema for Chapter 1

**Avoids (from PITFALLS.md):**
- Baked-in text (programmatic overlay only)
- Overwriting upstream artifacts (separate output directories per stage)
- Building assembler before validating generation (Phase 1 gates this)

**Stack requirements:** Pillow 11.2.1, Python 3.11, Click 8.x, manga font files (Bangers/Wild Words/Anime Ace TTF), python-dotenv.

**Research flag:** Low — Pillow text overlay and vertical assembly are well-documented. May need a quick research pass on manga-appropriate font licenses and Webtoon Canvas upload specs before finalizing output format.

---

### Phase 3: Process Codification and Template System

**Rationale:** After Chapter 1 is published, the pipeline must be systematized so Chapter 2 takes less effort than Chapter 1. The manual-repetition pitfalls (copied character descriptions, copy-pasted style prefix) are replaced with a Jinja2 template system. Stages 1 and 2 are formalized as documented, reproducible Claude-assisted workflows.

**Delivers:** Template library covering all Ch.1 character blocks and style prefixes. Documented Stage 1 and Stage 2 Claude prompts with consistent I/O contracts. New character introduction workflow for Ch.2 cast (Jairek, Hector, Micki, etc.).

**Addresses (from FEATURES.md):**
- Prompt template library (character blocks, style guide as Jinja2 templates)
- New character introduction workflow
- Batch prompt generation for a full chapter in one pass
- Narrative-to-script quality validation (lightweight check against manga-script.md rules)
- Chapter-by-chapter repeatability

**Implements (from ARCHITECTURE.md):**
- `templates/prompt_base.j2` — Jinja2 base with character reference injection
- `templates/character_refs.yaml` — canonical character description data
- `config.yaml` — chapter-level configuration
- `Makefile` — `make prompts`, `make assemble` stage shortcuts

**Avoids (from PITFALLS.md):**
- Paraphrasing the style prefix (templates enforce verbatim consistency)
- Character fingerprint rewrite errors (canonical YAML source, not copied text)
- Prompt complexity overload (Jinja2 templates enforce prompt structure priority order)

**Research flag:** Standard patterns — Jinja2 templating is well-documented. No research phase needed.

---

### Phase 4: API Automation (Stage 3)

**Rationale:** Manual copy-paste of prompts becomes the dominant bottleneck after Chapter 1 is complete. With the pipeline proven, the format validated, and the prompt templates locked, Stage 3 can be automated via the Gemini API. Rate limiting, retry logic, and cost tracking are required from the first API call — not as a later addition.

**Delivers:** Automated image generation — run a script with chapter and page range, receive images in the `raw/` folder without manual copy-paste.

**Addresses (from FEATURES.md):**
- Gemini API integration (listed as v2+ / P3 in features — this is the right phase)
- Batch generation across a full chapter
- Foundation for visual continuity automation

**Implements (from ARCHITECTURE.md):**
- `generate.py` — Stage 3: reads prompt files, calls Gemini API, writes to `output/ch-NN/raw/`
- Rate limiting with tqdm + sleep
- API key management via python-dotenv

**Avoids (from PITFALLS.md):**
- Assuming web UI and API produce identical results (must re-validate prompts on API before assuming parity)
- Ignoring Gemini rate limits (rate limiting built in from first implementation)
- Losing prompt-to-image traceability (API run logs the exact prompt and model version used)

**Stack requirements:** google-generativeai (>=0.8), tqdm 4.x, python-dotenv.

**Research flag:** Needs phase-specific research — Gemini API image generation endpoint, model ID, rate limits, authentication, multimodal reference image input capability. Run `/gsd:research-phase` before implementation. Confirm API access is available and image generation quota is not restricted before scoping this phase.

---

### Phase 5: Scale to Chapter 2 and Beyond

**Rationale:** The pipeline is proven when Chapter 2 produces publishable output with less manual effort than Chapter 1. This phase runs the full automated pipeline on Chapter 2, incorporates new characters, and surfaces any remaining friction that only appears at scale.

**Delivers:** Chapter 2 published on Webtoon. Validated that the pipeline scales across chapters. New character introduction workflow exercised for Ch.2 cast.

**Addresses (from FEATURES.md):**
- Chapter-by-chapter repeatability validated
- New character introduction workflow (Jairek is Ch.2's main new character)
- Visual continuity checking at chapter scale

**Avoids (from PITFALLS.md):**
- Prompt fatigue from generating full chapter in one session (batch in groups of 5-10 panels with review)
- Regenerating failed panels mid-assembly after style drift (versioned style fingerprint file enforced)
- Full-resolution storage explosion (export approved panels to optimized WebP before assembly)

**Research flag:** Standard patterns — if Phase 3 templates and Phase 4 API automation are solid, this phase is execution, not research.

---

### Phase Ordering Rationale

- **Validation before automation:** Phase 1 (validate generation quality) gates Phase 4 (automate generation). Building API automation before knowing if Gemini produces acceptable art is waste.
- **Test data for tooling:** Phase 2 (assembly tooling) requires real panel images as test input. Running Phase 2 after Phase 1 means building scripts with real data, not speculative data.
- **Stabilize before systematizing:** Phase 3 (template system) is more effective after one full manual chapter is complete. Templates are extracted from validated prompts, not designed speculatively.
- **Critical path item:** The dialogue overlay approach (Phase 2) must be decided and tested before Phase 1 generates all panels, because the decision affects whether panels are generated with blank balloon shapes or as pure art. This is the one cross-phase dependency that requires an early decision even before Phase 2 tooling is built.

### Research Flags

**Needs `/gsd:research-phase` before planning:**
- **Phase 1:** Gemini API image generation capabilities — aspect ratio control, actual output dimensions, multimodal reference image input, model ID, API access status for image generation
- **Phase 4:** Gemini API authentication, rate limits, image generation quota, cost model, web UI vs. API output parity

**Standard patterns — skip research-phase:**
- **Phase 2:** Pillow text overlay, vertical image stitching, ImageDraw font rendering — well-documented Python standard library usage
- **Phase 3:** Jinja2 templating, PyYAML/TOML configuration, Makefile targets — established patterns
- **Phase 5:** Execution of validated pipeline — no new technology

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core tools (Python 3.11, Pillow 11.2.1) confirmed installed. Gemini model name ("Nano Banana") observed in repo but specific API endpoint, output dimensions, and API access status unverified. google-generativeai SDK MEDIUM confidence — verify version and image generation capability at install time. |
| Features | HIGH (table stakes) / MEDIUM (format specs) | Table stakes features are grounded directly in existing project artifacts. Webtoon Canvas format specs (800px wide, JPG/PNG, ~20MB) based on training knowledge — must verify at creators.webtoons.com before finalizing assembly step. |
| Architecture | MEDIUM | Architecture inferred from direct inspection of existing pipeline artifacts and domain patterns. Six-stage linear chain is sound. Dialogue map schema is original design — no external validation. Pillow API for overlay and assembly is well-documented. |
| Pitfalls | HIGH (character/text) / MEDIUM (others) | Character drift and text-in-image pitfalls have direct first-hand evidence from this repo's concept art generation attempts (June's color errors, Spyke's age metadata errors). Other pitfalls based on training data and domain knowledge. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Gemini API image generation access:** PROJECT.md states API access status is unknown. Confirm before scoping Phase 4. If API image generation is not available or is restricted, Phase 4 timeline shifts significantly. This is the single largest unknown.

- **Webtoon Canvas output specifications:** Width (800px) is well-established. Max file size per episode, exact supported pixel dimensions for tall strips, and whether Webtoon accepts WebP vs. PNG only — verify against official Webtoon Canvas creator documentation before finalizing the assembly step in Phase 2.

- **Dialogue overlay implementation:** Two approaches remain valid (programmatic overlay on pure art panels vs. Gemini-prompted blank balloon shapes + overlay). The decision is made in principle (programmatic overlay always), but the specific implementation — SVG balloon shapes, Pillow ImageDraw rounded rectangles, or pre-designed balloon templates — needs a spike in Phase 2 before all Phase 1 panels are finalized.

- **Gemini output aspect ratio control:** It is unknown whether Gemini 2.0 Flash Experimental supports specifying output dimensions or aspect ratio in the prompt or API parameters. This affects the Phase 1 format specification and whether programmatic cropping/resizing is required at Stage 4 or can be avoided.

- **Ch.1 pages 30-48 prompts:** 29 of 48 Chapter 1 page prompts are written. The remaining 19 pages are required to complete Phase 1. This is a known gap, not a research question — it is scoped work.

---

## Sources

### Primary (HIGH confidence)
- `/Users/dondemetrius/Code/plasma/.planning/PROJECT.md` — pipeline stages, constraints, stated goals
- `/Users/dondemetrius/Code/plasma/03_manga/chapter-01-script.md` — panel script structure
- `/Users/dondemetrius/Code/plasma/03_manga/manga-script.md` — scripting rules and format
- `/Users/dondemetrius/Code/plasma/03_manga/prompts/character-sheets.md` — character reference prompts (Spyke, June, Draster, Hood, Punks)
- `/Users/dondemetrius/Code/plasma/03_manga/prompts/pages-01-to-15.md`, `pages-16-to-29.md` — established Gemini prompt format and page-level generation pattern
- `/Users/dondemetrius/Code/plasma/03_manga/concept/characters/` — concept art images (direct evidence of character drift, color misinterpretation, age metadata errors)
- `pip show pillow` — Pillow 11.2.1 confirmed installed on system
- Python 3.11.9 — confirmed via pyenv on system

### Secondary (MEDIUM confidence)
- google-generativeai SDK — training data; version and image generation capability require verification at install time
- Gemini 2.0 Flash Experimental native image generation — training data; "Nano Banana" model reference observed in repo consistent with this model
- Webtoon format (800px wide, vertical scroll) — well-established creator guidelines, MEDIUM confidence on exact current specs
- Pillow vertical concatenation and ImageDraw for text overlay — training data, well-documented Python library

### Tertiary (LOW confidence — needs validation)
- Webtoon Canvas max file size and supported format specs — training data only; must verify at creators.webtoons.com
- Gemini API output aspect ratio specification capability — unknown; requires implementation-time research
- Gemini API image generation quota and rate limits — unknown; requires confirmed API access to verify
- Gemini image-to-image reference input in API — unknown; if available, significantly improves character consistency in Phase 4

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
