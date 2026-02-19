/**
 * Zod validation schemas for character YAML data.
 *
 * Character fingerprints are the verbatim visual description blocks embedded
 * in every Gemini prompt. This schema validates YAML-parsed character data
 * to ensure fingerprints are substantial (min 20 chars) and IDs follow
 * the kebab-case convention.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

export const PaletteSchema = z.object({
  primary: z.array(z.string()),
  accent: z.array(z.string()),
});

export type PaletteData = z.infer<typeof PaletteSchema>;

// ---------------------------------------------------------------------------
// Character Fingerprint
// ---------------------------------------------------------------------------

export const CharacterFingerprintSchema = z.object({
  /** Lowercase kebab-case identifier (e.g., "kael-driftborn"). */
  id: z.string().regex(/^[a-z0-9-]+$/, 'ID must be lowercase kebab-case (a-z, 0-9, hyphens only)'),

  /** Display name. */
  name: z.string().min(1, 'Name is required'),

  /** Alternative names. Defaults to empty array when omitted. */
  aliases: z.array(z.string()).default([]),

  /** Verbatim visual description for prompt embedding. Must be substantial. */
  fingerprint: z.string().min(20, 'Fingerprint must be at least 20 characters'),

  /** Optional prompt for generating character reference sheets. */
  reference_sheet_prompt: z.string().optional(),

  /** Optional color palette. */
  palette: PaletteSchema.optional(),

  /** Optional named variants (e.g., "combat", "casual"). */
  variants: z.record(z.string(), z.string()).optional(),
});

export type CharacterFingerprintData = z.infer<typeof CharacterFingerprintSchema>;
