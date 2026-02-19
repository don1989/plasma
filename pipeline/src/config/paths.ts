/**
 * Centralized path resolution for the pipeline.
 *
 * Source directories (bible, manga) are READ-ONLY.
 * Only the output directory is writable by pipeline stages.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Project root is three levels up from config/ -> src/ -> pipeline/ -> project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// Pipeline root is two levels up from config/ -> src/ -> pipeline/
const PIPELINE_ROOT = path.resolve(__dirname, '..', '..');

export const PATHS = {
  /** Canon story bible (READ-ONLY). */
  bible: path.join(PROJECT_ROOT, '01_bible'),

  /** Manga scripts and prompts (READ-ONLY). */
  manga: path.join(PROJECT_ROOT, '03_manga'),

  /** Prompt templates directory (READ-ONLY). */
  prompts: path.join(PROJECT_ROOT, '03_manga', 'prompts'),

  /** Pipeline output directory (WRITE). */
  output: path.join(PROJECT_ROOT, 'output'),

  /** Pipeline root directory. */
  pipelineRoot: PIPELINE_ROOT,

  /** Character YAML data files. */
  characterData: path.join(PIPELINE_ROOT, 'data', 'characters'),

  /** Nunjucks template files. */
  templates: path.join(PIPELINE_ROOT, 'data', 'templates'),

  /** Style guide configuration. */
  styleGuide: path.join(PIPELINE_ROOT, 'data', 'config', 'style-guide.yaml'),

  /** Character reference sheet output directory. */
  characterOutput: (characterId: string) =>
    path.join(PROJECT_ROOT, 'output', 'characters', characterId),

  /** Chapter-specific output paths. */
  chapterOutput: (chapter: number) => {
    const chNum = String(chapter).padStart(2, '0');
    const root = path.join(PROJECT_ROOT, 'output', `ch-${chNum}`);
    const raw = path.join(root, 'raw');
    return {
      root,
      raw,
      processed: path.join(root, 'processed'),
      lettered: path.join(root, 'lettered'),
      webtoon: path.join(root, 'webtoon'),
      prompts: path.join(root, 'prompts'),
      comfyuiRaw: path.join(raw, 'comfyui'),  // raw/comfyui/ for ComfyUI-generated images
    };
  },
} as const;
