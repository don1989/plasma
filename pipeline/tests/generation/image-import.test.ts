import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

import { importImage, approveImage } from '../../src/generation/image-import.js';
import { saveManifest, loadManifest, addEntry } from '../../src/generation/manifest.js';
import type { GenerationManifest } from '../../src/types/generation.js';

/** Create a real 10x10 PNG test image in the given directory. */
async function createTestImage(dir: string, filename: string = 'test.png'): Promise<string> {
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

/** Create a real 10x10 JPEG test image. */
async function createTestJpeg(dir: string, filename: string = 'test.jpg'): Promise<string> {
  const filePath = join(dir, filename);
  await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 3,
      background: { r: 0, g: 255, b: 0 },
    },
  })
    .jpeg()
    .toFile(filePath);
  return filePath;
}

describe('importImage', () => {
  let tempDir: string;
  let sourceDir: string;
  let rawDir: string;
  let promptsDir: string;
  let chapterDir: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    sourceDir = join(tempDir, 'downloads');
    chapterDir = join(tempDir, 'ch-01');
    rawDir = join(chapterDir, 'raw');
    promptsDir = join(chapterDir, 'prompts');

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(promptsDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('copies file to raw/ with correct naming convention', async () => {
    const sourcePath = await createTestImage(sourceDir);
    writeFileSync(join(promptsDir, 'page-03.txt'), 'test prompt');

    const result = await importImage({
      sourcePath,
      chapter: 1,
      page: 3,
      rawDir,
      promptsDir,
      chapterDir,
    });

    expect(result.entry.imageFile).toBe('ch01_p003_v1.png');
    expect(existsSync(result.destPath)).toBe(true);
    expect(result.destPath).toContain('raw');
  });

  it('does not delete the source file (copy, not move)', async () => {
    const sourcePath = await createTestImage(sourceDir);
    writeFileSync(join(promptsDir, 'page-01.txt'), 'prompt text');

    await importImage({
      sourcePath,
      chapter: 1,
      page: 1,
      rawDir,
      promptsDir,
      chapterDir,
    });

    expect(existsSync(sourcePath)).toBe(true);
  });

  it('returns a GenerationLogEntry with model="manual"', async () => {
    const sourcePath = await createTestImage(sourceDir);
    writeFileSync(join(promptsDir, 'page-05.txt'), 'some prompt');

    const result = await importImage({
      sourcePath,
      chapter: 1,
      page: 5,
      rawDir,
      promptsDir,
      chapterDir,
    });

    expect(result.entry.model).toBe('manual');
    expect(result.entry.approved).toBe(false);
    expect(result.entry.version).toBe(1);
    expect(result.entry.timestamp).toBeTruthy();
  });

  it('reads and hashes the corresponding prompt file', async () => {
    const sourcePath = await createTestImage(sourceDir);
    writeFileSync(join(promptsDir, 'page-03.txt'), 'specific prompt text');

    const result = await importImage({
      sourcePath,
      chapter: 1,
      page: 3,
      rawDir,
      promptsDir,
      chapterDir,
    });

    expect(result.entry.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.entry.promptFile).toBe('prompts/page-03.txt');
    expect(result.entry.promptText).toBe('specific prompt text');
  });

  it('auto-increments version when file already exists in raw/', async () => {
    mkdirSync(rawDir, { recursive: true });
    // Create an existing v1 file
    await createTestImage(rawDir, 'ch01_p003_v1.png');

    const sourcePath = await createTestImage(sourceDir, 'second.png');
    writeFileSync(join(promptsDir, 'page-03.txt'), 'prompt');

    const result = await importImage({
      sourcePath,
      chapter: 1,
      page: 3,
      rawDir,
      promptsDir,
      chapterDir,
    });

    expect(result.entry.imageFile).toBe('ch01_p003_v2.png');
    expect(result.entry.version).toBe(2);
    expect(existsSync(join(rawDir, 'ch01_p003_v2.png'))).toBe(true);
  });

  it('throws on non-existent source file', async () => {
    await expect(
      importImage({
        sourcePath: '/nonexistent/path/image.png',
        chapter: 1,
        page: 1,
        rawDir,
        promptsDir,
        chapterDir,
      }),
    ).rejects.toThrow('Source file not found');
  });

  it('creates raw/ directory if it does not exist', async () => {
    expect(existsSync(rawDir)).toBe(false);

    const sourcePath = await createTestImage(sourceDir);
    writeFileSync(join(promptsDir, 'page-01.txt'), 'prompt');

    await importImage({
      sourcePath,
      chapter: 1,
      page: 1,
      rawDir,
      promptsDir,
      chapterDir,
    });

    expect(existsSync(rawDir)).toBe(true);
  });

  it('handles missing prompt file gracefully (empty hash, no promptText)', async () => {
    const sourcePath = await createTestImage(sourceDir);
    // No prompt file created for page 10

    const result = await importImage({
      sourcePath,
      chapter: 1,
      page: 10,
      rawDir,
      promptsDir,
      chapterDir,
    });

    // Should still succeed
    expect(result.entry.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.entry.promptFile).toBe('');
    expect(result.entry.promptText).toBeUndefined();
  });

  it('normalizes jpeg extension to jpg', async () => {
    const sourcePath = await createTestJpeg(sourceDir, 'photo.jpg');
    writeFileSync(join(promptsDir, 'page-02.txt'), 'prompt');

    const result = await importImage({
      sourcePath,
      chapter: 1,
      page: 2,
      rawDir,
      promptsDir,
      chapterDir,
    });

    expect(result.entry.imageFile).toBe('ch01_p002_v1.jpg');
  });

  it('stores notes in the entry when provided', async () => {
    const sourcePath = await createTestImage(sourceDir);
    writeFileSync(join(promptsDir, 'page-01.txt'), 'prompt');

    const result = await importImage({
      sourcePath,
      chapter: 1,
      page: 1,
      rawDir,
      promptsDir,
      chapterDir,
      notes: 'good composition but colors are off',
    });

    expect(result.entry.notes).toBe('good composition but colors are off');
  });
});

describe('approveImage', () => {
  let tempDir: string;
  let chapterDir: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `approve-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    chapterDir = join(tempDir, 'ch-01');
    mkdirSync(chapterDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('sets approved=true on the specified entry', async () => {
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

    await approveImage({ imageFile: 'ch01_p003_v1.png', chapterDir });

    const loaded = await loadManifest(chapterDir, 1);
    const entry = loaded.entries.find((e) => e.imageFile === 'ch01_p003_v1.png');
    expect(entry?.approved).toBe(true);
  });

  it('unapproves other versions of the same page', async () => {
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
          approved: true,
        },
        {
          imageFile: 'ch01_p003_v2.png',
          promptFile: 'prompts/page-03.txt',
          promptHash: 'abc',
          model: 'manual',
          timestamp: '2026-02-19T12:01:00Z',
          version: 2,
          approved: false,
        },
      ],
    };
    await saveManifest(chapterDir, manifest);

    // Approve v2 -- v1 should become unapproved
    await approveImage({ imageFile: 'ch01_p003_v2.png', chapterDir });

    const loaded = await loadManifest(chapterDir, 1);
    const v1 = loaded.entries.find((e) => e.imageFile === 'ch01_p003_v1.png');
    const v2 = loaded.entries.find((e) => e.imageFile === 'ch01_p003_v2.png');
    expect(v1?.approved).toBe(false);
    expect(v2?.approved).toBe(true);
  });

  it('throws when image is not found in manifest', async () => {
    const manifest: GenerationManifest = {
      chapter: 1,
      pipelineVersion: '0.1.0',
      entries: [],
    };
    await saveManifest(chapterDir, manifest);

    await expect(
      approveImage({ imageFile: 'ch01_p099_v1.png', chapterDir }),
    ).rejects.toThrow('Image not found in manifest');
  });

  it('throws on invalid image filename format', async () => {
    await expect(
      approveImage({ imageFile: 'bad-name.png', chapterDir }),
    ).rejects.toThrow('Invalid image filename format');
  });
});
