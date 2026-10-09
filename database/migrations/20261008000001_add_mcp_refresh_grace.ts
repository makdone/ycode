import type { Knex } from 'knex';

/**
 * Migration: Add a short grace window to MCP OAuth refresh-token rotation.
 *
 * Rotation used to delete the previous token row immediately. MCP clients
 * (Claude, Cursor, …) sometimes fire two refreshes concurrently; the second
 * one then found no row and failed with `invalid_grant`, disconnecting the
 * user until they re-authorised.
 *
 * Instead of deleting, rotation now marks the old row inactive and stamps
 * `refresh_grace_until`. A refresh presented inside that window is still
 * honoured (issuing another fresh pair); the inactive row is removed by the
 * periodic cleanup once the window has passed.
 *
 * Idempotent: guarded by `hasColumn` so it is safe to run on template data.
 */

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('mcp_tokens', 'refresh_grace_until');
  if (!hasColumn) {
    await knex.schema.alterTable('mcp_tokens', (table) => {
      table.timestamp('refresh_grace_until', { useTz: true }).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('mcp_tokens', 'refresh_grace_until');
  if (hasColumn) {
    await knex.schema.alterTable('mcp_tokens', (table) => {
      table.dropColumn('refresh_grace_until');
    });
  }
}
