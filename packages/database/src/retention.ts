import type { QueryResultRow } from "pg";

import { getPool } from "./pool";

export type RetentionResult = {
  sessions: number;
  authSessions: number;
  voiceGrants: number;
  auditEvents: number;
  usageCounters: number;
  authAttemptCounters: number;
  guestTenants: number;
};

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export async function runRetentionBatch(): Promise<RetentionResult> {
  const retentionDays = boundedInteger(
    process.env.GUEST_RETENTION_DAYS,
    30,
    1,
    365,
  );
  const auditRetentionDays = boundedInteger(
    process.env.AUDIT_RETENTION_DAYS,
    30,
    1,
    365,
  );
  const batchSize = boundedInteger(
    process.env.RETENTION_BATCH_SIZE,
    100,
    1,
    500,
  );
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const expiredSessions = await client.query<QueryResultRow & { id: string }>(
      `SELECT interview_sessions.id
         FROM interview_sessions
         JOIN users ON users.id = interview_sessions.user_id
        WHERE users.kind = 'guest'
          AND interview_sessions.updated_at < now() - ($1 * interval '1 day')
        ORDER BY interview_sessions.updated_at, interview_sessions.id
        LIMIT $2
        FOR UPDATE OF interview_sessions SKIP LOCKED`,
      [retentionDays, batchSize],
    );
    const sessionIds = expiredSessions.rows.map(({ id }) => id);
    if (sessionIds.length > 0) {
      await client.query(
        "DELETE FROM checkpoint_writes WHERE thread_id = ANY($1::text[])",
        [sessionIds],
      );
      await client.query(
        "DELETE FROM checkpoint_blobs WHERE thread_id = ANY($1::text[])",
        [sessionIds],
      );
      await client.query(
        "DELETE FROM checkpoints WHERE thread_id = ANY($1::text[])",
        [sessionIds],
      );
      await client.query(
        "DELETE FROM audit_events WHERE subject_id = ANY($1::uuid[])",
        [sessionIds],
      );
      await client.query(
        "DELETE FROM interview_sessions WHERE id = ANY($1::uuid[])",
        [sessionIds],
      );
    }

    const voiceGrants = await client.query(
      `DELETE FROM voice_token_grants
        WHERE expires_at < now()
           OR (expires_at IS NULL AND created_at < now() - interval '1 day')`,
    );
    const authSessions = await client.query(
      "DELETE FROM auth_sessions WHERE expires_at < now()",
    );
    const usageCounters = await client.query(
      "DELETE FROM usage_counters WHERE expires_at < now()",
    );
    const authAttemptCounters = await client.query(
      "DELETE FROM auth_attempt_counters WHERE expires_at < now()",
    );
    const auditEvents = await client.query(
      `DELETE FROM audit_events
        WHERE created_at < now() - ($1 * interval '1 day')`,
      [auditRetentionDays],
    );
    const guestTenants = await client.query(
      `DELETE FROM tenants
        WHERE id IN (
          SELECT tenants.id
            FROM tenants
            JOIN users ON users.tenant_id = tenants.id
           WHERE users.kind = 'guest'
             AND NOT EXISTS (
               SELECT 1 FROM auth_sessions
                WHERE auth_sessions.tenant_id = tenants.id
             )
             AND NOT EXISTS (
               SELECT 1 FROM interview_sessions
                WHERE interview_sessions.tenant_id = tenants.id
             )
           ORDER BY tenants.created_at
           LIMIT $1
        )`,
      [batchSize],
    );
    await client.query("COMMIT");
    return {
      sessions: sessionIds.length,
      authSessions: authSessions.rowCount ?? 0,
      voiceGrants: voiceGrants.rowCount ?? 0,
      auditEvents: auditEvents.rowCount ?? 0,
      usageCounters: usageCounters.rowCount ?? 0,
      authAttemptCounters: authAttemptCounters.rowCount ?? 0,
      guestTenants: guestTenants.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
