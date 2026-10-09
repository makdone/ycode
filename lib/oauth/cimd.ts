/**
 * OAuth Client ID Metadata Documents (CIMD)
 *
 * Implements the authorization-server side of
 * draft-ietf-oauth-client-id-metadata-document as adopted by the MCP
 * authorization spec (2025-11-25): a client may identify itself with an HTTPS
 * URL as its `client_id`, and that URL serves a JSON document describing the
 * client (name, redirect URIs). This lets clients such as Claude connect
 * without a Dynamic Client Registration call on every fresh connection.
 *
 * Validation rules implemented here:
 *  - client_id URL: https, non-empty path, no fragment / credentials / dot
 *    segments, host must not be a loopback, private, or special-use address
 *  - fetch: no redirects followed, 200 only, JSON, size and time limited
 *  - document: `client_id` must equal the URL exactly; `client_name` and a
 *    non-empty `redirect_uris` array are required
 *  - cache: only valid documents, TTL from Cache-Control max-age clamped to
 *    [1 min, 24 h], default 1 h
 */

import { lookup } from 'dns/promises';
import { isIP } from 'net';

import type { McpOAuthClient } from '@/lib/repositories/mcpOAuthClientRepository';

const FETCH_TIMEOUT_MS = 5_000;
const MAX_DOCUMENT_BYTES = 64 * 1024;
const MIN_CACHE_MS = 60 * 1000;
const MAX_CACHE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_MS = 60 * 60 * 1000;

interface CacheEntry {
  client: McpOAuthClient;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** True when the string looks like a CIMD client identifier (an https URL). */
export function isClientIdUrl(clientId: string): boolean {
  return clientId.startsWith('https://');
}

/**
 * Validate the shape of a CIMD client_id URL. Returns the parsed URL or null.
 */
export function parseClientIdUrl(clientId: string): URL | null {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.pathname === '' || url.pathname === '/') return null;
  if (url.hash !== '' || url.username !== '' || url.password !== '') return null;
  if (url.pathname.split('/').some((seg) => seg === '.' || seg === '..')) return null;
  if (!isPublicHostname(url.hostname)) return null;
  // The identifier must round-trip unchanged so the document's client_id can
  // match it with simple string comparison.
  if (url.toString() !== clientId) return null;

  return url;
}

function isPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return false;
  }
  const ipVersion = isIP(host.replace(/^\[|\]$/g, ''));
  if (ipVersion) {
    return !isSpecialUseIp(host.replace(/^\[|\]$/g, ''), ipVersion);
  }
  return host.includes('.');
}

/** RFC 6890 special-use ranges that an authorization server must never fetch. */
function isSpecialUseIp(ip: string, version: number): boolean {
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::' || v6 === '::1') return true;
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // fc00::/7 unique local
  if (v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb')) return true; // link-local
  if (v6.startsWith('::ffff:')) {
    const v4 = v6.slice('::ffff:'.length);
    return isIP(v4) === 4 ? isSpecialUseIp(v4, 4) : true;
  }
  return false;
}

async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return true; // already validated as a literal
  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return false;
    return addresses.every(({ address, family }) => !isSpecialUseIp(address, family));
  } catch {
    return false;
  }
}

function cacheTtlFromHeaders(headers: Headers): number {
  const cacheControl = headers.get('cache-control') || '';
  if (/no-store|no-cache/i.test(cacheControl)) return MIN_CACHE_MS;
  const match = /max-age=(\d+)/i.exec(cacheControl);
  if (!match) return DEFAULT_CACHE_MS;
  const seconds = Number(match[1]);
  return Math.min(MAX_CACHE_MS, Math.max(MIN_CACHE_MS, seconds * 1000));
}

async function readLimitedText(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_DOCUMENT_BYTES) return null;

  const reader = response.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_DOCUMENT_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

interface ClientMetadataDocument {
  client_id?: unknown;
  client_name?: unknown;
  redirect_uris?: unknown;
}

function toClient(clientId: string, doc: ClientMetadataDocument): McpOAuthClient | null {
  if (doc.client_id !== clientId) return null;
  if (typeof doc.client_name !== 'string' || doc.client_name.trim() === '') return null;
  if (!Array.isArray(doc.redirect_uris)) return null;

  const redirectUris = doc.redirect_uris.filter(
    (u): u is string => typeof u === 'string' && u.length > 0,
  );
  if (redirectUris.length === 0) return null;

  for (const uri of redirectUris) {
    try {
      new URL(uri);
    } catch {
      return null;
    }
  }

  return {
    id: clientId,
    client_id: clientId,
    client_name: doc.client_name.trim(),
    redirect_uris: redirectUris,
    created_at: new Date().toISOString(),
  };
}

/**
 * Fetch and validate a Client ID Metadata Document.
 *
 * Returns null for any invalid identifier, unreachable or non-200 document,
 * oversized or malformed JSON, or a document whose `client_id` does not match
 * the URL. Never throws.
 */
export async function fetchClientMetadataDocument(clientId: string): Promise<McpOAuthClient | null> {
  const url = parseClientIdUrl(clientId);
  if (!url) return null;

  const cached = cache.get(clientId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.client;
  }

  if (!(await resolvesToPublicAddress(url.hostname))) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    console.warn('[oauth/cimd] Fetch failed for', clientId, error instanceof Error ? error.message : error);
    return null;
  }

  if (response.status !== 200) {
    return null;
  }

  const text = await readLimitedText(response);
  if (text === null) return null;

  let doc: ClientMetadataDocument;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== 'object') return null;

  const client = toClient(clientId, doc);
  if (!client) return null;

  cache.set(clientId, { client, expiresAt: Date.now() + cacheTtlFromHeaders(response.headers) });
  return client;
}

/** Test hook: drop cached documents. */
export function clearClientMetadataCache(): void {
  cache.clear();
}
