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
