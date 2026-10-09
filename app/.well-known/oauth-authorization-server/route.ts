import type { NextRequest } from 'next/server';
import { getBaseUrl, jsonMetadataResponse, optionsResponse } from '@/lib/oauth/metadata';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * RFC 8414 — OAuth 2.0 Authorization Server Metadata.
 *
 * Advertises the authorize, token, and registration endpoints, plus the
 * supported response types, grant types, and PKCE methods. MCP clients
 * (Claude.ai web, ChatGPT) fetch this to discover the OAuth flow.
 *
 * Two client registration mechanisms are advertised:
 *  - Client ID Metadata Documents (`client_id_metadata_document_supported`):
 *    the client_id is an https URL serving its metadata; preferred by Claude
 *    and avoids a registration row per connection
 *  - Dynamic Client Registration (`registration_endpoint`) as the fallback
 * Both register public clients, hence `token_endpoint_auth_methods_supported`
 * is `none` (PKCE is the security mechanism).
 */
export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);

  return jsonMetadataResponse({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/ycode/oauth/authorize`,
    token_endpoint: `${baseUrl}/ycode/api/oauth/token`,
    registration_endpoint: `${baseUrl}/ycode/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    scopes_supported: ['mcp'],
  });
}

export async function OPTIONS() {
  return optionsResponse();
}
