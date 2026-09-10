import { describe, it, expect } from 'vitest';
import { parseFaces } from '../../src/generation/vision.js';

describe('parseFaces', () => {
  it('converts 0-1000 grid boxes to normalised rects and drops junk', () => {
    const r = parseFaces('```json\n{"faces":[{"ymin":100,"xmin":200,"ymax":300,"xmax":400},{"ymin":1,"xmin":1,"ymax":2,"xmax":2},{"bad":1}]}');
    expect(r).toEqual([{ x: 0.2, y: 0.1, w: 0.2, h: 0.2 }]);
  });
  it('returns [] on garbage', () => {
    expect(parseFaces('not json')).toEqual([]);
  });
});
