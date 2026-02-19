/**
 * Template token replacement for ComfyUI workflow JSON templates.
 *
 * Tokens are {{PLACEHOLDER}} style. In the JSON template, string tokens
 * are wrapped in quotes ("{{PROMPT_TEXT}}") and the seed token is also
 * quoted ("{{SEED}}") but must be replaced as a bare integer.
 *
 * CRITICAL: seed replacement strips the surrounding JSON quotes so the
 * resulting JSON has `"seed": 12345` not `"seed": "12345"`.
 */

/** Documentation map of the 5 supported token names. */
export const TOKENS = {
  PROMPT_TEXT: '{{PROMPT_TEXT}}',
  NEGATIVE_PROMPT: '{{NEGATIVE_PROMPT}}',
  SEED: '{{SEED}}',
  LORA_NAME: '{{LORA_NAME}}',
  CHECKPOINT_NAME: '{{CHECKPOINT_NAME}}',
} as const;

/**
 * Escape a string value for safe injection into a JSON string literal.
 *
 * JSON.stringify produces a full JSON string including outer quotes.
 * Slicing off the outer quotes gives us the escaped content only, which
 * is safe to drop directly into an existing JSON string slot.
 *
 * This handles all control characters (\n, \t, \r), backslashes,
 * Unicode escapes, em-dashes, and any other characters that would
 * break a raw JSON string substitution.
 */
function jsonEscapeString(s: string): string {
  return JSON.stringify(s).slice(1, -1);
}

/**
 * Fill all placeholder tokens in a workflow JSON string.
 *
 * @param templateJson  Raw JSON string read from a workflow template file.
 * @param values        Map of token name → replacement value.
 *                      `seed` must be provided as a number so it can be
 *                      injected as a JSON integer (not a string).
 * @returns             The filled JSON string, ready to POST to ComfyUI.
 */
export function slotFill(
  templateJson: string,
  values: Record<string, string | number>,
): string {
  let result = templateJson;

  // Seed must be injected as a bare integer — strip the surrounding JSON quotes.
  // Template has:  "seed": "{{SEED}}"
  // Result must be: "seed": 12345
  if ('seed' in values) {
    result = result.replace('"{{SEED}}"', String(values['seed']));
  }

  // String tokens: escape values for safe JSON string injection before substitution.
  // Raw replacement breaks JSON when the value contains newlines, em-dashes, etc.
  if ('prompt_text' in values) {
    result = result.replaceAll('{{PROMPT_TEXT}}', jsonEscapeString(String(values['prompt_text'])));
  }
  if ('negative_prompt' in values) {
    result = result.replaceAll('{{NEGATIVE_PROMPT}}', jsonEscapeString(String(values['negative_prompt'])));
  }
  if ('lora_name' in values) {
    result = result.replaceAll('{{LORA_NAME}}', jsonEscapeString(String(values['lora_name'])));
  }
  if ('checkpoint_name' in values) {
    result = result.replaceAll('{{CHECKPOINT_NAME}}', jsonEscapeString(String(values['checkpoint_name'])));
  }

  return result;
}
