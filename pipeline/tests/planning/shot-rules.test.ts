import { describe, it, expect } from 'vitest';
import { aspectForShot, assignSpeakerSides, pickEmphasisPanel } from '../../src/planning/shot-rules.js';

describe('aspectForShot', () => {
  it('maps shot types', () => {
    expect(aspectForShot('Wide')).toBe('16:9');
    expect(aspectForShot('Medium-Wide')).toBe('4:3');
    expect(aspectForShot('Medium')).toBe('3:4');
    expect(aspectForShot('Close-up')).toBe('1:1');
    expect(aspectForShot('Extreme Close-up')).toBe('1:1');
    expect(aspectForShot('Two-shot')).toBe('3:4');
  });
  it('is case-insensitive', () => {
    expect(aspectForShot('wide')).toBe('16:9');
  });
});

describe('assignSpeakerSides', () => {
  it('first speaker left, second right, others alternate', () => {
    const sides = assignSpeakerSides(
      [{ character: 'SPYKE', line: 'a', type: 'speech' },
       { character: 'PUNK 1', line: 'b', type: 'speech' },
       { character: 'SPYKE', line: 'c', type: 'speech' },
       { character: 'JUNE', line: 'd', type: 'speech' }],
      ['SPYKE', 'PUNK 1', 'JUNE'],
    );
    expect(sides).toEqual({ SPYKE: 'left', 'PUNK 1': 'right', JUNE: 'left' });
  });
  it('skips narration and speakers not on the panel', () => {
    const sides = assignSpeakerSides(
      [{ character: 'Narrator', line: 'x', type: 'narration' },
       { character: 'INTERCOM', line: 'y', type: 'speech' },
       { character: 'SPYKE', line: 'z', type: 'thought' }],
      ['SPYKE'],
    );
    expect(sides).toEqual({ SPYKE: 'left' });
  });
});

describe('pickEmphasisPanel', () => {
  const p = (n: number, lines: number, notes = '') => ({ panelNumber: n, dialogueCount: lines, notes });
  it('picks the panel with the most dialogue', () => {
    expect(pickEmphasisPanel([p(1, 0), p(2, 3), p(3, 1)])).toBe(2);
  });
  it('breaks ties with reveal/beat/! notes', () => {
    expect(pickEmphasisPanel([p(1, 1), p(2, 1, 'The reveal.'), p(3, 1)])).toBe(2);
  });
  it('falls back to the last panel', () => {
    expect(pickEmphasisPanel([p(1, 0), p(2, 0), p(3, 0)])).toBe(3);
  });
});
