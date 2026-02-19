import { describe, it, expect, afterAll } from 'vitest';
import { isReadableDir, assertSourceDir, ensureDir } from '../../src/utils/fs.js';
import { PATHS } from '../../src/config/paths.js';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';

describe('isReadableDir', () => {
  it('returns true for existing source directories', () => {
    expect(isReadableDir(PATHS.bible)).toBe(true);
    expect(isReadableDir(PATHS.manga)).toBe(true);
  });

  it('returns false for a nonexistent path', () => {
    expect(isReadableDir('/nonexistent/path/that/does/not/exist')).toBe(false);
  });
});

describe('assertSourceDir', () => {
  it('throws for a nonexistent path with a descriptive message', () => {
    expect(() => assertSourceDir('/nonexistent/path', 'Test')).toThrow(
      'Test directory not found or not readable',
    );
  });

  it('does not throw for an existing directory', () => {
    expect(() => assertSourceDir(PATHS.bible, 'Bible')).not.toThrow();
  });
});

describe('ensureDir', () => {
  const testDir = path.join(PATHS.output, '__test_ensureDir__');

  afterAll(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true });
    }
  });

  it('creates a directory that exists afterward', async () => {
    await ensureDir(testDir);
    expect(existsSync(testDir)).toBe(true);
  });
});
