/**
 * Server-side Tailwind compiler for stored (per-page / global) CSS.
 *
 * Every call compiles exactly the candidates it is given. Tailwind's
 * `compile().build()` is incremental by design: each `build()` call ADDS its
 * candidates to the compiler's internal set and re-emits CSS for the union.
 * Reusing one compiler across pages therefore leaks every previously compiled
 * class into every later stylesheet — the output grows without bound, and a
 * single malformed candidate from one page (or, in multi-tenant deployments,
 * one tenant) poisons the CSS of everything compiled after it in the same
 * process. Only the parsed Tailwind input is cached; the compiler itself is
 * created per build (a few milliseconds).
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { compile } from 'tailwindcss';
import { isSafeTailwindCandidate } from '@/lib/tailwind-candidate-utils';
import { TAILWIND_CUSTOM_VARIANTS } from '@/lib/tailwind-custom-variants';

export const EMPTY_CSS_PLACEHOLDER = '/* No classes to generate */';

let compilerInputCache: Promise<string> | null = null;

/**
 * Tailwind's base stylesheet plus the project's custom variants. Read once;
 * the file never changes for the lifetime of the process.
 */
function getCompilerInput(): Promise<string> {
  if (!compilerInputCache) {
    const twPath = join(process.cwd(), 'node_modules/tailwindcss/index.css');
    // Register custom variants (current:, disabled:) so user classes like
    // `current:opacity-100` on slider bullets compile — mirrors the client
    // generator and app/globals.css.
    compilerInputCache = readFile(twPath, 'utf-8').then(
      baseInput => `${baseInput}\n${TAILWIND_CUSTOM_VARIANTS}\n`,
    );
  }
  return compilerInputCache;
}

async function createCompiler() {
  return compile(await getCompilerInput(), {
    base: process.cwd(),
    async loadStylesheet(id: string, base: string) {
      const fullPath = join(dirname(base), id);
      const content = await readFile(fullPath, 'utf-8');
      return { path: fullPath, content, base: dirname(fullPath) };
    },
  });
}

/**
 * Compile a stylesheet containing exactly the given Tailwind candidates.
 * Unsafe candidates (see `isSafeTailwindCandidate`) are dropped so one bad
 * class cannot invalidate the rest of the output.
 */
export async function compileTailwindCss(candidates: Iterable<string>): Promise<string> {
  const safe = Array.from(new Set(candidates)).filter(isSafeTailwindCandidate);
  if (safe.length === 0) return EMPTY_CSS_PLACEHOLDER;

  const compiler = await createCompiler();
  return compiler.build(safe);
}
