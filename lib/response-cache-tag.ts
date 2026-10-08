import 'server-only';

import { addCacheTag } from '@vercel/functions';
import { buildAllPagesTag } from '@/lib/cache-tags';
import { getTenantIdFromHeaders } from '@/lib/supabase-server';

/**
 * Tag the current response with the site-wide purge tag so `clearAllCache()`
 * reaches it.
 *
 * Routes that set their own `s-maxage` are served from the CDN without the
 * function running, but they aren't in the prerender manifest, so Next never
 * emits `x-next-cache-tags` for them and a data-cache tag would purge nothing.
 * Tagging the response directly is the only way to make the edge copy
 * purgeable. No-ops off Vercel.
 */
export async function tagResponseForPublish(): Promise<void> {
  try {
    const tenantId = await getTenantIdFromHeaders();
    await addCacheTag(buildAllPagesTag(tenantId));
  } catch (error) {
    console.error('[Cache] Failed to tag response:', error);
  }
}
