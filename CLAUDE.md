# Plasma Project — Claude Instructions

## Project Overview

Plasma is a multimedia story universe (manga + future game) set in 3031 on flooded Earth and alien planet Terra. The repo contains the story bible, 15 written chapters, manga scripts, character sheets, and concept art. A production pipeline is being built to convert story chapters into Webtoon-style digital manga using Gemini for AI image generation.

## Git Workflow

- **Never commit directly to `main`.** Always work on feature branches.
- Branch naming: `feature/<description>` (e.g., `feature/pipeline-setup`)
- Create PRs to merge into main.

## Directory Structure

- `01_bible/` — Canon story bible, lore rules, glossary. **Do not modify without explicit instruction.**
- `02_planning/` — Story outlines, continuity tools. **Do not modify without explicit instruction.**
- `03_manga/` — Manga scripts, dialogue profiles, art prompts, concept art. **Source material — read from, don't restructure.**
- `04_game/` — Game narrative conversion docs. Out of scope for current work.
- `05_gsd/` — Execution framework docs.
- `pipeline/` — Manga production pipeline (TypeScript). All pipeline code, config, and tooling lives here.
- `output/` — Generated manga images and assembled Webtoon strips, organized by chapter.
- `.planning/` — GSD project planning docs (roadmap, requirements, research, state).

## Pipeline Stack

- **Language:** TypeScript (Node.js)
- **Image processing:** Sharp (libvips)
- **AI image generation:** Gemini via `@google/generative-ai` SDK
- **Target format:** Webtoon vertical scroll (800px wide, PNG/JPG)

## Key Conventions

- Pipeline code is **completely separate** from story content. The pipeline reads from `01_bible/`, `02_planning/`, `03_manga/` but never writes to them.
- Character consistency is the hardest problem. Every Gemini prompt must embed the full character visual description — Gemini has no session memory.
- Dialogue text is **never baked into AI-generated images**. Always use programmatic text overlay.
- Intermediate artifacts are preserved at each pipeline stage (`raw/`, `processed/`, `lettered/`, `webtoon/`). Never overwrite upstream outputs.
- Panel images follow naming convention: `ch01_p003_v1.png` (chapter, page, version).

## AI Image Generation Notes

- Using Gemini Pro account for image generation
- Manual copy-paste workflow initially; API automation planned
- Style guide prefix must be identical (verbatim) in every prompt — never paraphrase
- Character "prompt fingerprints" are locked, tested description blocks per character
