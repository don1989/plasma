/**
 * Markdown script parser for manga chapter scripts.
 *
 * Converts chapter-NN-script.md files into typed Chapter objects
 * using unified + remark-parse to walk the MDAST tree.
 *
 * Key MDAST insight: remark merges consecutive lines without blank
 * separators into a single paragraph node. So **Action:** value
 * **Dialogue:** value all become one paragraph with interleaved
 * Strong and Text children. Similarly, list items that are followed
 * (without a blank line) by **SFX:** and **Notes:** get those fields
 * merged into the last list item.
 *
 * Handles all edge cases from chapter-01-script.md:
 * - Em-dash (U+2014) separators and "no dialogue" markers
 * - Splash pages, double-page spreads, [PAGE-TURN REVEAL] tags
 * - Dialogue types: speech, thought (italicized), narration
 * - Off-panel speech, silent panels, Black panels, Small inset
 * - Director's Notes / End Hook footer sections (excluded)
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, Content, PhrasingContent } from 'mdast';
import type { Chapter, Page, Panel, DialogueLine } from '../types/manga.js';
import {
  ChapterSchema,
  checkPagePanelCountWarnings,
} from '../schemas/manga.schema.js';
import type { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// MDAST text extraction helpers
// ---------------------------------------------------------------------------

/**
 * Recursively extract plain text from any MDAST node.
 * Strips all formatting — Strong, Emphasis become plain text.
 */
function extractText(node: Content | PhrasingContent | Root): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'inlineCode') return node.value;
  if ('children' in node) {
    return (node.children as (Content | PhrasingContent)[])
      .map(extractText)
      .join('');
  }
  return '';
}

/**
 * Extract text preserving emphasis markers (needed for dialogue parsing).
 * Strong markers are also preserved so we can detect field labels in list items.
 */
function extractTextPreserving(node: Content | PhrasingContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'inlineCode') return node.value;
  if (node.type === 'emphasis') {
    const inner = 'children' in node
      ? (node.children as PhrasingContent[]).map(extractTextPreserving).join('')
      : '';
    return `*${inner}*`;
  }
  if (node.type === 'strong') {
    const inner = 'children' in node
      ? (node.children as PhrasingContent[]).map(extractTextPreserving).join('')
      : '';
    return `**${inner}**`;
  }
  if ('children' in node) {
    return (node.children as (Content | PhrasingContent)[])
      .map(extractTextPreserving)
      .join('');
  }
  return '';
}

// ---------------------------------------------------------------------------
// Field extraction from paragraph children
// ---------------------------------------------------------------------------

/** A field-value pair extracted from a paragraph's Strong/Text children. */
interface FieldEntry {
  field: string; // lowercase: 'action', 'dialogue', 'sfx', 'notes'
  value: string;
}

/**
 * Extract field-value pairs from a paragraph's children.
 *
 * In the MDAST, a paragraph like:
 *   **Action:** value\n**Dialogue:** —\n**SFX:** —\n**Notes:** note
 * becomes children:
 *   [Strong("Action:"), Text(" value\n"), Strong("Dialogue:"), Text(" —\n"), ...]
 *
 * We walk the children, and each time we encounter a Strong node whose text
 * matches a known field label, we start a new field entry.
 */
function extractFieldsFromParagraph(node: Content): FieldEntry[] {
  if (node.type !== 'paragraph' || !('children' in node)) return [];

  const fields: FieldEntry[] = [];
  let currentField: string | null = null;
  let currentValue = '';

  const children = node.children as PhrasingContent[];

  for (const child of children) {
    if (child.type === 'strong') {
      const strongText = extractText(child).trim();
      const labelMatch = strongText.match(/^(Action|Dialogue|SFX|Notes):$/i);

      if (labelMatch) {
        // Save previous field
        if (currentField) {
          fields.push({ field: currentField, value: currentValue.trim() });
        }
        currentField = labelMatch[1]!.toLowerCase();
        currentValue = '';
        continue;
      }
    }

    // Accumulate text into current field
    if (currentField) {
      currentValue += extractText(child);
    }
  }

  // Save final field
  if (currentField) {
    fields.push({ field: currentField, value: currentValue.trim() });
  }

  return fields;
}

/**
 * Extract metadata field-value pairs from a metadata paragraph.
 * Metadata paragraphs contain multiple **Label:** value pairs.
 */
function extractMetadataFields(node: Content): Array<{ label: string; value: string }> {
  if (node.type !== 'paragraph' || !('children' in node)) return [];

  const entries: Array<{ label: string; value: string }> = [];
  let currentLabel: string | null = null;
  let currentValue = '';

  const children = node.children as PhrasingContent[];

  for (const child of children) {
    if (child.type === 'strong') {
      const strongText = extractText(child).trim();
      // Match labels ending with colon
      const labelMatch = strongText.match(/^(.+):$/);
      if (labelMatch) {
        // Save previous entry
        if (currentLabel) {
          entries.push({ label: currentLabel, value: currentValue.trim() });
        }
        currentLabel = labelMatch[1]!.toLowerCase().trim();
        currentValue = '';
        continue;
      }
    }

    if (currentLabel) {
      currentValue += extractText(child);
    }
  }

  if (currentLabel) {
    entries.push({ label: currentLabel, value: currentValue.trim() });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Heading parsers
// ---------------------------------------------------------------------------

/** Extract chapter number and title from H1: "# Chapter N: Title" */
function parseH1(text: string): { chapterNumber: number; title: string } | null {
  const match = text.match(/^Chapter\s+(\d+):\s+(.+)$/);
  if (!match) return null;
  return { chapterNumber: parseInt(match[1]!, 10), title: match[2]!.trim() };
}

/**
 * Parse H2 page heading. Handles:
 * - "Page N"
 * - "Page N -- SPLASH PAGE"
 * - "Page N -- DOUBLE-PAGE SPREAD (Pages N-M)"
 * - "Page N [PAGE-TURN REVEAL]"
 */
function parseH2(text: string): {
  pageNumber: number;
  isSplash: boolean;
  isDoubleSpread: boolean;
  tags: string[];
} | null {
  // First, extract any bracket tags
  const tags: string[] = [];
  const tagMatches = text.matchAll(/\[([^\]]+)\]/g);
  for (const m of tagMatches) {
    tags.push(m[1]!);
  }

  // Remove bracket tags for page number/type parsing
  const cleanText = text.replace(/\s*\[[^\]]+\]\s*/g, '').trim();

  // Match "Page N" with optional suffix after em-dash
  const match = cleanText.match(/^Page\s+(\d+)(?:\s*\u2014\s*(.+))?$/);
  if (!match) return null;

  const pageNumber = parseInt(match[1]!, 10);
  const suffix = match[2]?.trim() ?? '';
  const isSplash = /SPLASH\s+PAGE/i.test(suffix);
  const isDoubleSpread = /DOUBLE[- ]PAGE\s+SPREAD/i.test(suffix);

  return { pageNumber, isSplash, isDoubleSpread, tags };
}

/** Parse H3 panel heading: "### Panel N -- Shot Type" */
function parseH3(text: string): { panelNumber: number; shotType: string } | null {
  const match = text.match(/^Panel\s+(\d+)\s*\u2014\s*(.+)$/);
  if (!match) return null;
  return { panelNumber: parseInt(match[1]!, 10), shotType: match[2]!.trim() };
}

// ---------------------------------------------------------------------------
// Dialogue line parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single dialogue line string into a DialogueLine.
 *
 * Patterns:
 * - "CHARACTER: \"line\"" => speech
 * - "CHARACTER (thought): *line*" => thought
 * - "CHARACTER (off-panel): \"line\"" => speech
 * - "(narration): *line*" => narration
 */
function parseDialogueLine(text: string): DialogueLine | null {
  const line = text.trim();

  // Narration: "(narration): *line*"
  const narrationMatch = line.match(/^\(narration\):\s*\*?([^*]*)\*?\s*$/i);
  if (narrationMatch) {
    return {
      character: 'Narrator',
      line: narrationMatch[1]!.trim(),
      type: 'narration',
    };
  }

  // Character with modifier: "CHARACTER (thought): *line*"
  const modMatch = line.match(/^([A-Z][A-Z0-9 ]*?)\s*\(([^)]+)\):\s*(.+)$/);
  if (modMatch) {
    const character = modMatch[1]!.trim();
    const modifier = modMatch[2]!.trim().toLowerCase();
    let dialogueLine = modMatch[3]!.trim();
    const type: DialogueLine['type'] = modifier === 'thought' ? 'thought' : 'speech';
    dialogueLine = dialogueLine.replace(/^["*]|["*]$/g, '').trim();
    return { character, line: dialogueLine, type };
  }

  // Standard: "CHARACTER: \"line\""
  const stdMatch = line.match(/^([A-Z][A-Z0-9 ]*?):\s*(.+)$/);
  if (stdMatch) {
    const character = stdMatch[1]!.trim();
    let dialogueLine = stdMatch[2]!.trim();
    dialogueLine = dialogueLine.replace(/^"|"$/g, '').trim();
    return { character, line: dialogueLine, type: 'speech' };
  }

  return null;
}

/**
 * Parse dialogue lines from a list node.
 *
 * CRITICAL: In the MDAST, when list items are immediately followed by
 * **SFX:** and **Notes:** (no blank line), those fields get merged into
 * the last list item. We need to:
 * 1. Extract dialogue from list item text up to the first Strong node
 * 2. Return any remaining fields (SFX, Notes) found in list items
 */
function parseDialogueFromList(listNode: Content): {
  dialogueLines: DialogueLine[];
  trailingFields: FieldEntry[];
} {
  const dialogueLines: DialogueLine[] = [];
  const trailingFields: FieldEntry[] = [];

  if (listNode.type !== 'list' || !('children' in listNode)) {
    return { dialogueLines, trailingFields };
  }

  for (const item of listNode.children) {
    if (item.type !== 'listItem' || !('children' in item)) continue;

    // Each list item has paragraph children
    for (const itemChild of item.children) {
      if (itemChild.type !== 'paragraph' || !('children' in itemChild)) continue;

      const phrasingChildren = itemChild.children as PhrasingContent[];

      // Split the phrasing children: dialogue text comes before any Strong field label
      let dialogueText = '';
      let hitFieldLabel = false;
      let currentFieldLabel: string | null = null;
      let currentFieldValue = '';

      for (const pc of phrasingChildren) {
        if (pc.type === 'strong') {
          const strongText = extractText(pc).trim();
          const labelMatch = strongText.match(/^(Action|Dialogue|SFX|Notes):$/i);
          if (labelMatch) {
            // Save any prior trailing field
            if (currentFieldLabel) {
              trailingFields.push({
                field: currentFieldLabel,
                value: currentFieldValue.trim(),
              });
            }
            hitFieldLabel = true;
            currentFieldLabel = labelMatch[1]!.toLowerCase();
            currentFieldValue = '';
            continue;
          }
        }

        if (hitFieldLabel && currentFieldLabel) {
          currentFieldValue += extractText(pc);
        } else {
          dialogueText += extractTextPreserving(pc);
        }
      }

      // Save final trailing field
      if (currentFieldLabel) {
        trailingFields.push({
          field: currentFieldLabel,
          value: currentFieldValue.trim(),
        });
      }

      // Parse the dialogue text (may have newline separating lines)
      const cleanDialogue = dialogueText.replace(/\n$/, '').trim();
      if (cleanDialogue) {
        const parsed = parseDialogueLine(cleanDialogue);
        if (parsed) {
          dialogueLines.push(parsed);
        }
      }
    }
  }

  return { dialogueLines, trailingFields };
}

// ---------------------------------------------------------------------------
// Apply fields to panel
// ---------------------------------------------------------------------------

function applyFieldToPanel(panel: Panel, field: string, value: string): void {
  const cleanValue = value.replace(/\n$/, '').trim();

  switch (field) {
    case 'action':
      panel.action = cleanValue;
      break;
    case 'dialogue':
      // Em-dash means no dialogue
      if (cleanValue === '\u2014' || cleanValue === '') {
        panel.dialogue = [];
      }
      break;
    case 'sfx':
      panel.sfx = cleanValue === '\u2014' ? '' : cleanValue;
      break;
    case 'notes':
      panel.notes = cleanValue;
      break;
  }
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/** Stop-section H2 headings. */
const STOP_HEADINGS = ['end hook', "director's notes"];

/**
 * Parse a chapter script markdown string into a typed Chapter object.
 *
 * Uses unified + remark-parse to build an MDAST tree, then walks nodes
 * sequentially to extract pages, panels, and metadata.
 */
export function parseChapterScript(markdown: string): Chapter {
  const tree = unified().use(remarkParse).parse(markdown) as Root;
  const nodes = tree.children;

  let chapterNumber = 0;
  let title = '';
  let themeBeat = '';
  let estimatedPages = 0;
  let characters: string[] = [];
  let locations: string[] = [];
  const pages: Page[] = [];

  let currentPage: Page | null = null;
  let currentPanel: Panel | null = null;
  let lastField: string | null = null;
  let h1Found = false;
  let inMetadata = false;

  // Page-level tags stored temporarily
  const pageTagsMap = new Map<Page, string[]>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;

    // -----------------------------------------------------------------------
    // H1: Chapter heading
    // -----------------------------------------------------------------------
    if (node.type === 'heading' && node.depth === 1 && !h1Found) {
      const text = extractText(node);
      const parsed = parseH1(text);
      if (parsed) {
        chapterNumber = parsed.chapterNumber;
        title = parsed.title;
        h1Found = true;
        inMetadata = true;
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // H2: Page heading or stop section
    // -----------------------------------------------------------------------
    if (node.type === 'heading' && node.depth === 2) {
      const text = extractText(node);

      // Stop sections
      if (STOP_HEADINGS.some((s) => text.toLowerCase().startsWith(s))) {
        if (currentPanel && currentPage) {
          currentPage.panels.push(currentPanel);
          currentPanel = null;
        }
        if (currentPage) {
          pages.push(currentPage);
          currentPage = null;
        }
        break;
      }

      const pageInfo = parseH2(text);
      if (pageInfo) {
        // Finalize previous panel/page
        if (currentPanel && currentPage) {
          currentPage.panels.push(currentPanel);
          currentPanel = null;
        }
        if (currentPage) {
          pages.push(currentPage);
        }

        currentPage = {
          pageNumber: pageInfo.pageNumber,
          panels: [],
          isSplash: pageInfo.isSplash,
          isDoubleSpread: pageInfo.isDoubleSpread,
        };

        if (pageInfo.tags.length > 0) {
          pageTagsMap.set(currentPage, pageInfo.tags);
        }

        inMetadata = false;
        lastField = null;
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // Metadata paragraphs (between H1 and first H2)
    // -----------------------------------------------------------------------
    if (inMetadata && node.type === 'paragraph') {
      const entries = extractMetadataFields(node);
      for (const entry of entries) {
        switch (entry.label) {
          case 'theme beat':
            themeBeat = entry.value;
            break;
          case 'estimated pages':
            estimatedPages = parseInt(entry.value, 10) || 0;
            break;
          case 'characters appearing':
            characters = entry.value.split(',').map((s) => s.trim()).filter(Boolean);
            break;
          case 'locations':
            locations = entry.value.split(',').map((s) => s.trim()).filter(Boolean);
            break;
        }
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // H3: Panel heading
    // -----------------------------------------------------------------------
    if (node.type === 'heading' && node.depth === 3) {
      const text = extractText(node);
      const panelInfo = parseH3(text);
      if (panelInfo && currentPage) {
        if (currentPanel) {
          currentPage.panels.push(currentPanel);
        }

        currentPanel = {
          panelNumber: panelInfo.panelNumber,
          shotType: panelInfo.shotType,
          action: '',
          dialogue: [],
          sfx: '',
          notes: '',
          tags: [],
        };
        lastField = null;

        // Transfer page-level tags to first panel
        const pageTags = pageTagsMap.get(currentPage);
        if (pageTags && currentPage.panels.length === 0) {
          currentPanel.tags.push(...pageTags);
        }
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // Thematic break (---): skip
    // -----------------------------------------------------------------------
    if (node.type === 'thematicBreak') {
      continue;
    }

    // -----------------------------------------------------------------------
    // Blockquote: tags like [PLAYER DECISION POINT]
    // -----------------------------------------------------------------------
    if (node.type === 'blockquote') {
      const text = extractText(node);
      const tagMatches = text.matchAll(/\[([^\]]+)\]/g);
      for (const m of tagMatches) {
        if (currentPanel) {
          currentPanel.tags.push(m[1]!);
        }
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // Paragraph within a panel: extract fields
    // -----------------------------------------------------------------------
    if (node.type === 'paragraph' && currentPanel) {
      const fields = extractFieldsFromParagraph(node);

      if (fields.length > 0) {
        for (const f of fields) {
          applyFieldToPanel(currentPanel, f.field, f.value);
          lastField = f.field;
        }
      }
      continue;
    }

    // -----------------------------------------------------------------------
    // List within a panel: dialogue lines (with possible trailing fields)
    // -----------------------------------------------------------------------
    if (node.type === 'list' && currentPanel) {
      const { dialogueLines, trailingFields } = parseDialogueFromList(node);
      currentPanel.dialogue.push(...dialogueLines);

      // Apply trailing fields (SFX, Notes) that got merged into list items
      for (const tf of trailingFields) {
        applyFieldToPanel(currentPanel, tf.field, tf.value);
      }

      lastField = trailingFields.length > 0
        ? trailingFields[trailingFields.length - 1]!.field
        : 'dialogue';
      continue;
    }
  }

  // Finalize last panel and page
  if (currentPanel && currentPage) {
    currentPage.panels.push(currentPanel);
  }
  if (currentPage) {
    pages.push(currentPage);
  }

  return {
    chapterNumber,
    title,
    themeBeat,
    estimatedPages,
    characters,
    locations,
    pages,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: ZodError[];
  warnings: string[];
}

/**
 * Validate a parsed Chapter object against the ChapterSchema.
 * Returns validation errors and warning-level panel count issues.
 */
export function validateChapter(chapter: Chapter): ValidationResult {
  const result = ChapterSchema.safeParse(chapter);
  const warnings: string[] = [];

  for (const page of chapter.pages) {
    warnings.push(
      ...checkPagePanelCountWarnings(
        page as Parameters<typeof checkPagePanelCountWarnings>[0]
      )
    );
  }

  if (result.success) {
    return { valid: true, errors: [], warnings };
  }

  return {
    valid: false,
    errors: [result.error],
    warnings,
  };
}
