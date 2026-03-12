import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { Inter } from 'next/font/google';
import './globals.css';
import DarkModeProvider from '@/components/DarkModeProvider';
import { getSettingsByKeys } from '@/lib/repositories/settingsRepository';
import { parseHeadHtml, getPageHeadElements } from '@/lib/parse-head-html';
import { fetchPageByPath, fetchHomepage } from '@/lib/page-fetcher';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ycode - Visual Website Builder',
  description: 'Self-hosted visual website builder',
};

async function fetchCachedCustomHeadCode(): Promise<string | null> {
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

const PREVIEW_PREFIX = '/ycode/preview/';
const NON_PAGE_PREFIXES = ['/ycode', '/_next', '/api'];

/** Check if the current route is a public page or preview (not editor, API, etc.) */
function isPageRoute(pathname: string): boolean {
  if (pathname.startsWith(PREVIEW_PREFIX)) return true;
  return !NON_PAGE_PREFIXES.some(p => pathname.startsWith(p));
}

/**
 * Fetch page-specific custom head code for the current route.
 * Uses the same cached fetchers as page components (React cache deduplicates).
 */
async function fetchPageCustomHeadCode(pathname: string): Promise<React.ReactNode[] | null> {
  try {
    const isPreview = pathname.startsWith(PREVIEW_PREFIX);
    const isPublished = !isPreview;

    // Determine slug path
    let slugPath: string;
    if (isPreview) {
      slugPath = pathname.slice(PREVIEW_PREFIX.length);
      if (slugPath.startsWith('error-pages/')) return null;
    } else {
      slugPath = pathname.replace(/^\//, '');
    }

    // Fetch page data (React cache() deduplicates with the page component's call)
    if (slugPath === '') {
      const data = await fetchHomepage(isPublished);
      if (!data) return null;
      return getPageHeadElements(data.page);
    }

    const data = await fetchPageByPath(slugPath, isPublished);
    if (!data) return null;
    return getPageHeadElements(data.page, data.collectionItem, data.collectionFields);
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '/';
  const shouldInjectHeadCode = isPageRoute(pathname);

  const [customHeadCode, pageHeadElements] = shouldInjectHeadCode
    ? await Promise.all([fetchCachedCustomHeadCode(), fetchPageCustomHeadCode(pathname)])
    : [null, null];

  return (
    <html lang="en">
      <head>
        {customHeadCode && parseHeadHtml(customHeadCode)}
        {pageHeadElements}
      </head>
      <body className={`${inter.variable} font-sans antialiased text-xs`} suppressHydrationWarning>
        <DarkModeProvider>
          {children}
        </DarkModeProvider>
      </body>
    </html>
  );
}
