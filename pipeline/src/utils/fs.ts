/**
 * File system helpers for the pipeline.
 */
import { existsSync, accessSync, constants } from 'node:fs';
import { mkdir } from 'node:fs/promises';

/**
 * Create a directory recursively if it doesn't exist.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Check if a directory exists and is readable.
 */
export function isReadableDir(dirPath: string): boolean {
  try {
    if (!existsSync(dirPath)) return false;
    accessSync(dirPath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Assert that a source directory exists and is readable.
 * Throws a descriptive error if not.
 */
export function assertSourceDir(dirPath: string, name: string): void {
  if (!isReadableDir(dirPath)) {
    throw new Error(
      `${name} directory not found or not readable: ${dirPath}`,
    );
  }
}
