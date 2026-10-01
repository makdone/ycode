/**
 * Guards for Tailwind class candidates before they reach the compiler.
 *
 * Tailwind v4 copies arbitrary values (`ml-[…]`) into the emitted declaration
 * verbatim. A malformed candidate such as `ml-[12 mr-[12 rem] pb-[0rem] pt-[1rem]`
 * therefore compiles to `margin-left: 12 mr-[12 rem] pb-[0rem] pt-[1rem;` — an
 * unclosed `[`. Browsers treat `[` as the start of a simple block and consume
 * input until the matching `]`, so every rule after that point in the
 * stylesheet is silently discarded and the page renders unstyled.
 */

const BRACKET_PAIRS: Record<string, string> = {
  '[': ']',
  '(': ')',
};

/**
 * True when a class token can be handed to the Tailwind compiler without
 * risking a declaration that breaks the rest of the stylesheet.
 *
 * Rejects tokens that contain whitespace, unbalanced or mismatched `[]` / `()`,
 * an odd number of quotes, or characters that can terminate a CSS block or
 * declaration (`{`, `}`, `;`).
 */
export function isSafeTailwindCandidate(token: string): boolean {
  if (!token) return false;
  if (/\s/.test(token)) return false;
  if (/[{};]/.test(token)) return false;

  let singleQuotes = 0;
  let doubleQuotes = 0;
  const stack: string[] = [];

  for (const ch of token) {
    if (ch === '\'') singleQuotes++;
    else if (ch === '"') doubleQuotes++;
    else if (ch in BRACKET_PAIRS) stack.push(BRACKET_PAIRS[ch]);
    else if (ch === ']' || ch === ')') {
      if (stack.pop() !== ch) return false;
    }
  }

  if (stack.length > 0) return false;
  if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) return false;

  return true;
}

/**
 * Split a class attribute value into individual candidates, dropping anything
 * `isSafeTailwindCandidate` rejects.
 */
export function extractSafeTailwindCandidates(classValue: string): string[] {
  return classValue.split(/\s+/).filter(isSafeTailwindCandidate);
}
