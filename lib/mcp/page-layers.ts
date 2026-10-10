/**
 * Cached read/write helpers for page layers used by MCP tools.
 *
 * Agents typically make 10-50 sequential tool calls against the same page. The
 * naive `getDraftLayers` → `upsertDraftLayers` pattern hits Supabase twice per
 * call (once for the tool's read, once inside the repo's write). This module
 * collapses both:
 *
 *   1. Reads are cached per page on `globalThis` with a short TTL. Subsequent
 *      reads inside a burst skip the DB entirely. The TTL is short enough that
 *      builder-side edits resync within a few seconds.
 *
 *   2. Writes pass the cached `PageLayers` row to `upsertDraftLayers` via its
 *      `existingDraft` parameter, so the repo skips its own internal read.
 *      The repo's translation diff still runs against the cached snapshot.
 *
 * On any write error we evict the page from the cache so the next read pulls
 * fresh data from the DB.
 */

import type { Layer, PageLayers } from '@/types';
import {
  getDraftLayers,
  upsertDraftLayers,
} from '@/lib/repositories/pageLayersRepository';
import { getComponentById } from '@/lib/repositories/componentRepository';
import { getPageById } from '@/lib/repositories/pageRepository';
import { getTenantIdFromHeaders } from '@/lib/supabase-server';
import { broadcastLayersChanged } from '@/lib/mcp/broadcast';

interface CacheEntry {
  pageLayers: PageLayers;
  expiresAt: number;
}

const CACHE_TTL_MS = 5_000;

const globalForPageCache = globalThis as unknown as {
  __mcpPageLayersCache?: Map<string, CacheEntry>;
};

const cache = globalForPageCache.__mcpPageLayersCache ?? new Map<string, CacheEntry>();
globalForPageCache.__mcpPageLayersCache = cache;

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return entry !== undefined && entry.expiresAt > Date.now();
}

/**
 * One process can serve several sites (multi-tenant deployments), so entries
 * are keyed by tenant as well as page — a page id must never hit another
 * site's cached tree.
 */
async function cacheKey(pageId: string): Promise<string> {
  const tenantId = await getTenantIdFromHeaders().catch(() => null);
  return `${tenantId ?? ''}:${pageId}`;
}

/**
 * Fetch the draft `PageLayers` row for a page, served from the in-memory cache
 * when fresh. Returns `null` if no draft exists.
 */
export async function getCachedDraft(pageId: string): Promise<PageLayers | null> {
  const key = await cacheKey(pageId);
  const cached = cache.get(key);
  if (isFresh(cached)) {
    return cached.pageLayers;
  }

  const draft = await getDraftLayers(pageId);
  if (draft) {
    cache.set(key, { pageLayers: draft, expiresAt: Date.now() + CACHE_TTL_MS });
  } else {
    cache.delete(key);
  }
  return draft;
}

/**
 * Convenience: return just the layer tree (or `[]` if no draft).
 *
 * Agents often pass a component ID where a page ID is expected, which would
 * otherwise surface as a misleading "Layer not found". Throw a pointer to the
 * component tools instead (the MCP server reports thrown errors to the agent).
 */
export async function getCachedLayers(pageId: string): Promise<Layer[]> {
  const draft = await getCachedDraft(pageId);
  if (draft) return (draft.layers as Layer[]) || [];

  if (await getComponentById(pageId).catch(() => null)) {
    throw new Error(
      `"${pageId}" is a component ID, not a page ID. Edit layers inside a component with update_component_layers (component_id: "${pageId}") — it supports update_image with alt, update_text, update_design, update_link, and more.`,
    );
  }
  // An unknown id would otherwise read as an empty page and every layer as "not found"
  if (!await getPageById(pageId).catch(() => null)) {
    throw new Error(`Page "${pageId}" does not exist on this site. Check the id with list_pages (or that the right site is selected).`);
  }
  return [];
}

/**
 * Save layers for a page and update the cache. Passes the cached `PageLayers`
 * snapshot to `upsertDraftLayers` so the repo skips its own pre-read.
 *
 * On error the cache entry is invalidated so the next read is forced to hit
 * the database.
 */
export async function saveCachedLayers(pageId: string, layers: Layer[]): Promise<PageLayers> {
  const key = await cacheKey(pageId);
  const cached = cache.get(key);
  const existingDraft = isFresh(cached) ? cached.pageLayers : undefined;

  let saved: PageLayers;
  try {
    saved = await upsertDraftLayers(pageId, layers, undefined, existingDraft);
  } catch (error) {
    cache.delete(key);
    throw error;
  }

  cache.set(key, { pageLayers: saved, expiresAt: Date.now() + CACHE_TTL_MS });
  broadcastLayersChanged(pageId, layers).catch(() => {});
  return saved;
}

/**
 * Drop the cached entry for a page. Use after operations that change the page
 * outside this module's awareness (e.g. publishing, deleting).
 */
export function invalidateCachedPage(pageId: string): void {
  for (const key of cache.keys()) {
    if (key.endsWith(`:${pageId}`)) cache.delete(key);
  }
}
