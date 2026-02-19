import type { StageOptions, StageResult } from '../types/pipeline.js';
import { PATHS } from '../config/paths.js';
import { assertSourceDir } from '../utils/fs.js';
import path from 'node:path';

export async function runOverlay(options: StageOptions): Promise<StageResult> {
  const startTime = Date.now();

  // Verify output parent directory is accessible
  const outputParent = path.dirname(PATHS.output);
  assertSourceDir(outputParent, 'Output parent');

  // TODO: Implement in Phase 4
  console.log(`[overlay] Chapter ${options.chapter} -- stage not yet implemented`);

  return {
    stage: 'overlay',
    success: true,
    outputFiles: [],
    errors: [],
    duration: Date.now() - startTime,
  };
}
