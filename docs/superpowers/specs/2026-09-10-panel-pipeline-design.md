# Panel-Based Page Pipeline — Design

**Date:** 2026-09-10
**Status:** Approved in conversation, pending spec review
**Scope:** `pipeline/` only. Story content under `01_bible/`, `02_planning/`, `03_manga/` is read, never written.

## Problem

Chapter 1 pages generated on Runway Muse hold Spyke's look well but fail as manga pages:

1. **Pacing.** Each page is one AI image containing every panel. The model chooses the grid, defaults to equal-sized cells, merges or duplicates beats, and never sees the script's shot types. Establishing shots and eye close-ups get the same weight.
2. **No dialogue.** The lettering stage exists but is disconnected: it expects an approval manifest the Muse stage never writes, reads the old raw folder, and places balloons by guessing vertical zones. On a grid page it has no idea where panels or speakers are.

Both share a root cause: the unit of generation is the page. It must be the panel.

## Goals

- Pages read like Naruto / One Piece / Death Note: fixed page, hand-built grid, panel size carries pacing. Left-to-right reading order (the script and all output so far assume it).
- Dialogue, thought bubbles, narration and SFX from the script appear on the page in the right panel, on the speaker's side, in a proper comic font.
- Re-rolling costs one panel, not one page.
- Every downstream stage reads one source of truth per chapter.
- Nothing generates until the user asks. This design and its plan are documents only.

## Non-goals

- Right-to-left reading order (flag only).
- A browser-based balloon editor (possible later; a JSON override covers manual nudges).
- Webtoon vertical strip output (the existing assembly stage remains and can consume lettered pages unchanged).
- Automatic face detection for balloon placement. Speaker side is declared in the prompt and recorded in the plan; a vision pass can be added later if the heuristic misses too often.

## Architecture

```
03_manga/chapter-01-script.md
        │  stage: script (existing)
        ▼
output/ch-01/script.json
        │  stage: plan  (NEW)  + character registry + shot-type rules
        ▼
output/ch-01/pages.json   ◄── single source of truth: layout, panel prompts,
        │                     speaker sides, dialogue, versions, approvals
        ├─ stage: panels  (NEW)  one Muse call per panel
        │       └─► output/ch-01/raw/<model>/ch01_p03_pn2_v1.png (+ .log.json)
        ├─ stage: review  (NEW)  contact sheet of all versions per page
        │       └─► output/ch-01/review/ch01_p03.png
        ├─ command: approve (NEW)  marks the winning version in pages.json
        ├─ stage: compose (NEW)  approved panels → page grid
        │       └─► output/ch-01/pages/ch01_p03.png
        └─ stage: letter  (NEW)  balloons + SFX inside known panel rects
                └─► output/ch-01/lettered/ch01_p03.png
                          │  stage: assemble (existing, unchanged)
                          ▼
                output/ch-01/webtoon/...
```

## Components

### Page plan (`src/types/page-plan.ts`, `src/planning/page-plan.ts`)

`pages.json` holds an array of `PagePlan`:

- `pageNumber`, `isSplash`, `layout: { canvas: {w,h}, slots: SlotRect[] }` where `SlotRect = { panelNumber, x, y, w, h }` in canvas pixels.
- `panels: PanelPlan[]` each with `panelNumber`, `shotType`, `aspectRatio` ('16:9' | '4:3' | '3:4' | '1:1'), `characterIds`, `speakerSides: Record<string,'left'|'right'>`, `dialogue: DialogueLine[]`, `sfx`, `prompt`, `versions: PanelVersion[]`, `approvedVersion: number | null`, `balloonOverrides?: Record<number, {dx,dy}>` keyed by dialogue index.
- `PanelVersion = { version, file, model, requestId, timestamp, notes }`.

The plan builder derives everything from `script.json` and the character registry. Re-running `plan` keeps existing versions and approvals for panels whose `prompt` hash is unchanged, and resets them when the prompt changed.

**Aspect ratio from shot type:** Wide → 16:9. Medium-Wide → 4:3. Medium → 3:4. Close-up and Extreme close-up → 1:1. Splash page → 3:4. Anything else → 3:4. These map onto Muse's ratio table via the existing registry (`RUNWAY_RATIOS.muse`; 16:9 → 2016:1152, 4:3 → 1792:1344, 3:4 → 1344:1792, 1:1 → 1600:1600).

**Speaker side:** the first speaker in a panel is placed on the left, the second distinct speaker on the right, further speakers alternate. Off-panel speakers (dialogue whose character is not in the panel's detected characters, or narration) get no side and their balloon goes top-centre. The side is written into the prompt ("Spyke on the left of the frame, the punk leader on the right") and stored in `speakerSides`.

**Panel prompt:** `[style prefix] [panel action] [panel notes] CHARACTERS: [canon fingerprint per character on the panel] FRAMING: [shot type], [speaker placement], leave clear headroom above the characters for dialogue. NO text, NO balloons, NO lettering.`

### Layout engine (`src/layout/`)

Row-flow layout, not fixed templates. Reading order is preserved exactly.

- Canvas 1600 × 2264 (B5 trim ratio), outer margin 60, gutter 24.
- Rows are formed left to right, top to bottom:
  - A 16:9 or 4:3 panel takes a full-width row alone.
  - Two consecutive 3:4 or 1:1 panels share a row (left, right).
  - A leftover single 3:4 / 1:1 panel takes a full-width row.
- Row weights: full-width wide row 1.0; paired row 1.3; single portrait row 1.3. The emphasis panel (most dialogue lines; tie-break: notes containing "!", "reveal", "beat", or the last panel) multiplies its row by 1.25. Weights normalise to the inner height.
- Splash pages: one slot filling the inner canvas.
- Any page with more than 7 panels falls back to rows of two.
- Compose cover-fits each approved panel image into its slot (resize to cover, centre crop) with a 4 px black border, on a white page.

### Panel generation (`src/stages/panel-generate.ts`)

For each selected page/panel with no approved version (or `--redo`), call `generateImage` with the panel's prompt, its aspect ratio, and the references for its `characterIds` (through the existing per-page ref cache and model cap). Save `ch01_p03_pn2_vN.png` plus log, append a `PanelVersion` to the plan, auto-approve if the panel had no approved version. Concurrency 3 (Muse tolerates it; Runway errors surface per panel and do not abort the run).

### Review and approve

`review -c 1 [--page N]` renders `output/ch-01/review/ch01_p03.png`: one row per panel, every version thumbnail at 320 px wide with a "v2 ✓" label on the approved one. `approve -c 1 --page 3 --panel 2 --version 2` updates the plan.

### Lettering (`src/overlay/placement.ts`, `src/stages/letter.ts`)

Input is the composed page and the plan's slots. For each panel, balloons are laid out in dialogue order inside the slot rectangle:

- Font: Comic Neue Bold (OFL), bundled at `pipeline/data/fonts/ComicNeue-Bold.ttf`, loaded through Pango via `fontfile`. Font size = clamp(slot width / 28, 18, 34).
- Max balloon width = min(0.45 × slot width, 420).
- Speech and thought balloons start 24 px inside the top edge on the speaker's side (left or right), stacking downward with 12 px spacing when the same side repeats. Tail points down toward the speaker's side. Narration boxes are centred at the top, up to 0.6 × slot width (max 560 px). Off-panel speech goes top-centre with the tail clipped.
- SFX renders through the existing `renderSfx` at bottom-centre of the panel slot.
- `balloonOverrides` in the plan add a pixel offset per dialogue index.
- Existing `generateBalloonSvg`, `calculateBalloonSize`, `renderSfx` are reused; the `overlayPage` zone heuristic is retired.

### CLI

New commands on `src/cli.ts`: `plan`, `panels`, `review`, `approve`, `compose`, `letter`, all taking `-c`, `--page`, `--pages`, `-v`, `--dry-run`; `panels` also takes `--model`, `--redo`, `--notes`. `stage:kling` stays for one-shot page or test renders.

## Error handling

- Missing `script.json` → stage fails with the existing "run script stage first" message.
- Missing `pages.json` → `panels`, `compose`, `letter`, `review` fail with "run plan stage first".
- A panel with no approved version → `compose` draws a grey placeholder with "MISSING p03 panel 2" and continues; `letter` still letters the page.
- Provider errors are caught per panel, recorded in the stage result, never abort the run.
- Character with no references → warning, text-only for that character (existing behaviour).

## Testing

- Pure units under vitest: aspect mapping, speaker-side assignment, row-flow layout (slot counts, order, no overlap, fits canvas), balloon placement (inside slot, side, stacking), plan merge (keeps approvals when prompt unchanged).
- Compose and letter tested with 64 px synthetic PNGs created by Sharp in the test.
- No network in tests; `generateImage` is injected into the panel stage so tests pass a stub.
- Three pre-existing failing tests in `tests/templates/prompt-generator.test.ts` expect the old "spiky ginger hair" canon; they are updated to the current fingerprint as part of this work since the template they test is being replaced.

## Delivery phases

1. Plan + layout + compose, verified by composing pages from placeholder tiles (no API calls).
2. Panel generation and review/approve on pages 1–3 only, compared against the current Muse pages. **Runs only on the user's go.**
3. Lettering on those three pages.
4. Remaining chapter 1 pages.
