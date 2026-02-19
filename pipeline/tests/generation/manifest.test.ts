import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hashPrompt,
  loadManifest,
  saveManifest,
  addEntry,
  getApprovedEntry,
} from '../../src/generation/manifest.js';
import type { GenerationLogEntry, GenerationManifest } from '../../src/types/generation.js';

/** Create a realistic test entry. */
function makeEntry(overrides: Partial<GenerationLogEntry> = {}): GenerationLogEntry {
  return {
    imageFile: 'ch01_p003_v1.png',
    promptFile: 'prompts/ch01_p003.txt',
    promptHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123de',
    model: 'gemini-2.5-flash-image',
    timestamp: '2026-02-19T12:00:00Z',
    version: 1,
    approved: false,
    ...overrides,
  };
}

describe('hashPrompt', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const hash = hashPrompt('test prompt');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hashPrompt('prompt one');
    const hash2 = hashPrompt('prompt two');
    expect(hash1).not.toBe(hash2);
  });

  it('produces identical hashes for identical inputs (deterministic)', () => {
    const hash1 = hashPrompt('same prompt');
    const hash2 = hashPrompt('same prompt');
    expect(hash1).toBe(hash2);
  });
});

describe('manifest I/O', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `manifest-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('loadManifest returns empty manifest when file does not exist', async () => {
    const manifest = await loadManifest(tempDir, 1);
    expect(manifest.chapter).toBe(1);
    expect(manifest.pipelineVersion).toBeTruthy();
    expect(manifest.entries).toEqual([]);
  });

  it('loadManifest parses existing JSON manifest file correctly', async () => {
    const existing: GenerationManifest = {
      chapter: 5,
      pipelineVersion: '0.1.0',
      entries: [makeEntry({ imageFile: 'ch05_p001_v1.png' })],
    };
    const manifestPath = join(tempDir, 'generation-log.json');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(manifestPath, JSON.stringify(existing, null, 2));

    const loaded = await loadManifest(tempDir, 5);
    expect(loaded.chapter).toBe(5);
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0]!.imageFile).toBe('ch05_p001_v1.png');
  });

  it('saveManifest writes valid JSON to disk', async () => {
    const manifest: GenerationManifest = {
      chapter: 1,
      pipelineVersion: '0.1.0',
      entries: [makeEntry()],
    };
    await saveManifest(tempDir, manifest);

    const filePath = join(tempDir, 'generation-log.json');
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.chapter).toBe(1);
    expect(parsed.entries).toHaveLength(1);
  });

  it('saveManifest then loadManifest round-trips correctly', async () => {
    const manifest: GenerationManifest = {
      chapter: 3,
      pipelineVersion: '0.1.0',
      entries: [
        makeEntry({ imageFile: 'ch03_p001_v1.png', approved: true }),
        makeEntry({ imageFile: 'ch03_p002_v1.png', version: 1 }),
      ],
    };
    await saveManifest(tempDir, manifest);
    const loaded = await loadManifest(tempDir, 3);

    expect(loaded).toEqual(manifest);
  });

  it('addEntry appends an entry and persists to disk', async () => {
    const manifest: GenerationManifest = {
      chapter: 1,
      pipelineVersion: '0.1.0',
      entries: [],
    };
    const entry = makeEntry();
    await addEntry(tempDir, manifest, entry);

    expect(manifest.entries).toHaveLength(1);

    // Verify persisted
    const loaded = await loadManifest(tempDir, 1);
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0]!.imageFile).toBe('ch01_p003_v1.png');
  });

  it('addEntry called twice produces manifest with 2 entries', async () => {
    const manifest: GenerationManifest = {
      chapter: 1,
      pipelineVersion: '0.1.0',
      entries: [],
    };
    await addEntry(tempDir, manifest, makeEntry({ imageFile: 'ch01_p001_v1.png' }));
    await addEntry(tempDir, manifest, makeEntry({ imageFile: 'ch01_p002_v1.png' }));

    expect(manifest.entries).toHaveLength(2);

    const loaded = await loadManifest(tempDir, 1);
    expect(loaded.entries).toHaveLength(2);
  });
});

describe('getApprovedEntry', () => {
  it('returns the approved version for a given page', () => {
    const manifest: GenerationManifest = {
      chapter: 1,
      pipelineVersion: '0.1.0',
      entries: [
        makeEntry({ imageFile: 'ch01_p003_v1.png', approved: false }),
        makeEntry({ imageFile: 'ch01_p003_v2.png', version: 2, approved: true }),
      ],
    };
    const result = getApprovedEntry(manifest, 3);
    expect(result).toBeDefined();
    expect(result!.imageFile).toBe('ch01_p003_v2.png');
    expect(result!.approved).toBe(true);
  });

  it('returns undefined when no approved version exists', () => {
    const manifest: GenerationManifest = {
      chapter: 1,
      pipelineVersion: '0.1.0',
      entries: [
        makeEntry({ imageFile: 'ch01_p003_v1.png', approved: false }),
      ],
    };
    const result = getApprovedEntry(manifest, 3);
    expect(result).toBeUndefined();
  });
});
