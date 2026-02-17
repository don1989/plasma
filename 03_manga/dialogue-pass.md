# Dialogue Pass — Plasma

> **Purpose:** Review and refine dialogue in a manga script. Enforce character voice, add subtext, cut exposition dumps, and keep lines balloon-friendly.

---

## Instructions

When given a manga script to review for dialogue, perform the following:

### Step 1: Voice Check

For each character with dialogue, compare against their voice notes in the story bible and the quick reference table below:
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

| Character | Speech Style | Quirks | Avoids |
|-----------|-------------|--------|--------|
| **Spyke** | Blunt, short sentences. Impatient. Commands rather than asks. Gets sharper under stress. Rare vulnerability with June. | Sighs frequently. Says "Fine" or "Let's move" to end conversations. Growls when angry. Internal monologue is more reflective than his speech. | Small talk. Compliments. Long explanations. Never begs or pleads. |
| **June** | Energetic, expressive. Blurts things out. Uses exclamation marks. Gets annoyed visibly (yells, grunts "Grrr!"). Teasing with Spyke. | Says "Grrr!" when frustrated. Blurts classified info ("We plan to do something about it!"). Rhetorical questions. Spells out words for emphasis ("B-O-R-R-O-W"). | Being quiet for long. Hiding her emotions. Formal speech. |
| **Draster** | Calm, analytical. Full sentences. Often the voice of reason. Polite with strangers. Uses "Indeed" as agreement. | Says "Indeed" frequently. Whispers tactical advice. Pats Spyke on back to calm him. Introduces others when Spyke forgets. Thinks out loud ("Let's see..."). | Rudeness. Impulsive statements. Losing composure (very rare). |
| **Morkain** | Cold, commanding. Measured words. Calls Spyke "child" or "insignificant." Speaks in declarations. Philosophical about power. | Hisses words. Uses "I" statements about destiny. Drops bombs casually ("Tinwall." — single word to shock). Turns his back mid-conversation as a power move. | Shouting (he doesn't need to). Explaining himself. Showing weakness. |
| **Dobblepot** | Nervous stutter initially, warms up to cheerful chatter. Uses "Hehe" laugh. Polite and formal. Gets emotional about gnome history. | Stutters when scared ("W-w-welcome"). Cheers "Great!" or "Hehe" when happy. Withholds information until directly asked. Says "Now, allow me to..." when hosting. | Confrontation. Bragging. Profanity. |
| **Hector** | Boisterous Scottish-accented. Loud laughs ("Gyahahahaha!"). Direct and honest. Military bearing. | "Aye" for agreement. "O'course!" Bellows and cheers. Proposes toasts. Calls people by first name immediately. | Subtlety. Quiet indoor voice. Beating around the bush. |
| **Micki** | Friendly, straightforward. Low-key. Offers help without being asked. Formal introductions ("My name is Mickitarius"). | Whispers serious offers. Salutes when departing. "Fare thee well." Uses "Let me know" as a catch phrase. | Aggression (unless provoked). Rudeness. Showing off. |
| **Bob** | Gruff, working-class. Loud when performing. Strategic underneath. Bellowing laugh. | "Hahaha" belly laughs. Plays dumb strategically. "On yer way now!" Calls people "you three" or by name. Rough handshake. | Formality. Subtlety when it's not tactical. |
| **Jairek** | Elderly, knowledgeable. Formal but warm. Becomes animated when explaining. | "It's not all bad" — tries to stay positive. Long explanations with hand gestures. Trails off when emotional about the past. | Rudeness. Rushing. Hiding information. |
| **Master** | Calm authority. Protective. Few words, each one counts. Gentle with children, steel with enemies. | "Don't be afraid." Uses silence as communication. Nods instead of speaking. | Cruelty. Unnecessary violence. Long speeches. |
| **Seymour** | Arrogant, mocking. Calls Spyke "redhead." Competitive. | Smirks. Taunts. "Redhead" as a dismissive nickname. | Showing respect to Spyke. Admitting weakness. |
| **Zena** | Confident warrior. Earthy, practical. Warm underneath. | Smiles with actions not words. Firm handshake. Direct eye contact. Gifts treasures to seal trust. | Flowery language. Hesitation. Showing vulnerability publicly. |
| **Cannon** | Grumpy elder. Prejudiced but changeable. Curt. | "Hmph!" Grudging concessions. Takes time to warm up. Firm handshake once trust is earned. | Praising humans easily. Admitting he was wrong quickly. |
| **Tinwall** | Cold, commanding. Abusive. | Commands, doesn't ask. Uses silence as threat. | Warmth. Explanation. Empathy. |

---

## Rules

- Never flatten distinct voices into the same "default" tone.
- Villains don't monologue about their plans unless there's a story reason.
- Emotional lines hit harder when they're short.
- Silence (empty balloon, "...") is a valid and powerful dialogue choice — Spyke uses it frequently.
- Spyke's internal monologue (thought bubbles) is more reflective and vulnerable than his spoken dialogue. Preserve this contrast.
- June and Draster often serve as a "translator" for Spyke's bluntness — they smooth over social situations he makes awkward.
- When Spyke speaks gently (rare), it signals character growth. Do not overuse.
- Morkain never raises his voice. His power is in the calmness of his cruelty.
- Dobblepot's information withholding is a character trait, not a writing crutch — but it should always feel natural (he genuinely doesn't think to mention things until relevant).
