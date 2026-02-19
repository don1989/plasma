import { existsSync, readFileSync } from 'node:fs';

/**
 * Load environment variables from a .env file without dotenv as a dependency.
 * Parses KEY=value pairs, skipping comments and empty lines.
 * Returns an empty object if the file doesn't exist.
 */
export function loadEnvFile(envPath: string): Record<string, string> {
  if (!existsSync(envPath)) return {};

  const content = readFileSync(envPath, 'utf-8');
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    result[key] = value;
  }

  return result;
}
