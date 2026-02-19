import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

import { runGenerate } from '../../src/stages/generate.js';
import { saveManifest, loadManifest } from '../../src/generation/manifest.js';
import type { GenerationManifest } from '../../src/types/generation.js';

/** Create a real 10x10 PNG test image. */
async function createTestImage(dir: string, filename: string = 'test.png'): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, filename);
  await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toFile(filePath);
  return filePath;
}

describe('runGenerate - manual import mode', () => {
  let tempDir: string;
  let sourceDir: string;
  let chapterDir: string;
  let rawDir: string;
  let promptsDir: string;

  // Mock PATHS to use our temp directory
  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `gen-stage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    sourceDir = join(tempDir, 'downloads');
    chapterDir = join(tempDir, 'ch-01');
    rawDir = join(chapterDir, 'raw');
    promptsDir = join(chapterDir, 'prompts');

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(promptsDir, { recursive: true });

    // Mock PATHS.chapterOutput to return our temp paths
    const pathsMod = await import('../../src/config/paths.js');
    vi.spyOn(pathsMod.PATHS, 'chapterOutput').mockReturnValue({
      root: chapterDir,
      raw: rawDir,
      processed: join(chapterDir, 'processed'),
      lettered: join(chapterDir, 'lettered'),
      webtoon: join(chapterDir, 'webtoon'),
      prompts: promptsDir,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('imports image and updates manifest when --import and --page are set', async () => {
    const sourcePath = await createTestImage(sourceDir);
    writeFileSync(join(promptsDir, 'page-03.txt'), 'test prompt text');

    const result = await runGenerate({
      chapter: 1,
      mode: 'manual',
      importPath: sourcePath,
      page: 3,
    });

    expect(result.success).toBe(true);
    expect(result.stage).toBe('generate');
    expect(result.outputFiles).toHaveLength(1);
    expect(result.outputFiles[0]).toContain('ch01_p003_v1.png');

    // Verify manifest was updated
    const manifest = await loadManifest(chapterDir, 1);
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]!.model).toBe('manual');
    expect(manifest.entries[0]!.imageFile).toBe('ch01_p003_v1.png');
  });

  it('displays prompt files when no --import is set', async () => {
    // Create prompt files
    writeFileSync(join(promptsDir, 'page-01.txt'), 'Prompt for page 1');
    writeFileSync(join(promptsDir, 'page-02.txt'), 'Prompt for page 2');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runGenerate({
      chapter: 1,
      mode: 'manual',
    });

    expect(result.success).toBe(true);
    expect(result.outputFiles).toHaveLength(0);

    // Check that prompts were displayed
    const logCalls = consoleSpy.mock.calls.map((c) => c[0]);
    expect(logCalls.some((msg) => typeof msg === 'string' && msg.includes('PAGE 1'))).toBe(true);
    expect(logCalls.some((msg) => typeof msg === 'string' && msg.includes('PAGE 2'))).toBe(true);

    consoleSpy.mockRestore();
  });

  it('filters prompts by --pages option', async () => {
    writeFileSync(join(promptsDir, 'page-01.txt'), 'Prompt 1');
    writeFileSync(join(promptsDir, 'page-02.txt'), 'Prompt 2');
    writeFileSync(join(promptsDir, 'page-03.txt'), 'Prompt 3');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runGenerate({
      chapter: 1,
      mode: 'manual',
      pages: [2],
    });

    expect(result.success).toBe(true);

    const logCalls = consoleSpy.mock.calls.map((c) => c[0]);
    expect(logCalls.some((msg) => typeof msg === 'string' && msg.includes('PAGE 2'))).toBe(true);
    expect(logCalls.some((msg) => typeof msg === 'string' && msg.includes('PAGE 1'))).toBe(false);
    expect(logCalls.some((msg) => typeof msg === 'string' && msg.includes('PAGE 3'))).toBe(false);

    consoleSpy.mockRestore();
  });
});

describe('runGenerate - approve mode', () => {
  let tempDir: string;
  let chapterDir: string;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `gen-approve-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    chapterDir = join(tempDir, 'ch-01');
    mkdirSync(chapterDir, { recursive: true });

    const pathsMod = await import('../../src/config/paths.js');
    vi.spyOn(pathsMod.PATHS, 'chapterOutput').mockReturnValue({
      root: chapterDir,
      raw: join(chapterDir, 'raw'),
      processed: join(chapterDir, 'processed'),
      lettered: join(chapterDir, 'lettered'),
      webtoon: join(chapterDir, 'webtoon'),
      prompts: join(chapterDir, 'prompts'),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('marks entry as approved in manifest', async () => {
    const manifest: GenerationManifest = {
      chapter: 1,
      pipelineVersion: '0.1.0',
      entries: [
        {
          imageFile: 'ch01_p003_v1.png',
          promptFile: 'prompts/page-03.txt',
          promptHash: 'abc',
          model: 'manual',
          timestamp: '2026-02-19T12:00:00Z',
          version: 1,
          approved: false,
        },
      ],
    };
    await saveManifest(chapterDir, manifest);

    const result = await runGenerate({
      chapter: 1,
      mode: 'manual',
      approve: 'ch01_p003_v1.png',
    });

    expect(result.success).toBe(true);

    const loaded = await loadManifest(chapterDir, 1);
    expect(loaded.entries[0]!.approved).toBe(true);
  });

  it('returns failure when approve target is not in manifest', async () => {
    const manifest: GenerationManifest = {
      chapter: 1,
      pipelineVersion: '0.1.0',
      entries: [],
    };
    await saveManifest(chapterDir, manifest);

    const result = await runGenerate({
      chapter: 1,
      mode: 'manual',
      approve: 'ch01_p099_v1.png',
    });

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('not found in manifest');
  });
});

describe('runGenerate - API mode', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `gen-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const chapterDir = join(tempDir, 'ch-01');
    mkdirSync(chapterDir, { recursive: true });

    const pathsMod = await import('../../src/config/paths.js');
    vi.spyOn(pathsMod.PATHS, 'chapterOutput').mockReturnValue({
      root: chapterDir,
      raw: join(chapterDir, 'raw'),
      processed: join(chapterDir, 'processed'),
      lettered: join(chapterDir, 'lettered'),
      webtoon: join(chapterDir, 'webtoon'),
      prompts: join(chapterDir, 'prompts'),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns not-yet-implemented message for API mode', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runGenerate({
      chapter: 1,
      mode: 'api',
    });

    expect(result.success).toBe(true);
    expect(result.outputFiles).toHaveLength(0);

    const logCalls = consoleSpy.mock.calls.map((c) => c[0]);
    expect(logCalls.some((msg) => typeof msg === 'string' && msg.includes('API mode not yet implemented'))).toBe(true);

    consoleSpy.mockRestore();
  });
});
