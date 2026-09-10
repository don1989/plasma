/**
 * Location reference generation: a wide establishing image of a location from
 * its setting text, saved to output/locations/<id>/candidates/<model>/ for review.
 * Promote by copying into pipeline/data/locations/<id>/references/.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StageResult } from '../types/pipeline.js';
import { PATHS } from '../config/paths.js';
import { loadEnvFile } from '../utils/env.js';
import { resolveModel } from '../generation/models.js';
import { loadLocation } from '../planning/scenes.js';

export async function runLocationGenerate(options: { locationId: string; model?: string; count?: number; extra?: string; dryRun?: boolean }): Promise<StageResult> {
  const start = Date.now();
  const env = loadEnvFile(`${PATHS.pipelineRoot}/.env`);
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
  const loc = await loadLocation(options.locationId);
  if (!loc) return { stage: 'location', success: false, outputFiles: [], errors: [`No location YAML: data/locations/${options.locationId}.yaml`], duration: Date.now() - start };
  const model = resolveModel(options.model);
  const prompt = [
    `Wide establishing shot of ${loc.name}, no characters, no people in the foreground.`,
    loc.setting, options.extra?.trim() ?? '',
    'Colored manga background art, cel-shaded, clean linework, vibrant colors, consistent architecture. No text, no lettering, no panel borders.',
  ].filter(Boolean).join('\n\n');
  const outDir = path.join(PATHS.output, 'locations', options.locationId, 'candidates', model.alias);
  await mkdir(outDir, { recursive: true });
  const existing = (await readdir(outDir)).filter((f) => /^wide_v\d+\.png$/.test(f));
  let version = existing.reduce((n, f) => Math.max(n, parseInt(f.match(/_v(\d+)/)![1]!)), 0) + 1;
  console.log(`[location] ${options.locationId} via ${model.endpoint}`);
  if (options.dryRun) { console.log(`  [dry-run] would write ${path.join(outDir, `wide_v${version}.png`)}\n${prompt}`); return { stage: 'location', success: true, outputFiles: [], errors: [], duration: Date.now() - start }; }
  const { configureProvider, generateImage, downloadAndSave } = await import('../generation/kling-client.js');
  configureProvider(model);
  const res = await generateImage({ model: model.alias, prompt, imageUrls: [], aspectRatio: '16:9', resolution: '2K', count: options.count ?? 1 });
  const outputFiles: string[] = [];
  for (const url of res.imageUrls) {
    const file = path.join(outDir, `wide_v${version++}.png`);
    await downloadAndSave(url, file);
    await writeFile(`${file}.log.json`, JSON.stringify({ locationId: options.locationId, model: res.model.endpoint, requestId: res.requestId, prompt, timestamp: new Date().toISOString() }, null, 2));
    outputFiles.push(file); console.log(`  Saved: ${file}`);
  }
  return { stage: 'location', success: outputFiles.length > 0, outputFiles, errors: outputFiles.length ? [] : ['no images returned'], duration: Date.now() - start };
}
