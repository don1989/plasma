# Feature Research

**Domain:** AI-powered manga production pipeline (Webtoon vertical scroll)
**Researched:** 2026-02-18
**Confidence:** MEDIUM — Core pipeline features are grounded in existing project artifacts (HIGH confidence). Webtoon format specs and AI generation ecosystem patterns based on training knowledge, unverified by live sources (LOW-MEDIUM confidence on specifics).

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the pipeline must have. Missing any of these means the chapter cannot be produced or the output is unreadable/unpublishable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Manga script generation from prose** | Pipeline starts here — without converting narrative chapters to panel-by-panel scripts, nothing else can proceed | MEDIUM | Scripting rules and format already established in `manga-script.md`. Ch.1 script exists as the template. Subsequent chapters need to follow the same format (shot type, action, dialogue, SFX, notes). |
| **Art prompt generation per panel** | Gemini needs a self-contained, detailed prompt per panel — the script alone is not a usable prompt | MEDIUM | Prompt format already proven across 29 pages of Ch.1 prompts. Each prompt must embed character appearance details, style guide, panel layout, and scene action. Non-trivial translation from script notation to image prompt. |
| **Character reference sheet prompts** | Without consistent character reference prompts, each generation produces a different-looking Spyke or June | LOW | Reference sheet prompts already written for Spyke, June, Draster, Hood/Morkain, Punks. New characters introduced in later chapters will need new sheets. |
| **Style guide embedded in every prompt** | Colored manga, cel-shaded, clean linework, vibrant colors — these must appear in every single panel prompt or Gemini drifts to a different style | LOW | Style block is already established in the page prompt files. Must be maintained as a consistent header/prefix in every generated prompt. |
| **Dialogue and SFX text integration** | A manga panel without readable text is not a manga panel — dialogue is load-bearing | HIGH | This is the stated hard problem. AI-generated text in images is garbled. Two approaches: (a) programmatic text overlay post-generation (requires font/balloon tooling), (b) instructing Gemini to leave blank spaces and adding text in post. Approach TBD — this is the most technically complex table-stakes feature. |
| **Panel assembly into vertical scroll** | Individual panels must be stitched into a continuous vertical strip — this IS the Webtoon format | MEDIUM | Webtoon pages are typically 800px wide, stitched vertically. Each "episode" is a single long image or series of images scrolled top-to-bottom. Assembly means correct ordering, correct sizing, gutters between panels, and output in the right format. |
| **Chapter-by-chapter repeatability** | The pipeline must run again for Ch.2, Ch.3, etc. without rebuilding from scratch | MEDIUM | 15 chapters exist, more coming. Every pipeline step must be documented, templated, and reproducible. One-off scripts or manual workarounds that don't scale are anti-features. |
| **Output format compatibility** | Panels must be in the correct pixel dimensions and file format to upload to Webtoon Canvas | LOW | Webtoon Canvas accepts JPG/PNG. Standard width is 800px. Max file size per episode varies (typically ~20MB). Height per strip is variable — Webtoon scroll is continuous. (MEDIUM confidence on exact specs — verify against Webtoon Canvas docs before finalizing.) |

---

### Differentiators (Competitive Advantage)

Features that elevate the pipeline beyond "functional" to "high quality and fast." Not required to produce a readable chapter, but meaningfully improve output or throughput.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Character consistency enforcement** | The hardest problem in AI manga generation. Consistent Spyke across 48 panels means the reader sees the same character, not 48 variations | HIGH | Existing approach: embed full character appearance description in every panel prompt. Enhancement: generate dedicated character reference sheets and use them as style anchors. Gemini supports image-to-image reference if the API supports it — unknown currently. Manual review pass comparing panels against reference sheets is the minimum viable approach. |
| **Visual continuity checking** | Catching when a panel shows Spyke with the wrong glove, or June missing her shoulder pauldron | HIGH | Requires either manual review against character sheets or automated visual diff tooling. A structured review checklist per character per panel is a high-value, low-tech differentiator. |
| **Prompt library / reuse system** | The style guide, character descriptions, and setting blocks are repeated in every prompt. A templating system prevents copy-paste errors and makes updates propagate everywhere | MEDIUM | Currently each prompt in `pages-01-to-15.md` and `pages-16-to-29.md` is hand-written with manual repetition. A template engine (even simple string interpolation) where `{{SPYKE_APPEARANCE}}` expands to the canonical description would make updates to costume details propagate automatically across all future prompts. |
| **SFX visual design system** | Manga SFX are drawn lettering integrated into panels, not plain text. Getting Gemini to render "KRAKOOOM" in the right style vs. using programmatic lettering are two different approaches with different quality ceilings | MEDIUM | Existing prompts already specify "stylized SFX text integrated into panels in Japanese onomatopoeia style." This works to a degree. A curated SFX font library for programmatic overlay would be a step up — specific lettering that matches the manga art style. |
| **Splash page / spread handling** | Full-page splash panels and double-page spreads are cinematically critical moments — they need special treatment in both prompt generation and assembly | MEDIUM | Already flagged in `chapter-01-script.md`: splash (p.23), double spread (p.25-26). The pipeline must handle these as a distinct panel type: different aspect ratio instructions in the prompt, different assembly logic (spreads become one wide image or a stacked pair). |
| **Batch prompt generation** | Generating all 48 page prompts for a chapter in one pass rather than page-by-page | MEDIUM | Given the current manual copy-paste workflow, batch generation means producing a ready-to-use prompt document per chapter. For API workflow, it means one invocation generating all prompts. High leverage for throughput. |
| **Narrative-to-script quality validation** | Checking that the generated manga script hits the beat structure, pacing rules (4-7 panels per page), and visual direction conventions from `manga-script.md` | MEDIUM | The scripting rules are well-documented. A validation pass that checks panel counts, flags missing shot types, or notes when a page lacks a quiet moment would catch quality issues before prompt generation. |
| **New character introduction workflow** | Whenever a new character appears in a later chapter, the pipeline needs to generate a character sheet prompt, produce reference art, and then integrate that character into subsequent page prompts | MEDIUM | 15+ characters in the bible. Only Spyke, June, Draster, Hood/Morkain, and Punks have existing reference sheets. Later chapters introduce Jairek, Hector, Micki, Seymour, Zena, Cannon, Dobblepot, Tinwall (as a revealed identity), etc. Each new major character needs a reference sheet before their chapter can be produced. |
| **Dialogue balloon placement guidance** | When text is added via overlay, the positions of balloons must match where characters are in the generated panel — this requires either marked positions in the prompt or a post-generation placement pass | HIGH | Currently prompts include dialogue in the description but actual balloon placement in the generated image is unpredictable. If using programmatic overlay, the placement decision is manual per panel. If AI-generated, placement is unreliable. A layout map (top-left, top-right, etc.) per panel from the script would guide overlay work. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem useful but would hurt the project — through scope bloat, technical debt, or misaligned effort.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Fully automated end-to-end generation** | "Just run one command and get a Webtoon chapter" | Gemini's text rendering is unreliable, character consistency requires human review, and AI generation still produces panels that need selective rejection and re-prompting. Full automation without review loops produces garbage. | Semi-automated pipeline with explicit human checkpoints: script review, prompt review, panel QC, text overlay, assembly. Automate the mechanical steps; keep humans in the quality loop. |
| **Training a custom model for character consistency** | "Fine-tune a model on our characters" | This is a significant ML engineering effort (months, not weeks), requires training infrastructure, and Gemini's fine-tuning access for image generation is constrained/unknown. Out of scope for this project's scale. | Consistent character description strings embedded in every prompt. Reference sheet images as style anchors (if Gemini API supports). This is the practical solution at this scale. |
| **Real-time collaborative editing** | "Multiple people editing panels at once" | This is a solo/small-team production pipeline, not a platform product. Building collaboration infrastructure is pure scope creep. | Simple file-based workflow. One person generates, one person reviews. Git for version control of prompts and scripts. |
| **Print-ready formatting** | "Let's also make a print version" | Stated out of scope in PROJECT.md. Print and digital-vertical-scroll have fundamentally different layout requirements (page spreads vs. continuous scroll, color profiles, bleed). Serving both creates dual-track complexity. | Digital-only (Webtoon vertical scroll). If print is ever needed, it's a separate future project. |
| **Animation / motion manga** | "The action panels would look great animated" | Static panels only — stated constraint in PROJECT.md. Animation is an entirely different production discipline. | Use dynamic composition, speed lines, and panel border tricks (jagged borders during Adrenaline Mode) to create the sensation of motion in static art. These are already specified in `manga-script.md`. |
| **Interactive / branching story** | "The [PLAYER DECISION POINT] markers suggest a game" | The game is a separate future project (noted in PROJECT.md under Out of Scope). Baking interactivity into the manga pipeline conflates two distinct products. | Keep [PLAYER DECISION POINT] markers in the script as documentation of where the game and manga diverge. The manga tells the story linearly; the game adapts it interactively. |
| **Fully automatic dialogue balloon rendering via AI** | "Tell Gemini to render the text in the image" | AI text rendering in images is garbled — this is explicitly noted as a known problem in PROJECT.md. Gemini's text generation within images is inconsistent and often illegible. Relying on it for manga text will produce unpublishable panels. | Programmatic text overlay using a compositing tool (Pillow/PIL in Python, or similar) with a manga-appropriate font. This is the reliable path. Alternatively: generate panels with intentional blank speech balloon shapes, then fill with overlay text. |
| **Web platform / reader UI** | "Build a Webtoon reader app" | The output format IS Webtoon — upload to Webtoon Canvas. Building a separate reader is reinventing the platform. | Produce standard Webtoon-compatible image strips. Upload to Webtoon Canvas for distribution. No custom reader needed. |

---

## Feature Dependencies

```
[Story Prose (Chapters 1-15)]
    └──requires──> [Manga Script Generation]
                       └──requires──> [Scripting Rules (manga-script.md)]
                       └──produces──> [Panel-by-Panel Script]
                                          └──requires──> [Art Prompt Generation]
                                          |                  └──requires──> [Character Reference Sheets]
                                          |                  └──requires──> [Style Guide Template]
                                          |                  └──produces──> [Panel Prompts]
                                          |                                     └──requires──> [Gemini Image Generation]
                                          |                                                        └──produces──> [Raw Panel Images]
                                          |                                                                           └──requires──> [QC / Consistency Review]
                                          |                                                                                              └──requires──> [Panel Assembly]
                                          |                                                                                                                 └──requires──> [Dialogue/SFX Overlay]
                                          |                                                                                                                                    └──produces──> [Webtoon Episode]
                                          └──requires──> [Dialogue/SFX Integration]
                                                             └──requires──> [Voice Profiles (dialogue-pass.md)]

[Character Reference Sheets] ──enhances──> [Art Prompt Generation] (character consistency)
[Prompt Library / Templates] ──enhances──> [Art Prompt Generation] (maintainability)
[Visual Continuity Checking] ──enhances──> [QC / Consistency Review]
[New Character Workflow] ──feeds into──> [Character Reference Sheets] (for each new chapter)
```

### Dependency Notes

- **Manga Script Generation requires Scripting Rules:** The format in `manga-script.md` defines what a valid panel description looks like. Any script that doesn't follow this format cannot reliably generate prompts.
- **Art Prompt Generation requires Character Reference Sheets:** Without canonical character descriptions embedded in prompts, visual consistency collapses. Reference sheets must exist before prompts are generated.
- **Dialogue/SFX Overlay must happen after Image Generation:** Because AI text in images is unreliable, dialogue is a post-generation step. This means scripts must carry dialogue forward through the pipeline to the overlay stage — dialogue cannot be "lost" after script generation.
- **Panel Assembly depends on QC:** Assembling bad panels wastes effort. The review gate must happen before assembly.
- **New Character Workflow blocks any chapter that introduces that character:** Jairek (Ch.2), Hector, Micki, etc. cannot appear in panels until reference sheets exist for them.
- **Splash/Spread handling is a special case of Assembly:** The assembly step must know which panels are splash/spreads to apply different stitching logic.

---

## MVP Definition

### Launch With (v1) — Produce Ch.1 End-to-End

Minimum viable pipeline: take the existing Ch.1 script and produce a complete, publishable Webtoon episode.

- [x] **Character reference sheets** — Already exist for Ch.1 characters (Spyke, June, Draster, Hood, Punks). Use as-is.
- [x] **Style guide template** — Already established. Codify as a reusable prefix block.
- [ ] **Art prompt generator** — Script-to-prompt conversion for all 48 Ch.1 panels. (29 of 48 already written; need pages 30-48.)
- [ ] **Dialogue/SFX overlay solution** — Decide and implement: programmatic text overlay with manga font, or Gemini prompt with blank balloon shapes + post overlay. This is the critical path decision.
- [ ] **Panel QC checklist** — A structured per-panel checklist comparing generated panels against character reference sheets. Lightweight, manual, but essential.
- [ ] **Vertical strip assembly** — Tool or process to stitch ordered panel images into Webtoon-format vertical strip(s) at correct dimensions (800px wide).
- [ ] **Output packaging** — Produce final episode files in Webtoon Canvas-compatible format (JPG/PNG, correct sizing).

### Add After Validation (v1.x) — Pipeline as a System

Once Ch.1 is produced and the core steps are validated:

- [ ] **Prompt template library** — Extract character appearance blocks, style guides, and setting blocks into reusable templates. Apply to Ch.2 prompts.
- [ ] **New character introduction workflow** — Structured process for generating reference sheets for Ch.2+ characters (Jairek, etc.) before their chapter's prompts are generated.
- [ ] **Batch prompt generation** — Generate all page prompts for a chapter in one pass from the script.
- [ ] **Narrative-to-script quality validation** — Lightweight check that generated scripts conform to `manga-script.md` rules before prompts are generated.
- [ ] **Splash/spread handling** — Explicit support for full-page and double-page spread assembly in the pipeline.

### Future Consideration (v2+) — Scale and Quality

- [ ] **Gemini API integration** — Replace copy-paste workflow with API calls. Enables automation of generation loop, batch processing, and retry logic for rejected panels.
- [ ] **Visual continuity automation** — Tool-assisted comparison of generated panels against reference sheet images (could use Gemini's vision capability for this).
- [ ] **SFX visual design system** — Curated manga-style SFX font library for programmatic overlay that matches the art style.
- [ ] **Dialogue balloon placement map** — Per-panel balloon position specified in the script, used to guide programmatic overlay placement.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Manga script generation | HIGH | MEDIUM | P1 |
| Art prompt generation per panel | HIGH | MEDIUM | P1 |
| Dialogue/SFX text overlay | HIGH | HIGH | P1 |
| Panel vertical strip assembly | HIGH | MEDIUM | P1 |
| Character reference sheet prompts | HIGH | LOW | P1 |
| Style guide embedded in prompts | HIGH | LOW | P1 |
| Panel QC / consistency review | HIGH | LOW | P1 |
| Output format compatibility | HIGH | LOW | P1 |
| Prompt template library | MEDIUM | MEDIUM | P2 |
| New character introduction workflow | HIGH | MEDIUM | P2 |
| Batch prompt generation | MEDIUM | MEDIUM | P2 |
| Splash/spread handling | MEDIUM | MEDIUM | P2 |
| Narrative-to-script quality validation | MEDIUM | MEDIUM | P2 |
| Visual continuity checking | HIGH | HIGH | P2 |
| Dialogue balloon placement map | MEDIUM | HIGH | P2 |
| Gemini API integration | MEDIUM | HIGH | P3 |
| SFX visual design system | LOW | HIGH | P3 |
| Visual continuity automation | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for Ch.1 production (v1 launch)
- P2: Should have — adds once core is working and Ch.2+ begins
- P3: Nice to have — future, after pipeline is proven

---

## Competitor Feature Analysis

Note: This pipeline is not a commercial product competing with others — it is an internal production tool. "Competitors" here are the informal reference points: other AI manga creators' workflows, and commercial tools in the space.

| Feature | Manual Comic Artists | AI Comic Tools (e.g., ChatGPT + DALL-E workflows) | This Pipeline |
|---------|---------------------|---------------------------------------------------|----|
| Character consistency | Perfect (artist knows the character) | Low — requires heavy prompt engineering, still drifts | Medium — enforced via reference sheets + canonical description blocks |
| Script-to-panel conversion | Manual — artist reads script, interprets freely | Ad hoc — no standardized format | Structured — uses `manga-script.md` schema |
| Text in panels | Native part of workflow (lettering stage) | Weak — AI text generation is unreliable | Programmatic overlay (correct approach) |
| Vertical scroll assembly | Native (digital artists use Clip Studio, Photoshop) | Not handled — ad hoc | Explicit assembly step in pipeline |
| Character reference sheets | Standard practice (model sheets) | Rarely used systematically | Already established for Ch.1 cast |
| Batch generation | Human throughput is the bottleneck | Possible but requires manual session management | Target for v1.x automation |
| Style consistency | Perfect (artist has a style) | Drifts heavily between sessions | Enforced by style guide prefix in every prompt |

---

## Sources

- Project artifacts (direct analysis, HIGH confidence): `PROJECT.md`, `manga-script.md`, `chapter-01-script.md`, `dialogue-pass.md`, `prompts/character-sheets.md`, `prompts/pages-01-to-15.md`, `prompts/pages-16-to-29.md`, `story-bible.md`
- Webtoon Canvas format specifications: Not verified — web access unavailable during research. Specs (800px width, JPG/PNG, ~20MB limit) are based on training knowledge (LOW-MEDIUM confidence). **Must verify against official Webtoon Canvas documentation before building assembly step.**
- AI image generation text limitations: Confirmed by PROJECT.md explicitly stating "AI-generated text in images is often garbled" — this is corroborated by general training knowledge (HIGH confidence on the problem existing; LOW on specific workarounds without live research).
- Gemini API image generation capabilities (image-to-image reference support, style transfer): Unknown — API access status listed as unknown in PROJECT.md. (LOW confidence — needs investigation in Phase-specific research.)

---

*Feature research for: AI-powered manga production pipeline (Plasma Webtoon)*
*Researched: 2026-02-18*
