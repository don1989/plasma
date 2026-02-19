/**
 * In-memory job store for the ComfyUI Express bridge.
 * Uses a module-level Map singleton — no persistence, resets on restart.
 */
import { randomUUID } from 'node:crypto';
import type { JobState } from './types.js';

const store = new Map<string, JobState>();

/**
 * Create a new job entry in the store.
 * Generates a UUID, sets status to 'queued', and stamps timestamps.
 */
export function createJob(req: Partial<JobState> = {}): JobState {
  const now = new Date().toISOString();
  const job: JobState = {
    jobId: randomUUID(),
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    ...req,
  };
  store.set(job.jobId, job);
  return job;
}

/**
 * Retrieve a job by ID.
 * Returns undefined if not found.
 */
export function getJob(jobId: string): JobState | undefined {
  return store.get(jobId);
}

/**
 * Apply a partial patch to an existing job.
 * Updates the updatedAt timestamp.
 * Returns the updated job, or undefined if not found.
 */
export function updateJob(jobId: string, patch: Partial<JobState>): JobState | undefined {
  const existing = store.get(jobId);
  if (!existing) return undefined;
  const updated: JobState = {
    ...existing,
    ...patch,
    jobId: existing.jobId,       // jobId is immutable
    createdAt: existing.createdAt, // createdAt is immutable
    updatedAt: new Date().toISOString(),
  };
  store.set(jobId, updated);
  return updated;
}
