/**
 * Pagination URL Utilities
 *
 * A collection's current page travels in the query string as `p_{layerId}=N`,
 * with the layer's `lyr-` prefix stripped. These helpers build that param and
 * the resulting URLs so the server-rendered pagination links, the client
 * navigation runtime and the SEO link tags all agree on one format.
 *
 * CLIENT-SAFE: pure string/object manipulation, no server-only imports.
 */

import type { CollectionPaginationMeta, Layer } from '@/types';

/** Drop the `lyr-` prefix — native layers carry it, migrated ones use bare uids. */
export function stripLayerPrefix(id: string): string {
  return id.startsWith('lyr-') ? id.slice(4) : id;
}

/**
 * Keep a configured param name usable in a URL. Returns an empty string when
 * nothing usable is left, so callers fall back to the layer id.
 */
export function sanitizePaginationParamName(name?: string | null): string {
  return (name || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

/** Param suffix for a collection: its configured name, else its layer id. */
function paramSuffix(layerId: string, paramName?: string): string {
  return sanitizePaginationParamName(paramName) || stripLayerPrefix(layerId);
}

/** Query param carrying a collection layer's current page. */
export function paginationParamKey(layerId: string, paramName?: string): string {
  return `p_${paramSuffix(layerId, paramName)}`;
}

/** Query param carrying a collection layer's current page while filtered. */
export function filteredPaginationParamKey(layerId: string, paramName?: string): string {
  return `fp_${paramSuffix(layerId, paramName)}`;
}

/**
 * Current page for a collection from the request's parsed page numbers.
 * Accepts the configured param name and the layer id, so URLs indexed before
 * a name was set (or changed) still resolve to the right page.
 */
export function resolveCurrentPage(
  pageNumbers: Record<string, number> | undefined,
  layerId: string,
  paramName?: string
): number | undefined {
  if (!pageNumbers) return undefined;

  const custom = sanitizePaginationParamName(paramName);
  return (custom ? pageNumbers[custom] : undefined) ?? pageNumbers[layerId];
}

interface PaginationQueryOptions {
  /** Current query string, whose other params are preserved. */
  queryString?: string;
  collectionLayerId: string;
  page: number;
  /** Configured param name, when the collection has one. */
  paramName?: string;
}

/**
 * Query string for a collection's page N, preserving every other param (other
 * collections' pages, filters). Page 1 drops the param so the first page keeps
 * a single URL.
 */
export function buildPaginationQueryString({
  queryString,
  collectionLayerId,
  page,
  paramName,
}: PaginationQueryOptions): string {
  const params = new URLSearchParams(queryString || '');
  const key = paginationParamKey(collectionLayerId, paramName);

  // Drop the layer-id form so a link never carries both it and the configured
  // name — arriving on a URL indexed before the rename would otherwise keep
  // the stale param around for the rest of the session.
  const legacyKey = paginationParamKey(collectionLayerId);
  if (legacyKey !== key) {
    params.delete(legacyKey);
  }

  if (page <= 1) {
    params.delete(key);
  } else {
    params.set(key, String(page));
  }

  return params.toString();
}

/** Relative URL for a collection's page N (e.g. `/news?p_abc=2`). */
export function buildPaginationHref(
  options: PaginationQueryOptions & { basePath: string }
): string {
  const query = buildPaginationQueryString(options);
  return query ? `${options.basePath}?${query}` : options.basePath;
}

/**
 * Tag and attributes that turn a prev/next control into a crawlable link, or
 * `null` to keep it a plain button — at a boundary page, in load-more mode, or
 * with no request path to link to (editor, template rendering).
 */
export function buildPaginationLinkAttrs(options: {
  direction: 'prev' | 'next';
  meta: Pick<CollectionPaginationMeta, 'currentPage' | 'totalPages' | 'totalItems' | 'mode' | 'paramName'>;
  collectionLayerId: string;
  basePath?: string;
  queryString?: string;
}): { tag: 'a'; href: string; rel: 'prev' | 'next' } | null {
  const { direction, meta, collectionLayerId, basePath, queryString } = options;
  const page = direction === 'prev' ? meta.currentPage - 1 : meta.currentPage + 1;

  if (!basePath) return null;
  if ((meta.mode || 'pages') === 'load_more') return null;
  if (meta.totalItems <= 0) return null;
  if (page < 1 || page > meta.totalPages) return null;

  return {
    tag: 'a',
    href: buildPaginationHref({ basePath, queryString, collectionLayerId, page, paramName: meta.paramName }),
    rel: direction,
  };
}

/**
 * Collect resolved pagination meta keyed by collection layer id, reading the
 * `_paginationMeta` that `resolveCollectionLayers` stashes on `-fragment` layers.
 */
export function collectPaginationMeta(layers: Layer[]): Record<string, CollectionPaginationMeta> {
  const metaByLayerId: Record<string, CollectionPaginationMeta> = {};

  const scan = (layerList: Layer[]) => {
    for (const layer of layerList) {
      if (layer._paginationMeta) {
        metaByLayerId[layer.id.replace(/-fragment$/, '')] = layer._paginationMeta;
      }
      if (layer.children) scan(layer.children);
    }
  };

  scan(layers);
  return metaByLayerId;
}

/**
 * Canonical pagination query for the current URL: only params naming a real
 * paginated collection and a page that exists. Tracking params, filter state
 * and out-of-range or unknown `p_*` values canonicalize back to page 1 instead
 * of minting another indexable URL.
 */
export function buildCanonicalPaginationQueryString(layers: Layer[], queryString: string): string {
  const requested = new URLSearchParams(queryString);
  const canonical = new URLSearchParams();

  for (const [layerId, meta] of Object.entries(collectPaginationMeta(layers))) {
    const key = paginationParamKey(layerId, meta.paramName);
    // Accept the layer-id form too, so a URL indexed before a name was set
    // canonicalizes to the page it actually shows rather than back to page 1.
    const page = Number(requested.get(key) ?? requested.get(paginationParamKey(layerId)));

    if (!Number.isInteger(page) || page < 2 || page > meta.totalPages) continue;

    canonical.set(key, String(page));
  }

  canonical.sort();
  return canonical.toString();
}

/**
 * Pick the collection that `rel="prev"`/`rel="next"` should describe: the only
 * page-mode collection with more than one page. With several of them the
 * relation is ambiguous, so no links are emitted.
 */
export function findPrimaryPaginatedCollection(
  layers: Layer[]
): { collectionLayerId: string; meta: CollectionPaginationMeta } | null {
  const paginated = Object.entries(collectPaginationMeta(layers)).filter(
    ([, meta]) => (meta.mode || 'pages') !== 'load_more' && meta.totalPages > 1
  );

  if (paginated.length !== 1) return null;

  const [collectionLayerId, meta] = paginated[0];
  return { collectionLayerId, meta };
}
