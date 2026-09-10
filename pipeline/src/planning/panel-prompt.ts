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

export function buildPanelPrompt(i: PanelPromptInput): string {
  const parts: string[] = [i.stylePrefix.trim(), i.action.trim()];
  if (i.notes.trim()) parts.push(i.notes.trim());

  if (i.fingerprints.length > 0) {
    parts.push('CHARACTERS (match the reference images; these specs are canon):\n' +
      i.fingerprints.map((f) => `- ${f.fingerprint.trim()}`).join('\n'));
  }

  const framing: string[] = [`FRAMING: ${i.shotType.toUpperCase()} shot.`];
  for (const [key, side] of Object.entries(i.speakerSides)) {
    framing.push(`${i.speakerNames[key] ?? key} on the ${side} of the frame.`);
  }
  parts.push(framing.join(' '));
  parts.push(CLOSER);
  return parts.join('\n\n');
}
