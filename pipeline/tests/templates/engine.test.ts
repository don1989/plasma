import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPromptEngine } from '../../src/templates/engine.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TEMPLATE_DIR = resolve(__dirname, '..', '..', 'data', 'templates');

describe('createPromptEngine', () => {
  it('creates a valid Nunjucks Environment', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    expect(env).toBeDefined();
    expect(typeof env.render).toBe('function');
    expect(typeof env.renderString).toBe('function');
  });

  it('rendering style-prefix.njk returns the exact verbatim text', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    const result = env.render('partials/style-prefix.njk');
    expect(result).toBe(
      'Colored manga page, cel-shaded, clean linework, vibrant colors, dynamic panel layout.'
    );
  });

  it('rendering setting-description.njk with a setting variable returns "Setting: {value}"', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    const result = env.render('partials/setting-description.njk', {
      setting: 'Year 3031, sci-fi London',
    });
    expect(result).toBe('Setting: Year 3031, sci-fi London');
  });

  it('rendering character-block.njk wraps fingerprint with "Character:" label', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    const result = env.render('partials/character-block.njk', {
      fingerprint: 'Spyke — spiky ginger hair, red bandana',
    });
    expect(result).toBe('Character: Spyke — spiky ginger hair, red bandana');
  });

  it('rendering page-prompt.njk with mock data produces expected output', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    const result = env.render('page-prompt.njk', {
      has_establishing_shot: false,
      setting: '',
      panel_count: 2,
      layout_description: 'vertical layout',
      panels: [
        {
          panelNumber: 1,
          shotType: 'wide',
          position: 'top half of page',
          action: 'An establishing shot of the city.',
          character_fingerprints: ['Spyke — spiky ginger hair'],
          dialogue_lines: [
            { character: 'Spyke', line: 'Hello!', type: 'speech' },
          ],
          sfx: 'BOOM',
          notes: '',
        },
        {
          panelNumber: 2,
          shotType: 'close-up',
          position: '',
          action: 'Close-up of Spyke.',
          character_fingerprints: [],
          dialogue_lines: [],
          sfx: '',
          notes: 'Focus on expression.',
        },
      ],
    });

    // Verify structure
    expect(result).toContain('Colored manga page, cel-shaded, clean linework, vibrant colors, dynamic panel layout.');
    expect(result).toContain('2-panel vertical layout.');
    expect(result).toContain('PANEL 1 (WIDE');
    expect(result).toContain('PANEL 2 (CLOSE-UP');
    expect(result).toContain('Character: Spyke — spiky ginger hair');
    expect(result).toContain('Speech balloon: Spyke: "Hello!"');
    expect(result).toContain('Stylized SFX text integrated into the panel: "BOOM"');
    expect(result).toContain('Focus on expression.');
    // Should NOT contain setting since has_establishing_shot is false
    expect(result).not.toContain('Setting:');
  });

  it('rendering page-prompt.njk with has_establishing_shot=true includes setting text', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    const result = env.render('page-prompt.njk', {
      has_establishing_shot: true,
      setting: 'Year 3031, sci-fi London — vertical tower city above ocean',
      panel_count: 1,
      layout_description: 'vertical layout',
      panels: [
        {
          panelNumber: 1,
          shotType: 'wide',
          position: '',
          action: 'Establishing shot.',
          character_fingerprints: [],
          dialogue_lines: [],
          sfx: '',
          notes: '',
        },
      ],
    });

    expect(result).toContain('Setting: Year 3031, sci-fi London — vertical tower city above ocean');
  });

  it('rendering page-prompt.njk with has_establishing_shot=false omits setting text', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    const result = env.render('page-prompt.njk', {
      has_establishing_shot: false,
      setting: 'Year 3031, sci-fi London',
      panel_count: 1,
      layout_description: 'vertical layout',
      panels: [
        {
          panelNumber: 1,
          shotType: 'close-up',
          position: '',
          action: 'Close-up shot.',
          character_fingerprints: [],
          dialogue_lines: [],
          sfx: '',
          notes: '',
        },
      ],
    });

    expect(result).not.toContain('Setting:');
  });

  it('throwOnUndefined causes error when a variable is missing', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    expect(() => {
      env.renderString('Hello {{ missing_var }}');
    }).toThrow();
  });

  it('autoescape is disabled (no HTML escaping in prompts)', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    const result = env.renderString('{{ text }}', {
      text: '<strong>bold</strong> & "quoted"',
    });
    // Should NOT be escaped — raw HTML/special chars preserved
    expect(result).toBe('<strong>bold</strong> & "quoted"');
  });

  it('renders thought bubble dialogue correctly', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    const result = env.render('page-prompt.njk', {
      has_establishing_shot: false,
      setting: '',
      panel_count: 1,
      layout_description: 'vertical layout',
      panels: [
        {
          panelNumber: 1,
          shotType: 'medium',
          position: '',
          action: 'Spyke thinks.',
          character_fingerprints: [],
          dialogue_lines: [
            { character: 'Spyke', line: 'I must hurry...', type: 'thought' },
          ],
          sfx: '',
          notes: '',
        },
      ],
    });

    expect(result).toContain('Thought bubble: Spyke: "I must hurry..."');
  });

  it('renders narration box dialogue correctly', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    const result = env.render('page-prompt.njk', {
      has_establishing_shot: false,
      setting: '',
      panel_count: 1,
      layout_description: 'vertical layout',
      panels: [
        {
          panelNumber: 1,
          shotType: 'wide',
          position: '',
          action: 'The train speeds through.',
          character_fingerprints: [],
          dialogue_lines: [
            { character: 'Narrator', line: 'The 9:27 from Kings Cross.', type: 'narration' },
          ],
          sfx: '',
          notes: '',
        },
      ],
    });

    expect(result).toContain('Narration box: "The 9:27 from Kings Cross."');
  });

  it('renders character-sheet.njk with reference sheet prompt', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    const result = env.render('character-sheet.njk', {
      reference_sheet_prompt: 'Colored manga character reference sheet, Spyke Tinwall.',
    });

    expect(result).toContain('Colored manga page, cel-shaded, clean linework, vibrant colors, dynamic panel layout.');
    expect(result).toContain('Colored manga character reference sheet, Spyke Tinwall.');
    expect(result).toContain('Layout:');
    expect(result).toContain('Main Row: Four full-body views: Front View, 3/4 Angle View, Side Profile View, Back View.');
  });

  it('renders panel position with em-dash separator', () => {
    const env = createPromptEngine(TEMPLATE_DIR);
    const result = env.render('page-prompt.njk', {
      has_establishing_shot: false,
      setting: '',
      panel_count: 1,
      layout_description: 'vertical layout',
      panels: [
        {
          panelNumber: 1,
          shotType: 'wide',
          position: 'top half of page',
          action: 'Action here.',
          character_fingerprints: [],
          dialogue_lines: [],
          sfx: '',
          notes: '',
        },
      ],
    });

    expect(result).toContain('PANEL 1 (WIDE \u2014 top half of page): Action here.');
  });
});
