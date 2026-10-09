/**
 * Resolve an OAuth client by `client_id`, whichever registration mechanism the
 * client used:
 *  - `https://…` identifiers are Client ID Metadata Documents (fetched and
 *    validated, see `cimd.ts`)
 *  - anything else is a Dynamic Client Registration entry in `mcp_oauth_clients`
 */

import { fetchClientMetadataDocument, isClientIdUrl } from '@/lib/oauth/cimd';
import { getClient, type McpOAuthClient } from '@/lib/repositories/mcpOAuthClientRepository';

export async function resolveOAuthClient(clientId: string): Promise<McpOAuthClient | null> {
  if (isClientIdUrl(clientId)) {
    return fetchClientMetadataDocument(clientId);
  }
  return getClient(clientId);
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/**
 * Check a redirect_uri against the client's registered URIs.
 *
 * Exact string match, except for loopback redirects where RFC 8252 §7.3
 * requires ignoring the port: native clients (Claude Code, Cursor, VS Code)
 * bind an ephemeral port per session and register `http://127.0.0.1/callback`
 * or `http://localhost/callback`.
 */
export function isRedirectUriRegistered(client: McpOAuthClient, redirectUri: string): boolean {
  if (client.redirect_uris.includes(redirectUri)) {
    return true;
  }

  let requested: URL;
  try {
    requested = new URL(redirectUri);
  } catch {
    return false;
  }

  if (requested.protocol !== 'http:' || !isLoopbackHost(requested.hostname)) {
    return false;
  }

  return client.redirect_uris.some((registered) => {
    try {
      const candidate = new URL(registered);
      return candidate.protocol === 'http:'
        && candidate.hostname === requested.hostname
        && candidate.pathname === requested.pathname
        && candidate.search === requested.search;
    } catch {
      return false;
    }
  });
}
