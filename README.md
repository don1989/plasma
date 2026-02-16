# Plasma

A story/manga/game universe project.

## Project Structure

```
01_bible/        — Canon, world rules, and reference material
02_planning/     — Outlining and continuity tools
03_manga/        — Manga scripting and dialogue
04_game/         — Game narrative conversion
```

## Skills

Each `.md` file in the folders above serves as a **Claude skill** — a structured prompt/ruleset that guides AI-assisted writing for a specific task (scripting, continuity checking, game conversion, etc.).

| Skill | Purpose |
|-------|---------|
| `story-bible.md` | Single source of truth for all canon |
| `lore-consistency-rules.md` | Hard constraints the world must obey |
| `glossary.md` | Names, terms, and definitions |
| `outline-to-chapters.md` | Turn outlines into chapter beats |
| `continuity-editor.md` | Catch and fix contradictions |
| `manga-script.md` | Write chapters as manga pages/panels |
| `dialogue-pass.md` | Punch up dialogue and character voices |
| `game-narrative-conversion.md` | Convert manga chapters into game assets |

## Workflow

1. **Define canon** — Fill out `story-bible.md` and `lore-consistency-rules.md`
2. **Plan** — Use `outline-to-chapters.md` to break the story into chapters
3. **Script** — Write manga pages with `manga-script.md`, refine with `dialogue-pass.md`
4. **Check** — Run `continuity-editor.md` after every major change
5. **Convert** — Use `game-narrative-conversion.md` to produce game-ready assets
