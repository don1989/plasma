import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScript } from '../../src/stages/script.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'output', 'ch-01');
const OUTPUT_JSON = resolve(OUTPUT_DIR, 'script.json');

// Only remove script.json if this test created it; the real chapter parse is
// an input to the plan stage and must survive a test run.
let existedBefore = false;
beforeEach(() => {
  existedBefore = existsSync(OUTPUT_JSON);
});
afterEach(async () => {
  if (!existedBefore && existsSync(OUTPUT_JSON)) {
    await rm(OUTPUT_JSON);
  }
});

describe('runScript', () => {
  it('returns a StageResult with the correct shape', async () => {
    const result = await runScript({ chapter: 1, dryRun: true });
    expect(result).toHaveProperty('stage');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('outputFiles');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('duration');
  });

  it('returns stage name as "script"', async () => {
    const result = await runScript({ chapter: 1, dryRun: true });
    expect(result.stage).toBe('script');
  });

  it('returns a positive duration', async () => {
    const result = await runScript({ chapter: 1, dryRun: true });
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe('number');
  });

  it('returns error for non-existent chapter', async () => {
    const result = await runScript({ chapter: 99 });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Script file not found');
  });

  it('with dryRun parses but does not write file', async () => {
    const before = existsSync(OUTPUT_JSON) ? (await stat(OUTPUT_JSON)).mtimeMs : null;
    const result = await runScript({ chapter: 1, dryRun: true });
    expect(result.success).toBe(true);
    expect(result.outputFiles).toHaveLength(0);
    // Either the file still does not exist, or a pre-existing one was left untouched.
    const after = existsSync(OUTPUT_JSON) ? (await stat(OUTPUT_JSON)).mtimeMs : null;
    expect(after).toBe(before);
  });
});

describe('runScript (integration)', () => {
  it('reads chapter-01-script.md and produces valid JSON output', async () => {
    const result = await runScript({ chapter: 1 });
    expect(result.success).toBe(true);
    expect(result.outputFiles).toHaveLength(1);
    expect(result.outputFiles[0]).toContain('script.json');

    // Verify the file was written
    expect(existsSync(OUTPUT_JSON)).toBe(true);

    // Read and verify content
    const json = JSON.parse(await readFile(OUTPUT_JSON, 'utf-8'));
    expect(json.chapterNumber).toBe(1);
    expect(json.title).toBe('The Exam');
    expect(json.pages).toHaveLength(28);
  });

  it('returns correct outputFiles path', async () => {
    const result = await runScript({ chapter: 1 });
    expect(result.success).toBe(true);
    expect(result.outputFiles[0]).toMatch(/output\/ch-01\/script\.json$/);
  });

  it('verbose mode logs parse summary without error', async () => {
    const result = await runScript({ chapter: 1, verbose: true });
    expect(result.success).toBe(true);
  });
});
