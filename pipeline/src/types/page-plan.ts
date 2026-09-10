/**
 * Page plan: the single source of truth for panel-based page production.
 * Built from script.json by the plan stage; read by panels, review, compose, letter.
 */
import { z } from 'zod';
import { DialogueLineSchema } from '../schemas/manga.schema.js';

export const ASPECT_RATIOS = ['16:9', '4:3', '3:4', '1:1'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const CanvasSchema = z.object({ w: z.number().positive(), h: z.number().positive() });

export const PanelVersionSchema = z.object({
  version: z.number().int().positive(),
  /** Path relative to the chapter output root, e.g. raw/runway-muse/ch01_p03_pn2_v1.png */
  file: z.string(),
  model: z.string(),
  requestId: z.string(),
  timestamp: z.string(),
  notes: z.string().default(''),
  /** Source image size, recorded when faces are detected. */
  imageSize: z.object({ w: z.number().positive(), h: z.number().positive() }).optional(),
  /** Face boxes normalised to the source image (0-1), from the vision pass. */
  faces: z.array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })).optional(),
});

export const SlotRectSchema = z.object({
  panelNumber: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

export const PanelPlanSchema = z.object({
  panelNumber: z.number().int().positive(),
  shotType: z.string(),
  aspectRatio: z.enum(ASPECT_RATIOS),
  characterIds: z.array(z.string()),
  /** Scene continuity: location whose setting text and refs are injected. */
  locationId: z.string().optional(),
  speakerSides: z.record(z.string(), z.enum(['left', 'right'])),
  dialogue: z.array(DialogueLineSchema),
  sfx: z.string(),
  prompt: z.string(),
  /** sha1 of prompt; approvals reset when it changes. */
  promptHash: z.string(),
  versions: z.array(PanelVersionSchema),
  approvedVersion: z.number().int().positive().nullable(),
  /** Manual nudges per dialogue index, in page pixels. */
  balloonOverrides: z.record(z.string(), z.object({ dx: z.number(), dy: z.number() })).optional(),
});

export const PagePlanSchema = z.object({
  pageNumber: z.number().int().positive(),
  isSplash: z.boolean(),
  layout: z.object({
    canvas: CanvasSchema,
    slots: z.array(SlotRectSchema),
  }),
  panels: z.array(PanelPlanSchema),
});

export const ChapterPlanSchema = z.object({
  chapterNumber: z.number().int().positive(),
  canvas: CanvasSchema,
  pages: z.array(PagePlanSchema),
});

export type DialogueLinePlan = z.infer<typeof DialogueLineSchema>;
export type PanelVersion = z.infer<typeof PanelVersionSchema>;
export type SlotRect = z.infer<typeof SlotRectSchema>;
export type PanelPlan = z.infer<typeof PanelPlanSchema>;
export type PagePlan = z.infer<typeof PagePlanSchema>;
export type ChapterPlan = z.infer<typeof ChapterPlanSchema>;

/** Manga B5 trim at 1600 wide. */
export const DEFAULT_CANVAS = { w: 1600, h: 2264 } as const;
export const PAGE_MARGIN = 60;
export const PAGE_GUTTER = 24;
