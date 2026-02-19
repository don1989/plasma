/**
 * CharacterRegistry — loads, validates, and provides case-insensitive
 * lookup for character YAML fingerprint files.
 *
 * Each character YAML file is validated against CharacterFingerprintSchema.
 * The registry indexes characters by id, name, and every alias (all lowercase)
 * so any variant of the name returns the same data.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

import { CharacterFingerprintSchema } from '../schemas/character.schema.js';
import type { CharacterFingerprint } from '../types/characters.js';
import { PATHS } from '../config/paths.js';

export class CharacterRegistry {
  private characters: Map<string, CharacterFingerprint> = new Map();

  /**
   * Load all .yaml/.yml files from the given directory, validate each
   * against CharacterFingerprintSchema, and index by id, name, and aliases.
   * Invalid files log a warning and are skipped (no crash).
   */
  async loadAll(dirPath: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch {
      throw new Error(`Cannot read character directory: ${dirPath}`);
    }

    const yamlFiles = entries.filter(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
    );

    for (const file of yamlFiles) {
      const filePath = path.join(dirPath, file);
      try {
        const raw = await readFile(filePath, 'utf-8');
        const parsed: unknown = parse(raw);
        const result = CharacterFingerprintSchema.safeParse(parsed);

        if (!result.success) {
          console.warn(
            `[CharacterRegistry] Skipping ${file}: validation failed`,
            result.error.issues,
          );
          continue;
        }

        const char = result.data as CharacterFingerprint;
        // Index by id
        this.characters.set(char.id.toLowerCase(), char);
        // Index by name
        this.characters.set(char.name.toLowerCase(), char);
        // Index by each alias
        for (const alias of char.aliases) {
          this.characters.set(alias.toLowerCase(), char);
        }
      } catch (err) {
        console.warn(
          `[CharacterRegistry] Skipping ${file}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * Look up a character by id, name, or alias (case-insensitive).
   */
  get(nameOrAlias: string): CharacterFingerprint | undefined {
    return this.characters.get(nameOrAlias.toLowerCase());
  }

  /**
   * Get the verbatim fingerprint text for a character.
   * Throws if the character is not found.
   */
  getFingerprint(nameOrAlias: string): string {
    const char = this.get(nameOrAlias);
    if (!char) throw new Error(`Unknown character: ${nameOrAlias}`);
    return char.fingerprint;
  }

  /**
   * Get the reference sheet prompt for a character.
   * Throws if the character is not found.
   */
  getReferenceSheetPrompt(nameOrAlias: string): string | undefined {
    const char = this.get(nameOrAlias);
    if (!char) throw new Error(`Unknown character: ${nameOrAlias}`);
    return char.reference_sheet_prompt;
  }

  /**
   * Check if a character exists by id, name, or alias (case-insensitive).
   */
  has(nameOrAlias: string): boolean {
    return this.characters.has(nameOrAlias.toLowerCase());
  }

  /**
   * Return all unique characters (deduplicated by id).
   */
  getAll(): CharacterFingerprint[] {
    return [
      ...new Map(
        [...this.characters.values()].map((c) => [c.id, c]),
      ).values(),
    ];
  }

  /**
   * Number of unique characters loaded.
   */
  get size(): number {
    return this.getAll().length;
  }
}

/**
 * Convenience: create a registry, load all characters from the default
 * (or specified) directory, and return it.
 */
export async function loadCharacterRegistry(
  dirPath?: string,
): Promise<CharacterRegistry> {
  const registry = new CharacterRegistry();
  await registry.loadAll(dirPath ?? PATHS.characterData);
  return registry;
}

/**
 * Scaffold a new character YAML file in the given directory.
 * Returns the absolute path to the created file.
 */
export async function scaffoldCharacterYaml(
  name: string,
  dirPath?: string,
): Promise<string> {
  const dir = dirPath ?? PATHS.characterData;
  const id = name.toLowerCase().replace(/\s+/g, '-');
  const filePath = path.join(dir, `${id}.yaml`);

  const template = `id: ${id}
name: ${name}
aliases: ["${name}"]

# Verbatim prompt fingerprint — DO NOT paraphrase or rearrange
# Fill in the tested visual description for this character
fingerprint: |
  TODO: Add the locked prompt fingerprint for ${name}

# Optional: reference sheet prompt for generating character sheets
# reference_sheet_prompt: |
#   TODO: Add reference sheet prompt

# Optional: color palette
# palette:
#   primary: []
#   accent: []

# Optional: named variants
# variants:
#   variant_name: "description"
`;

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, template, 'utf-8');
  return filePath;
}
