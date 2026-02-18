import type { StageOptions, StageResult } from '../types/pipeline.js';
import { PATHS } from '../config/paths.js';
import { assertSourceDir } from '../utils/fs.js';

export async function runScript(options: StageOptions): Promise<StageResult> {
  const startTime = Date.now();

  // Verify source directory is readable
  assertSourceDir(PATHS.manga, 'Manga');

  // TODO: Implement in Phase 2
  console.log(`[script] Chapter ${options.chapter} -- stage not yet implemented`);

  return {
    stage: 'script',
    success: true,
    outputFiles: [],
    errors: [],
    duration: Date.now() - startTime,
  };
}
