import { describe, it, expect } from 'vitest';
import { runScript } from '../../src/stages/script.js';

describe('runScript', () => {
  it('returns a StageResult with the correct shape', async () => {
    const result = await runScript({ chapter: 1 });
    expect(result).toHaveProperty('stage');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('outputFiles');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('duration');
  });

  it('returns success: true for stub implementation', async () => {
    const result = await runScript({ chapter: 1 });
    expect(result.success).toBe(true);
  });

  it('returns stage name as "script"', async () => {
    const result = await runScript({ chapter: 1 });
    expect(result.stage).toBe('script');
  });

  it('returns a positive duration', async () => {
    const result = await runScript({ chapter: 1 });
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe('number');
  });
});
