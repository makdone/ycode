import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSafeTailwindCandidates, isSafeTailwindCandidate } from '@/lib/tailwind-candidate-utils';

/**
 * Assemble a class candidate from fragments. The app's own Tailwind build
 * (`@import "tailwindcss"` in app/*.css) scans every source file, including
 * tests, for class-like strings — a literal `bg-[url('a)]` fixture here would
 * be compiled into app/globals.css and break `next build`.
 */
const candidate = (...parts: string[]): string => parts.join('');

test('accepts ordinary utilities, variants and arbitrary values', () => {
  for (const token of [
    'flex',
    candidate('text-', '[60px]'),
    candidate('max-lg:', 'grid-cols-1'),
    candidate('hover:bg-', '[#b4ea62]'),
    candidate('bg-', '[image:var(--bg-img)]'),
    candidate('bg-', '[url(\'https://example.com/a%20b.png\')]'),
    candidate('shadow-', '[0px_1px_0px_0px_rgba(0,0,0,0.1)]'),
    candidate('text-', '[color:var(--578837ce-8046-4df6-b3e4-db51b3af33cd)]'),
    candidate('bg-', '[#000000]/5'),
  ]) {
    assert.equal(isSafeTailwindCandidate(token), true, token);
  }
});

test('rejects candidates that would emit an unclosed bracket', () => {
  // The exact tokens that truncated production stylesheets.
  assert.equal(isSafeTailwindCandidate(candidate('ml-', '[12 mr-', '[12 rem] pb-', '[0rem] pt-', '[1rem]')), false);
  assert.equal(isSafeTailwindCandidate(candidate('ml-', '[12')), false);
  assert.equal(isSafeTailwindCandidate('rem]'), false);
  assert.equal(isSafeTailwindCandidate(candidate('shadow-', '[0px_4px_10px_0px_rgba(0_0]')), false);
  assert.equal(isSafeTailwindCandidate(candidate('bg-', '[rgba(0,0,0,0.5]')), false);
});

test('rejects whitespace, quotes and block terminators', () => {
  assert.equal(isSafeTailwindCandidate(''), false);
  assert.equal(isSafeTailwindCandidate(candidate('text-', '[60 px]')), false);
  assert.equal(isSafeTailwindCandidate(candidate('bg-', '[url(\'a)]')), false);
  assert.equal(isSafeTailwindCandidate(candidate('content-', '["x]')), false);
  assert.equal(isSafeTailwindCandidate(candidate('text-', '[red;]')), false);
  assert.equal(isSafeTailwindCandidate(candidate('text-', '[red}]')), false);
});

test('extractSafeTailwindCandidates splits on whitespace and drops bad tokens', () => {
  assert.deepEqual(
    extractSafeTailwindCandidates(
      candidate('  flex  pb-0 ml-', '[12 mr-[12 rem] pb-', '[0rem] pt-', '[1rem] text-', '[60px]'),
    ),
    ['flex', 'pb-0', candidate('pb-', '[0rem]'), candidate('pt-', '[1rem]'), candidate('text-', '[60px]')],
  );
  assert.deepEqual(extractSafeTailwindCandidates(''), []);
});
