import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCanonicalPaginationQueryString,
  buildPaginationHref,
  buildPaginationLinkAttrs,
  buildPaginationQueryString,
  findPrimaryPaginatedCollection,
  paginationParamKey,
  resolveCurrentPage,
} from '@/lib/pagination-url-utils';

import type { CollectionPaginationMeta, Layer } from '@/types';

function meta(partial: Partial<CollectionPaginationMeta>): CollectionPaginationMeta {
  return {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    mode: 'pages',
    ...partial,
  } as CollectionPaginationMeta;
}

function fragment(id: string, paginationMeta: CollectionPaginationMeta): Layer {
  return { id, name: 'div', _paginationMeta: paginationMeta } as Layer;
}

test('paginationParamKey strips the layer prefix', () => {
  assert.equal(paginationParamKey('lyr-abc123'), 'p_abc123');
  assert.equal(paginationParamKey('abc123'), 'p_abc123');
});

test('a configured param name replaces the layer id, sanitized', () => {
  assert.equal(paginationParamKey('lyr-abc123', 'news'), 'p_news');
  assert.equal(paginationParamKey('lyr-abc123', ' News Feed! '), 'p_newsfeed');
  // Nothing usable left after sanitizing falls back to the layer id
  assert.equal(paginationParamKey('lyr-abc123', '!!!'), 'p_abc123');
  assert.equal(paginationParamKey('lyr-abc123', ''), 'p_abc123');

  assert.equal(
    buildPaginationHref({ basePath: '/news', collectionLayerId: 'lyr-abc123', page: 3, paramName: 'news' }),
    '/news?p_news=3'
  );
});

test('a renamed param supersedes the layer-id form in links and canonicals', () => {
  // Arriving on a URL indexed before the rename must not carry both forms on
  const href = buildPaginationHref({
    basePath: '/news',
    queryString: 'p_abc123=2&utm_source=x',
    collectionLayerId: 'lyr-abc123',
    page: 3,
    paramName: 'news',
  });
  assert.equal(href, '/news?utm_source=x&p_news=3');

  // ...and it canonicalizes to the page it shows, under the configured name
  const layers = [fragment('lyr-abc123-fragment', meta({
    currentPage: 2,
    totalPages: 4,
    totalItems: 40,
    paramName: 'news',
  }))];
  assert.equal(buildCanonicalPaginationQueryString(layers, 'p_abc123=2'), 'p_news=2');
  assert.equal(buildCanonicalPaginationQueryString(layers, 'p_news=2'), 'p_news=2');
});

test('resolveCurrentPage accepts the configured name and the legacy layer id', () => {
  const pageNumbers = { news: 4, 'lyr-abc': 2, abc: 2 };

  assert.equal(resolveCurrentPage(pageNumbers, 'lyr-abc', 'news'), 4);
  // A URL indexed before the rename still resolves through the layer id
  assert.equal(resolveCurrentPage({ 'lyr-abc': 2 }, 'lyr-abc', 'news'), 2);
  assert.equal(resolveCurrentPage(pageNumbers, 'lyr-abc'), 2);
  assert.equal(resolveCurrentPage(undefined, 'lyr-abc', 'news'), undefined);
  assert.equal(resolveCurrentPage({}, 'lyr-abc', 'news'), undefined);
});

test('buildPaginationHref preserves other params and drops the param on page 1', () => {
  assert.equal(
    buildPaginationHref({ basePath: '/news', collectionLayerId: 'lyr-abc', page: 3 }),
    '/news?p_abc=3'
  );
  assert.equal(
    buildPaginationHref({
      basePath: '/news',
      queryString: 'p_abc=2&p_def=5&utm_source=x',
      collectionLayerId: 'lyr-abc',
      page: 3,
    }),
    '/news?p_abc=3&p_def=5&utm_source=x'
  );
  assert.equal(
    buildPaginationHref({
      basePath: '/news',
      queryString: 'p_abc=2',
      collectionLayerId: 'lyr-abc',
      page: 1,
    }),
    '/news'
  );
});

test('buildPaginationQueryString returns only the query', () => {
  assert.equal(
    buildPaginationQueryString({ queryString: 'p_abc=4', collectionLayerId: 'abc', page: 5 }),
    'p_abc=5'
  );
});

test('buildCanonicalPaginationQueryString keeps only real, in-range pages', () => {
  const layers = [
    fragment('lyr-abc-fragment', meta({ currentPage: 2, totalPages: 4, totalItems: 40 })),
    fragment('lyr-def-fragment', meta({ currentPage: 1, totalPages: 2, totalItems: 20 })),
  ];

  // Tracking params, filter state and page 1 are all dropped
  assert.equal(
    buildCanonicalPaginationQueryString(layers, 'utm_source=x&p_abc=2&fp_abc=1&p_def=1'),
    'p_abc=2'
  );
  // Out-of-range and unknown collections canonicalize back to page 1
  assert.equal(buildCanonicalPaginationQueryString(layers, 'p_abc=99'), '');
  assert.equal(buildCanonicalPaginationQueryString(layers, 'p_junk=2'), '');
  assert.equal(buildCanonicalPaginationQueryString(layers, 'p_abc=3&p_def=2'), 'p_abc=3&p_def=2');
});

test('buildPaginationLinkAttrs links only where a target page exists', () => {
  const base = { collectionLayerId: 'lyr-abc', basePath: '/news' };
  const paged = meta({ currentPage: 2, totalPages: 4, totalItems: 40 });

  assert.deepEqual(buildPaginationLinkAttrs({ ...base, direction: 'prev', meta: paged }), {
    tag: 'a',
    href: '/news',
    rel: 'prev',
  });
  assert.deepEqual(buildPaginationLinkAttrs({ ...base, direction: 'next', meta: paged }), {
    tag: 'a',
    href: '/news?p_abc=3',
    rel: 'next',
  });

  // Boundaries stay buttons — there is no page to link to
  const firstPage = meta({ currentPage: 1, totalPages: 4, totalItems: 40 });
  const lastPage = meta({ currentPage: 4, totalPages: 4, totalItems: 40 });
  assert.equal(buildPaginationLinkAttrs({ ...base, direction: 'prev', meta: firstPage }), null);
  assert.equal(buildPaginationLinkAttrs({ ...base, direction: 'next', meta: lastPage }), null);

  // An out-of-range request must not advertise another out-of-range page
  const beyondLast = meta({ currentPage: 11, totalPages: 4, totalItems: 40 });
  assert.equal(buildPaginationLinkAttrs({ ...base, direction: 'prev', meta: beyondLast }), null);
  assert.equal(buildPaginationLinkAttrs({ ...base, direction: 'next', meta: beyondLast }), null);

  // Load-more mode, empty results and a missing request path keep buttons too
  assert.equal(
    buildPaginationLinkAttrs({ ...base, direction: 'next', meta: meta({ ...paged, mode: 'load_more' }) }),
    null
  );
  assert.equal(
    buildPaginationLinkAttrs({ ...base, direction: 'next', meta: meta({ currentPage: 1, totalPages: 1, totalItems: 0 }) }),
    null
  );
  assert.equal(
    buildPaginationLinkAttrs({ collectionLayerId: 'lyr-abc', direction: 'next', meta: paged }),
    null
  );
});

test('buildPaginationLinkAttrs preserves unrelated query params', () => {
  assert.equal(
    buildPaginationLinkAttrs({
      direction: 'next',
      meta: meta({ currentPage: 1, totalPages: 3, totalItems: 30 }),
      collectionLayerId: 'lyr-abc',
      basePath: '/news',
      queryString: 'p_def=2&utm_source=x',
    })?.href,
    '/news?p_def=2&utm_source=x&p_abc=2'
  );
});

test('findPrimaryPaginatedCollection needs exactly one multi-page collection', () => {
  const single = [fragment('lyr-abc-fragment', meta({ currentPage: 2, totalPages: 4, totalItems: 40 }))];
  assert.deepEqual(findPrimaryPaginatedCollection(single), {
    collectionLayerId: 'lyr-abc',
    meta: meta({ currentPage: 2, totalPages: 4, totalItems: 40 }),
  });

  // Single-page and load-more collections never claim the prev/next relation
  assert.equal(findPrimaryPaginatedCollection([fragment('lyr-abc-fragment', meta({}))]), null);
  assert.equal(
    findPrimaryPaginatedCollection([
      fragment('lyr-abc-fragment', meta({ totalPages: 4, mode: 'load_more' })),
    ]),
    null
  );

  // Ambiguous: two independent paginated collections on one page
  assert.equal(
    findPrimaryPaginatedCollection([
      fragment('lyr-abc-fragment', meta({ totalPages: 4 })),
      fragment('lyr-def-fragment', meta({ totalPages: 2 })),
    ]),
    null
  );
});

test('findPrimaryPaginatedCollection descends into nested layers', () => {
  const layers = [
    {
      id: 'wrapper',
      name: 'div',
      children: [fragment('lyr-abc-fragment', meta({ currentPage: 1, totalPages: 2 }))],
    } as Layer,
  ];

  assert.equal(findPrimaryPaginatedCollection(layers)?.collectionLayerId, 'lyr-abc');
});
