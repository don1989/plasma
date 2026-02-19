/**
 * Zod validation schemas for manga script data.
 *
 * These schemas validate parsed chapter scripts from Markdown source files.
 * They enforce structural rules (e.g., splash pages have exactly 1 panel)
 * and provide TypeScript types via z.infer.
 *
 * Shot types use z.string() rather than a strict enum because the source
 * scripts contain compound types like "Wide (Action)" and "Medium-Wide".
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shot type reference enum (non-exhaustive — for documentation, not validation)
// ---------------------------------------------------------------------------

/**
 * Known shot types from chapter scripts. Used for reference only.
 * The actual PanelSchema uses z.string() to allow compound variants
 * like "Wide (Action)" that appear in the source scripts.
 */
export const ShotType = z.enum([
  'Wide',
  'Medium',
  'Medium-Wide',
  'Close-up',
  'Extreme close-up',
  "Bird's eye",
  'Low angle',
  'Full Page',
  'Full Double Spread',
  'Black',
]);

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

export const DialogueLineSchema = z.object({
  character: z.string(),
  line: z.string(),
  type: z.enum(['speech', 'thought', 'narration']),
});

export type DialogueLineData = z.infer<typeof DialogueLineSchema>;

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export const PanelSchema = z.object({
  panelNumber: z.number().int().positive(),
  shotType: z.string().min(1),
  action: z.string().min(1),
  dialogue: z.array(DialogueLineSchema),
  sfx: z.string(),
  notes: z.string(),
  tags: z.array(z.string()),
});

export type PanelData = z.infer<typeof PanelSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Standard panel count range for non-splash, non-double-spread pages. */
const STANDARD_PANEL_RANGE = { min: 4, max: 7 } as const;

export const PageSchema = z
  .object({
    pageNumber: z.number().int().positive(),
    panels: z.array(PanelSchema).min(1),
    isSplash: z.boolean(),
    isDoubleSpread: z.boolean(),
  })
  .check((ctx) => {
    const { panels, isSplash, isDoubleSpread } = ctx.value;

    // Splash and double-spread pages must have exactly 1 panel
    if ((isSplash || isDoubleSpread) && panels.length !== 1) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value,
        message: `Splash/double-spread pages must have exactly 1 panel, got ${panels.length}`,
        path: ['panels'],
      });
    }
  });

export type PageData = z.infer<typeof PageSchema>;

/**
 * Warning-level check for standard pages outside the typical 4-7 panel range.
 * Returns warnings but does not reject the data (action montages exist).
 */
export function checkPagePanelCountWarnings(page: PageData): string[] {
  const warnings: string[] = [];
  if (!page.isSplash && !page.isDoubleSpread) {
    if (
      page.panels.length < STANDARD_PANEL_RANGE.min ||
      page.panels.length > STANDARD_PANEL_RANGE.max
    ) {
      warnings.push(
        `Page ${page.pageNumber}: ${page.panels.length} panels is outside typical ${STANDARD_PANEL_RANGE.min}-${STANDARD_PANEL_RANGE.max} range`
      );
    }
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Chapter
// ---------------------------------------------------------------------------

export const ChapterSchema = z
  .object({
    chapterNumber: z.number().int().positive(),
    title: z.string().min(1),
    themeBeat: z.string(),
    estimatedPages: z.number().int().positive(),
    characters: z.array(z.string()),
    locations: z.array(z.string()),
    pages: z.array(PageSchema).min(1),
  })
  .check((ctx) => {
    const { pages } = ctx.value;

    // A chapter must contain at least one Wide shot type across all pages
    const hasWideShot = pages.some((page) =>
      page.panels.some((panel) => panel.shotType.startsWith('Wide'))
    );

    if (!hasWideShot) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value,
        message:
          'Chapter must contain at least one Wide shot type for establishing shots',
        path: ['pages'],
      });
    }
  });

export type ChapterData = z.infer<typeof ChapterSchema>;
