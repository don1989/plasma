export interface PanelPromptInput {
  stylePrefix: string;
  action: string;
  notes: string;
  shotType: string;
  fingerprints: Array<{ id: string; name: string; fingerprint: string }>;
  speakerSides: Record<string, 'left' | 'right'>;
  /** Display name per script speaker key, e.g. { 'PUNK 1': 'the punk leader' } */
  speakerNames: Record<string, string>;
}

const CLOSER =
  'Single manga panel, one continuous scene, no panel borders inside the image. ' +
  'Leave clear headroom above the characters for dialogue balloons. ' +
  'NO text, NO speech balloons, NO sound-effect lettering, NO captions.';

/**
 * Assembles the Gemini prompt for a single panel, in order: style prefix,
 * action, notes, CHARACTERS block, FRAMING line, closer.
 */
export function buildPanelPrompt(input: PanelPromptInput): string {
  const parts: string[] = [];
  const stylePrefix = input.stylePrefix.trim();
  if (stylePrefix) parts.push(stylePrefix);
  const action = input.action.trim();
  if (action) parts.push(action);
  const notes = input.notes.trim();
  if (notes) parts.push(notes);

  if (input.fingerprints.length > 0) {
    parts.push('CHARACTERS (match the reference images; these specs are canon):\n' +
      input.fingerprints.map((f) => `- ${f.fingerprint.trim()}`).join('\n'));
  }

  const framing: string[] = [`FRAMING: ${input.shotType.trim().toUpperCase()} shot.`];
  for (const [key, side] of Object.entries(input.speakerSides)) {
    framing.push(`${input.speakerNames[key] ?? key} on the ${side} of the frame.`);
  }
  parts.push(framing.join(' '));
  parts.push(CLOSER);
  return parts.join('\n\n');
}
