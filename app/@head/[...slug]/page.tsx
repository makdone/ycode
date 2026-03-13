import { unstable_cache } from 'next/cache';
import { fetchPageByPath } from '@/lib/page-fetcher';
import { getSettingsByKeys } from '@/lib/repositories/settingsRepository';
import { parseHeadHtml } from '@/lib/parse-head-html';
import { resolveCustomCodePlaceholders } from '@/lib/resolve-cms-variables';

const NON_PAGE_PREFIXES = ['ycode', 'dynamic', '_next', 'api'];

/**
 * Reuse the same static params as the main [...slug] route.
 */
export { generateStaticParams } from '@/app/[...slug]/page';

async function fetchPublishedPageWithLayers(slugPath: string) {
  try {
    return await unstable_cache(
      async () => fetchPageByPath(slugPath, true),
      [`data-for-route-/${slugPath}`],
      { tags: ['all-pages', `route-/${slugPath}`], revalidate: false }
    )();
  } catch {
    try {
      return await fetchPageByPath(slugPath, true);
    } catch {
      return null;
    }
  }
}

async function fetchGlobalHeadCode(): Promise<string | null> {
  try {
    return await unstable_cache(
      async () => {
        const settings = await getSettingsByKeys(['custom_code_head']);
        return (settings.custom_code_head as string) || null;
      },
      ['data-for-global-custom-head-code'],
      { tags: ['all-pages'], revalidate: false }
    )();
  } catch {
    return null;
  }
}

interface HeadSlugProps {
  params: Promise<{ slug: string | string[] }>;
}

export default async function HeadSlug({ params }: HeadSlugProps) {
  const { slug } = await params;
  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;

  if (NON_PAGE_PREFIXES.some(prefix => slugPath.startsWith(prefix))) {
    return null;
  }

  const [data, globalHeadCode] = await Promise.all([
    fetchPublishedPageWithLayers(slugPath),
    fetchGlobalHeadCode(),
  ]);

  const pageHeadCode = (() => {
    if (!data) return null;
    const raw = data.page?.settings?.custom_code?.head;
    if (!raw) return null;
    return data.page.is_dynamic && data.collectionItem
      ? resolveCustomCodePlaceholders(raw, data.collectionItem, data.collectionFields || [])
      : raw;
  })();

  if (!globalHeadCode && !pageHeadCode) return null;

  return (
    <>
      {globalHeadCode && parseHeadHtml(globalHeadCode)}
      {pageHeadCode && parseHeadHtml(pageHeadCode)}
    </>
  );
}
