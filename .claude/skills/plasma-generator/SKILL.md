---
name: plasma-generator
description: Generate canon-locked Plasma manga panels via fal.ai Kling API. Use when the user asks to generate, render, produce, or test a manga panel/page/scene for the Plasma project, references Spyke / June / Draster / Hood / Punks, or mentions chapter+page numbers in a Plasma context.
---

# Plasma Manga Generator

API-only manga panel generator for the Plasma project. Wraps the existing pipeline at `pipeline/src/stages/kling-generate.ts`. Default model is Nano Banana Pro on fal.ai; Kling O1, Nano Banana 2, and Runway (gen4, gen4-turbo, muse) are selectable with `--model`. No UI steps. No manual copy-paste.

## When to invoke

- User asks to generate, render, draw, or produce a manga panel/page/scene
- User mentions a chapter + page (e.g. "ch01 page 5", "page 12 of chapter 2")
- User describes a scene with Plasma characters
- User wants to test, preview, or iterate a panel
- User wants to re-roll a panel with different framing/action/lighting

## When NOT to invoke

- User asks about story content, dialogue, or canon (not generation)
- User asks to train a LoRA or alter the model pipeline architecturally
- User asks for video output (this skill is stills only)

## Architecture (what's wired up already)

| Component | Path |
|---|---|
| Kling stage (fal.ai) | `pipeline/src/stages/kling-generate.ts` |
| Provider client (fal.ai + Runway) | `pipeline/src/generation/kling-client.ts` |
| Model registry | `pipeline/src/generation/models.ts` |
| Reference view generator | `pipeline/src/stages/reference-generate.ts` (`pnpm reference generate <id> <view>`) |
| Reference loader | `pipeline/src/generation/references.ts` |
| Character canon YAMLs | `pipeline/data/characters/<id>.yaml` |
| Character ref images | `pipeline/data/characters/<id>/references/*.png` |
| Style prefix (auto-prepended) | `pipeline/data/config/style-guide.yaml` |
| CLI entry | `pnpm stage:kling` |
| Output destination | `output/ch-NN/raw/kling/chNN_pNNN_vN.png` (auto-versioned) |

API keys live in `pipeline/.env` (`FAL_KEY`, `GEMINI_API_KEY`, `RUNWAYML_API_SECRET`).

## Character IDs (verbatim — match the YAML filenames)

- `spyke-tinwall` — Protagonist
- `june-kamara`
- `draster`
- `hood-morkain`
- `punks`

## Workflow

### Step 1 — Gather scene spec

Extract from the user's request (ask if any are unclear):

- **Chapter & page** — or "test" if no specific page (use chapter 99 for tests)
- **Characters in panel** — by ID
- **Action** — what's happening (specific body action, gaze, energy)
- **Setting** — environment, time of day, lighting, atmosphere
- **Framing** — wide / medium / close-up (optional, default medium)

### Step 2 — Verify refs exist for every character

For each character ID in the panel, check `pipeline/data/characters/<id>/references/` exists and has at least one PNG. If empty, **stop and ask the user** — the pipeline falls back to text-only mode silently and will produce off-canon results.

### Step 3 — Load canon

Read `pipeline/data/characters/<id>.yaml` for each character. The `fingerprint` field is the locked canon spec — single source of truth.

**Critical Spyke canon (most violated):**
- Plasma Blade hilt on RIGHT belt, Master's Katana at LEFT hip
- NO back-mounted broadsword, NO leather chest harness, NO X-straps
- Asymmetric arms: red fingerless glove RIGHT (hand only), red armored bracer LEFT (hand + forearm to elbow)
- Hex pauldron on LEFT knee ONLY, RIGHT knee bare
- Hair: STRAIGHT layered ginger/copper, neck-length, NOT spiky, NOT messy
- Bandana: forehead strip at hairline, NOT wrapping skull
- Cold neutral face, NEVER smiling
- Cloak: white sleeveless with crudely-cut frayed sleeve edges, black geometric hem, black dojo insignia on back

(See yaml for full spec including other characters.)

### Step 4 — Compose the prompt

Build a single prompt block, structured like this:

1. **Opening clause** — scene type: `Single character panel` / `Single action panel` / `Multi-character panel` / `Establishing shot`
2. **Identity lock** — `Match the character in the reference image exactly` + verbatim canon markers from the YAML (hair, bandana, cloak with hem pattern, asymmetric arms, pauldron placement, boots)
3. **Weapons lock** — explicitly list canon weapons AND **explicitly negate forbidden elements** (`NO back-mounted broadsword. NO leather chest harness. NO X-straps.`)
4. **Action** — specific body angle, hand positions, gaze, expression
5. **Setting** — environment, lighting direction & color temperature, atmospheric mood, palette
6. **Style closer** — `Colored manga, cel-shaded with vibrant saturated colors, medium-thick clean confident linework, anime and manga character proportions, large expressive eyes, high-resolution professional manga illustration finish. Not photoreal, not painterly.`

For multi-character panels: identity-lock and weapon-lock each character in sequence inside the prompt body. Append `@Image1 is <char1-id>. @Image2 is <char2-id>.` is handled by the pipeline automatically — don't write it yourself.

### Step 5 — Run the pipeline

Write the composed prompt to a temp file, then:

```bash
(cd /Users/dondemetrius/Code/plasma/pipeline && pnpm stage:kling -- \
  --chapter <N> \
  --page <P> \
  --characters <id1> [<id2>...] \
  --prompt "$(cat /tmp/plasma-prompt.txt)" \
  --notes "<short context describing the panel intent>")
```

Useful flags:
- `--aspect-ratio 3:4` (default — manga vertical) · `--aspect-ratio 16:9` for wide establishing shots
- `--model nano-banana-pro` (default) · `nano-banana-2` · `kling-o1` · `runway-gen4` · `runway-gen4-turbo` · `runway-muse`
- `--resolution 1K` (default) · `2K` · `4K` (Nano Banana only)
- `--seed <n>` for repeatable rolls where the model supports it
- All reference images in `references/` are sent, split across characters up to the model's cap (14 Nano Banana, 10 Kling/Muse, 3 Runway Gen-4)
- `--dry-run` — preview without spending an API call

Cost per shot: ~$0.15 Nano Banana Pro, ~$0.08 Nano Banana 2, ~$0.03 Kling O1, ~$0.08 Runway Gen-4, ~$0.01 Runway Muse.

### Step 6 — Verify and report

Read the output PNG. Check against canon:
- ✅ Hair / bandana / cloak / asymmetric arms / pauldron / boots match
- ✅ Weapons present and correct (Plasma hilt right, Katana left, no broadsword)
- ✅ NO forbidden elements (broadsword, X-harness, both-knees-pauldron)
- ✅ Style is manga (cel-shaded, clean linework) not photoreal

Report to the user:
- Output path (use the `[file.png](path)` markdown link form)
- What matches canon
- What drifted (if anything) and suggested prompt tweaks
- Whether to re-roll, accept, or tweak

## Test isolation

Use **chapter 99** for all test/iteration shots. Production chapters (1, 2, ...) stay clean. The pipeline auto-creates the directory.

## Known drift patterns (and prompt fixes)

| Drift | Fix |
|---|---|
| Pauldron renders on both knees | Add explicit `RIGHT knee completely bare, NO pad, NO pauldron` |
| Cloak sleeves render clean (not frayed) | Currently unsolved at prompt level. Acknowledge as minor. |
| Face structure varies slightly between shots | Acceptable — the character still reads. All refs are now sent; add a `05_face_closeup.png` ref for tighter lock. |
| Model copies the reference pose instead of rotating (3/4 views) | Nano Banana Pro anchors hard to a front ref. Generate the angle with `--no-refs --ref <side> <back> <face>` or a different model. |
| Background character drift in multi-character panels | Expected — primary character locks best. Accept some drift on secondaries. |
| Style drifts toward photoreal | Strengthen the style closer: `Not photoreal, not painterly, not 3D-rendered. Strictly cel-shaded colored manga.` |

## Snapshots from verified working runs

- [ch99_p001_v1.png](output/ch-99/raw/kling/ch99_p001_v1.png) — Spyke standing, dawn London walkway (canon ✓)
- [ch99_p002_v1.png](output/ch-99/raw/kling/ch99_p002_v1.png) — Spyke combat with Plasma Blade activated (canon ✓)
- [ch99_p003_v1.png](output/ch-99/raw/kling/ch99_p003_v1.png) — Spyke seated in ramen shop (canon ✓)

## Important — stale production prompts

`output/ch-01/prompts/page-NN.txt` files were written against an older canon and reference a **back-mounted broadsword + leather X-harness** — both forbidden by the current YAML. **Do not use `--page N` to consume those prompts directly.** Always compose a fresh prompt with `--prompt` until those files are regenerated.

A separate task is needed to refresh those page prompts from the updated canon YAML.

## Example invocations

### Example 1 — simple test shot

User: "Generate a test of Spyke walking through a flooded street"

1. Verify `pipeline/data/characters/spyke-tinwall/references/` has refs
2. Compose prompt with the canon spec + that action + flooded street setting
3. Run with `--chapter 99 --page 1 --characters spyke-tinwall`
4. Show result, check canon

### Example 2 — production page

User: "Generate ch02 page 5 — Spyke and June arguing in the dojo"

1. Verify refs for both `spyke-tinwall` and `june-kamara` exist
2. Compose multi-character prompt with both canons locked
3. Run with `--chapter 2 --page 5 --characters spyke-tinwall june-kamara`
4. Verify both characters hold, report

### Example 3 — re-roll with tweak

User: "Re-roll that combat shot but with the plasma blade in a thinner katana shape"

1. Modify only the weapon-active clause in the previous prompt
2. Re-run (will auto-version to v2)
3. Compare to v1, report
