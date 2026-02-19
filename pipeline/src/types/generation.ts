/**
 * Types for the image generation workflow.
 */

/** Parsed components of a panel image filename. */
export interface PanelImageName {
  chapter: number;
  page: number;
  version: number;
  filename: string;
  extension: string;
}

/** A single entry in the generation log tracking prompt-to-image mapping. */
export interface GenerationLogEntry {
  /** Output image filename (e.g. ch01_p003_v1.png). */
  imageFile: string;
  /** Path to the prompt file used. */
  promptFile: string;
  /** SHA-256 hash of the prompt text for traceability. */
  promptHash: string;
  /** Gemini model used for generation. */
  model: string;
  /** ISO 8601 timestamp of generation. */
  timestamp: string;
  /** Image version number. */
  version: number;
  /** Whether this version has been approved for use. */
  approved: boolean;
  /** Optional notes about the generation result. */
  notes?: string;
  /** Full prompt text for absolute traceability. */
  promptText?: string;
  /** Generation source — 'gemini' (manual/api) or 'comfyui'. Absent for legacy entries. */
  source?: 'gemini' | 'comfyui';
  /** For comfyui-sourced images: absolute path to source file in raw/comfyui/ before promotion. */
  sourcePath?: string;
}

/** Manifest tracking all generated images for a chapter. */
export interface GenerationManifest {
  /** Chapter number. */
  chapter: number;
  /** Pipeline version that created this manifest. */
  pipelineVersion: string;
  /** All generation log entries for the chapter. */
  entries: GenerationLogEntry[];
}
