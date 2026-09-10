import { describe, it, expect } from 'vitest';
import { PagePlanSchema, ChapterPlanSchema } from '../../src/types/page-plan.js';

describe('page plan schema', () => {
  it('accepts a minimal valid page plan', () => {
    const page = {
      pageNumber: 3,
      isSplash: false,
      layout: { canvas: { w: 1600, h: 2264 }, slots: [{ panelNumber: 1, x: 60, y: 60, w: 1480, h: 900 }] },
      panels: [{
        panelNumber: 1,
        shotType: 'Medium',
        aspectRatio: '3:4',
        characterIds: ['spyke-tinwall'],
        speakerSides: { SPYKE: 'left' },
        dialogue: [{ character: 'SPYKE', line: 'Don\'t touch me.', type: 'speech' }],
        sfx: '',
        prompt: 'Spyke turns.',
        promptHash: 'abc',
        versions: [],
        approvedVersion: null,
      }],
    };
    expect(PagePlanSchema.parse(page).panels[0]!.approvedVersion).toBeNull();
  });

  it('rejects an unknown aspect ratio', () => {
    const bad = { pageNumber: 1, isSplash: false, layout: { canvas: { w: 1, h: 1 }, slots: [] },
      panels: [{ panelNumber: 1, shotType: 'Wide', aspectRatio: '5:7', characterIds: [], speakerSides: {},
        dialogue: [], sfx: '', prompt: 'x', promptHash: 'h', versions: [], approvedVersion: null }] };
    expect(() => PagePlanSchema.parse(bad)).toThrow();
  });

  it('wraps pages in a chapter plan', () => {
    const chapter = { chapterNumber: 1, canvas: { w: 1600, h: 2264 }, pages: [] };
    expect(ChapterPlanSchema.parse(chapter).pages).toEqual([]);
  });
});
