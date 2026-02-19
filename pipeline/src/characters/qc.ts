/**
 * QC (Quality Control) checklist generator for character-panel cross-referencing.
 *
 * Cross-references characters appearing in parsed script panels against the
 * character registry and verifies their fingerprints appear in generated prompts.
 * Produces a readable markdown checklist report for each chapter.
 *
 * Purpose: Character consistency is the hardest problem in AI manga generation.
 * Instead of eyeballing each prompt, the QC checklist systematically reports
 * which characters were found, which had fingerprints injected, and which are
 * missing from the registry — catching gaps before images are generated.
 */
import type { Chapter } from '../types/manga.js';
import type { CharacterRegistry } from './registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single QC checklist entry for one character appearance in one panel. */
export interface QCChecklistItem {
  pageNumber: number;
  panelNumber: number;
  character: string;
  /** Character exists in the registry. */
  hasFingerprint: boolean;
  /** Character has a reference_sheet_prompt defined. */
  hasReferenceSheet: boolean;
  /** Fingerprint text was found in the corresponding generated prompt. */
  fingerprintIncluded: boolean;
  /** Warning notes (empty string when all clear). */
  notes: string;
}

/** Aggregated QC report for a chapter. */
export interface QCReport {
  chapterNumber: number;
  totalPanels: number;
  totalCharacterAppearances: number;
  knownCharacters: number;
  unknownCharacters: string[];
  /** Known characters whose fingerprint text was NOT found in the prompt. */
  missingFingerprints: number;
  items: QCChecklistItem[];
}

// ---------------------------------------------------------------------------
// Character extraction from panels
// ---------------------------------------------------------------------------

/**
 * Extract unique character names from a panel's dialogue speakers and action text.
 *
 * Sources:
 * 1. Dialogue speakers (character field of each DialogueLine, excluding 'Narrator')
 * 2. Uppercase character names in action text (matches patterns like "SPYKE",
 *    "PUNK 1", "HOOD" — words in ALL CAPS that look like character references)
 */
export function extractCharactersFromPanel(panel: {
  dialogue: Array<{ character: string }>;
  action: string;
}): string[] {
  const characters = new Set<string>();

  // 1. Dialogue speakers
  for (const line of panel.dialogue) {
    const name = line.character.trim();
    if (name && name !== 'Narrator') {
      characters.add(name);
    }
  }

  // 2. Character names from action text — look for capitalized names
  // Match sequences of capitalized words that look like character references.
  // We look for known patterns: single capitalized word or "Word (Word)" patterns.
  // Also match names from dialogue that might appear differently in action text.
  const actionText = panel.action;
  if (actionText) {
    // Match "Spyke", "June", "Hood", "Punk 1", etc. from action text
    // These are Title Case or ALL CAPS words that appear as character references
    const namePatterns = actionText.match(
      /\b(?:[A-Z][a-z]+(?:\s+\d+)?|[A-Z]{2,}(?:\s+\d+)?)\b/g,
    );
    if (namePatterns) {
      for (const match of namePatterns) {
        const cleaned = match.trim();
        // Skip common non-character words that match the pattern
        if (isCommonWord(cleaned)) continue;
        characters.add(cleaned);
      }
    }
  }

  return [...characters];
}

/** Common words that match capitalized patterns but are not character names. */
const COMMON_WORDS = new Set([
  // Articles / prepositions / conjunctions (when sentence-start capitalized)
  'The', 'This', 'That', 'These', 'Those', 'His', 'Her', 'Its',
  'He', 'She', 'They', 'We', 'You', 'It', 'A', 'An',
  // Scene/action terms common in manga scripts
  'Action', 'Shot', 'Close', 'Wide', 'Medium', 'Panel', 'Page',
  'Establishing', 'Black', 'Splash', 'CUT', 'FADE', 'ZOOM',
  'INT', 'EXT', 'SFX', 'POV', 'BG', 'FG',
  // Location/environment words
  'London', 'Westminster', 'Kings', 'Cross', 'Earth', 'Terra',
  // Time/general words
  'Chapter', 'Scene', 'Beat', 'Moment', 'Note', 'Notes',
  'Big', 'Ben', 'Shard', 'NOT',
  // Other commonly capitalized words in scripts
  'Plasma', 'SPLASH', 'PAGE', 'REVEAL', 'DECISION', 'POINT',
  'TURN', 'DOUBLE', 'SPREAD', 'PLAYER',
]);

function isCommonWord(word: string): boolean {
  return COMMON_WORDS.has(word);
}

// ---------------------------------------------------------------------------
// QC Checklist Generator
// ---------------------------------------------------------------------------

/**
 * Generate a QC checklist for a chapter by cross-referencing characters
 * found in the parsed script against the character registry and verifying
 * their fingerprints appear in the corresponding generated prompts.
 *
 * @param chapter - Parsed chapter object
 * @param registry - Character registry loaded with fingerprint data
 * @param generatedPrompts - Array of generated prompt texts, one per page
 *   (index 0 = page 1's prompt, etc.). If a page has no prompt, pass an
 *   empty string at that index.
 */
export function generateQCChecklist(
  chapter: Chapter,
  registry: CharacterRegistry,
  generatedPrompts: string[],
): QCReport {
  const items: QCChecklistItem[] = [];
  const unknownCharactersSet = new Set<string>();
  let totalPanels = 0;
  let totalCharacterAppearances = 0;
  let knownCharacters = 0;
  let missingFingerprints = 0;

  for (let pageIdx = 0; pageIdx < chapter.pages.length; pageIdx++) {
    const page = chapter.pages[pageIdx]!;
    const promptText = generatedPrompts[pageIdx] ?? '';

    for (const panel of page.panels) {
      totalPanels++;

      const characters = extractCharactersFromPanel(panel);

      for (const characterName of characters) {
        totalCharacterAppearances++;

        const charData = registry.get(characterName);
        const hasFingerprint = charData !== undefined;
        const hasReferenceSheet = charData?.reference_sheet_prompt !== undefined;

        let fingerprintIncluded = false;
        if (charData) {
          const fpText = charData.fingerprint.trim();
          fingerprintIncluded = fpText.length > 0 && promptText.includes(fpText);
        }

        // Build notes
        const notes: string[] = [];
        if (!hasFingerprint) {
          notes.push('WARNING: No fingerprint found');
          unknownCharactersSet.add(characterName);
        } else {
          knownCharacters++;
          if (!fingerprintIncluded) {
            notes.push('WARNING: Fingerprint not included in prompt');
            missingFingerprints++;
          }
        }

        items.push({
          pageNumber: page.pageNumber,
          panelNumber: panel.panelNumber,
          character: characterName,
          hasFingerprint,
          hasReferenceSheet,
          fingerprintIncluded,
          notes: notes.join('; '),
        });
      }
    }
  }

  return {
    chapterNumber: chapter.chapterNumber,
    totalPanels,
    totalCharacterAppearances,
    knownCharacters,
    unknownCharacters: [...unknownCharactersSet].sort(),
    missingFingerprints,
    items,
  };
}

// ---------------------------------------------------------------------------
// Markdown Report Formatter
// ---------------------------------------------------------------------------

/**
 * Format a QCReport into a readable markdown string with summary and
 * per-page checklist tables.
 */
export function formatQCReport(report: QCReport): string {
  const lines: string[] = [];

  // Header
  lines.push(`# QC Report: Chapter ${report.chapterNumber}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total panels: ${report.totalPanels}`);
  lines.push(`- Character appearances: ${report.totalCharacterAppearances}`);
  lines.push(`- Known characters: ${report.knownCharacters}`);

  if (report.unknownCharacters.length > 0) {
    lines.push(
      `- Unknown characters: ${report.unknownCharacters.length} (${report.unknownCharacters.join(', ')})`,
    );
  } else {
    lines.push('- Unknown characters: 0');
  }

  lines.push(`- Missing fingerprints in prompts: ${report.missingFingerprints}`);
  lines.push('');

  // Group items by page
  const pageMap = new Map<number, QCChecklistItem[]>();
  for (const item of report.items) {
    const existing = pageMap.get(item.pageNumber);
    if (existing) {
      existing.push(item);
    } else {
      pageMap.set(item.pageNumber, [item]);
    }
  }

  if (pageMap.size === 0) {
    lines.push('## Checklist');
    lines.push('');
    lines.push('No character appearances found.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## Checklist');
  lines.push('');

  // Sort pages numerically
  const sortedPages = [...pageMap.entries()].sort((a, b) => a[0] - b[0]);

  for (const [pageNum, pageItems] of sortedPages) {
    const allResolved = pageItems.every(
      (item) => item.hasFingerprint && item.fingerprintIncluded,
    );
    const pageStatus = allResolved ? ' ✓' : ' ⚠';

    lines.push(`### Page ${pageNum}${pageStatus}`);
    lines.push('');
    lines.push(
      '| Panel | Character | In Registry | Ref Sheet | In Prompt | Notes |',
    );
    lines.push(
      '|-------|-----------|-------------|-----------|-----------|-------|',
    );

    for (const item of pageItems) {
      const inRegistry = item.hasFingerprint ? 'yes' : 'no';
      const refSheet = item.hasReferenceSheet ? 'yes' : 'no';
      const inPrompt = item.fingerprintIncluded ? 'yes' : 'no';
      lines.push(
        `| ${item.panelNumber} | ${item.character} | ${inRegistry} | ${refSheet} | ${inPrompt} | ${item.notes} |`,
      );
    }

    lines.push('');
  }

  return lines.join('\n');
}
