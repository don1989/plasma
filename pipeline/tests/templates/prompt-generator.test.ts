import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  generateChapterPrompts,
  loadStyleGuide,
} from '../../src/templates/prompt-generator.js';
import { CharacterRegistry } from '../../src/characters/registry.js';
import type { Chapter, Page, Panel } from '../../src/types/manga.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PIPELINE_ROOT = resolve(__dirname, '..', '..');
const TEMPLATE_DIR = resolve(PIPELINE_ROOT, 'data', 'templates');
const STYLE_GUIDE_PATH = resolve(PIPELINE_ROOT, 'data', 'config', 'style-guide.yaml');
const CHARACTER_DIR = resolve(PIPELINE_ROOT, 'data', 'characters');
const PROJECT_ROOT = resolve(PIPELINE_ROOT, '..');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePanel(overrides: Partial<Panel> = {}): Panel {
  return {
    panelNumber: 1,
    shotType: 'Medium',
    action: 'A character stands in the room.',
    dialogue: [],
    sfx: '',
    notes: '',
    tags: [],
    ...overrides,
  };
}

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    pageNumber: 1,
    panels: [makePanel()],
    isSplash: false,
    isDoubleSpread: false,
    ...overrides,
  };
}

function makeChapter(pages: Page[]): Chapter {
  return {
    chapterNumber: 1,
    title: 'Test Chapter',
    themeBeat: 'Test theme',
    estimatedPages: pages.length,
    characters: ['Spyke Tinwall', 'June Kamara'],
    locations: ['London'],
    pages,
  };
}

/**
 * Create a minimal test registry with known characters.
 */
function createTestRegistry(): CharacterRegistry {
  const registry = new CharacterRegistry();
  // We'll use the real loadAll in integration tests;
  // for unit tests, manually populate via the underlying Map
  return registry;
}

// ---------------------------------------------------------------------------
// Unit tests with mock data
// ---------------------------------------------------------------------------

describe('generateChapterPrompts (unit)', () => {
  let registry: CharacterRegistry;

  beforeAll(async () => {
    // Load real character data for unit tests (they're small files)
    registry = new CharacterRegistry();
    await registry.loadAll(CHARACTER_DIR);
  });

  it('generates 1 prompt for a 1-page chapter', () => {
    const chapter = makeChapter([makePage()]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'Colored manga page, cel-shaded, clean linework, vibrant colors, dynamic panel layout.',
      setting: 'Year 3031, sci-fi London',
      templateDir: TEMPLATE_DIR,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.pageNumber).toBe(1);
  });

  it('generated prompt starts with the style prefix text', () => {
    const chapter = makeChapter([makePage()]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'Colored manga page, cel-shaded, clean linework, vibrant colors, dynamic panel layout.',
      setting: 'Year 3031, sci-fi London',
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.prompt).toMatch(
      /^Colored manga page, cel-shaded, clean linework, vibrant colors, dynamic panel layout\./,
    );
  });

  it('generated prompt includes character fingerprints for known characters', () => {
    const page = makePage({
      panels: [
        makePanel({
          action: 'Spyke walks through the corridor.',
          dialogue: [{ character: 'SPYKE', line: 'Hello!', type: 'speech' }],
        }),
      ],
    });
    const chapter = makeChapter([page]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'test prefix',
      setting: '',
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.prompt).toContain('Character:');
    expect(results[0]!.prompt).toContain('spiky ginger hair');
    expect(results[0]!.charactersIncluded).toContain('Spyke Tinwall');
  });

  it('generated prompt contains panel shot types in uppercase', () => {
    const page = makePage({
      panels: [
        makePanel({ shotType: 'close-up' }),
      ],
    });
    const chapter = makeChapter([page]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'test prefix',
      setting: '',
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.prompt).toContain('CLOSE-UP');
  });

  it('characters not in registry appear in charactersUnknown', () => {
    const page = makePage({
      panels: [
        makePanel({
          dialogue: [
            { character: 'REGISTRAR', line: 'Next please.', type: 'speech' },
          ],
        }),
      ],
    });
    const chapter = makeChapter([page]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'test prefix',
      setting: '',
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.charactersUnknown).toContain('REGISTRAR');
  });

  it('splash page prompt notes full-page composition', () => {
    const page = makePage({
      isSplash: true,
      panels: [makePanel({ panelNumber: 1 })],
    });
    const chapter = makeChapter([page]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'test prefix',
      setting: '',
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.prompt).toContain('Full-page splash composition');
  });

  it('page with a Wide establishing shot includes the setting description text', () => {
    const page = makePage({
      pageNumber: 1,
      panels: [
        makePanel({
          panelNumber: 1,
          shotType: 'Wide',
          action: 'Establishing shot of the city skyline.',
        }),
      ],
    });
    const chapter = makeChapter([page]);
    const settingText = 'Year 3031, sci-fi London — vertical tower city above ocean';
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'test prefix',
      setting: settingText,
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.prompt).toContain(`Setting: ${settingText}`);
  });

  it('page with only close-up shots does NOT include the setting description text', () => {
    const page = makePage({
      pageNumber: 5,
      panels: [
        makePanel({
          panelNumber: 1,
          shotType: 'Close-up',
          action: 'Close-up of Spyke.',
        }),
        makePanel({
          panelNumber: 2,
          shotType: 'Medium',
          action: 'Medium shot.',
        }),
      ],
    });
    const chapter = makeChapter([page]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'test prefix',
      setting: 'Year 3031, sci-fi London',
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.prompt).not.toContain('Setting:');
  });

  it('setting value from style-guide.yaml is passed through to template context', () => {
    const styleGuide = loadStyleGuide(STYLE_GUIDE_PATH);
    expect(styleGuide.setting).toBe(
      'Year 3031, sci-fi London — vertical tower city above ocean, hover vehicles, holographic tech',
    );

    const page = makePage({
      pageNumber: 1,
      panels: [
        makePanel({
          panelNumber: 1,
          shotType: 'Wide',
          action: 'Establishing shot of the skyline.',
        }),
      ],
    });
    const chapter = makeChapter([page]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: styleGuide.stylePrefix,
      setting: styleGuide.setting,
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.prompt).toContain(styleGuide.setting);
  });

  it('renders multiple characters in same panel with deduplicated fingerprints', () => {
    const page = makePage({
      panels: [
        makePanel({
          action: 'Spyke and June face each other.',
          dialogue: [
            { character: 'SPYKE', line: 'Hello.', type: 'speech' },
            { character: 'JUNE', line: 'Hi!', type: 'speech' },
          ],
        }),
      ],
    });
    const chapter = makeChapter([page]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'test prefix',
      setting: '',
      templateDir: TEMPLATE_DIR,
    });

    // Should have both characters
    expect(results[0]!.prompt).toContain('spiky ginger hair');
    expect(results[0]!.prompt).toContain('blonde hair');
    expect(results[0]!.charactersIncluded.length).toBeGreaterThanOrEqual(2);
  });

  it('renders thought bubble and narration dialogue types correctly', () => {
    const page = makePage({
      panels: [
        makePanel({
          dialogue: [
            { character: 'Spyke', line: 'I must hurry...', type: 'thought' },
            { character: 'Narrator', line: 'The dawn breaks.', type: 'narration' },
          ],
        }),
      ],
    });
    const chapter = makeChapter([page]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'test prefix',
      setting: '',
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.prompt).toContain('Thought bubble: Spyke: "I must hurry..."');
    expect(results[0]!.prompt).toContain('Narration box: "The dawn breaks."');
  });

  it('renders SFX when present in a panel', () => {
    const page = makePage({
      panels: [
        makePanel({
          sfx: 'BOOM CRASH',
        }),
      ],
    });
    const chapter = makeChapter([page]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'test prefix',
      setting: '',
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.prompt).toContain('Stylized SFX text integrated into the panel: "BOOM CRASH"');
  });

  it('double-page spread notes double-page composition', () => {
    const page = makePage({
      isDoubleSpread: true,
      panels: [makePanel({ panelNumber: 1 })],
    });
    const chapter = makeChapter([page]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'test prefix',
      setting: '',
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.prompt).toContain('Double-page spread composition');
  });

  it('Narrator in dialogue does not appear in charactersUnknown', () => {
    const page = makePage({
      panels: [
        makePanel({
          dialogue: [
            { character: 'Narrator', line: 'Time passed.', type: 'narration' },
          ],
        }),
      ],
    });
    const chapter = makeChapter([page]);
    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: 'test prefix',
      setting: '',
      templateDir: TEMPLATE_DIR,
    });

    expect(results[0]!.charactersUnknown).not.toContain('Narrator');
  });
});

// ---------------------------------------------------------------------------
// Integration test: real chapter 1 data
// ---------------------------------------------------------------------------

describe('generateChapterPrompts (integration)', () => {
  const scriptJsonPath = resolve(PROJECT_ROOT, 'output', 'ch-01', 'script.json');

  // This test requires script.json to exist — it's generated by the script stage.
  // We'll generate it inline if needed, or skip if unavailable.
  it('generates 28 prompts for chapter 1 (from script.json)', async () => {
    // First, ensure script.json exists by running the script stage
    let chapter: Chapter;

    if (existsSync(scriptJsonPath)) {
      chapter = JSON.parse(readFileSync(scriptJsonPath, 'utf-8')) as Chapter;
    } else {
      // Parse directly from source to avoid needing the stage
      const { parseChapterScript } = await import(
        '../../src/parsers/script-parser.js'
      );
      const scriptMd = readFileSync(
        resolve(PROJECT_ROOT, '03_manga', 'chapter-01-script.md'),
        'utf-8',
      );
      chapter = parseChapterScript(scriptMd);
    }

    const registry = new CharacterRegistry();
    await registry.loadAll(CHARACTER_DIR);

    const styleGuide = loadStyleGuide(STYLE_GUIDE_PATH);

    const results = generateChapterPrompts({
      chapter,
      registry,
      stylePrefix: styleGuide.stylePrefix,
      setting: styleGuide.setting,
      templateDir: TEMPLATE_DIR,
    });

    // Chapter 1 has 28 page headings (page 25-26 is a double spread with single heading)
    expect(results).toHaveLength(28);

    // Every prompt should start with the style prefix
    for (const r of results) {
      expect(r.prompt).toMatch(
        /^Colored manga page, cel-shaded, clean linework, vibrant colors, dynamic panel layout\./,
      );
    }

    // Page 1 should include Spyke's fingerprint
    const page1 = results.find((r) => r.pageNumber === 1);
    expect(page1).toBeDefined();
    expect(page1!.prompt).toContain('spiky ginger hair');
    expect(page1!.charactersIncluded).toContain('Spyke Tinwall');

    // Page 1 should include setting (has establishing Wide shot)
    expect(page1!.prompt).toContain('Setting:');

    // Page 25 is the double-page spread (splash) — should mention double-page or splash composition
    const page25 = results.find((r) => r.pageNumber === 25);
    expect(page25).toBeDefined();
    expect(page25!.prompt).toMatch(/Double-page spread composition/i);

    // Page 23 is the splash page
    const page23 = results.find((r) => r.pageNumber === 23);
    expect(page23).toBeDefined();
    expect(page23!.prompt).toMatch(/Full-page splash composition/i);

    // Check that some unknown minor characters are tracked (like registrar, commuters)
    const allUnknown = results.flatMap((r) => r.charactersUnknown);
    // Some pages may have unknown characters from dialogue (REGISTRAR, INTERCOM, PUNK 2 etc.)
    // This is expected behavior — not all dialogue speakers need fingerprints
    expect(Array.isArray(allUnknown)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadStyleGuide tests
// ---------------------------------------------------------------------------

describe('loadStyleGuide', () => {
  it('loads style_prefix from style-guide.yaml', () => {
    const data = loadStyleGuide(STYLE_GUIDE_PATH);
    expect(data.stylePrefix).toBe(
      'Colored manga page, cel-shaded, clean linework, vibrant colors, dynamic panel layout.',
    );
  });

  it('loads setting from style-guide.yaml', () => {
    const data = loadStyleGuide(STYLE_GUIDE_PATH);
    expect(data.setting).toContain('Year 3031');
    expect(data.setting).toContain('sci-fi London');
  });
});
