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

## Plasma-Specific Checks

In addition to general continuity, always verify these Plasma-universe specifics:

### Character Consistency
- [ ] Spyke's eye color is green (left eye turns purple/black when demon activates, red in Adrenaline Mode)
- [ ] Spyke wears Master's red bandana
- [ ] June is blonde, uses shortsword + pistol + magician glove + Plasma shoes
- [ ] Draster has dark brown skin, black/silver hair, dual Plasma Gloves
- [ ] Morkain has long blonde hair, scar, goatee, black uniform
- [ ] Dobblepot is a gnome (very short)
- [ ] Hector is a dwarf (short, Scottish accent)
- [ ] Micki is an elf (7 feet tall, huge bow)

### Power System Checks
- [ ] Plasma weapons require Plasma manipulation to lift
- [ ] Monsters can only be destroyed with Plasma
- [ ] Sword Art requires a Plasma weapon
- [ ] Elemental Sword requires a mage + swordsman (two people)
- [ ] Combined spells require multiple casters
- [ ] Time-freeze can only be perceived by those with blood of the ancients
- [ ] Adrenaline Mode is rage-triggered, not voluntary
- [ ] Healing magic cannot fix all injuries (certain trauma requires conventional treatment)

### Geography Checks
- [ ] Characters cannot fly off Terra (barrier turns things to dust)
- [ ] Deadbane Desert requires levitating vehicle
- [ ] Western Continent is irradiated (radiation effects on health and Plasma)
- [ ] Inter-continent travel: airships (Formican-controlled), tunnels (dangerous/incomplete), or ocean (Formican-controlled)
- [ ] Travel times are realistic (days/weeks on foot, faster by vehicle)

### Item & Equipment Checks
- [ ] Spyke carries: broadsword, Master's katana, hidden daggers (5 blades max)
- [ ] Trio has Plasma motorcycle (needs Plasma fuel, can levitate temporarily)
- [ ] Zodiac gems collected so far: Sagittarius, Cancer, Leo, Gemini
- [ ] Red crystal from Zena is in Spyke's possession
- [ ] Hector's armlet is in Spyke's possession

### Faction State Checks
- [ ] Formican Army controls all 5 Dukedoms and the skies/ports
- [ ] Juniper Village is burned (survivors rebuilding)
- [ ] Knadville is retaken by the dwarves
- [ ] Delton is a crater (artefact vault underneath, drilling machine destroyed)
- [ ] The Elder is dead (killed by Morkain)
- [ ] Master is dead

### Alliance State
- [ ] Confirmed allies: Zena/Juniper Village (red crystal), Cannon/Gunners Green (handshake), Micki (handshake), Bob (handshake), Dobblepot (traveling companion), Hector/Dwarves (handshake + armlet), Cid (informal)
- [ ] Potential allies (conditional on player decisions): Melvin, Thermadore, Thaconion, Boligon (via Hector's armlet)
- [ ] NOT allies: Dukes (enemies), Formican soldiers (enemies), Marik (ambiguous)

### Spelling Watchlist
- [ ] Spyke (not Spike)
- [ ] Draster (not Draster)
- [ ] Morkain (not Morcain)
- [ ] Dobblepot (not Doublepot)
- [x] Bazzleworth — **RESOLVED** (canonical spelling confirmed)
- [ ] Formican (not Formicant)
- [ ] Knadville (not Nadville)
- [ ] Thaconion (not Thaconeon)

---

## Rules

- Always prefer fixing the draft over changing canon.
- Never silently resolve a contradiction — always report it.
- If no contradictions are found, explicitly state: "No contradictions detected."
- Check character voice consistency (does dialogue match the character's voice notes in the bible?).
- Check timeline consistency (do events happen in the right order?).
- Check geography (can characters physically be where the draft says they are?).
- When a new character, location, or term appears, flag it for glossary addition.
- When Spyke's demon eye activates, verify the trigger is consistent (near crystals, shrines, extreme stress).

---

## Quick Checklist (Copy-Paste for Every Review)

```
## Continuity Review: [Chapter/Draft Name]

### General
- [ ] Character names and spellings correct
- [ ] Character appearances match bible descriptions
- [ ] Character abilities within established limits
- [ ] Timeline events in correct order
- [ ] Locations described consistently
- [ ] Faction behavior matches their established goals
- [ ] No forbidden story devices used
- [ ] Power scaling within caps
- [ ] New terms added to glossary
- [ ] Character voice consistent with bible notes

### Plasma-Specific
- [ ] Plasma power system rules followed
- [ ] Geography/travel rules respected
- [ ] Equipment inventory accurate
- [ ] Alliance states current
- [ ] Demon eye triggers consistent
- [ ] Game design notes don't contradict narrative

### Result
- Contradictions found: [N]
- Critical: [N]
- Major: [N]
- Minor: [N]
- Canon patches needed: [Y/N]
```
