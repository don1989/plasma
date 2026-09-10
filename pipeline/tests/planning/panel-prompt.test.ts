import { describe, it, expect } from 'vitest';
import { buildPanelPrompt } from '../../src/planning/panel-prompt.js';

describe('buildPanelPrompt', () => {
  it('assembles style, action, notes, canon, framing and the no-text closer', () => {
    const p = buildPanelPrompt({
      stylePrefix: 'Colored manga, cel-shaded.',
      action: 'Spyke turns to face the punks.',
      notes: 'Tension.',
      shotType: 'Medium',
      fingerprints: [{ id: 'spyke-tinwall', name: 'Spyke Tinwall', fingerprint: 'Spyke — red bandana' }],
      speakerSides: { SPYKE: 'left', 'PUNK 1': 'right' },
      speakerNames: { SPYKE: 'Spyke Tinwall', 'PUNK 1': 'the punk leader' },
    });
    expect(p.startsWith('Colored manga, cel-shaded.')).toBe(true);
    expect(p).toContain('Spyke turns to face the punks.');
    expect(p).toContain('CHARACTERS');
    expect(p).toContain('Spyke — red bandana');
    expect(p).toContain('Spyke Tinwall on the left of the frame');
    expect(p).toContain('the punk leader on the right of the frame');
    expect(p).toContain('MEDIUM shot');
    expect(p).toContain('NO text');
    expect(p).not.toContain('Tension.\n\nTension.');
  });
  it('omits framing sides when nobody speaks', () => {
    const p = buildPanelPrompt({ stylePrefix: 's', action: 'a', notes: '', shotType: 'Wide', fingerprints: [], speakerSides: {}, speakerNames: {} });
    expect(p).not.toContain('of the frame');
    expect(p).toContain('WIDE shot');
  });
});
