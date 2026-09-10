/**
 * Character reference generation stage.
 *
 * Produces candidate reference images for a character from its canon YAML.
 * Candidates land in output/characters/<id>/candidates/ and are promoted
 * into pipeline/data/characters/<id>/references/ only after review
 * (`reference add`). Existing references are fed back in as image inputs so
 * new views stay locked to the approved look.
 */

import { existsSync } from 'node:fs';
import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import { PATHS } from '../config/paths.js';
import { configureProvider, generateImage, downloadAndSave } from '../generation/kling-client.js';
import { resolveModel, buildRefBindings } from '../generation/models.js';
import { loadCharacterReferences } from '../generation/references.js';
import { loadEnvFile } from '../utils/env.js';

export type ReferenceView = 'front' | 'three-quarter' | 'side' | 'back' | 'face' | 'action';

const VIEW_PROMPTS: Record<ReferenceView, string> = {
  front:
    'FULL-BODY FRONT VIEW: standing upright, facing directly toward the viewer, feet shoulder-width apart, ' +
    'arms relaxed at the sides so both hands and both knees are fully visible. Head to boots in frame.',
  'three-quarter':
    'FULL-BODY 3/4 VIEW: body turned about 45 degrees to the viewer\'s right, head turned the same way, ' +
    'showing clear depth on the torso and belt. Both belt-mounted items visible. Head to boots in frame.',
  side:
    'FULL-BODY SIDE PROFILE: exactly 90 degrees, facing the viewer\'s right, pure profile silhouette. ' +
    'Only the near arm and near leg are fully visible. Head to boots in frame.',
  back:
    'FULL-BODY BACK VIEW: facing directly away from the viewer, back of the head and back of the outfit fully ' +
    'visible, arms relaxed. Any back insignia is the dominant feature. Head to boots in frame.',
  face:
    'HEAD AND SHOULDERS PORTRAIT: face fills the frame, neutral three-quarter lighting, eyes level with camera, ' +
    'hair and headwear fully visible, canonical expression.',
  action:
    'FULL-BODY DYNAMIC ACTION POSE: mid-motion combat stance with primary weapon active, low camera angle, ' +
    'strong silhouette. Every costume element still visible and correct.',
};

const SHEET_STYLE =
  'Colored manga character reference art on a plain flat white background, no scenery, no text, no labels, ' +
  'no panel borders. Cel-shaded, clean medium-thick linework, vibrant saturated colors, anime and manga ' +
  'proportions, high-resolution professional finish. Not photoreal, not painterly, not 3D-rendered. ' +
  'One character only, exactly one figure in the image.';

export interface ReferenceGenerateOptions {
  characterId: string;
  view: ReferenceView;
  model?: string;
  resolution?: string;
  /** Extra instruction appended after the canon spec. */
  extra?: string;
  /** Additional local images to include as references (e.g. a hand-picked candidate). */
  extraRefs?: string[];
  /** Skip existing references (pure text-to-image via Kling). */
  noRefs?: boolean;
  count?: number;
  seed?: number;
  notes?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

export interface ReferenceGenerateResult {
  success: boolean;
  outputFiles: string[];
  errors: string[];
}

interface CharacterYaml {
  id: string;
  name: string;
  fingerprint?: string;
  reference_sheet_prompt?: string;
}

async function loadCharacterYaml(characterId: string): Promise<CharacterYaml> {
  const file = path.join(PATHS.characterData, `${characterId}.yaml`);
  if (!existsSync(file)) throw new Error(`No character YAML at ${file}`);
  return parseYaml(await readFile(file, 'utf-8')) as CharacterYaml;
}

export function buildReferencePrompt(char: CharacterYaml, view: ReferenceView, extra?: string): string {
  const spec = (char.reference_sheet_prompt ?? char.fingerprint ?? '').trim();
  if (!spec) throw new Error(`Character ${char.id} has neither reference_sheet_prompt nor fingerprint`);
  return [
    `Single character reference image of ${char.name}.`,
    VIEW_PROMPTS[view],
    'CANON SPEC (follow every line exactly):',
    spec,
    extra?.trim() ?? '',
    SHEET_STYLE,
  ].filter(Boolean).join('\n\n');
}

export async function runReferenceGenerate(options: ReferenceGenerateOptions): Promise<ReferenceGenerateResult> {
  const errors: string[] = [];
  const outputFiles: string[] = [];

  const env = loadEnvFile(`${PATHS.pipelineRoot}/.env`);
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;

  let model;
  try {
    model = resolveModel(options.model);
    if (!options.dryRun) configureProvider(model);
  } catch (e) {
    return { success: false, outputFiles, errors: [(e as Error).message] };
  }

  const char = await loadCharacterYaml(options.characterId);
  const existingRefs = options.noRefs ? [] : await loadCharacterReferences(options.characterId);
  const refs = [...existingRefs, ...(options.extraRefs ?? [])].slice(0, model.maxRefs);

  let prompt = buildReferencePrompt(char, options.view, options.extra);
  if (refs.length > 0) {
    const binding = buildRefBindings(model, [{ label: `${char.name} (approved canon look)`, count: refs.length }]);
    prompt = `${binding} Reproduce this exact character, costume, colors, and face in the new view. ${prompt}`;
  }

  const outDir = path.join(PATHS.characterOutput(options.characterId), 'candidates');
  await mkdir(outDir, { recursive: true });
  const existing = (await readdir(outDir)).filter((f) => f.startsWith(`${options.view}_v`));
  let version = 1;
  for (const f of existing) {
    const m = f.match(/_v(\d+)\.png$/);
    if (m) version = Math.max(version, parseInt(m[1]!) + 1);
  }

  console.log(`[${options.characterId}] ${options.view} via ${model.endpoint} (${refs.length} refs)`);
  if (options.verbose) console.log(`  Prompt:\n${prompt}\n`);
  if (options.dryRun) {
    console.log(`  [dry-run] would write ${path.join(outDir, `${options.view}_v${version}.png`)}`);
    return { success: true, outputFiles, errors };
  }

  try {
    const result = await generateImage({
      model: model.alias,
      prompt,
      imageUrls: refs,
      aspectRatio: options.view === 'face' ? '1:1' : '3:4',
      resolution: options.resolution ?? '2K',
      count: options.count ?? 1,
      seed: options.seed,
    });
    if (result.imageUrls.length === 0) {
      errors.push('no images returned');
    }
    for (const url of result.imageUrls) {
      const file = path.join(outDir, `${options.view}_v${version}.png`);
      await downloadAndSave(url, file);
      await writeFile(`${file}.log.json`, JSON.stringify({
        characterId: options.characterId,
        view: options.view,
        version,
        requestId: result.requestId,
        model: result.model.endpoint,
        refs,
        prompt,
        notes: options.notes ?? '',
        timestamp: new Date().toISOString(),
      }, null, 2));
      outputFiles.push(file);
      console.log(`  Saved: ${file}`);
      version++;
    }
  } catch (e) {
    errors.push((e as Error).message);
    console.error(`  Error: ${(e as Error).message}`);
  }

  return { success: errors.length === 0, outputFiles, errors };
}
