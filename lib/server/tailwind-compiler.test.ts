import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileTailwindCss, EMPTY_CSS_PLACEHOLDER } from '@/lib/server/tailwind-compiler';

/**
 * Assemble a class candidate from fragments so the app's own Tailwind build,
 * which scans every source file for class-like strings, ignores these fixtures.
 */
const candidate = (...parts: string[]): string => parts.join('');

/** Count rules in a compiled stylesheet whose declaration block is missing a `]` or `)`. */
function unbalancedDeclarationBlocks(css: string): number {
  let count = 0;
  for (const match of css.matchAll(/\{([^{}]*)\}/g)) {
    const block = match[1];
    const opens = (block.match(/[[(]/g) ?? []).length;
    const closes = (block.match(/[\])]/g) ?? []).length;
    if (opens !== closes) count++;
  }
  return count;
}

test('each build contains only the candidates it was given', async () => {
  const first = await compileTailwindCss(['flex', candidate('text-', '[60px]')]);
  assert.match(first, /\.flex\s*\{/);
  assert.match(first, /\.text-\\\[60px\\\]\s*\{/);

  const second = await compileTailwindCss(['p-4']);
  assert.match(second, /\.p-4\s*\{/);
  // No leakage from the previous build.
  assert.doesNotMatch(second, /\.flex\s*\{/);
  assert.doesNotMatch(second, /text-\\\[60px\\\]/);
});

test('malformed candidates are dropped instead of truncating the stylesheet', async () => {
  const css = await compileTailwindCss([
    'flex',
    candidate('ml-', '[12 mr-[12 rem] pb-', '[0rem] pt-', '[1rem]'),
    candidate('shadow-', '[0px_4px_10px_0px_rgba(0_0]'),
    candidate('text-', '[60px]'),
  ]);
  assert.match(css, /\.flex\s*\{/);
  assert.match(css, /\.text-\\\[60px\\\]\s*\{/);
  assert.doesNotMatch(css, /pt-\[1rem;/);
  assert.equal(unbalancedDeclarationBlocks(css), 0);
});

test('returns a placeholder when nothing compilable remains', async () => {
  assert.equal(await compileTailwindCss([]), EMPTY_CSS_PLACEHOLDER);
  assert.equal(await compileTailwindCss([candidate('ml-', '[12')]), EMPTY_CSS_PLACEHOLDER);
});
