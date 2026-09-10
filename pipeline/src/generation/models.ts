/**
 * Image model registry for fal.ai.
 *
 * Every model here accepts a prompt plus a list of reference image URLs and
 * returns one or more images. They differ in endpoint, how references are
 * cited inside the prompt, and the input schema fields they accept.
 */

export type RefSyntax = 'at-image' | 'natural' | 'runway-tag';
export type Provider = 'fal' | 'runway';

/** Runway wants pixel ratios; map the manga-friendly aspect strings per model family. */
export const RUNWAY_RATIOS: Record<string, Record<string, string>> = {
  gen4: { '3:4': '1080:1440', '4:3': '1440:1080', '1:1': '1024:1024', '16:9': '1920:1080', '9:16': '1080:1920', '21:9': '2112:912' },
  muse: { '3:4': '1344:1792', '4:3': '1792:1344', '1:1': '1600:1600', '16:9': '2016:1152', '9:16': '1152:2016', '21:9': '2352:1008' },
};

/** Tag for the Nth reference image (1-based) in Runway prompts: @ref1, @ref2 ... */
export function runwayTag(index: number): string {
  return `ref${index}`;
}

export interface ModelSpec {
  /** Short alias used on the CLI (`--model nano-banana-pro`). */
  alias: string;
  /** Which API the endpoint lives on. */
  provider: Provider;
  /** fal.ai endpoint ID. */
  endpoint: string;
  /** Maximum reference images per request. */
  maxRefs: number;
  /**
   * How references are cited in the prompt:
   * - 'at-image': Kling style `@Image1`, `@Image2`
   * - 'natural': plain language, "the character in image 1"
   * - 'runway-tag': Runway style `@ref1`, `@ref2` (tags from runwayTag())
   */
  refSyntax: RefSyntax;
  /** Supported resolution strings for this endpoint. */
  resolutions: readonly string[];
  /** Approximate USD per image, for logging. */
  approxCost: number;
  /** Hard prompt length cap enforced by the API, if any. */
  maxPromptChars?: number;
}

export const MODELS: Record<string, ModelSpec> = {
  'kling-o1': {
    alias: 'kling-o1',
    provider: 'fal',
    endpoint: 'fal-ai/kling-image/o1',
    maxRefs: 10,
    refSyntax: 'at-image',
    resolutions: ['1K', '2K'],
    approxCost: 0.028,
  },
  'nano-banana-pro': {
    alias: 'nano-banana-pro',
    provider: 'fal',
    endpoint: 'fal-ai/nano-banana-pro/edit',
    maxRefs: 14,
    refSyntax: 'natural',
    resolutions: ['1K', '2K', '4K'],
    approxCost: 0.15,
  },
  'nano-banana-2': {
    alias: 'nano-banana-2',
    provider: 'fal',
    endpoint: 'fal-ai/nano-banana-2/edit',
    maxRefs: 14,
    refSyntax: 'natural',
    resolutions: ['0.5K', '1K', '2K', '4K'],
    approxCost: 0.08,
  },
  'runway-gen4': {
    alias: 'runway-gen4',
    provider: 'runway',
    endpoint: 'gen4_image',
    maxRefs: 3,
    refSyntax: 'runway-tag',
    resolutions: ['1K', '2K'],
    approxCost: 0.08,
    maxPromptChars: 1000,
  },
  'runway-gen4-turbo': {
    alias: 'runway-gen4-turbo',
    provider: 'runway',
    endpoint: 'gen4_image_turbo',
    maxRefs: 3,
    refSyntax: 'runway-tag',
    resolutions: ['1K', '2K'],
    approxCost: 0.02,
    maxPromptChars: 1000,
  },
  'runway-muse': {
    alias: 'runway-muse',
    provider: 'runway',
    endpoint: 'muse_image',
    maxRefs: 10,
    refSyntax: 'natural',
    resolutions: ['1K', '2K'],
    approxCost: 0.01,
  },
};

export const DEFAULT_MODEL = 'runway-muse';

/**
 * Resolve a model by alias or full endpoint ID. Throws on unknown names.
 */
export function resolveModel(name?: string): ModelSpec {
  const key = name ?? DEFAULT_MODEL;
  const byAlias = MODELS[key];
  if (byAlias) return byAlias;
  const byEndpoint = Object.values(MODELS).find((m) => m.endpoint === key);
  if (byEndpoint) return byEndpoint;
  throw new Error(
    `Unknown model "${key}". Known models: ${Object.keys(MODELS).join(', ')}`,
  );
}

/**
 * Build the prompt fragment that binds reference images to character IDs.
 * `refGroups` is ordered; image indices are 1-based and sequential across groups.
 */
export function buildRefBindings(
  model: ModelSpec,
  refGroups: Array<{ label: string; count: number }>,
): string {
  const parts: string[] = [];
  let index = 1;
  for (const group of refGroups) {
    if (group.count === 0) continue;
    const first = index;
    const last = index + group.count - 1;
    if (model.refSyntax === 'runway-tag') {
      const tags = [];
      for (let i = first; i <= last; i++) tags.push(`@${runwayTag(i)}`);
      parts.push(`${tags.join(' ')} ${group.count === 1 ? 'is' : 'are all'} ${group.label}.`);
    } else if (model.refSyntax === 'at-image') {
      const tags = [];
      for (let i = first; i <= last; i++) tags.push(`@Image${i}`);
      parts.push(`${tags.join(' ')} ${group.count === 1 ? 'is' : 'are all'} ${group.label}.`);
    } else {
      const range = first === last ? `image ${first}` : `images ${first}-${last}`;
      parts.push(`The character in ${range} is ${group.label}.`);
    }
    index = last + 1;
  }
  return parts.join(' ');
}
