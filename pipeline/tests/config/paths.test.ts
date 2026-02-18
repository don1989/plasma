import { describe, it, expect } from 'vitest';
import { PATHS } from '../../src/config/paths.js';
import { existsSync } from 'node:fs';
import path from 'node:path';

describe('PATHS', () => {
  it('resolves bible directory to existing path', () => {
    expect(PATHS.bible).toContain('01_bible');
    expect(existsSync(PATHS.bible)).toBe(true);
  });

  it('resolves manga directory to existing path', () => {
    expect(PATHS.manga).toContain('03_manga');
    expect(existsSync(PATHS.manga)).toBe(true);
  });

  it('output directory is at project root level', () => {
    // output/ should be a sibling of 01_bible/, not inside pipeline/
    const outputParent = path.dirname(PATHS.output);
    const bibleParent = path.dirname(PATHS.bible);
    expect(outputParent).toBe(bibleParent);
  });

  it('generates chapter output paths correctly', () => {
    const ch1 = PATHS.chapterOutput(1);
    expect(ch1.root).toContain('ch-01');
    expect(ch1.raw).toContain(path.join('ch-01', 'raw'));
    expect(ch1.processed).toContain(path.join('ch-01', 'processed'));
    expect(ch1.lettered).toContain(path.join('ch-01', 'lettered'));
    expect(ch1.webtoon).toContain(path.join('ch-01', 'webtoon'));
  });
});
