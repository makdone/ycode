import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('color_variables', 'sort_order');
  if (!hasColumn) {
    await knex.schema.alterTable('color_variables', (table) => {
      table.integer('sort_order').defaultTo(0);
    });

    // Set initial sort order based on creation order
    await knex.raw(`
      UPDATE color_variables SET sort_order = sub.rn
      FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
        FROM color_variables
      ) sub
      WHERE color_variables.id = sub.id
        AND color_variables.sort_order = 0;
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('color_variables', 'sort_order');
  if (hasColumn) {
    await knex.schema.alterTable('color_variables', (table) => {
      table.dropColumn('sort_order');
    });
  }
}
