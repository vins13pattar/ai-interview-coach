import { readFile } from "node:fs/promises";

import { getPostgresCheckpointer } from "./checkpointer";
import { getPool } from "./pool";

const migrationVersion = "0001_durable_sessions";
const migrationUrl = new URL(
  "../migrations/0001_durable_sessions.sql",
  import.meta.url,
);

async function migrate() {
  const checkpointer = getPostgresCheckpointer();
  await checkpointer.setup();

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
    const existing = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations WHERE version = $1",
      [migrationVersion],
    );
    if (existing.rowCount === 0) {
      await client.query(await readFile(migrationUrl, "utf8"));
      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
        [migrationVersion],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
    await checkpointer.end();
  }
}

migrate().catch((error) => {
  console.error("Database migration failed", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
