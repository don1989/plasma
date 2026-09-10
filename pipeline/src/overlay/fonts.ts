/** Lettering font lookup: bundled Comic Neue Bold with a system fallback. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PATHS } from '../config/paths.js';

export interface LetterFont { family: string; fontfile?: string }

/** Bundled comic font, with a system fallback so lettering never fails on a missing file. */
export function letterFont(): LetterFont {
  for (const name of ['ComicNeue-Bold.otf', 'ComicNeue-Bold.ttf']) {
    const file = path.join(PATHS.pipelineRoot, 'data', 'fonts', name);
    if (existsSync(file)) return { family: 'Comic Neue', fontfile: file };
  }
  return { family: 'sans-serif' };
}
