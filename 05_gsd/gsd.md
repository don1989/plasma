# GSD (Get Shit Done) — Plasma

> **Purpose:** Execution-focused skill that breaks down any Plasma project task into concrete, actionable steps and drives them to completion. No hand-wringing, no over-planning — identify what needs doing and do it.

---

## When to Use

Use GSD when you need to:
- Break a vague creative goal into specific deliverables
- Prioritize competing tasks across the manga/game pipeline
- Unblock a stuck phase (writing, scripting, game design)
- Sprint through a batch of work (e.g., "script chapters 5-8 this session")
- Audit what's done vs. what's missing

---

## How It Works

### Step 1: Define the Objective

State the goal in one sentence. Examples:
- "Script Chapter 3 as manga pages"
- "Add 4 new characters to the bible"
- "Convert Chapters 1-5 into game quests"
- "Resolve all continuity issues from last draft"

### Step 2: Audit Current State

Before doing anything, check:
- What exists in the repo already? (Read the relevant files)
- What's the last thing that was completed?
- Are there any blockers (missing canon, unresolved decisions, TODO markers)?

List blockers explicitly. If there are none, say so and move on.

### Step 3: Break It Down

Split the objective into **atomic tasks** — each one completable in a single focused action. Format:

```
## Sprint: [Objective]

### Must Do (blocks everything else)
- [ ] Task 1
- [ ] Task 2

### Should Do (improves quality)
- [ ] Task 3

### Nice to Have (if time permits)
- [ ] Task 4

### Blockers
- [BLOCKER] Description → Proposed resolution
```

### Step 4: Execute

Work through tasks in order. For each task:
1. **Do it** — write the content, make the edit, create the file
2. **Verify it** — cross-check against bible/lore rules if applicable
3. **Mark it done** — move on immediately

Do not:
- Revisit completed tasks unless a blocker surfaces
- Spend more than 2 minutes deciding between approaches — pick one and go
- Add scope mid-sprint — log it for the next sprint instead

### Step 5: Sprint Summary

After completing the sprint, output:

```
## Sprint Complete

**Objective:** [what was the goal]
**Completed:** [N/M tasks]
**Files modified:** [list]
**Canon changes:** [any updates to bible/lore/glossary]
**Deferred:** [tasks pushed to next sprint]
**Next sprint suggestion:** [what should happen next]
```

---

## Sprint Templates

### Template: New Chapter Sprint

```
## Sprint: Write Chapter [N]

### Must Do
- [ ] Review story bible for relevant characters/locations
- [ ] Review previous chapter's end hook
- [ ] Write chapter outline (goal, conflict, twist, cliffhanger)
- [ ] Draft full chapter narrative
- [ ] Run continuity check against bible

### Should Do
- [ ] Update glossary with any new terms/characters
- [ ] Add timeline entries for new events
- [ ] Note any open mysteries introduced

### Nice to Have
- [ ] Draft manga page breakdown
- [ ] Identify player decision points for game conversion
```

### Template: Manga Script Sprint

```
## Sprint: Script Chapter [N] as Manga

### Must Do
- [ ] Review chapter narrative
- [ ] Break into pages (estimate page count)
- [ ] Script each page: panels, shots, dialogue, SFX
- [ ] Ensure chapter ends with hook/cliffhanger
- [ ] Mark page-turn reveals

### Should Do
- [ ] Run dialogue pass on all dialogue
- [ ] Note splash page and double-spread opportunities
- [ ] Check character appearances match bible

### Nice to Have
- [ ] Add composition notes for key panels
- [ ] Identify panels that could become game cutscenes
```

### Template: Game Conversion Sprint

```
## Sprint: Convert Chapter [N] to Game Assets

### Must Do
- [ ] Extract main quest from chapter events
- [ ] Define quest steps, triggers, and fail states
- [ ] Script cutscenes with triggers and camera notes
- [ ] List all flags/variables introduced
- [ ] Write NPC dialogue (default + post-event)

### Should Do
- [ ] Identify side quest opportunities
- [ ] Map player decision points with consequences
- [ ] Update flag naming to match convention

### Nice to Have
- [ ] Write NPC bark rotations
- [ ] Design optional exploration content
- [ ] Note where music/SFX changes should occur
```

### Template: Canon Update Sprint

```
## Sprint: Update Canon After [Event/Chapter]

### Must Do
- [ ] Run continuity editor on new content
- [ ] Resolve all Critical contradictions
- [ ] Resolve all Major contradictions
- [ ] Apply canon patches to story bible
- [ ] Update glossary with new entries
- [ ] Update timeline

### Should Do
- [ ] Resolve Minor contradictions
- [ ] Review lore consistency rules for needed updates
- [ ] Check character arc progression against bible

### Nice to Have
- [ ] Add new open mysteries
- [ ] Update planned reveals timeline
- [ ] Review power scaling after new abilities introduced
```

---

## Rules

1. **Bias toward action.** If you can do it now, do it now.
2. **One sprint, one objective.** Don't try to write a chapter AND convert it to game assets in the same sprint.
3. **Respect the bible.** Every sprint output must be consistent with `story-bible.md` and `lore-consistency-rules.md`. If it's not, fix it before marking done.
4. **Log everything.** New characters, locations, terms, and timeline events must be added to the glossary/bible as part of the sprint — not "later."
5. **Protect scope.** If something new comes up mid-sprint, add it to "Deferred" and keep going. The next sprint will pick it up.
6. **Ship imperfect over not shipping.** A rough chapter you can edit beats a perfect outline you haven't started. Get words on the page first.

---

## Quick Commands

Use these as shorthand prompts:

- **"GSD: chapter N"** — Run the New Chapter Sprint template for chapter N
- **"GSD: script N"** — Run the Manga Script Sprint for chapter N
- **"GSD: convert N"** — Run the Game Conversion Sprint for chapter N
- **"GSD: canon update"** — Run the Canon Update Sprint
- **"GSD: status"** — Audit all files and report what's complete vs. missing
- **"GSD: next"** — Suggest the highest-priority sprint based on current state
