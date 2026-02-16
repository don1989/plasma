# Game Narrative Conversion — Plasma

> **Purpose:** Convert manga chapters into game-ready narrative assets. Produces quests, cutscenes, dialogue trees, flags/variables, and side content.

---

## Instructions

Given a manga chapter (or set of chapters), produce the following game assets:

### 1. Quests

For each quest derived from the chapter:

```
## Quest: [Quest Name]

- **Type:** Main / Side / Hidden
- **Trigger:** [What starts this quest — location, NPC, event]
- **Objective:** [What the player must do]
- **Steps:**
  1. [Step 1]
  2. [Step 2]
  3. [...]
- **Fail states:** [What can go wrong / how the player can fail]
- **Rewards:** [XP, items, story progression, unlocks]
- **Completion flag:** [Variable name, e.g., `quest_ch3_rescue_complete`]
```

### 2. Cutscenes

For each cutscene:

```
## Cutscene: [Name]

- **Trigger:** [What causes this cutscene to play]
- **Location:** [Where it takes place]
- **Characters present:** [List]
- **Duration:** Short (< 30s) / Medium (30s-2min) / Long (2min+)
- **Dialogue:** [Script with speaker tags]
- **Camera notes:** [Angles, pans, zooms]
- **Transitions:** [What happens before/after]
- **Skippable:** Yes / No
```

### 3. Flags & Variables

List all game state variables this chapter introduces or modifies:

```
| Variable | Type | Set When | Used By |
|----------|------|----------|---------|
| `flag_name` | bool/int/string | [trigger] | [what checks this] |
```

### 4. NPC Dialogue

For each NPC with dialogue:

```
## NPC: [Name]

**Location:** [Where they are]

### Default (idle) bark:
- "[Line 1]"
- "[Line 2]" (random rotation)

### After [event/flag]:
- "[Updated line]"

### Quest dialogue:
- **[Quest stage]:** "[Line]"

### Repeat dialogue:
- "[What they say if talked to again]"
```

### 5. Optional / Side Content

Content from the chapter that could become optional gameplay:

```
## Side Content: [Name]

- **Source:** [Which part of the manga chapter inspired this]
- **Type:** Side quest / Collectible / Lore entry / Mini-game / Hidden area
- **Description:** [What it is]
- **Requirements:** [Flags or conditions needed to access]
```

---

## Rules

- Every quest must have at least one fail state (even if it's just "player leaves the area").
- NPC dialogue must update after major story events — no stale dialogue.
- Flag names follow the convention: `[type]_[chapter]_[description]` (e.g., `quest_ch1_intro_complete`).
- Cutscene dialogue should be adapted from manga dialogue, not copied verbatim — spoken pacing differs from reading pacing.
- Side content should feel organic, not tacked on.
- Cross-reference all content against the story bible and lore rules.

---

## Conversion Checklist

- [ ] All main story beats from the chapter are covered by quests or cutscenes
- [ ] NPC dialogue accounts for different game states
- [ ] Flags are named consistently and documented
- [ ] Side content is flagged as optional (not blocking main progression)
- [ ] No lore contradictions introduced during conversion
- [ ] Player agency preserved where possible (choices, exploration)
