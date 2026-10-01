/**
 * Request-scoped pagination context for the paginated page routes.
 *
 * SERVER-ONLY: uses React's request cache.
 */

import 'server-only';

import { cache } from 'react';
import { stripLayerPrefix } from '@/lib/pagination-url-utils';
import type { PaginationContext } from '@/lib/page-fetcher';

/** Stable query string from Next's resolved `searchParams` (sorted, so equivalent URLs share a cache entry). */
export function toQueryString(
  searchParams: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else if (value !== undefined) {
      params.append(key, value);
    }
  }

  params.sort();
  return params.toString();
}

/**
 * Build the request's pagination context.
 *
 * Memoized on (path, query) so `generateMetadata` and the page render hand the
 * *same* object to `fetchPageByPath` — that fetch is memoized by argument
 * identity, so two equivalent objects would resolve the page twice.
 */
export const getPaginationContext = cache(
  (basePath: string, queryString: string): PaginationContext => {
    const pageNumbers: Record<string, number> = {};

    for (const [key, value] of new URLSearchParams(queryString)) {
      if (!key.startsWith('p_')) continue;

      const pageNum = parseInt(value, 10);
      if (isNaN(pageNum) || pageNum < 1) continue;

      // The `p_` param carries the layer id with its `lyr-` prefix stripped.
      // Native layers are `lyr-`-prefixed, migrated (legacy) layers use bare
      // uids — register both forms so `resolveCollectionLayers`, which looks up
      // `pageNumbers[layer.id]`, matches whichever the layer actually uses
      // (otherwise the page number is dropped and the list renders page 1).
      const bareId = stripLayerPrefix(key.slice(2));
      pageNumbers[bareId] = pageNum;
      pageNumbers[`lyr-${bareId}`] = pageNum;
    }

    return { pageNumbers, defaultPage: 1, basePath, queryString };
  }
);
