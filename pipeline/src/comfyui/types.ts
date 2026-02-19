/**
 * Shared types for the ComfyUI Express bridge service.
 */

export type JobStatus = 'queued' | 'running' | 'complete' | 'failed';

export interface JobRequest {
  prompt_text: string;
  negative_prompt?: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  resolution: { width: number; height: number };
  checkpoint_name?: string;
}

export interface JobState {
  jobId: string;
  status: JobStatus;
  promptId?: string;
  imagePath?: string;   // absolute path to image in raw/comfyui/
  imageFile?: string;   // bare filename e.g. ch01_p001_v1.png
  error?: string;
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}

export interface ComfyMessage {
  type: string;
  data: {
    node: string | null;
    prompt_id?: string;
    value?: number;
    max?: number;
  };
}

export interface HistoryEntry {
  outputs: Record<string, {
    images: Array<{
      filename: string;
      subfolder: string;
      type: 'output' | 'temp' | 'input';
    }>;
  }>;
  status: { completed: boolean };
}
