# Manga Script — Plasma

> **Purpose:** Write a chapter as manga pages and panels. This skill produces artist-ready scripts with shot types, dialogue, action, and composition notes.

---

## Output Format

For each chapter, output:

```
# Chapter [N]: [Title]

**Theme beat:** [What emotional/thematic note does this chapter hit?]
**Pages:** [estimated count]

---

## Page [N]

### Panel [N] — [Shot Type]

**Shot type:** Wide / Medium / Close-up / Extreme close-up / Bird's eye / Low angle
**Action:** [What is happening visually in this panel]
**Dialogue:**
- [CHARACTER]: "[Line]"
- [CHARACTER]: "[Line]"
**SFX:** [Sound effects, if any]
**Notes:** [Composition notes, mood, lighting, emphasis]

---
```

---

## Rules

### Page Layout
- Target **4-7 panels per page** for standard scenes.
- Action montages may use more panels (up to 9-10 small panels).
- Splash pages (1 panel = 1 page) reserved for major reveals or emotional peaks.
- Double-page spreads must be noted explicitly.

### Page-Turn Reveals
- Big reveals go on the **last panel of a right-hand (odd-numbered) page** so the reader sees them when turning the page.
- Mark these panels with: `[PAGE-TURN REVEAL]`

### Dialogue
- Keep lines **short** — manga speech balloons are small.
- Max **2-3 short sentences per balloon**.
- If a character is giving a speech, break it across multiple panels.
- Use `(thought)` for internal monologue and `(narration)` for narrator boxes.

### Pacing
- Every chapter must **end with a hook or cliffhanger**.
- Alternate between high-action and quiet character moments.
- Use silent (no-dialogue) panels for emotional weight.

### Visual Direction
- Always specify shot type — the artist needs framing info.
- Note when a panel should **bleed to the edge** of the page (no border).
- Note **speed lines**, **impact frames**, or **tone shifts** (e.g., "background goes dark").

### Consistency
- Cross-reference character appearances with the story bible.
- Check all events against `lore-consistency-rules.md`.
- New characters or locations must be added to the glossary.

---

## Plasma-Specific Visual Rules

### Character Appearances (Must Be Consistent)
- **Spyke (age 21):** Spiky ginger hair (tips reach traps), green eyes, red bandana. White knee-length cloak (sleeves cut, dojo emblem on back, decorative pattern along bottom hem). Red fingerless glove on left hand, red bracer on left wrist; armoured full-fingered glove on right hand. Red-accented belt. Broadsword on back, patterned katana at hip, daggers hidden in metal knee pauldron (not revealed until later). When Adrenaline Mode activates: eyes turn red, art style becomes sharper/more intense. When demon activates: left eye turns purple/black, arm may transform green/purple.
- **June:** Blonde hair, sporty build. Shortsword at hip, pistol holster, magician glove on one hand, Plasma shoes visible.
- **Draster:** Dark brown skin, black/silver hair, brown eyes. Slim. Navy jacket-style robe. Dual Plasma Gloves (leather, always visible).
- **Morkain:** Long blonde hair, facial scar, long goatee. Black Formican uniform. Broadsword. Always drawn with an aura of calm menace.

### Action Sequences
- **Sword Art:** Show energy beams emanating from blades with motion lines. Color note: Plasma energy is typically blue/white.
- **Iaijutsu (Flash of Light):** Single decisive panel — sword already sheathed, effect already happened. Speed lines radiating from the strike point. After-image of the blade's path. Gold/yellow glow from Master's katana.
- **Adrenaline Mode:** When Spyke's eyes go red, the art should intensify — heavier inks, darker shadows, more aggressive panel shapes (jagged borders).
- **Time-Freeze:** Everything stops except Morkain. Show frozen rain/debris/people. Spyke perceives but moves in slow motion (show motion blur on Spyke while environment is sharp/frozen).
- **Elemental Sword:** Show Draster casting toward Spyke's blade (two-person technique). Element wraps around the blade. Dual-panel composition: mage + swordsman acting in sync.
- **Demon Transformation:** Spyke's left eye panel — close-up of green/purple iris shifting. Dark tendrils on his arm. Background turns dark. Other characters react with fear.

### Boss Fights
- Boss introduction: **Full splash page** or **double-page spread** showing the creature's scale.
- Use **dynamic panel layouts** during fights — slanted panels, breaking panel borders, overlapping panels.
- Final blow: **Single clean panel** with white/bright background, decisive strike in focus.

### Emotional Moments
- **Master's death (Ch.5):** Slow down pacing. Multiple silent panels. Close-up of bandana being passed. Spyke's face transitions from shock to resolve.
- **June/Spyke conversations:** Intimate medium shots. Stars visible in night scenes. Comfortable silence between dialogue.
- **Morkain confrontations:** Wide shots establishing his dominance. He should always look down at the trio (literally or compositionally).

### Terra Visual Identity
- **Blue grass, pink sky, blue-leafed trees.** These must be consistent in every Terra outdoor scene.
- **Heavy air:** Show characters breathing harder in early Terra scenes. Subtle visual cue (breath marks, sweat).
- **Formican soldiers:** Blue uniforms with face-covering helmets. Faceless and interchangeable by design.
- **Radiation (Western Continent):** Visual distortion. Crackling lines in the air. Desaturated palette note for colorist.

### Game Design Panels
- When a player decision point occurs, mark it with a visual break: `> **[PLAYER DECISION POINT]**`
- Boss fights should open with a clear establishing panel that could translate to a game encounter camera angle.
- When new game mechanics are introduced (Adrenaline Mode, stagger, elemental sword), give them a clear visual showcase panel.

---

## Chapter Template

```
# Chapter [N]: [Title]

**Theme beat:**
**Estimated pages:** [N]
**Characters appearing:** [list]
**Locations:** [list]
**Canon references:** [any bible entries this chapter depends on]

---

## Page 1

### Panel 1 — Wide

**Action:**
**Dialogue:**
**SFX:**
**Notes:**

### Panel 2 — Medium

**Action:**
**Dialogue:**
**SFX:**
**Notes:**

[...continue for all panels/pages...]

---

## End Hook

**What pulls the reader to the next chapter:**
```

---

## Splash Page / Spread Candidates (from Chapters 1-15)

These moments warrant splash pages or double-page spreads:

| Chapter | Moment | Type |
|---------|--------|------|
| 1 | Hood freezes time — everyone stops mid-motion | Splash |
| 1 | Fang attacks London skyline | Double spread |
| 4 | Young Spyke finally lifts the broadsword | Splash |
| 5 | Master's final stand (katana drawn, enemies surrounding) | Double spread |
| 5 | Trio wakes up on Terra (blue grass, pink sky reveal) | Double spread |
| 7 | ArmourBird swooping down on the trio | Splash |
| 8 | Underground monster factory reveal | Double spread |
| 10 | Morkain standing over the Elder's body, village burning | Splash |
| 10 | Time-freeze: Morkain walks through frozen flames | Splash |
| 11 | Spyke's demon transformation (green/purple eye, dark arm) | Splash |
| 13 | Catastrophe vision — Plasma ball hitting Terra | Double spread |
| 13 | Giant Sand Eye emerging from desert | Splash |
| 14 | Spyke cleaves through motorcycle soldier mid-air | Splash |
| 14 | Delton crater with airship — scale of destruction | Double spread |
| 15 | Fluffy the behemoth emerging from fog | Splash |
| 15 | Dwarves cheering Spyke after victory | Splash |
