# Dialogue Pass — Plasma

> **Purpose:** Review and refine dialogue in a manga script. Enforce character voice, add subtext, cut exposition dumps, and keep lines balloon-friendly.

---

## Instructions

When given a manga script to review for dialogue, perform the following:

### Step 1: Voice Check

For each character with dialogue, compare against their voice notes in the story bible:
- Does the vocabulary match their background?
- Does the sentence structure match their personality (short/blunt vs. flowery/verbose)?
- Are their speech quirks or patterns present?
- Would the reader know who's talking even without the name tag?

### Step 2: Subtext Pass

For each dialogue exchange:
- What does the character **say**?
- What do they actually **mean**?
- If say = mean, rewrite so the meaning is implied rather than stated.
- Characters should talk around difficult topics, not announce their feelings.

### Step 3: Exposition Purge

Flag any line where a character explains something they already know to another character who also already knows it. Propose alternatives:
- Show it visually instead (note for artist)
- Move to narrator box if absolutely necessary
- Break across multiple scenes so info comes out naturally
- Have a character who genuinely doesn't know ask

### Step 4: Balloon Fit

- Max **2-3 short sentences per balloon**.
- If a line is too long, split into multiple balloons or panels.
- Read each line aloud mentally — if it sounds unnatural spoken, rewrite it.
- Cut filler words ("well," "you see," "basically") unless it's a character trait.

---

## Output Format

For each dialogue change, output:

```
### [Character] — Page [N], Panel [N]

**Original:** "[original line]"
**Revised:** "[new line]"
**Reason:** [why this change improves the dialogue]
```

At the end, provide a summary:
- Total lines reviewed
- Lines changed
- Lines flagged for author decision
- Any voice inconsistencies that may need a bible update

---

## Character Voice Quick Reference

<!-- Fill in as characters are established -->

| Character | Speech Style | Quirks | Avoids |
|-----------|-------------|--------|--------|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

---

## Rules

- Never flatten distinct voices into the same "default" tone.
- Villains don't monologue about their plans unless there's a story reason.
- Emotional lines hit harder when they're short.
- Silence (empty balloon, "...") is a valid and powerful dialogue choice.
