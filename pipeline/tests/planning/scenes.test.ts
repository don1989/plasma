import { describe, it, expect } from 'vitest';
import { findScene } from '../../src/planning/scenes.js';

const scenes = [
  { pages: [2, 2] as [number, number], panels: [1, 2], locationId: 'walkway' },
  { pages: [2, 6] as [number, number], locationId: 'park' },
];

describe('findScene', () => {
  it('prefers a panel-specific entry over the page range', () => {
    expect(findScene(scenes, 2, 1)?.locationId).toBe('walkway');
    expect(findScene(scenes, 2, 3)?.locationId).toBe('park');
  });
  it('matches page ranges inclusively and returns undefined outside', () => {
    expect(findScene(scenes, 6, 1)?.locationId).toBe('park');
    expect(findScene(scenes, 7, 1)).toBeUndefined();
  });
});
