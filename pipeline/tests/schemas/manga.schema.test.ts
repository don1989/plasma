import { describe, it, expect } from 'vitest';
import {
  DialogueLineSchema,
  PanelSchema,
  PageSchema,
  ChapterSchema,
  checkPagePanelCountWarnings,
} from '../../src/schemas/manga.schema.js';

// ---------------------------------------------------------------------------
// Helpers — reusable valid data builders
// ---------------------------------------------------------------------------

function validDialogue(overrides = {}) {
  return {
    character: 'Kael',
    line: 'We need to move.',
    type: 'speech' as const,
    ...overrides,
  };
}

function validPanel(overrides: Record<string, unknown> = {}) {
  return {
    panelNumber: 1,
    shotType: 'Wide',
    action: 'Kael strides across the flooding rooftop.',
    dialogue: [validDialogue()],
    sfx: '',
    notes: '',
    tags: ['action'],
    ...overrides,
  };
}

function validPage(overrides: Record<string, unknown> = {}) {
  return {
    pageNumber: 1,
    panels: [
      validPanel({ panelNumber: 1 }),
      validPanel({ panelNumber: 2, shotType: 'Medium' }),
      validPanel({ panelNumber: 3, shotType: 'Close-up' }),
      validPanel({ panelNumber: 4, shotType: 'Medium-Wide' }),
    ],
    isSplash: false,
    isDoubleSpread: false,
    ...overrides,
  };
}

function validChapter(overrides: Record<string, unknown> = {}) {
  return {
    chapterNumber: 1,
    title: 'The Drift',
    themeBeat: 'Introduction to the flooded world',
    estimatedPages: 24,
    characters: ['Kael', 'Mira'],
    locations: ['Rooftop', 'Submerged City'],
    pages: [validPage()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DialogueLine tests
// ---------------------------------------------------------------------------

describe('DialogueLineSchema', () => {
  it('validates a dialogue line with thought type', () => {
    const result = DialogueLineSchema.safeParse(
      validDialogue({ type: 'thought' })
    );
    expect(result.success).toBe(true);
  });

  it('validates a narration dialogue line', () => {
    const result = DialogueLineSchema.safeParse(
      validDialogue({ type: 'narration', character: 'Narrator' })
    );
    expect(result.success).toBe(true);
  });

  it('rejects invalid dialogue type', () => {
    const result = DialogueLineSchema.safeParse(
      validDialogue({ type: 'whisper' })
    );
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Panel tests
// ---------------------------------------------------------------------------

describe('PanelSchema', () => {
  it('validates a panel with all fields populated', () => {
    const result = PanelSchema.safeParse(validPanel());
    expect(result.success).toBe(true);
  });

  it('rejects a panel with empty action', () => {
    const result = PanelSchema.safeParse(validPanel({ action: '' }));
    expect(result.success).toBe(false);
  });

  it('accepts compound shot types like "Wide (Action)"', () => {
    const result = PanelSchema.safeParse(
      validPanel({ shotType: 'Wide (Action)' })
    );
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Page tests
// ---------------------------------------------------------------------------

describe('PageSchema', () => {
  it('validates a standard page with 4-7 panels', () => {
    const result = PageSchema.safeParse(validPage());
    expect(result.success).toBe(true);
  });

  it('validates a splash page with 1 panel', () => {
    const result = PageSchema.safeParse(
      validPage({
        isSplash: true,
        panels: [validPanel({ shotType: 'Full Page' })],
      })
    );
    expect(result.success).toBe(true);
  });

  it('rejects a splash page with more than 1 panel', () => {
    const result = PageSchema.safeParse(
      validPage({
        isSplash: true,
        panels: [validPanel({ panelNumber: 1 }), validPanel({ panelNumber: 2 })],
      })
    );
    expect(result.success).toBe(false);
  });

  it('rejects a standard page with 0 panels', () => {
    const result = PageSchema.safeParse(
      validPage({ panels: [] })
    );
    expect(result.success).toBe(false);
  });

  it('accepts a standard page with 2 panels (action montage)', () => {
    // Action montages may have fewer panels — warning only, not rejection
    const result = PageSchema.safeParse(
      validPage({
        panels: [validPanel({ panelNumber: 1 }), validPanel({ panelNumber: 2 })],
      })
    );
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Page warning check
// ---------------------------------------------------------------------------

describe('checkPagePanelCountWarnings', () => {
  it('returns no warnings for standard page in 4-7 range', () => {
    const page = PageSchema.parse(validPage());
    expect(checkPagePanelCountWarnings(page)).toEqual([]);
  });

  it('returns warning for standard page with 2 panels', () => {
    const page = PageSchema.parse(
      validPage({
        panels: [validPanel({ panelNumber: 1 }), validPanel({ panelNumber: 2 })],
      })
    );
    const warnings = checkPagePanelCountWarnings(page);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('outside typical');
  });

  it('returns no warnings for splash page with 1 panel', () => {
    const page = PageSchema.parse(
      validPage({ isSplash: true, panels: [validPanel()] })
    );
    expect(checkPagePanelCountWarnings(page)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Chapter tests
// ---------------------------------------------------------------------------

describe('ChapterSchema', () => {
  it('validates a chapter with at least one Wide shot', () => {
    const result = ChapterSchema.safeParse(validChapter());
    expect(result.success).toBe(true);
  });

  it('rejects a chapter with no Wide shot type', () => {
    const noWidePage = validPage({
      panels: [
        validPanel({ panelNumber: 1, shotType: 'Close-up' }),
        validPanel({ panelNumber: 2, shotType: 'Medium' }),
        validPanel({ panelNumber: 3, shotType: 'Close-up' }),
        validPanel({ panelNumber: 4, shotType: 'Medium' }),
      ],
    });
    const result = ChapterSchema.safeParse(
      validChapter({ pages: [noWidePage] })
    );
    expect(result.success).toBe(false);
  });

  it('accepts a chapter with "Wide (Action)" compound shot type', () => {
    const compoundPage = validPage({
      panels: [
        validPanel({ panelNumber: 1, shotType: 'Wide (Action)' }),
        validPanel({ panelNumber: 2, shotType: 'Medium' }),
        validPanel({ panelNumber: 3, shotType: 'Close-up' }),
        validPanel({ panelNumber: 4, shotType: 'Medium' }),
      ],
    });
    const result = ChapterSchema.safeParse(
      validChapter({ pages: [compoundPage] })
    );
    expect(result.success).toBe(true);
  });
});
