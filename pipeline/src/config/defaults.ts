/**
 * Default configuration values for the pipeline.
 */

import type { StageName } from '../types/pipeline.js';

/** Default chapter number when none specified. */
export const DEFAULT_CHAPTER = 1;

/** Current pipeline version. */
export const PIPELINE_VERSION = '0.1.0';

/** All pipeline stage names in execution order. */
export const STAGE_NAMES: readonly StageName[] = [
  'script',
  'prompt',
  'generate',
  'overlay',
  'assemble',
] as const;

/** Default Gemini model for image generation (fast/cheap for drafting). */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-image';

/** Default aspect ratio for manga page generation (portrait). */
export const DEFAULT_ASPECT_RATIO = '3:4';

/** Delay in milliseconds between API calls for rate limiting. */
export const DEFAULT_RATE_LIMIT_DELAY_MS = 2000;
