import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  validateApiKey,
  saveGeneratedImage,
  sleep,
  generateImage,
} from '../../src/generation/gemini-client.js';
import type { GeminiImageResult } from '../../src/generation/gemini-client.js';

// Mock the @google/genai SDK
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent,
    };
  },
}));

describe('validateApiKey', () => {
  it('throws on undefined', () => {
    expect(() => validateApiKey(undefined)).toThrow('GEMINI_API_KEY is not set');
  });

  it('throws on empty string', () => {
    expect(() => validateApiKey('')).toThrow('GEMINI_API_KEY is not set');
  });

  it('throws on whitespace-only string', () => {
    expect(() => validateApiKey('   ')).toThrow('GEMINI_API_KEY is not set');
  });

  it('returns trimmed key for valid input', () => {
    expect(validateApiKey('  my-api-key  ')).toBe('my-api-key');
  });

  it('returns key unchanged when already trimmed', () => {
    expect(validateApiKey('valid-key-123')).toBe('valid-key-123');
  });
});

describe('saveGeneratedImage', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `gemini-save-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('writes buffer to disk correctly', async () => {
    const testData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const result: GeminiImageResult = {
      imageBuffer: testData,
      mimeType: 'image/png',
    };
    const destPath = join(tempDir, 'test-image.png');

    await saveGeneratedImage(result, destPath);

    expect(existsSync(destPath)).toBe(true);
    const written = readFileSync(destPath);
    expect(Buffer.compare(written, testData)).toBe(0);
  });
});

describe('sleep', () => {
  it('resolves after approximately the specified delay', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow small timing variance
  });
});

describe('generateImage', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('throws meaningful error when API call fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API connection failed'));

    await expect(
      generateImage({
        prompt: 'test prompt',
        apiKey: 'test-key',
      }),
    ).rejects.toThrow('API connection failed');
  });

  it('throws when response has no image parts', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: 'Here is some text but no image' }],
          },
        },
      ],
    });

    await expect(
      generateImage({
        prompt: 'test prompt',
        apiKey: 'test-key',
      }),
    ).rejects.toThrow('No image data in Gemini response');
  });

  it('returns image buffer and mime type on success', async () => {
    const fakeImageBase64 = Buffer.from('fake-image-data').toString('base64');

    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: fakeImageBase64,
                  mimeType: 'image/png',
                },
              },
            ],
          },
        },
      ],
    });

    const result = await generateImage({
      prompt: 'test prompt',
      apiKey: 'test-key',
    });

    expect(result.mimeType).toBe('image/png');
    expect(result.imageBuffer).toEqual(Buffer.from('fake-image-data'));
  });

  it('defaults mimeType to image/png when not provided', async () => {
    const fakeImageBase64 = Buffer.from('data').toString('base64');

    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: fakeImageBase64,
                  // No mimeType provided
                },
              },
            ],
          },
        },
      ],
    });

    const result = await generateImage({
      prompt: 'test prompt',
      apiKey: 'test-key',
    });

    expect(result.mimeType).toBe('image/png');
  });

  it('throws when response has no candidates', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [],
    });

    await expect(
      generateImage({
        prompt: 'test prompt',
        apiKey: 'test-key',
      }),
    ).rejects.toThrow('No image data in Gemini response');
  });
});
