/**
 * Keys reach the modes as one joined string, and the non-character keys are
 * multi-character tokens within it: `<up>`, `<s-tab>`, `<pagedown>`. A mode
 * that wants "the single key the user pressed" has to split the chain rather
 * than index into it, or pressing Up in replace-char mode replaces the
 * character with a literal `<`.
 */
export function splitKeyTokens(chain: string): string[] {
  return chain.match(/<[^<>]+>|[\s\S]/g) ?? [];
}

/** Whether a single token is a non-character key such as `<up>`. */
export function isNonCharacterKey(token: string): boolean {
  return token.length > 1 && token.startsWith("<") && token.endsWith(">");
}

/**
 * The single character the chain represents, or null if it isn't exactly one
 * character -- either because more keys are still coming, or because the user
 * pressed something like an arrow key that has no character to work with.
 */
export function singleCharacter(chain: string): string | null {
  const tokens = splitKeyTokens(chain);
  if (tokens.length !== 1 || isNonCharacterKey(tokens[0])) {
    return null;
  }
  return tokens[0];
}
