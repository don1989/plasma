import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChapterScript, validateChapter } from '../../src/parsers/script-parser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

function readChapter01(): string {
  return readFileSync(
    resolve(PROJECT_ROOT, '03_manga', 'chapter-01-script.md'),
    'utf-8'
  );
}

// Minimal valid script for unit tests
function minimalScript(overrides: { pages?: string } = {}): string {
  const pages =
    overrides.pages ??
    `## Page 1

### Panel 1 \u2014 Wide

**Action:** Establishing shot of the city.
**Dialogue:** \u2014
**SFX:** \u2014
**Notes:** Set the scene.`;

  return `# Chapter 1: Test Chapter

**Theme beat:** A test theme beat.
**Estimated pages:** 24
**Characters appearing:** Alpha, Beta
**Locations:** City, Park

---

${pages}
`;
}

// ---------------------------------------------------------------------------
// Unit tests: parseChapterScript
// ---------------------------------------------------------------------------

describe('parseChapterScript', () => {
  it('parses a minimal valid script (1 page, 1 panel)', () => {
    const chapter = parseChapterScript(minimalScript());
    expect(chapter.chapterNumber).toBe(1);
    expect(chapter.title).toBe('Test Chapter');
    expect(chapter.pages).toHaveLength(1);
    expect(chapter.pages[0]!.panels).toHaveLength(1);
    expect(chapter.pages[0]!.panels[0]!.shotType).toBe('Wide');
    expect(chapter.pages[0]!.panels[0]!.action).toBe('Establishing shot of the city.');
    expect(chapter.pages[0]!.panels[0]!.dialogue).toEqual([]);
    expect(chapter.pages[0]!.panels[0]!.sfx).toBe('');
  });

  it('parses a page with 4 panels with all fields', () => {
    const md = minimalScript({
      pages: `## Page 1

### Panel 1 \u2014 Wide

**Action:** Wide shot of the skyline.
**Dialogue:** \u2014
**SFX:** BOOM
**Notes:** Establishing shot.

### Panel 2 \u2014 Medium

**Action:** Character runs through the crowd.
**Dialogue:**
- ALPHA: "Let's go!"
**SFX:** \u2014
**Notes:** Dynamic movement.

### Panel 3 \u2014 Close-up

**Action:** Face shot of Alpha.
**Dialogue:**
- ALPHA (thought): *I need to hurry...*
**SFX:** \u2014
**Notes:** Show determination.

### Panel 4 \u2014 Medium-Wide

**Action:** Alpha arrives at the gate.
**Dialogue:**
- ALPHA: "Made it."
- BETA: "Barely."
**SFX:** CLANG
**Notes:** Relief and tension.`,
    });

    const chapter = parseChapterScript(md);
    const page = chapter.pages[0]!;
    expect(page.panels).toHaveLength(4);

    expect(page.panels[0]!.shotType).toBe('Wide');
    expect(page.panels[0]!.sfx).toBe('BOOM');
    expect(page.panels[0]!.notes).toBe('Establishing shot.');

    expect(page.panels[1]!.shotType).toBe('Medium');
    expect(page.panels[1]!.dialogue).toHaveLength(1);
    expect(page.panels[1]!.dialogue[0]!.character).toBe('ALPHA');
    expect(page.panels[1]!.dialogue[0]!.line).toBe("Let's go!");
    expect(page.panels[1]!.dialogue[0]!.type).toBe('speech');

    expect(page.panels[2]!.shotType).toBe('Close-up');
    expect(page.panels[2]!.dialogue).toHaveLength(1);
    expect(page.panels[2]!.dialogue[0]!.type).toBe('thought');
    expect(page.panels[2]!.dialogue[0]!.line).toBe('I need to hurry...');

    expect(page.panels[3]!.shotType).toBe('Medium-Wide');
    expect(page.panels[3]!.dialogue).toHaveLength(2);
    expect(page.panels[3]!.sfx).toBe('CLANG');
  });

  it('parses dialogue with speech, thought, and narration types', () => {
    const md = minimalScript({
      pages: `## Page 1

### Panel 1 \u2014 Wide

**Action:** Scene with mixed dialogue.
**Dialogue:**
- ALPHA: "Regular speech."
- ALPHA (thought): *Internal thought.*
- (narration): *The city burned.*
- BETA (off-panel): "I'm over here!"
**SFX:** \u2014
**Notes:** Mixed dialogue types.`,
    });

    const chapter = parseChapterScript(md);
    const dialogue = chapter.pages[0]!.panels[0]!.dialogue;
    expect(dialogue).toHaveLength(4);

    expect(dialogue[0]).toEqual({
      character: 'ALPHA',
      line: 'Regular speech.',
      type: 'speech',
    });
    expect(dialogue[1]).toEqual({
      character: 'ALPHA',
      line: 'Internal thought.',
      type: 'thought',
    });
    expect(dialogue[2]).toEqual({
      character: 'Narrator',
      line: 'The city burned.',
      type: 'narration',
    });
    // off-panel is speech, not a separate type
    expect(dialogue[3]).toEqual({
      character: 'BETA',
      line: "I'm over here!",
      type: 'speech',
    });
  });

  it('parses silent panel (dialogue: em-dash) as empty array', () => {
    const md = minimalScript({
      pages: `## Page 1

### Panel 1 \u2014 Wide

**Action:** Silent establishing shot.
**Dialogue:** \u2014
**SFX:** \u2014
**Notes:** No dialogue.`,
    });

    const chapter = parseChapterScript(md);
    expect(chapter.pages[0]!.panels[0]!.dialogue).toEqual([]);
    expect(chapter.pages[0]!.panels[0]!.sfx).toBe('');
  });

  it('parses splash page with isSplash true', () => {
    const md = minimalScript({
      pages: `## Page 1

### Panel 1 \u2014 Wide

**Action:** Normal page.
**Dialogue:** \u2014
**SFX:** \u2014
**Notes:** Normal.

---

## Page 2 \u2014 SPLASH PAGE

### Panel 1 \u2014 Full Page

**Action:** Massive cinematic moment.
**Dialogue:** \u2014
**SFX:** \u2014
**Notes:** Splash page notes.`,
    });

    const chapter = parseChapterScript(md);
    expect(chapter.pages).toHaveLength(2);
    expect(chapter.pages[1]!.isSplash).toBe(true);
    expect(chapter.pages[1]!.isDoubleSpread).toBe(false);
    expect(chapter.pages[1]!.panels).toHaveLength(1);
    expect(chapter.pages[1]!.panels[0]!.shotType).toBe('Full Page');
  });

  it('parses double spread with isDoubleSpread true', () => {
    const md = minimalScript({
      pages: `## Page 1

### Panel 1 \u2014 Wide

**Action:** Normal page.
**Dialogue:** \u2014
**SFX:** \u2014
**Notes:** Normal.

---

## Page 2 \u2014 DOUBLE-PAGE SPREAD (Pages 2-3)

### Panel 1 \u2014 Full Double Spread

**Action:** Panoramic alien landscape.
**Dialogue:**
- ALPHA: "...That's Earth."
**SFX:** \u2014
**Notes:** Double spread reveal.`,
    });

    const chapter = parseChapterScript(md);
    expect(chapter.pages).toHaveLength(2);
    expect(chapter.pages[1]!.isDoubleSpread).toBe(true);
    expect(chapter.pages[1]!.isSplash).toBe(false);
    expect(chapter.pages[1]!.panels).toHaveLength(1);
    expect(chapter.pages[1]!.panels[0]!.shotType).toBe('Full Double Spread');
  });

  it('parses header metadata (themeBeat, characters, locations)', () => {
    const chapter = parseChapterScript(minimalScript());
    expect(chapter.themeBeat).toBe('A test theme beat.');
    expect(chapter.estimatedPages).toBe(24);
    expect(chapter.characters).toEqual(['Alpha', 'Beta']);
    expect(chapter.locations).toEqual(['City', 'Park']);
  });

  it('stops parsing at End Hook section', () => {
    const md = minimalScript({
      pages: `## Page 1

### Panel 1 \u2014 Wide

**Action:** Only page.
**Dialogue:** \u2014
**SFX:** \u2014
**Notes:** The only page.

---

## End Hook

Content after end hook should be ignored.

## Director's Notes

More ignored content.`,
    });

    const chapter = parseChapterScript(md);
    expect(chapter.pages).toHaveLength(1);
  });

  it('captures PLAYER DECISION POINT tag from blockquote', () => {
    const md = minimalScript({
      pages: `## Page 1

### Panel 1 \u2014 Wide

**Action:** Battle scene.
**Dialogue:** \u2014
**SFX:** \u2014
**Notes:** Battle.

> **[PLAYER DECISION POINT]** \u2014 *1st Battle tutorial*`,
    });

    const chapter = parseChapterScript(md);
    expect(chapter.pages[0]!.panels[0]!.tags).toContain('PLAYER DECISION POINT');
  });

  it('captures PAGE-TURN REVEAL tag from H2 heading', () => {
    const md = minimalScript({
      pages: `## Page 1

### Panel 1 \u2014 Wide

**Action:** Normal page.
**Dialogue:** \u2014
**SFX:** \u2014
**Notes:** Normal.

---

## Page 2 [PAGE-TURN REVEAL]

### Panel 1 \u2014 Medium

**Action:** Reveal moment.
**Dialogue:** \u2014
**SFX:** \u2014
**Notes:** Reveal.`,
    });

    const chapter = parseChapterScript(md);
    expect(chapter.pages).toHaveLength(2);
    // PAGE-TURN REVEAL should be on the first panel's tags
    expect(chapter.pages[1]!.panels[0]!.tags).toContain('PAGE-TURN REVEAL');
  });
});

// ---------------------------------------------------------------------------
// Integration test: real chapter-01-script.md
// ---------------------------------------------------------------------------

describe('parseChapterScript (chapter-01-script.md)', () => {
  it('parses chapter 1 with 28 page headings, correct title and number', () => {
    // The script has 28 ## Page headings. Page 25 is a double-page spread
    // covering pages 25-26, so there is no separate "## Page 26" heading.
    const md = readChapter01();
    const chapter = parseChapterScript(md);

    expect(chapter.chapterNumber).toBe(1);
    expect(chapter.title).toBe('The Exam');
    expect(chapter.pages).toHaveLength(28);
    // Verify page 25 exists as double-spread covering 25-26
    const page25 = chapter.pages.find((p) => p.pageNumber === 25);
    expect(page25).toBeDefined();
    expect(page25!.isDoubleSpread).toBe(true);
    // Page 26 is not a separate heading
    expect(chapter.pages.find((p) => p.pageNumber === 26)).toBeUndefined();
  });

  it('extracts metadata from chapter 1 header', () => {
    const md = readChapter01();
    const chapter = parseChapterScript(md);

    expect(chapter.themeBeat).toContain('lone wolf');
    expect(chapter.estimatedPages).toBe(48);
    expect(chapter.characters.length).toBeGreaterThan(0);
    expect(chapter.characters).toContain('Spyke');
    expect(chapter.locations.length).toBeGreaterThan(0);
  });

  it('page 23 is a splash page with 1 panel', () => {
    const md = readChapter01();
    const chapter = parseChapterScript(md);
    const page23 = chapter.pages.find((p) => p.pageNumber === 23);

    expect(page23).toBeDefined();
    expect(page23!.isSplash).toBe(true);
    expect(page23!.panels).toHaveLength(1);
    expect(page23!.panels[0]!.shotType).toBe('Full Page');
  });

  it('page 25 is a double-page spread', () => {
    const md = readChapter01();
    const chapter = parseChapterScript(md);
    const page25 = chapter.pages.find((p) => p.pageNumber === 25);

    expect(page25).toBeDefined();
    expect(page25!.isDoubleSpread).toBe(true);
    expect(page25!.panels).toHaveLength(1);
    expect(page25!.panels[0]!.shotType).toBe('Full Double Spread');
  });

  it('page 22 has PAGE-TURN REVEAL tag', () => {
    const md = readChapter01();
    const chapter = parseChapterScript(md);
    const page22 = chapter.pages.find((p) => p.pageNumber === 22);

    expect(page22).toBeDefined();
    // The tag should be on the first panel
    expect(page22!.panels[0]!.tags).toContain('PAGE-TURN REVEAL');
  });

  it('page 24 panel 1 has shot type Black', () => {
    const md = readChapter01();
    const chapter = parseChapterScript(md);
    const page24 = chapter.pages.find((p) => p.pageNumber === 24);

    expect(page24).toBeDefined();
    expect(page24!.panels[0]!.shotType).toBe('Black');
  });

  it('page 4 has PLAYER DECISION POINT tag on last panel', () => {
    const md = readChapter01();
    const chapter = parseChapterScript(md);
    const page4 = chapter.pages.find((p) => p.pageNumber === 4);

    expect(page4).toBeDefined();
    const lastPanel = page4!.panels[page4!.panels.length - 1]!;
    expect(lastPanel.tags).toContain('PLAYER DECISION POINT');
  });

  it('correctly distinguishes speech, thought, and narration dialogue', () => {
    const md = readChapter01();
    const chapter = parseChapterScript(md);

    // Page 1 Panel 3: SPYKE (thought) - should be thought type
    const page1 = chapter.pages.find((p) => p.pageNumber === 1)!;
    const panel3 = page1.panels.find((p) => p.panelNumber === 3)!;
    expect(panel3.dialogue).toHaveLength(1);
    expect(panel3.dialogue[0]!.type).toBe('thought');
    expect(panel3.dialogue[0]!.character).toBe('SPYKE');

    // Page 7 Panel 1: narration - should be narration type
    const page7 = chapter.pages.find((p) => p.pageNumber === 7)!;
    const p7panel1 = page7.panels.find((p) => p.panelNumber === 1)!;
    const narration = p7panel1.dialogue.find((d) => d.type === 'narration');
    expect(narration).toBeDefined();
    expect(narration!.character).toBe('Narrator');

    // Page 3 Panel 2: PUNK 1 (off-panel) - should be speech type
    const page3 = chapter.pages.find((p) => p.pageNumber === 3)!;
    const p3panel2 = page3.panels.find((p) => p.panelNumber === 2)!;
    expect(p3panel2.dialogue).toHaveLength(1);
    expect(p3panel2.dialogue[0]!.type).toBe('speech');
    expect(p3panel2.dialogue[0]!.character).toBe('PUNK 1');
  });

  it('all panels have required fields populated', () => {
    const md = readChapter01();
    const chapter = parseChapterScript(md);

    for (const page of chapter.pages) {
      for (const panel of page.panels) {
        expect(panel.panelNumber).toBeGreaterThan(0);
        expect(panel.shotType.length).toBeGreaterThan(0);
        expect(panel.action.length).toBeGreaterThan(0);
        expect(Array.isArray(panel.dialogue)).toBe(true);
        expect(typeof panel.sfx).toBe('string');
        expect(typeof panel.notes).toBe('string');
        expect(Array.isArray(panel.tags)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Validation tests
// ---------------------------------------------------------------------------

describe('validateChapter', () => {
  it('validates a well-formed chapter as valid', () => {
    const md = readChapter01();
    const chapter = parseChapterScript(md);
    const result = validateChapter(chapter);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns warnings for pages with unusual panel counts', () => {
    const md = readChapter01();
    const chapter = parseChapterScript(md);
    const result = validateChapter(chapter);

    // Chapter 1 has pages with varying panel counts, some outside 4-7 range
    // Pages with 1-3 or 8+ panels should generate warnings
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns error for chapter with no Wide shots', () => {
    const md = minimalScript({
      pages: `## Page 1

### Panel 1 \u2014 Close-up

**Action:** Close shot only.
**Dialogue:** \u2014
**SFX:** \u2014
**Notes:** No wide shots anywhere.`,
    });

    const chapter = parseChapterScript(md);
    const result = validateChapter(chapter);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
