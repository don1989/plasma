import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  panelImageFilename,
  parsePanelImageFilename,
  nextVersion,
} from '../../src/generation/naming.js';

describe('panelImageFilename', () => {
  it('formats chapter 1, page 3, version 1 as ch01_p003_v1.png', () => {
    expect(panelImageFilename(1, 3, 1)).toBe('ch01_p003_v1.png');
  });

  it('formats chapter 12, page 28, version 3 as ch12_p028_v3.png', () => {
    expect(panelImageFilename(12, 28, 3)).toBe('ch12_p028_v3.png');
  });

  it('supports jpg extension', () => {
    expect(panelImageFilename(1, 1, 1, 'jpg')).toBe('ch01_p001_v1.jpg');
  });
});

describe('parsePanelImageFilename', () => {
  it('parses a valid panel image filename', () => {
    const result = parsePanelImageFilename('ch01_p003_v1.png');
    expect(result).toEqual({
      chapter: 1,
      page: 3,
      version: 1,
      filename: 'ch01_p003_v1.png',
      extension: 'png',
    });
  });

  it('returns null for non-matching filenames', () => {
    expect(parsePanelImageFilename('not-a-panel.png')).toBeNull();
  });

  it('parses jpeg extension correctly', () => {
    const result = parsePanelImageFilename('ch01_p003_v1.jpeg');
    expect(result).toEqual({
      chapter: 1,
      page: 3,
      version: 1,
      filename: 'ch01_p003_v1.jpeg',
      extension: 'jpeg',
    });
  });
});

describe('nextVersion', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `naming-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns 1 for an empty directory', () => {
    expect(nextVersion(tempDir, 1, 3)).toBe(1);
  });

  it('returns 2 when v1 exists', () => {
    writeFileSync(join(tempDir, 'ch01_p003_v1.png'), '');
    expect(nextVersion(tempDir, 1, 3)).toBe(2);
  });

  it('returns max+1 when multiple versions exist', () => {
    writeFileSync(join(tempDir, 'ch01_p003_v1.png'), '');
    writeFileSync(join(tempDir, 'ch01_p003_v2.png'), '');
    writeFileSync(join(tempDir, 'ch01_p003_v3.png'), '');
    expect(nextVersion(tempDir, 1, 3)).toBe(4);
  });

  it('returns 1 for a non-existent directory', () => {
    const nonExistent = join(tempDir, 'does-not-exist');
    expect(nextVersion(nonExistent, 1, 3)).toBe(1);
  });
});
