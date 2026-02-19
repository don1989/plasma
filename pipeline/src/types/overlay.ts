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
