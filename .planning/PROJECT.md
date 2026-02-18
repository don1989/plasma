# Plasma Manga Pipeline

## What This Is

A production pipeline that converts Plasma story chapters into Webtoon-style digital manga, end to end. Takes written narrative chapters and outputs fully assembled vertical-scroll manga pages with art generated via Gemini and dialogue overlaid — repeatable for each chapter as the story grows.

## Core Value

A repeatable system that transforms any Plasma story chapter into publish-ready Webtoon manga pages with consistent character visuals across panels.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Panel-by-panel manga scripts generated from story chapters
- [ ] Gemini-optimized art prompts generated from scripts (per panel/page)
- [ ] Character visual consistency maintained across generated panels
- [ ] Art images generated via Gemini (manual copy-paste workflow initially)
- [ ] Dialogue and SFX integrated onto manga pages (approach TBD — baked-in vs overlay)
- [ ] Vertical-scroll Webtoon assembly from individual panels
- [ ] Pipeline handles new chapters as story continues being written

### Out of Scope

- Game development — separate future project
- Story writing — chapters already exist and are written separately
- Print-ready formatting — digital-first (Webtoon vertical scroll only)
- Hiring/managing human artists — AI generation only
- Animation or motion manga — static panels

## Context

The Plasma universe is a deeply developed story set in 3031 on flooded Earth and alien planet Terra. 15 chapters are written (~5000 lines), with the story ongoing. The story bible, character profiles, glossary, and lore consistency rules are all established.

**Existing manga work:**
- Chapter 1 is already scripted panel-by-panel (03_manga/chapter-01-script.md)
- Character reference sheets with AI art prompts exist for Spyke, June, Draster, Hood/Morkain, and Punks (03_manga/prompts/character-sheets.md)
- 8 concept art images generated: Spyke (4 variants), June (3 variants), Draster (1 variant)
- Manga scripting rules and visual style guide established (03_manga/manga-script.md)
- Dialogue voice profiles for 15+ characters (03_manga/dialogue-pass.md)
- Page prompts for Ch.1 pages 1-29 already exist (03_manga/prompts/)

**Art generation tool:** Gemini with Pro account. API access status unknown — pipeline should work with manual prompt execution (copy-paste to Gemini web UI) and support API automation as an upgrade path.

**Target format:** Webtoon-style vertical scroll optimized for phone/digital reading. One panel flows into the next vertically.

**Text/dialogue challenge:** AI-generated text in images is often garbled. Research needed to determine best approach — generating text as part of the image vs. programmatic overlay after generation.

**Visual identity (from existing character sheets):**
- Colored manga, cel-shaded, clean linework, vibrant colors
- Spyke: Reds, white cloak, ginger hair, green eyes
- June: Dark pinks, whites, blonde hair
- Draster: Navy suit-robe, silver-streaked black hair, dark brown skin
- Morkain: Black cloak, dark presence
- Terra environment: Blue grass, pink sky, blue-leafed trees

## Constraints

- **Art Tool**: Gemini Pro — pipeline must produce prompts optimized for Gemini's image generation capabilities and limitations
- **Workflow**: Manual Gemini interaction initially (copy-paste prompts) — design for automation upgrade later
- **Consistency**: Characters must be recognizable across panels — this is the hardest problem in AI manga generation
- **Format**: Webtoon vertical scroll — panels designed for top-to-bottom reading, not traditional page layouts
- **Existing Content**: Must respect and build on existing manga scripts, character sheets, and style guides in the repo
- **Ongoing Story**: Pipeline must be reusable — not a one-off conversion of 15 chapters

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gemini for art generation | User has Pro account, already generated character refs with it | — Pending |
| Webtoon vertical scroll format | Digital-first release, phone-optimized reading | — Pending |
| Pipeline-first approach | Build the system before producing chapters — ensures repeatability | — Pending |
| Text overlay approach | Baked-in vs programmatic overlay — needs research | — Pending |

---
*Last updated: 2026-02-18 after initialization*
