# Continuity Editor — Plasma

> **Purpose:** Compare any draft, outline, or script against the story bible and lore rules. Catch contradictions and propose minimal fixes. Run this after every chapter or major outline change.

---

## Instructions

When given a draft or chapter to review, perform the following checks:

### Step 1: Compare Against Canon

Read the draft and cross-reference every fact against:
- `01_bible/story-bible.md` (characters, timeline, locations, factions)
- `01_bible/lore-consistency-rules.md` (hard constraints)
- `01_bible/glossary.md` (names, terms, spelling)

### Step 2: List Contradictions

For each contradiction found, output:

```
### Contradiction [N]

- **Location:** Chapter/page/paragraph where the issue occurs
- **What the draft says:** [quote or summary]
- **What canon says:** [reference from bible]
- **Severity:** Minor / Major / Critical
  - Minor: Cosmetic (wrong eye color, name spelling)
  - Major: Plot-affecting (wrong timeline, power misuse)
  - Critical: Breaks a lore consistency rule
```

### Step 3: Propose Fixes

For each contradiction, propose options:

1. **Fix the draft** (minimal edit to match canon) — always list this first
2. **Update canon** (if the draft version is intentionally better) — include exact edits needed to the bible
3. **Flag for author decision** (if it's ambiguous)

### Step 4: Canon Patch Notes

If any canon updates are approved, output the exact changes needed:

```
### Canon Patch

- **File:** [which bible file]
- **Section:** [which section]
- **Old text:** [what it currently says]
- **New text:** [what it should say]
- **Reason:** [why this change is needed]
```

---

## Rules

- Always prefer fixing the draft over changing canon.
- Never silently resolve a contradiction — always report it.
- If no contradictions are found, explicitly state: "No contradictions detected."
- Check character voice consistency (does dialogue match the character's voice notes in the bible?).
- Check timeline consistency (do events happen in the right order?).
- Check geography (can characters physically be where the draft says they are?).

---

## Checklist Template

Use this quick checklist for every review:

- [ ] Character names and spellings correct
- [ ] Character abilities within established limits
- [ ] Timeline events in correct order
- [ ] Locations described consistently
- [ ] Faction behavior matches their established goals
- [ ] No forbidden story devices used (see lore rules)
- [ ] Power scaling within caps
- [ ] New terms added to glossary if needed
- [ ] Character voice consistent with bible notes
