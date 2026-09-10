import type { AspectRatio, DialogueLinePlan } from '../types/page-plan.js';

/** Shot type from the script → generation aspect ratio. */
export function aspectForShot(shotType: string): AspectRatio {
  const s = shotType.toLowerCase();
  if (s.includes('medium-wide') || s.includes('medium wide')) return '4:3';
  if (s.includes('wide')) return '16:9';
  if (s.includes('close')) return '1:1';
  return '3:4';
}

/**
 * First on-panel speaker goes left, second right, then alternate.
 * Narration and speakers not on the panel get no side (balloon goes top-centre).
 */
export function assignSpeakerSides(
  dialogue: DialogueLinePlan[],
  charactersOnPanel: string[],
): Record<string, 'left' | 'right'> {
  const onPanel = new Set(charactersOnPanel.map((c) => c.toUpperCase()));
  const sides: Record<string, 'left' | 'right'> = {};
  let next: 'left' | 'right' = 'left';
  for (const line of dialogue) {
    if (line.type === 'narration') continue;
    const key = line.character;
    if (!onPanel.has(key.toUpperCase())) continue;
    if (sides[key]) continue;
    sides[key] = next;
    next = next === 'left' ? 'right' : 'left';
  }
  return sides;
}

export interface EmphasisInput { panelNumber: number; dialogueCount: number; notes: string }

const EMPHASIS_WORDS = /reveal|beat|!|hero|money shot|dominant/i;

/** The panel that gets the biggest slot on the page. */
export function pickEmphasisPanel(panels: EmphasisInput[]): number {
  if (panels.length === 0) return 1;
  const max = Math.max(...panels.map((p) => p.dialogueCount));
  const top = panels.filter((p) => p.dialogueCount === max);
  if (top.length === 1 && max > 0) return top[0]!.panelNumber;
  const flagged = top.find((p) => EMPHASIS_WORDS.test(p.notes));
  if (flagged) return flagged.panelNumber;
  return panels[panels.length - 1]!.panelNumber;
}
