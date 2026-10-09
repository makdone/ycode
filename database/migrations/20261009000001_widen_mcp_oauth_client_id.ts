import type { Knex } from 'knex';

/**
 * Migration: Allow URL-form OAuth client identifiers.
 *
 * OAuth Client ID Metadata Documents (MCP authorization spec 2025-11-25) use
 * an https URL as the `client_id`, e.g.
 * `https://claude.ai/.well-known/oauth-client-metadata.json`. The DCR-era
 * columns were `varchar(128)`, which such identifiers can exceed, so the
 * columns that store a client_id alongside codes and tokens become `text`.
 *
 * `mcp_oauth_clients.client_id` is left alone: CIMD clients are never stored
 * there (their metadata is fetched from the URL on demand).
 *
 * Idempotent: `ALTER COLUMN … TYPE text` is a no-op on an already-text column,
 * and both statements are guarded by the table/column existing.
 */

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('mcp_oauth_codes', 'client_id')) {
    await knex.raw('ALTER TABLE mcp_oauth_codes ALTER COLUMN client_id TYPE text');
  }
  if (await knex.schema.hasColumn('mcp_tokens', 'oauth_client_id')) {
    await knex.raw('ALTER TABLE mcp_tokens ALTER COLUMN oauth_client_id TYPE text');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Narrowing back could truncate URL identifiers; leave the columns as text.
}
