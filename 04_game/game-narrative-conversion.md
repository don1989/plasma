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

## Plasma-Specific Game Systems

### Player Decision Points

The story features branching player decisions that affect ally recruitment and story outcomes. Each decision must be tracked:

```
## Decision: [Name]

- **Chapter:** [N]
- **Context:** [What's happening when the choice appears]
- **Options:**
  - A: [Choice text] → [Consequence + flag set]
  - B: [Choice text] → [Consequence + flag set]
  - C: [Choice text] → [Consequence + flag set] (if applicable)
- **Recruitment impact:** [Which ally this affects, if any]
- **Reversible:** Yes / No
```

**Key decisions from Chapters 1-15:**

| Chapter | Decision | Recruitment Impact |
|---------|----------|-------------------|
| 7 | Shake Cannon's hand or refuse | Cannon/Gunners Green alliance |
| 9 | Accept Zena's red crystal | Juniper Village alliance |
| 12 | Let competition organiser go or beat him up | Micki's willingness to help later |
| 12 | Travel with Micki or meet at Sherryville | Micki alliance strength |
| 13 | Go to Greyshere or Hemington | Access to Bob as ally + additional character recruit |
| 13 | Convince the tunnel worker or fight | Bob joining later |
| 13 | Help tunnel workers or escape | Bob alliance confirmed |
| 14 | Investigate Formican Army or go to shrine first | Dobblepot's shop survival + Dobblepot joining |
| 14 | Various dialogue choices with Dobblepot | Dobblepot joining party |
| 15 | Help dwarves retake Knadville or refuse | Dwarven alliance |

### Combat System Notes

- **Stagger mechanic:** Enemies must be staggered before taking significant damage. Exploit elemental weaknesses.
- **Adrenaline Mode:** Triggered in specific story moments. Player gets enhanced speed/power. Eyes turn red. Not manually activated.
- **Rage Mode:** Tutorial ability in Chapter 1 only. Allows damaging Hood.
- **Elemental Sword:** Combined technique requiring Draster + Spyke in party. Player activates Draster's cast, then times Spyke's strike.
- **Sword Art:** Ranged abilities cast from Plasma weapons. Uses Plasma gauge.
- **Party system:** Up to 4 active party members. Spyke always present. Others rotate based on story.

### Party Composition by Chapter

| Chapter | Party Members | Guest/Temp |
|---------|--------------|------------|
| 1-5 | Spyke, June, Draster | — |
| 6-8 | Spyke, June, Draster | — |
| 9-10 | Spyke, June, Draster | Zena (temporary in some fights) |
| 11 | Spyke, June, Draster | — |
| 12 | Spyke, June, Draster | Micki (if traveling together) |
| 13 | Spyke, June, Draster | — |
| 14 | Spyke, June, Draster, Dobblepot | — |
| 15 | Spyke, June, Draster, Dobblepot | Hector (during battle), Dwarven troops (RTS section) |

### Special Game Modes

| Mode | Chapter | Description |
|------|---------|-------------|
| **Tutorial combat** | 1 | Basic attack, dodge, Rage Mode activation |
| **Stealth infiltration** | 8, 13 | Disguise/sneak past Formican soldiers. Detection = combat |
| **Tailing mission** | 13 | Follow construction worker without being spotted |
| **Eavesdropping** | 13 | Listen to NPC conversations for intel. Timer-based |
| **Vehicle traversal** | 12-13 | Plasma motorcycle driving/levitation across terrain |
| **Quick-time event** | 14 | Motorcycle soldier attack sequence. Timed button presses. |
| **RTS infantry battle** | 15 | Command dwarven troops. Control squad positioning and attacks. |
| **Dialogue choice** | Multiple | Timed and untimed dialogue decisions affecting recruitment |
| **Sleep dream sequence** | 4, 11, 15 | Narrative sequences during rest. No combat. Expository. |

### Vehicle System

- **Plasma Motorcycle** (obtained Ch.12)
  - Seats: 3 on main seat + 1 in passenger pod
  - Fuel: Plasma (refill at outposts)
  - Modes: Wheeled (default), Levitation (drains Plasma fast)
  - Cannot enter towns/cities without drawing attention
  - Cid's insignia allows any mechanic to help with repairs
  - Flag: `vehicle_motorcycle_obtained`

### Flag Naming Convention

All flags follow: `[type]_[chapter]_[description]`

Types:
- `quest_` — Quest completion/progress
- `ally_` — Ally recruitment status
- `decision_` — Player choice tracking
- `item_` — Item obtained
- `location_` — Location discovered/unlocked
- `story_` — Major story progression

Examples:
- `ally_ch7_cannon_recruited` (bool)
- `decision_ch12_organiser_spared` (bool)
- `quest_ch14_thicklewig_restored` (bool)
- `item_ch9_zena_red_crystal` (bool)
- `item_ch15_hector_armlet` (bool)
- `story_ch10_elder_dead` (bool)
- `story_ch10_juniper_burned` (bool)

---

## Rules

- Every quest must have at least one fail state (even if it's just "player leaves the area").
- NPC dialogue must update after major story events — no stale dialogue.
- Cutscene dialogue should be adapted from manga dialogue, not copied verbatim — spoken pacing differs from reading pacing.
- Side content should feel organic, not tacked on.
- Cross-reference all content against the story bible and lore rules.
- Player decisions that affect recruitment are **not reversible** — once an ally is lost, they stay lost for that playthrough.
- The Thaconion quest line (visit every inn and order ale) is a **world-spanning side quest** — flag must persist across all chapters.

---

## Conversion Checklist

- [ ] All main story beats from the chapter are covered by quests or cutscenes
- [ ] NPC dialogue accounts for different game states
- [ ] Flags are named consistently and documented
- [ ] Side content is flagged as optional (not blocking main progression)
- [ ] No lore contradictions introduced during conversion
- [ ] Player agency preserved where possible (choices, exploration)
- [ ] Party composition matches chapter's story requirements
- [ ] Special game modes are documented with controls/rules
- [ ] Boss fights have clear introduction cutscenes and victory conditions
