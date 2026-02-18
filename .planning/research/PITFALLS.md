# Pitfalls Research

**Domain:** AI-powered manga production pipeline (Webtoon vertical scroll, Gemini image generation)
**Researched:** 2026-02-18
**Confidence:** MEDIUM — character sheet evidence is HIGH confidence (first-hand from this repo); Gemini-specific behaviors are MEDIUM confidence (training data + observed output patterns); web research unavailable this session

---

## Critical Pitfalls

### Pitfall 1: Character Drift Across Generations

**What goes wrong:**
Each time you generate a panel, Gemini re-rolls the character from scratch based only on the text description. Without an image reference, the same character description produces visually inconsistent results: hair length varies, skin tone shifts, clothing details morph, proportions change. Evidence from this repo: Spyke's hair appeared as shoulder-length ponytail in early concept runs when the prompt said "tips reach traps" (near-neck), cloak length varied from knee-length to floor-length across attempts, and the asymmetric glove setup (red fingerless left vs armored right) was sometimes mirrored or simplified.

**Why it happens:**
Gemini's image model (Imagen 3 / Gemini 2.0 Flash native image generation) has no memory between generations. Every prompt is a blank slate. Natural language descriptions of complex multi-detail characters inevitably produce variation — "shoulder-length" and "neck-length" land differently each run, and when a character has 12+ distinguishing details, some will be dropped or reinterpreted every generation.

**How to avoid:**
1. Generate canonical reference sheets first (done — Spyke_Final.png, June, Draster sheets exist). Use these as visual anchors for all human review.
2. When Gemini's API is accessible, use image-to-image prompting or pass the reference image as part of the prompt. In the manual workflow, describe characters from their approved sheet explicitly: copy the approved description verbatim, not a paraphrase.
3. Build a per-character "prompt fingerprint" — a locked, tested character description block that has been validated to produce on-model results. Paste this fingerprint into every panel prompt, never rewrite it from scratch.
4. Limit character detail in action panels: instead of describing all 12 outfit details in every panel, identify the 4-5 most recognizable "silhouette anchors" (Spyke: white cloak + red bandana + ginger hair + massive broadsword on back) and rely on those.
5. Accept a QC step: every generated panel image gets checked against the reference sheet before it moves to assembly. Character drift found late (post-assembly) costs 10x more to fix.

**Warning signs:**
- Spyke's cloak appearing as a trench coat, coat-length, or with both sleeves intact
- June's clothing appearing blue or teal (happened in first two generation attempts — her prompt originally specified dark pink but Gemini interpreted "blue" from the sporty/athletic framing)
- Draster's skin tone rendering too light
- The asymmetric glove setup (different left/right) being mirrored or simplified to matching gloves
- Spyke's age metadata in generated sheets showing 16 instead of 21 (happened in two early runs — a sign the model anchored to teenager archetype)

**Phase to address:** Phase 1 (Character System / Prompt Fingerprint) — before any panel generation begins

---

### Pitfall 2: Text in AI-Generated Images Is Unreliable

**What goes wrong:**
Asking Gemini to render readable speech bubbles, SFX text, or any dialogue directly in a generated manga panel will produce garbled, misspelled, or visually corrupt text most of the time. Even when the text appears to render correctly, it is inconsistent across generations. The current Chapter 1 page prompts include requests for speech balloons with dialogue baked in — this is a high-risk approach.

**Why it happens:**
Image generation models treat text as visual texture, not as semantic characters. Gemini / Imagen 3 has improved text rendering versus older models (it can produce legible labels as seen in the character reference sheets), but it remains unreliable for multi-word dialogue in panel contexts, especially when the text needs to fit inside a speech bubble shape and coexist with a busy visual composition.

**How to avoid:**
Do not bake dialogue into AI-generated panel images. Generate panels as art-only images with no text. Add all dialogue, speech bubbles, SFX, thought captions, and narration boxes as a programmatic overlay layer (using Pillow/ImageDraw in Python, or an image compositing tool like GIMP scripting). This separation means:
- Text is always perfectly legible
- Dialogue edits don't require regenerating the panel art
- Font choice, bubble style, and layout are fully controlled
- SFX can be stylized manually with vector type

Exception: character reference sheet labels (like the detail callouts already generated) are low-stakes and can be left to Gemini if they render acceptably on that specific run.

**Warning signs:**
- Any prompt containing `Speech balloon:`, `speech balloon:`, or inline dialogue text mixed into the panel description
- Panel prompts that describe text placement rather than visual composition
- Generated images where you can see speech bubble shapes but text inside is illegible or wrong

**Phase to address:** Phase 1 (Text Rendering Strategy) — decide and lock the overlay approach before generating any page-level panels

---

### Pitfall 3: Prompt Complexity Exceeds Model Attention Span

**What goes wrong:**
The current Chapter 1 page prompts are extremely long and detailed — some panels run 200+ words for a single panel within a multi-panel page prompt. Gemini doesn't give equal attention to every instruction. The later parts of a long prompt receive less attention than the opening lines. This causes elements mentioned early (general style, setting) to dominate, while elements mentioned late (specific character poses, background details, SFX text) get dropped or simplified.

**Why it happens:**
Attention mechanisms in large language/vision models have a well-documented recency bias and tend to prioritize high-level framing over granular detail once the prompt exceeds a certain density. A 300-word prompt describing three panels simultaneously is asking the model to hold too much in working attention while also generating a coherent image.

**How to avoid:**
Generate each panel individually, not the entire page at once. This feels slower but produces far more controllable results. For a multi-panel page, run N separate generations for N panels, then composite them together programmatically. Put the most critical details — character identity, action, emotion — at the start of each prompt. The style preamble (cel-shaded, colored manga, etc.) should be a fixed prefix that always appears first.

Structure prompts in priority order:
```
[Style prefix — always first]
[Character identity anchors]
[Primary action]
[Composition/framing]
[Secondary details]
[Optional: SFX if attempting baked text]
```

**Warning signs:**
- Prompts that describe more than one panel simultaneously
- Prompts where the character description is buried after setting descriptions
- Prompts over ~150 words for a single panel
- Outputs where the right character appears but their pose or expression ignores the prompt

**Phase to address:** Phase 2 (Prompt Engineering System) — build the prompt template before writing any production prompts

---

### Pitfall 4: Multi-Character Scenes Cause Merging and Confusion

**What goes wrong:**
When multiple characters appear in the same panel, Gemini may: merge their visual traits (one character ends up with another's hair color), apply the same outfit to multiple characters, or simply generate the wrong number of characters. Panels like Page 16's Panel 2 — which requires Spyke, June, AND Draster in the same frame — are high-failure-rate.

**Why it happens:**
The model has to simultaneously satisfy multiple character descriptions and keep them visually separate. This is a known hard problem in image generation. When character descriptions share structural similarities (all young, all in action clothes, all holding weapons), the model conflates them. Draster's dark brown skin is a strong differentiator, but Spyke and June share blonde/ginger proximity in some lighting.

**How to avoid:**
Lean on strong visual differentiators in the prompt ordering. For the Plasma trio, always lead with Draster's skin tone since it's the clearest differentiator. Use positional language ("left", "center", "right") consistently. Avoid having all three characters occupy equal prominence — give one character a clear visual focal point in any given panel. If a group shot fails repeatedly, split it: generate each character separately against a transparent/white background and composite.

Accept that some complex compositions cannot be generated in one shot reliably. Build a compositing step into the workflow budget.

**Warning signs:**
- Two characters with the same hair color in a panel where they should differ
- The wrong character holding a weapon (June with broadsword, Spyke without)
- Three-character panels where only two characters appear
- Characters' outfits bleeding into each other (Spyke in navy, Draster in white)

**Phase to address:** Phase 2 (Prompt Engineering System) and Phase 3 (QC Checklist)

---

### Pitfall 5: Style Consistency Across an Entire Chapter

**What goes wrong:**
Even if individual panels look good in isolation, a chapter of 30-50 generated panels will feel visually inconsistent as a unit. Line weight varies between generations, color saturation shifts, some panels look more realistic while others look more stylized, backgrounds vary in rendering complexity. The result looks like a compilation from multiple artists rather than a single coherent chapter.

**Why it happens:**
Each generation is stateless. Gemini doesn't know what your previous panels looked like. Subtle variations in how the style prefix is phrased produce visible differences in output. Real manga chapters have visual consistency because one artist draws all of them — the same hand, the same tools, the same creative interpretation across 30+ pages.

**How to avoid:**
Lock a single, tested style fingerprint string and paste it verbatim into every prompt. Do not paraphrase or adapt it. Even minor wording changes ("clean linework" vs "crisp linework") can shift the output aesthetic noticeably. Consider generating all background-type panels (establishing shots, interiors) in a single session before moving to character-heavy panels — batching similar panel types reduces visible variance. A consistent "post-processing" step (slight saturation normalization, uniform border treatment) applied to all panels in assembly can reduce perceived inconsistency.

**Warning signs:**
- One panel looks painterly/realistic and adjacent panels look flat/cel-shaded
- Background depth and detail varies wildly between panels on the same page
- The same character looks older or younger in different panels due to facial rendering variance

**Phase to address:** Phase 2 (Style System) — establish and test the style fingerprint before production

---

### Pitfall 6: Action Scenes and Dynamic Poses Produce Anatomy Failures

**What goes wrong:**
AI image generation is notoriously poor at complex body positions: specific sword grips, mid-leap poses, two-handed weapon swings, asymmetric stances. Gemini will produce extra fingers, broken wrist angles, weapons held at physically impossible angles, or bodies with wrong limb proportions. The manga style (speed lines, impact frames) can partially hide anatomical errors, but in close-up panels they become glaring.

**Why it happens:**
Training data for highly specific action poses in manga style is less abundant than for standing character portraits. Manga anatomy is already stylized in ways that differ from realistic proportions, and when you layer in a specific action (iaijutsu quick-draw, mid-air sword swing, Draster's two-handed Plasma Glove blast), the model is solving a very rare distribution problem.

**How to avoid:**
Prompt action poses in terms of visual impression rather than physical mechanics. Instead of "Spyke's right arm extended forward, katana horizontal at chest height, body turned 30 degrees left with weight on rear foot" — say "Spyke in aggressive katana forward-pointing challenge stance, low center of gravity, intense focus." Use the manga visual language from the existing scripts: "speed lines radiate from the blade", "impact frame", "afterimage of the blade path". These cues trigger the model's manga-mode pattern matching rather than its literal pose reconstruction.

For close-up action shots with specific hand/weapon details, run multiple generations and pick the best. Budget 3-5 generation attempts for any panel that requires a specific action pose.

**Warning signs:**
- Any panel prompt specifying exact joint angles or limb positions
- Panels requiring a character to grip a weapon with both hands in a specific configuration
- Close-up panels on hands during combat (the most common anatomy failure point)

**Phase to address:** Phase 2 (Prompt Engineering System) — build action scene prompt conventions

---

### Pitfall 7: Webtoon Vertical Format Aspect Ratio Mismatch

**What goes wrong:**
Gemini's image generation defaults to square or standard landscape/portrait outputs. Webtoon format is a very tall vertical strip — a single "page" might be 800px wide by 5000-8000px tall (a vertical scroll of stacked panels). If you generate panels at the wrong aspect ratio or resolution, assembling them into a Webtoon will produce panels that look stretched, cropped, or require resizing that degrades quality.

**Why it happens:**
Gemini doesn't have a native "manga panel" output aspect ratio that matches Webtoon specs. The model was not trained with Webtoon assembly in mind. Most AI art tools default to 1:1, 4:3, or 16:9 outputs.

**How to avoid:**
Decide the per-panel resolution spec before generating any production panels and document it. A standard approach for Webtoon: width = 800px, panel height varies by panel type (tall action panels, short reaction panels, wide establishing shots at narrow height). Generate each panel at the target width with appropriate height, then stack them vertically in the assembly step. Use prompt language to suggest composition proportions: "vertical composition", "portrait orientation", "wide horizontal establishing shot" to nudge the model. Verify Gemini's output resolution options early — not all models support arbitrary aspect ratio specification.

**Warning signs:**
- No resolution specification in your panel generation workflow
- Assembling panels and finding they don't line up cleanly
- Panels that look correct in isolation but are wrong proportions for the planned layout

**Phase to address:** Phase 1 (Format Specification) — determine Webtoon specs before any production generation

---

### Pitfall 8: Manual Copy-Paste Workflow Creates Version Chaos

**What goes wrong:**
The current workflow is manual: copy prompt text, paste into Gemini web UI, download the image, manually track what was generated when and with what prompt. With 30-50 panels per chapter and multiple generation attempts per panel, you will lose track of which image corresponds to which panel, which version was approved vs. rejected, and what prompt produced the chosen image. Regenerating a panel later (to fix a continuity issue) becomes impossible if the prompt is not saved.

**Why it happens:**
The manual workflow has no enforced structure for tracking prompt-to-image relationships. Image files get generic Gemini filenames (already visible in this repo: Gemini_Generated_Image_654svk654svk654s.png). The folder organization per-character is a good start, but panel-level tracking doesn't exist yet.

**How to avoid:**
Before generating any production panels, establish a naming and tracking convention. Minimum viable:
- Panel images named: `ch01_p003_panel2_v1.png` (chapter, page, panel, version)
- A companion `prompts.md` per chapter that records the exact prompt used for each approved panel
- A "status" marker per panel: `[generated]`, `[approved]`, `[needs-regen]`

This can be a simple markdown table maintained manually. When the pipeline upgrades to API automation, this tracking data becomes the input/output log automatically.

**Warning signs:**
- Image files with generic Gemini filenames in production panel folders
- Any situation where you don't know which prompt produced an image you like
- Having to "remember" what prompt variation worked for a character

**Phase to address:** Phase 1 (Workflow Infrastructure) — naming conventions before first production run

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Baking dialogue into panel art prompts | Saves the overlay tooling step | Unreadable text forces regen; editing dialogue requires art regen | Never — always separate text from art |
| Using one mega-prompt per full page | Faster prompting session | Lower quality, less control, harder to regen individual panels | Never in production; acceptable for rough layout previews |
| Skipping the character fingerprint review step | Ships faster | Inconsistent characters accumulate and are expensive to fix retroactively | Never — do it once before production starts |
| Keeping generic Gemini filenames | Zero admin overhead | Complete inability to manage a multi-panel chapter | Never past prototype stage |
| Generating multi-character scenes in one shot | One generation instead of three | High failure rate means more retries; compositing is faster overall | Acceptable for background group shots where individual identity doesn't matter |
| Paraphrasing the style prefix per prompt | Feels more natural | Style variance accumulates across a chapter | Never — lock and copy the style prefix verbatim |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Gemini API (future upgrade) | Assuming the web UI and API produce identical results with the same prompt | Web UI and API may use different model versions or safety filter thresholds — re-validate prompts on API before assuming parity |
| Gemini image generation | Expecting it to follow image reference URLs in prompts (it doesn't in text-only prompting) | For image-based character consistency, use the native multimodal input (upload the reference image) or the Imagen 3 subject reference feature if available on Pro |
| Python Pillow for text overlay | Rendering speech bubbles programmatically with pixel-perfect positioning is complex | Use a pre-built manga text overlay tool or design a simple template system with fixed bubble positions per panel type |
| Webtoon assembly | Assembling panels by hand in an image editor per chapter | Automate vertical assembly from the start: a script that takes a directory of panel images and stacks them with consistent margins is faster and more consistent |
| Color correction | Assuming all generated panels will match color temperature | Apply a consistent post-processing color grade to all panels as part of the assembly step |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Generating full chapter in one session | Prompt fatigue — later panels get worse prompts due to copy-paste errors | Generate in batches of 5-10 panels; review before continuing | After 15+ panels in a session |
| Storing full-resolution PNGs without compression | Disk usage explodes; assembly scripts slow down | Export approved panels to optimized PNG/WebP before assembly | After ~2 full chapters at 4K+ resolution |
| Regenerating failed panels mid-assembly | Style and character drift when a panel is regenerated weeks later with slightly different style | Lock the style fingerprint in a versioned file; always use the same version | Any time gap between generation sessions |
| Ignoring Gemini rate limits in manual workflow | No issue manually, massive issue at API scale | Rate limit handling built into the automation upgrade from day one | When moving to API automation |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Running QC only at chapter completion | All failed panels discovered at once; fixes cascade | QC panel-by-panel as they're generated; never advance to next panel without approval |
| No visual diff between approved and candidate panels | Approved reference sheet forgotten; imposter panels pass QC | Always have the reference sheet open and visible during QC; physically compare |
| Overly detailed prompts for background/filler panels | Wasted generation effort on low-stakes art | Reserve prompt detail budget for foreground character panels; simplify background-only shots |

---

## "Looks Done But Isn't" Checklist

- [ ] **Character fingerprint:** Prompt fingerprint for each character generated, tested (multiple runs), approved against reference sheet — not just "written down"
- [ ] **Text overlay pipeline:** Dialogue overlay is implemented and tested, not just planned — verify a real speech bubble appears correctly before generating all panels art-only
- [ ] **Panel naming convention:** Naming convention documented AND enforced on the first 5 panels — not retroactively applied
- [ ] **Webtoon resolution spec:** Output resolution confirmed in Gemini before committing — Gemini's actual output dimensions may not match what you specified
- [ ] **Style fingerprint:** Style prefix tested across 10+ generations to confirm consistent output — not just "looks good on the first try"
- [ ] **Multi-character panel strategy:** At least one Spyke+June+Draster group panel successfully generated (or compositing workflow tested) before assuming it works
- [ ] **Chapter assembly:** Full chapter vertical assembly run end-to-end at least once before declaring the pipeline ready — verify scroll behavior, panel gaps, aspect ratio on mobile

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Character drift discovered post-assembly | HIGH | Identify which panels have off-model characters, regenerate with locked fingerprint, reassemble affected pages |
| Baked-in text discovered to be garbled | MEDIUM | Re-generate all affected panels art-only, then build text overlay pipeline — work already done on art is preserved |
| Generic filename chaos | MEDIUM | Manually match images to panel positions using visual inspection, establish naming going forward — time-consuming but recoverable |
| Style inconsistency across chapter | MEDIUM | Apply a uniform color grade/filter pass to all panels in post; for severe cases, regenerate worst offenders |
| Wrong aspect ratio panels discovered at assembly | HIGH | Regenerate all panels at correct dimensions — no workaround that preserves quality |
| Action pose anatomy failure | LOW | Regenerate with simpler action description; 3-5 attempts usually produces an acceptable result |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Character drift | Phase 1: Character System | Test fingerprint across 5 consecutive generations; all should be on-model |
| Text in images garbled | Phase 1: Text Strategy | Generate one complete panel with overlay; dialogue must be perfectly legible |
| Prompt attention span overload | Phase 2: Prompt Engineering | Single-panel prompts only; measure per-panel detail word count vs. quality |
| Multi-character scene failures | Phase 2: Prompt Engineering | Successfully generate the trio in one scene, or confirm compositing workflow |
| Style inconsistency | Phase 2: Style System | Generate 10 panels from the locked style prefix; no visible style variance |
| Action pose anatomy | Phase 2: Action Conventions | At least 3 action panel types (sword strike, magic cast, running) produce acceptable results |
| Wrong Webtoon aspect ratio | Phase 1: Format Specification | One chapter's worth of panels assembled; scroll correctly on mobile |
| Manual workflow version chaos | Phase 1: Workflow Infrastructure | All panel images have correct names before leaving the generation step |

---

## Sources

- First-hand observation: concept art generation attempts in `/Users/dondemetrius/Code/plasma/03_manga/concept/characters/` (8 images examined across 3 characters — direct evidence of character drift, color misinterpretation, age metadata errors)
- First-hand observation: `/Users/dondemetrius/Code/plasma/03_manga/prompts/pages-01-to-15.md` and `pages-16-to-29.md` — evidence of multi-character scene complexity and baked-in dialogue approach requiring caution
- First-hand observation: June Kamara character reference sheets — color prompt ("dark pink") produced blue/teal in 2 of 3 attempts, confirmed on third with more explicit color specification
- First-hand observation: Spyke concept sheets — age labeled as "16" in two early runs despite prompt specifying "21", showing model defaulted to teenager archetype; corrected in final version by adding explicit adult descriptor
- Training data (MEDIUM confidence): Gemini / Imagen 3 text-in-image capabilities, attention mechanisms in diffusion models, Webtoon format specifications
- Project documentation: `/Users/dondemetrius/Code/plasma/.planning/PROJECT.md` — confirmed manual workflow, Gemini Pro account, text/dialogue approach undecided

---
*Pitfalls research for: AI manga production pipeline — Plasma Webtoon*
*Researched: 2026-02-18*
