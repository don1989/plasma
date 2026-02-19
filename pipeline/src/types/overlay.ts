/**
 * Overlay-specific types for the dialogue overlay stage.
 *
 * These types model speech balloons, SFX text, and page-level
 * overlay data used by the renderer to composite text onto
 * panel images.
 */

import type { DialogueLine } from './manga.js';

/** Balloon visual style — maps from DialogueLine.type. */
export type BalloonType = 'speech' | 'thought' | 'narration';

/** Configuration for a single speech balloon. */
export interface BalloonConfig {
  text: string;
  type: BalloonType;
  x: number;
  y: number;
  maxWidth?: number;
}

/** Configuration for a single SFX text element. */
export interface SfxConfig {
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
}

/** Overlay data for a single page, derived from script.json. */
export interface PageOverlayData {
  pageNumber: number;
  panelCount: number;
  dialogueLines: DialogueLine[];
  sfx: string;
  isSplash: boolean;
  isDoubleSpread: boolean;
}

/** Global configuration for the overlay renderer. */
export interface OverlayConfig {
  font: string;
  fontSize: number;
  dpi: number;
  balloonPadding: { x: number; y: number };
  maxBalloonWidth: number;
  sfxFont: string;
  sfxFontSize: number;
  sfxColor: string;
}

/** Sensible default overlay configuration. */
export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  font: 'sans-serif',
  fontSize: 14,
  dpi: 150,
  balloonPadding: { x: 20, y: 15 },
  maxBalloonWidth: 280,
  sfxFont: 'Impact',
  sfxFontSize: 22,
  sfxColor: '#CC0000',
};

// ---------------------------------------------------------------------------
// Assembly types (used by the Webtoon strip assembly stage)
// ---------------------------------------------------------------------------

/** Configuration for the Webtoon assembly stage. */
export interface AssemblyConfig {
  /** Strip width in pixels. */
  width: number;
  /** Height of black gutter between panels in pixels. */
  gutterHeight: number;
  /** Gutter fill color (RGBA). */
  gutterColor: { r: number; g: number; b: number; alpha: number };
  /** Target slice height for Webtoon strips in pixels. */
  sliceHeight: number;
  /** JPEG quality (1-100, mozjpeg). */
  jpegQuality: number;
  /** Output image format. */
  format: 'jpeg' | 'png';
}

/** Default Webtoon Canvas output configuration. */
export const WEBTOON_CONFIG: AssemblyConfig = {
  width: 800,
  gutterHeight: 10,
  gutterColor: { r: 0, g: 0, b: 0, alpha: 1 },
  sliceHeight: 1280,
  jpegQuality: 90,
  format: 'jpeg',
};

/** Metadata for a single panel image used in assembly. */
export interface PanelMetadata {
  /** Absolute path to the panel image file. */
  path: string;
  /** Original image width in pixels. */
  width: number;
  /** Original image height in pixels. */
  height: number;
  /** Page number in the chapter. */
  pageNumber: number;
  /** Whether this is a splash page (full-page art). */
  isSplash: boolean;
  /** Whether this is a double-spread page. */
  isDoubleSpread: boolean;
}

/** Result from assembling panels into a vertical strip. */
export interface AssemblyResult {
  /** The composited vertical strip as a raw PNG buffer. */
  stripBuffer: Buffer;
  /** Total height of the composited strip in pixels. */
  totalHeight: number;
  /** Number of panels composited. */
  panelCount: number;
}
