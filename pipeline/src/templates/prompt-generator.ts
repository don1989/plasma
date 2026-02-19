/**
 * Prompt generator — combines parsed script data, character fingerprints,
 * style guide, and Nunjucks templates to produce Gemini-optimized art
 * prompts, one per page.
 *
 * This is the culmination of Phase 2: the script parser provides structured
 * chapter data, the character registry provides fingerprints, and this module
 * assembles them into ready-to-use prompts via the template engine.
 */
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

import type { Chapter, Page, Panel } from '../types/manga.js';
import type { CharacterRegistry } from '../characters/registry.js';
import { createPromptEngine } from './engine.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface PromptGeneratorOptions {
  chapter: Chapter;
  registry: CharacterRegistry;
  stylePrefix: string;
  setting: string;
  templateDir: string;
}

export interface GeneratedPrompt {
  pageNumber: number;
  prompt: string;
  charactersIncluded: string[];
  charactersUnknown: string[];
}

// ---------------------------------------------------------------------------
// Character extraction
// ---------------------------------------------------------------------------

/**
 * Extract unique character names from a panel.
 *
 * Sources:
 * 1. Dialogue speakers (exact match from panel.dialogue[].character)
 * 2. Word-boundary matches of registered character names/aliases in action text
 */
function extractCharactersFromPanel(
  panel: Panel,
  registry: CharacterRegistry,
): { known: Set<string>; unknown: Set<string> } {
  const known = new Set<string>();
  const unknown = new Set<string>();

  // 1. Dialogue speakers
  for (const line of panel.dialogue) {
    const name = line.character;
    if (name === 'Narrator') continue; // Narration has no visual character
    if (registry.has(name)) {
      known.add(name);
    } else {
      unknown.add(name);
    }
  }

  // 2. Match registered character names/aliases against action text
  const actionLower = panel.action.toLowerCase();
  const allChars = registry.getAll();
  for (const char of allChars) {
    const namesToCheck = [char.name, ...char.aliases];
    for (const alias of namesToCheck) {
      // Word-boundary match (case-insensitive)
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(panel.action)) {
        known.add(alias);
        break; // One match per character is enough
      }
    }
  }

  return { known, unknown };
}

/**
 * Resolve character fingerprints for a panel.
 * Returns deduplicated fingerprint strings and unknown character names.
 */
function resolveCharacterFingerprints(
  panel: Panel,
  registry: CharacterRegistry,
): { fingerprints: string[]; included: string[]; unknown: string[] } {
  const { known, unknown } = extractCharactersFromPanel(panel, registry);

  // Deduplicate fingerprints by character id
  const seenIds = new Set<string>();
  const fingerprints: string[] = [];
  const included: string[] = [];

  for (const name of known) {
    const char = registry.get(name);
    if (!char || seenIds.has(char.id)) continue;
    seenIds.add(char.id);
    fingerprints.push(char.fingerprint.trim());
    included.push(char.name);
  }

  return {
    fingerprints,
    included,
    unknown: [...unknown],
  };
}

// ---------------------------------------------------------------------------
// Layout description generation
// ---------------------------------------------------------------------------

/**
 * Generate a natural-language layout description based on page type and panel count.
 *
 * Matches the style of the hand-written prompts:
 * - "Full-page splash composition"
 * - "Double-page spread composition"
 * - "3-panel vertical layout"
 * - "4-panel layout"
 */
function generateLayoutDescription(page: Page): string {
  if (page.isSplash) {
    return 'Full-page splash composition';
  }
  if (page.isDoubleSpread) {
    return 'Double-page spread composition';
  }

  const count = page.panels.length;
  if (count <= 3) {
    return `vertical layout`;
  }
  return `layout`;
}

// ---------------------------------------------------------------------------
// Establishing shot detection
// ---------------------------------------------------------------------------

/**
 * Determine if a page has an establishing shot.
 *
 * An establishing shot is present when:
 * - The page is the very first page (page 1) and has a Wide shot
 * - Any panel has a shot type containing "Wide" at panel position 1
 * - A splash page on page 1
 */
function hasEstablishingShot(page: Page): boolean {
  if (page.pageNumber === 1) {
    // First page with a Wide shot is always establishing
    for (const panel of page.panels) {
      if (/wide/i.test(panel.shotType)) {
        return true;
      }
    }
    if (page.isSplash) {
      return true;
    }
  }

  // For other pages, check if first panel is a Wide establishing shot
  const firstPanel = page.panels[0];
  if (firstPanel && /wide/i.test(firstPanel.shotType) && firstPanel.panelNumber === 1) {
    // Only if it looks like an establishing/intro shot
    // Check action text for setting-related keywords
    const actionLower = firstPanel.action.toLowerCase();
    if (
      actionLower.includes('establishing') ||
      actionLower.includes('panoram') ||
      actionLower.includes('vista') ||
      actionLower.includes('landscape') ||
      actionLower.includes('skyline')
    ) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate art prompts for every page in a chapter.
 *
 * For each page:
 * 1. Extract characters from all panels (dialogue + action text matching)
 * 2. Look up fingerprints in the registry
 * 3. Determine establishing shot status
 * 4. Build template context and render page-prompt.njk
 * 5. Return GeneratedPrompt with rendered text and tracking info
 */
export function generateChapterPrompts(
  options: PromptGeneratorOptions,
): GeneratedPrompt[] {
  const { chapter, registry, setting, templateDir } = options;
  const env = createPromptEngine(templateDir);
  const results: GeneratedPrompt[] = [];

  for (const page of chapter.pages) {
    const allIncluded: string[] = [];
    const allUnknown: string[] = [];

    // Build panel data with resolved fingerprints
    const panelData = page.panels.map((panel) => {
      const { fingerprints, included, unknown } = resolveCharacterFingerprints(
        panel,
        registry,
      );

      allIncluded.push(...included);
      allUnknown.push(...unknown);

      return {
        panelNumber: panel.panelNumber,
        shotType: panel.shotType,
        position: '', // Position extracted from shot type if present
        action: panel.action,
        character_fingerprints: fingerprints,
        dialogue_lines: panel.dialogue.map((d) => ({
          character: d.character,
          line: d.line,
          type: d.type,
        })),
        sfx: panel.sfx,
        notes: panel.notes,
      };
    });

    const isEstablishing = hasEstablishingShot(page);
    const layoutDesc = generateLayoutDescription(page);

    const context = {
      has_establishing_shot: isEstablishing,
      setting,
      panel_count: page.panels.length,
      layout_description: layoutDesc,
      panels: panelData,
    };

    const prompt = env.render('page-prompt.njk', context);

    // Deduplicate tracking arrays
    const uniqueIncluded = [...new Set(allIncluded)];
    const uniqueUnknown = [...new Set(allUnknown)].filter(
      (name) => !uniqueIncluded.some(
        (inc) => inc.toLowerCase() === name.toLowerCase()
      ),
    );

    results.push({
      pageNumber: page.pageNumber,
      prompt: prompt.trim(),
      charactersIncluded: uniqueIncluded,
      charactersUnknown: uniqueUnknown,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Style guide loader utility
// ---------------------------------------------------------------------------

export interface StyleGuideData {
  stylePrefix: string;
  setting: string;
}

/**
 * Load style guide data from a YAML file.
 * Returns both style_prefix and setting fields.
 */
export function loadStyleGuide(stylePath: string): StyleGuideData {
  const raw = readFileSync(stylePath, 'utf-8');
  const data = parseYaml(raw) as Record<string, unknown>;

  return {
    stylePrefix: typeof data['style_prefix'] === 'string' ? data['style_prefix'] : '',
    setting: typeof data['setting'] === 'string' ? data['setting'] : '',
  };
}
