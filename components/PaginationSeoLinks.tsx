import {
  buildCanonicalPaginationQueryString,
  buildPaginationLinkAttrs,
  findPrimaryPaginatedCollection,
} from '@/lib/pagination-url-utils';
import { buildAbsolutePageUrl } from '@/lib/url-utils';
import type { Layer } from '@/types';

interface PaginationSeoLinksProps {
  /** Resolved page layers, carrying the collections' pagination meta. */
  layers: Layer[];
  /** Public path of the current request (`/news`). */
  basePath: string;
  /** Current query string. Only real pagination params are carried over. */
  queryString?: string;
  /** Absolute site base URL. Links stay path-relative when unavailable. */
  baseUrl?: string | null;
}

/**
 * Emits `<link rel="prev">` / `<link rel="next">` for a paginated collection so
 * crawlers can walk the sequence instead of only seeing page 1. React hoists
 * the tags into the document head.
 */
export default function PaginationSeoLinks({
  layers,
  basePath,
  queryString,
  baseUrl,
}: PaginationSeoLinksProps) {
  const primary = findPrimaryPaginatedCollection(layers);

  if (!primary) return null;

  // Same boundary rules as the on-page controls, so an out-of-range request
  // never advertises a neighbour page that doesn't exist.
  const linkOptions = {
    meta: primary.meta,
    collectionLayerId: primary.collectionLayerId,
    basePath: baseUrl ? buildAbsolutePageUrl(baseUrl, basePath) : basePath,
    queryString: buildCanonicalPaginationQueryString(layers, queryString || ''),
  };
  const prev = buildPaginationLinkAttrs({ ...linkOptions, direction: 'prev' });
  const next = buildPaginationLinkAttrs({ ...linkOptions, direction: 'next' });

  return (
    <>
      {prev && (
        <link
          rel={prev.rel}
          href={prev.href}
        />
      )}
      {next && (
        <link
          rel={next.rel}
          href={next.href}
        />
      )}
    </>
  );
}
