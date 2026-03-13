import { unstable_cache } from 'next/cache';
import { fetchHomepage } from '@/lib/page-fetcher';
import { getSettingsByKeys } from '@/lib/repositories/settingsRepository';
import { parseHeadHtml } from '@/lib/parse-head-html';

async function fetchPublishedHomepage() {
  try {
    return await unstable_cache(
      async () => fetchHomepage(true),
      ['data-for-route-/'],
      { tags: ['all-pages', 'route-/'], revalidate: false }
    )();
  } catch {
    try {
      return await fetchHomepage(true);
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

export default async function HeadHome() {
  const [data, globalHeadCode] = await Promise.all([
    fetchPublishedHomepage(),
    fetchGlobalHeadCode(),
  ]);

  const pageHeadCode = data?.page?.settings?.custom_code?.head;
  if (!globalHeadCode && !pageHeadCode) return null;

  return (
    <>
      {globalHeadCode && parseHeadHtml(globalHeadCode)}
      {pageHeadCode && parseHeadHtml(pageHeadCode)}
    </>
  );
}
