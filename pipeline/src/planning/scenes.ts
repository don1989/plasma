/**
 * Scene continuity: maps chapter pages (optionally specific panels) to a
 * location whose setting text and reference images are injected into every
 * panel prompt on that page. Pipeline-owned data under data/scenes and
 * data/locations; never reads story files.
 */
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { PATHS } from '../config/paths.js';

export interface SceneEntry { pages: [number, number]; panels?: number[]; locationId: string }
export interface Location { id: string; name: string; setting: string }

export const LOCATIONS_DIR = path.join(PATHS.pipelineRoot, 'data', 'locations');
export const SCENES_DIR = path.join(PATHS.pipelineRoot, 'data', 'scenes');

export async function loadScenes(chapter: number, scenesDir = SCENES_DIR): Promise<SceneEntry[]> {
  const file = path.join(scenesDir, `ch${String(chapter).padStart(2, '0')}.yaml`);
  if (!existsSync(file)) return [];
  const data = parseYaml(await readFile(file, 'utf-8')) as { scenes?: SceneEntry[] };
  return data.scenes ?? [];
}

export async function loadLocation(id: string, locationsDir = LOCATIONS_DIR): Promise<Location | null> {
  const file = path.join(locationsDir, `${id}.yaml`);
  if (!existsSync(file)) return null;
  const data = parseYaml(await readFile(file, 'utf-8')) as Location;
  return { id: data.id ?? id, name: data.name ?? id, setting: (data.setting ?? '').trim() };
}

/** First matching entry wins; entries with a `panels` list only match those panels. */
export function findScene(scenes: SceneEntry[], page: number, panel: number): SceneEntry | undefined {
  return scenes.find((s) => page >= s.pages[0] && page <= s.pages[1] && (!s.panels || s.panels.includes(panel)));
}

/** Reference images for a location, sorted, or [] when none exist yet. */
export async function loadLocationReferences(id: string, locationsDir = LOCATIONS_DIR): Promise<string[]> {
  const dir = path.join(locationsDir, id, 'references');
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort().map((f) => path.join(dir, f));
}
