import { describe, it, expect } from 'vitest';
import { CharacterFingerprintSchema } from '../../src/schemas/character.schema.js';

// ---------------------------------------------------------------------------
// Helper — reusable valid character data
// ---------------------------------------------------------------------------

function validCharacter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'kael-driftborn',
    name: 'Kael Driftborn',
    aliases: ['Kael', 'The Drifter'],
    fingerprint:
      'Young man, early 20s, dark brown skin, short locs, amber eyes. ' +
      'Wears a weathered grey diving suit with bioluminescent blue patches.',
    reference_sheet_prompt: 'Full body turnaround of Kael Driftborn...',
    palette: {
      primary: ['#3B2F2F', '#1E3A5F'],
      accent: ['#00D4FF', '#FFB347'],
    },
    variants: {
      combat: 'Kael in full combat gear with helmet visor down.',
      casual: 'Kael in worn civilian clothes, locs loose.',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Valid data tests
// ---------------------------------------------------------------------------

describe('CharacterFingerprintSchema', () => {
  it('validates a character with all fields populated', () => {
    const result = CharacterFingerprintSchema.safeParse(validCharacter());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('kael-driftborn');
      expect(result.data.aliases).toEqual(['Kael', 'The Drifter']);
    }
  });

  it('validates a character with optional fields omitted', () => {
    const minimal = {
      id: 'mira-thorn',
      name: 'Mira Thorn',
      fingerprint: 'Tall woman with silver hair and mechanical arm prosthetic.',
    };
    const result = CharacterFingerprintSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reference_sheet_prompt).toBeUndefined();
      expect(result.data.palette).toBeUndefined();
      expect(result.data.variants).toBeUndefined();
    }
  });

  it('defaults aliases to empty array when omitted', () => {
    const noAliases = {
      id: 'mira-thorn',
      name: 'Mira Thorn',
      fingerprint: 'Tall woman with silver hair and mechanical arm prosthetic.',
    };
    const result = CharacterFingerprintSchema.safeParse(noAliases);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aliases).toEqual([]);
    }
  });

  // ---------------------------------------------------------------------------
  // Validation failure tests
  // ---------------------------------------------------------------------------

  it('rejects a character with short fingerprint (< 20 chars)', () => {
    const result = CharacterFingerprintSchema.safeParse(
      validCharacter({ fingerprint: 'Too short.' })
    );
    expect(result.success).toBe(false);
  });

  it('rejects a character with invalid id (uppercase, spaces)', () => {
    const result = CharacterFingerprintSchema.safeParse(
      validCharacter({ id: 'Kael Driftborn' })
    );
    expect(result.success).toBe(false);
  });

  it('rejects a character with missing name', () => {
    const result = CharacterFingerprintSchema.safeParse(
      validCharacter({ name: '' })
    );
    expect(result.success).toBe(false);
  });

  it('rejects a character with id containing special characters', () => {
    const result = CharacterFingerprintSchema.safeParse(
      validCharacter({ id: 'kael_driftborn!' })
    );
    expect(result.success).toBe(false);
  });
});
