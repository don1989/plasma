/** Tests for the balloon SVG's selectable tail side and geometry. */
import { describe, it, expect } from 'vitest';
import { generateBalloonSvg, generateBalloonShapeSvg } from '../../src/overlay/balloon.js';

const font = { family: 'sans-serif', size: 14 };

function polygonPoints(svg: string): Array<[number, number]> {
  const m = /<polygon points="([^"]+)"/.exec(svg);
  if (!m) throw new Error('no polygon in svg');
  return m[1]!.trim().split(/\s+/).map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return [x!, y!];
  });
}

describe('generateBalloonSvg tail', () => {
  it("draws no tail for 'none' and keeps total height equal to the body height", () => {
    const svg = generateBalloonSvg('Hi', 120, 60, 'speech', font, 'none').toString();
    expect(svg).not.toContain('<polygon');
    expect(svg).toContain('height="60"');
  });

  it("places a 'right' tail further right than a 'left' tail", () => {
    const left = polygonPoints(generateBalloonSvg('Hi', 200, 80, 'speech', font, 'left').toString());
    const right = polygonPoints(generateBalloonSvg('Hi', 200, 80, 'speech', font, 'right').toString());
    expect(right[0]![0]).toBeGreaterThan(left[0]![0]);
    expect(right[2]![0]).toBeGreaterThan(left[2]![0]);
  });

  it('keeps the tail base inside the ellipse on a small 60x60 balloon', () => {
    const w = 60, h = 60;
    const cx = w / 2, cy = h / 2, rx = w / 2 - 3, ry = h / 2 - 3;
    for (const side of ['left', 'right'] as const) {
      const pts = polygonPoints(generateBalloonSvg('Hi', w, h, 'speech', font, side).toString());
      const [b1, b2, tip] = pts;
      for (const [x, y] of [b1!, b2!]) {
        expect(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2).toBeLessThanOrEqual(1);
      }
      expect(tip![1]).toBe(h + 30);
    }
  });
});

describe('generateBalloonShapeSvg', () => {
  it('draws the shape and tail with no text element', () => {
    const svg = generateBalloonShapeSvg(200, 80, 'speech', 'left').toString();
    expect(svg).not.toContain('<text');
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('height="110"'); // body + 30 px tail
  });

  it('matches the legacy balloon tail geometry', () => {
    const shape = polygonPoints(generateBalloonShapeSvg(200, 80, 'speech', 'right').toString());
    const legacy = polygonPoints(generateBalloonSvg('Hi', 200, 80, 'speech', font, 'right').toString());
    expect(shape).toEqual(legacy);
  });

  it('draws a rounded box without a tail for narration', () => {
    const svg = generateBalloonShapeSvg(200, 80, 'narration', 'left').toString();
    expect(svg).toContain('<rect');
    expect(svg).not.toContain('<polygon');
    expect(svg).toContain('height="80"');
  });
});
