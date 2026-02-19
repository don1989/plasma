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

import { runGenerate } from '../../src/stages/generate.js';
import { loadManifest } from '../../src/generation/manifest.js';

// Use vi.hoisted so mock fns are available before vi.mock is hoisted
const { mockGenerateImage, mockSaveGeneratedImage, mockSleep } = vi.hoisted(() => ({
  mockGenerateImage: vi.fn(),
  mockSaveGeneratedImage: vi.fn(),
  mockSleep: vi.fn(),
}));

vi.mock('../../src/generation/gemini-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/generation/gemini-client.js')>();
  return {
    ...actual,
    generateImage: mockGenerateImage,
    saveGeneratedImage: mockSaveGeneratedImage,
    sleep: mockSleep,
  };
});

describe('runGenerate - API mode', () => {
  let tempDir: string;
  let chapterDir: string;
  let rawDir: string;
  let promptsDir: string;

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `gen-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    chapterDir = join(tempDir, 'ch-01');
    rawDir = join(chapterDir, 'raw');
    promptsDir = join(chapterDir, 'prompts');

    mkdirSync(promptsDir, { recursive: true });
    mkdirSync(rawDir, { recursive: true });

    // Mock PATHS to use temp directory
    const pathsMod = await import('../../src/config/paths.js');
    vi.spyOn(pathsMod.PATHS, 'chapterOutput').mockReturnValue({
      root: chapterDir,
      raw: rawDir,
      processed: join(chapterDir, 'processed'),
      lettered: join(chapterDir, 'lettered'),
      webtoon: join(chapterDir, 'webtoon'),
      prompts: promptsDir,
    });

    // Mock pipelineRoot for .env loading (point to temp dir so no real .env is found)
    Object.defineProperty(pathsMod.PATHS, 'pipelineRoot', {
      value: tempDir,
      writable: true,
      configurable: true,
    });

    // Reset mocks
    mockGenerateImage.mockReset();
    mockSaveGeneratedImage.mockReset();
    mockSleep.mockReset();
    mockSleep.mockResolvedValue(undefined);

    // Default mock: successful image generation
    mockGenerateImage.mockResolvedValue({
      imageBuffer: Buffer.from('fake-png-data'),
      mimeType: 'image/png',
    });
    mockSaveGeneratedImage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    // Clean up env var if set
    delete process.env['GEMINI_API_KEY'];
  });

  it('generates image and updates manifest with valid API key', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key-123';
    writeFileSync(join(promptsDir, 'page-01.txt'), 'Generate a manga panel');

    const result = await runGenerate({
      chapter: 1,
      mode: 'api',
    });

    expect(result.success).toBe(true);
    expect(result.outputFiles).toHaveLength(1);
    expect(result.outputFiles[0]).toContain('ch01_p001_v1.png');

    // Verify manifest was updated
    const manifest = await loadManifest(chapterDir, 1);
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]!.imageFile).toBe('ch01_p001_v1.png');
    expect(manifest.entries[0]!.model).toBe('gemini-2.5-flash-image');
    expect(manifest.entries[0]!.approved).toBe(false);
    expect(manifest.entries[0]!.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.entries[0]!.promptText).toBe('Generate a manga panel');
  });

  it('only generates specified pages when --pages is set', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key-123';
    writeFileSync(join(promptsDir, 'page-01.txt'), 'Prompt 1');
    writeFileSync(join(promptsDir, 'page-02.txt'), 'Prompt 2');
    writeFileSync(join(promptsDir, 'page-03.txt'), 'Prompt 3');

    const result = await runGenerate({
      chapter: 1,
      mode: 'api',
      pages: [2],
    });

    expect(result.success).toBe(true);
    expect(result.outputFiles).toHaveLength(1);
    expect(result.outputFiles[0]).toContain('ch01_p002_v1.png');

    // generateImage should only be called once (for page 2)
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
  });

  it('returns failure with descriptive error when API key is missing', async () => {
    delete process.env['GEMINI_API_KEY'];
    writeFileSync(join(promptsDir, 'page-01.txt'), 'Prompt 1');

    const result = await runGenerate({
      chapter: 1,
      mode: 'api',
    });

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('GEMINI_API_KEY is not set');
  });

  it('continues with remaining pages when one page errors', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key-123';
    writeFileSync(join(promptsDir, 'page-01.txt'), 'Prompt 1');
    writeFileSync(join(promptsDir, 'page-02.txt'), 'Prompt 2');
    writeFileSync(join(promptsDir, 'page-03.txt'), 'Prompt 3');

    // First call fails, second and third succeed
    mockGenerateImage
      .mockRejectedValueOnce(new Error('Random API error'))
      .mockResolvedValueOnce({
        imageBuffer: Buffer.from('fake-png-data'),
        mimeType: 'image/png',
      })
      .mockResolvedValueOnce({
        imageBuffer: Buffer.from('fake-png-data'),
        mimeType: 'image/png',
      });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await runGenerate({
      chapter: 1,
      mode: 'api',
    });

    // Should have partial success (2 of 3 pages)
    expect(result.success).toBe(false); // has errors
    expect(result.outputFiles).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Page 1');

    consoleSpy.mockRestore();
  });

  it('calls sleep between page generations for rate limiting', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key-123';
    writeFileSync(join(promptsDir, 'page-01.txt'), 'Prompt 1');
    writeFileSync(join(promptsDir, 'page-02.txt'), 'Prompt 2');
    writeFileSync(join(promptsDir, 'page-03.txt'), 'Prompt 3');

    await runGenerate({
      chapter: 1,
      mode: 'api',
    });

    // sleep should be called between pages (2 times for 3 pages)
    expect(mockSleep).toHaveBeenCalledTimes(2);
    expect(mockSleep).toHaveBeenCalledWith(2000); // DEFAULT_RATE_LIMIT_DELAY_MS
  });

  it('records correct model name and prompt hash in manifest entries', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key-123';
    writeFileSync(join(promptsDir, 'page-01.txt'), 'Specific prompt text');

    const result = await runGenerate({
      chapter: 1,
      mode: 'api',
      model: 'gemini-custom-model',
    });

    expect(result.success).toBe(true);

    const manifest = await loadManifest(chapterDir, 1);
    expect(manifest.entries[0]!.model).toBe('gemini-custom-model');
    expect(manifest.entries[0]!.promptHash).toBeTruthy();
    expect(manifest.entries[0]!.timestamp).toBeTruthy();
  });

  it('aborts on permission/billing errors', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key-123';
    writeFileSync(join(promptsDir, 'page-01.txt'), 'Prompt 1');
    writeFileSync(join(promptsDir, 'page-02.txt'), 'Prompt 2');

    mockGenerateImage.mockRejectedValue(new Error('403 permission denied'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await runGenerate({
      chapter: 1,
      mode: 'api',
    });

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('403 permission denied');
    // Should NOT attempt page 2 after permission error
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('dry run shows planned generation without making API calls', async () => {
    process.env['GEMINI_API_KEY'] = 'test-key-123';
    writeFileSync(join(promptsDir, 'page-01.txt'), 'Prompt 1');
    writeFileSync(join(promptsDir, 'page-02.txt'), 'Prompt 2');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await runGenerate({
      chapter: 1,
      mode: 'api',
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.outputFiles).toHaveLength(0);
    // generateImage should NOT be called during dry run
    expect(mockGenerateImage).not.toHaveBeenCalled();

    const logCalls = consoleSpy.mock.calls.map((c) => c[0]);
    expect(
      logCalls.some(
        (msg) => typeof msg === 'string' && msg.includes('Dry run'),
      ),
    ).toBe(true);

    consoleSpy.mockRestore();
  });

  it('reads API key from .env file when env var is not set', async () => {
    delete process.env['GEMINI_API_KEY'];
    // Create a .env file in the mocked pipelineRoot
    writeFileSync(join(tempDir, '.env'), 'GEMINI_API_KEY=file-based-key\n');
    writeFileSync(join(promptsDir, 'page-01.txt'), 'Prompt 1');

    const result = await runGenerate({
      chapter: 1,
      mode: 'api',
    });

    expect(result.success).toBe(true);
    expect(result.outputFiles).toHaveLength(1);

    // Verify the file-based key was used (passed to generateImage)
    expect(mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'file-based-key' }),
    );
  });
});
