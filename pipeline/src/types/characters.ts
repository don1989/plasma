/**
 * Character types for the Plasma pipeline.
 *
 * Character fingerprints are locked, verbatim description blocks that are
 * embedded in every Gemini prompt to ensure visual consistency. The registry
 * provides case-insensitive lookup by character id or any alias.
 */

/** A character's visual fingerprint and metadata for prompt generation. */
export interface CharacterFingerprint {
  /** Unique lowercase kebab-case identifier (e.g., "kael-driftborn"). */
  id: string;
  /** Display name (e.g., "Kael Driftborn"). */
  name: string;
  /** Alternative names this character is known by. */
  aliases: string[];
  /** Verbatim prompt text describing the character's visual appearance. */
  fingerprint: string;
  /** Optional prompt for generating character reference sheets. */
  reference_sheet_prompt?: string;
  /** Optional color palette for the character. */
  palette?: {
    primary: string[];
    accent: string[];
  };
  /** Optional named variants (e.g., "combat", "casual", "injured"). */
  variants?: Record<string, string>;
}

/**
 * The CharacterRegistry class (in src/characters/registry.ts) replaces
 * the previous Map type alias with a full-featured class providing
 * case-insensitive lookup, validation, and convenience methods.
 */
