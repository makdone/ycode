/**
 * In-memory cache for MCP token validation results.
 *
 * AI agents make many requests per minute and each was previously hitting
 * Supabase to revalidate the same token. Cache hits live for 60s (revocations
 * propagate within a minute, fine for static URL tokens). Misses cache for 5s
 * so a token flip from invalid→valid recovers quickly.
 *
 * Entries are keyed by `${host}:${token}`. A token is only ever valid for the
 * deployment it was issued on, so a validation result for one host must never
 * be reused for another. On a single-site install the host is constant and the
 * prefix is a no-op; on multi-site deployments (where many hosts share one
 * server process) it prevents a token validated for site A from being accepted
 * on site B before the DB lookup runs.
 *
 * The cache lives in its own module so both `lib/mcp/handler.ts` and the
 * repository can read/invalidate it without creating a circular import.
 * Rotated/deleted tokens are explicitly invalidated so the old access token
 * stops working immediately, not after the cache TTL expires.
 */

interface TokenCacheEntry {
  valid: boolean;
  expires: number;
}

const cache = new Map<string, TokenCacheEntry>();

export const TOKEN_CACHE_TTL_VALID_MS = 60_000;
export const TOKEN_CACHE_TTL_INVALID_MS = 5_000;

function cacheKey(host: string, token: string): string {
  return `${host}:${token}`;
}

export function getCachedToken(host: string, token: string): TokenCacheEntry | undefined {
  const key = cacheKey(host, token);
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry;
  }
  if (entry) {
    cache.delete(key);
  }
  return undefined;
}

export function setCachedToken(host: string, token: string, valid: boolean): void {
  const ttl = valid ? TOKEN_CACHE_TTL_VALID_MS : TOKEN_CACHE_TTL_INVALID_MS;
  cache.set(cacheKey(host, token), { valid, expires: Date.now() + ttl });
}

/**
 * Drop every cached entry for a token regardless of host. The repository
 * doesn't know which host a token was validated on, and the cache is small
 * enough that a linear scan is fine.
 */
export function invalidateToken(token: string): void {
  const suffix = `:${token}`;
  for (const key of cache.keys()) {
    if (key.endsWith(suffix)) {
      cache.delete(key);
    }
  }
}
