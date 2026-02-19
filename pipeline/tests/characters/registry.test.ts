import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CharacterRegistry, loadCharacterRegistry } from '../../src/characters/registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARACTER_DATA_DIR = path.resolve(__dirname, '../../data/characters');

describe('CharacterRegistry', () => {
  let registry: CharacterRegistry;

  beforeAll(async () => {
    registry = await loadCharacterRegistry(CHARACTER_DATA_DIR);
  });

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  it('loadAll loads all YAML files from data/characters/', () => {
    expect(registry.size).toBeGreaterThan(0);
  });

  it('registry size returns correct count of unique characters (5)', () => {
    expect(registry.size).toBe(5);
  });

  // -------------------------------------------------------------------------
  // Case-insensitive lookup by name/alias/id
  // -------------------------------------------------------------------------

  it('get("spyke") returns Spyke character data', () => {
    const char = registry.get('spyke');
    expect(char).toBeDefined();
    expect(char!.id).toBe('spyke-tinwall');
    expect(char!.name).toBe('Spyke Tinwall');
  });

  it('get("SPYKE") returns the same data (case-insensitive)', () => {
    const lower = registry.get('spyke');
    const upper = registry.get('SPYKE');
    expect(upper).toBeDefined();
    expect(upper!.id).toBe(lower!.id);
    expect(upper!.fingerprint).toBe(lower!.fingerprint);
  });

  it('get("spyke-tinwall") returns the same data (by id)', () => {
    const byAlias = registry.get('spyke');
    const byId = registry.get('spyke-tinwall');
    expect(byId).toBeDefined();
    expect(byId!.id).toBe(byAlias!.id);
  });

  // -------------------------------------------------------------------------
  // getFingerprint
  // -------------------------------------------------------------------------

  it('getFingerprint("June") returns a string containing expected text', () => {
    const fp = registry.getFingerprint('June');
    expect(typeof fp).toBe('string');
    expect(fp).toContain('June');
  });

  it('getFingerprint("unknown-character") throws Error', () => {
    expect(() => registry.getFingerprint('unknown-character')).toThrow(
      'Unknown character: unknown-character',
    );
  });

  // -------------------------------------------------------------------------
  // getReferenceSheetPrompt
  // -------------------------------------------------------------------------

  it('getReferenceSheetPrompt("Spyke") returns a string containing "reference sheet"', () => {
    const prompt = registry.getReferenceSheetPrompt('Spyke');
    expect(typeof prompt).toBe('string');
    expect(prompt!.toLowerCase()).toContain('reference sheet');
  });

  it('getReferenceSheetPrompt("unknown-character") throws Error', () => {
    expect(() => registry.getReferenceSheetPrompt('unknown-character')).toThrow(
      'Unknown character: unknown-character',
    );
  });

  // -------------------------------------------------------------------------
  // has
  // -------------------------------------------------------------------------

  it('has("Hood") returns true', () => {
    expect(registry.has('Hood')).toBe(true);
  });

  it('has("Morkain") returns true (alias lookup)', () => {
    expect(registry.has('Morkain')).toBe(true);
  });

  it('has("nonexistent") returns false', () => {
    expect(registry.has('nonexistent')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // getAll
  // -------------------------------------------------------------------------

  it('getAll() returns 5 unique characters (not duplicated by aliases)', () => {
    const all = registry.getAll();
    expect(all).toHaveLength(5);
    const ids = all.map((c) => c.id);
    expect(new Set(ids).size).toBe(5);
  });

  it('getAll() includes all expected characters', () => {
    const all = registry.getAll();
    const ids = all.map((c) => c.id).sort();
    expect(ids).toEqual([
      'draster',
      'hood-morkain',
      'june-kamara',
      'punks',
      'spyke-tinwall',
    ]);
  });

  // -------------------------------------------------------------------------
  // Cross-alias consistency
  // -------------------------------------------------------------------------

  it('all Spyke aliases resolve to the same character', () => {
    const aliases = ['Spyke', 'SPYKE', 'spyke-tinwall', 'Redhead', 'Spyke Tinwall'];
    const fingerprints = aliases.map((a) => registry.getFingerprint(a));
    const unique = new Set(fingerprints);
    expect(unique.size).toBe(1);
  });

  it('all Hood aliases resolve to the same character', () => {
    const aliases = ['Hood', 'HOOD', 'Morkain', 'MORKAIN', 'Hood (Morkain)'];
    const fingerprints = aliases.map((a) => registry.getFingerprint(a));
    const unique = new Set(fingerprints);
    expect(unique.size).toBe(1);
  });
});
