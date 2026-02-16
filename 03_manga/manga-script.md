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
