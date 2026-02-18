/**
 * Core pipeline types shared across all stages.
 */

/** Result returned by every pipeline stage. */
export interface StageResult {
  stage: string;
  success: boolean;
  outputFiles: string[];
  errors: string[];
  /** Duration in milliseconds. */
  duration: number;
}

/** Options passed to every pipeline stage. */
export interface StageOptions {
  chapter: number;
  verbose?: boolean;
  dryRun?: boolean;
}

/** Union of all pipeline stage names. */
export type StageName = 'script' | 'prompt' | 'generate' | 'overlay' | 'assemble';
