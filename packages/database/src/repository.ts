import { randomUUID } from "node:crypto";

import {
  AnswerEvaluationSchema,
  CreateSessionRequestSchema,
  DifficultySchema,
  InterviewTurnResultSchema,
  ProviderConnectionInputSchema,
  ProviderConnectionSchema,
  ProviderSchema,
  RecruiterReportSchema,
  SessionDetailSchema,
  SessionSummarySchema,
  SessionTurnResponseSchema,
  TranscriptTurnSchema,
  type CreateSessionRequest,
  type InterviewTurnResult,
  type ProviderConnection,
  type ProviderConnectionInput,
  type RecruiterReport,
  type SessionDetail,
  type SessionStatus,
  type SessionSummary,
  type SessionTurnResponse,
} from "@interview-coach/contracts";
import type { PoolClient, QueryResultRow } from "pg";

import { decryptProviderSecret, encryptProviderSecret } from "./crypto";
import { getPool } from "./pool";

export type AuthenticatedPrincipal = {
  authSessionId: string;
  tenantId: string;
  userId: string;
  expiresAt: Date;
};

type SessionRow = QueryResultRow & {
  id: string;
  status: SessionStatus;
  role: string;
  seniority: string;
  focus_areas: unknown;
  provider: string;
  current_difficulty: string;
  current_question: string;
  turn_count: number;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

type TurnRow = QueryResultRow & {
  id: string;
  question: string;
  answer: string;
  difficulty: string;
  evaluation: unknown;
};

export type PendingTurn = {
  requestId: string;
  session: SessionDetail;
  replayedResponse: SessionTurnResponse | null;
};

export type TurnCommitInput = {
  requestId: string;
  idempotencyKey: string;
  session: SessionDetail;
  answer: string;
  result: InterviewTurnResult;
  report: RecruiterReport | null;
};

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function mapSession(row: SessionRow): SessionSummary {
  return SessionSummarySchema.parse({
    id: row.id,
    status: row.status,
    role: row.role,
    seniority: row.seniority,
    focusAreas: row.focus_areas,
    provider: ProviderSchema.parse(row.provider),
    currentDifficulty: DifficultySchema.parse(row.current_difficulty),
    currentQuestion: row.current_question,
    turnCount: row.turn_count,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    completedAt: row.completed_at ? iso(row.completed_at) : null,
  });
}

async function audit(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  eventType: string,
  subjectId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await client.query(
    `INSERT INTO audit_events
      (id, tenant_id, user_id, subject_id, event_type, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      randomUUID(),
      principal.tenantId,
      principal.userId,
      subjectId,
      eventType,
      JSON.stringify(metadata),
    ],
  );
}

export async function findPrincipalByTokenHash(
  tokenHash: string,
): Promise<AuthenticatedPrincipal | null> {
  const result = await getPool().query<
    QueryResultRow & {
      id: string;
      tenant_id: string;
      user_id: string;
      expires_at: Date;
    }
  >(
    `UPDATE auth_sessions
       SET last_seen_at = now()
     WHERE token_hash = $1
       AND expires_at > now()
     RETURNING id, tenant_id, user_id, expires_at`,
    [tokenHash],
  );
  const row = result.rows[0];
  return row
    ? {
        authSessionId: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        expiresAt: row.expires_at,
      }
    : null;
}

export async function createGuestPrincipal(
  tokenHash: string,
  expiresAt: Date,
): Promise<AuthenticatedPrincipal> {
  const pool = getPool();
  const client = await pool.connect();
  const tenantId = randomUUID();
  const userId = randomUUID();
  const authSessionId = randomUUID();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [
      tenantId,
      `Guest tenant ${tenantId.slice(0, 8)}`,
    ]);
    await client.query(
      `INSERT INTO users (id, tenant_id, kind, display_name)
       VALUES ($1, $2, 'guest', 'Guest candidate')`,
      [userId, tenantId],
    );
    await client.query(
      `INSERT INTO auth_sessions
        (id, tenant_id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [authSessionId, tenantId, userId, tokenHash, expiresAt],
    );
    await audit(
      client,
      { authSessionId, tenantId, userId, expiresAt },
      "identity.created",
      userId,
    );
    await client.query("COMMIT");
    return { authSessionId, tenantId, userId, expiresAt };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createInterviewSession(
  principal: AuthenticatedPrincipal,
  input: CreateSessionRequest,
  openingQuestion: string,
): Promise<SessionDetail> {
  const parsed = CreateSessionRequestSchema.parse(input);
  const id = randomUUID();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<SessionRow>(
      `INSERT INTO interview_sessions
        (id, tenant_id, user_id, status, role, seniority, focus_areas,
         provider, current_difficulty, current_question)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        principal.tenantId,
        principal.userId,
        parsed.role,
        parsed.seniority,
        JSON.stringify(parsed.focusAreas),
        parsed.provider,
        parsed.difficulty,
        openingQuestion,
      ],
    );
    await audit(client, principal, "interview.created", id, {
      provider: parsed.provider,
    });
    await client.query("COMMIT");
    return SessionDetailSchema.parse({
      ...mapSession(result.rows[0]!),
      turns: [],
      report: null,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listInterviewSessions(
  principal: AuthenticatedPrincipal,
): Promise<SessionSummary[]> {
  const result = await getPool().query<SessionRow>(
    `SELECT *
       FROM interview_sessions
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY updated_at DESC
      LIMIT 50`,
    [principal.tenantId, principal.userId],
  );
  return result.rows.map(mapSession);
}

export async function getInterviewSession(
  principal: AuthenticatedPrincipal,
  sessionId: string,
  client?: PoolClient,
): Promise<SessionDetail | null> {
  const connection = client ?? getPool();
  const sessionResult = await connection.query<SessionRow>(
    `SELECT *
       FROM interview_sessions
      WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
    [sessionId, principal.tenantId, principal.userId],
  );
  const session = sessionResult.rows[0];
  if (!session) return null;

  const turnsResult = await connection.query<TurnRow>(
    `SELECT id, question, answer, difficulty, evaluation
       FROM interview_turns
      WHERE session_id = $1 AND tenant_id = $2 AND user_id = $3
      ORDER BY turn_number`,
    [sessionId, principal.tenantId, principal.userId],
  );
  const reportResult = await connection.query<
    QueryResultRow & { report: unknown }
  >(
    `SELECT report
       FROM reports
      WHERE session_id = $1 AND tenant_id = $2 AND user_id = $3`,
    [sessionId, principal.tenantId, principal.userId],
  );

  return SessionDetailSchema.parse({
    ...mapSession(session),
    turns: turnsResult.rows.map((turn) =>
      TranscriptTurnSchema.parse({
        id: turn.id,
        question: turn.question,
        answer: turn.answer,
        difficulty: turn.difficulty,
        evaluation: turn.evaluation,
      }),
    ),
    report: reportResult.rows[0]
      ? RecruiterReportSchema.parse(reportResult.rows[0].report)
      : null,
  });
}

export async function beginTurnRequest(
  principal: AuthenticatedPrincipal,
  sessionId: string,
  idempotencyKey: string,
): Promise<PendingTurn> {
  const pool = getPool();
  const existing = await pool.query<QueryResultRow & { response: unknown }>(
    `SELECT response
       FROM turn_requests
      WHERE session_id = $1
        AND idempotency_key = $2
        AND tenant_id = $3
        AND user_id = $4`,
    [sessionId, idempotencyKey, principal.tenantId, principal.userId],
  );
  if (existing.rows[0]?.response) {
    const session = await getInterviewSession(principal, sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    return {
      requestId: "",
      session,
      replayedResponse: SessionTurnResponseSchema.parse(
        existing.rows[0].response,
      ),
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const session = await getInterviewSession(principal, sessionId, client);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.status !== "active") throw new Error("SESSION_NOT_ACTIVE");

    const requestId = randomUUID();
    await client.query(
      `INSERT INTO turn_requests
        (id, tenant_id, user_id, session_id, idempotency_key, expected_turn)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        requestId,
        principal.tenantId,
        principal.userId,
        sessionId,
        idempotencyKey,
        session.turnCount + 1,
      ],
    );
    await client.query("COMMIT");
    return { requestId, session, replayedResponse: null };
  } catch (error) {
    await client.query("ROLLBACK");
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new Error("TURN_IN_PROGRESS");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function abortTurnRequest(
  principal: AuthenticatedPrincipal,
  requestId: string,
) {
  await getPool().query(
    `DELETE FROM turn_requests
      WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND response IS NULL`,
    [requestId, principal.tenantId, principal.userId],
  );
}

export async function commitTurnRequest(
  principal: AuthenticatedPrincipal,
  input: TurnCommitInput,
): Promise<SessionTurnResponse> {
  const result = InterviewTurnResultSchema.parse(input.result);
  const report = input.report
    ? RecruiterReportSchema.parse(input.report)
    : null;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<SessionRow>(
      `SELECT *
         FROM interview_sessions
        WHERE id = $1 AND tenant_id = $2 AND user_id = $3
        FOR UPDATE`,
      [input.session.id, principal.tenantId, principal.userId],
    );
    const current = locked.rows[0];
    if (!current) throw new Error("SESSION_NOT_FOUND");
    if (current.turn_count !== input.session.turnCount) {
      throw new Error("SESSION_VERSION_CONFLICT");
    }

    const turnId = randomUUID();
    await client.query(
      `INSERT INTO interview_turns
        (id, tenant_id, user_id, session_id, turn_number, idempotency_key,
         question_id, question, answer, difficulty, evaluation,
         next_difficulty, next_question, coach_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        turnId,
        principal.tenantId,
        principal.userId,
        input.session.id,
        input.session.turnCount + 1,
        input.idempotencyKey,
        `q-${input.session.turnCount + 1}`,
        input.session.currentQuestion,
        input.answer,
        input.session.currentDifficulty,
        JSON.stringify(AnswerEvaluationSchema.parse(result.evaluation)),
        result.nextDifficulty,
        result.nextQuestion,
        result.coachNote,
      ],
    );

    const updated = await client.query<SessionRow>(
      `UPDATE interview_sessions
          SET status = $1,
              current_difficulty = $2,
              current_question = $3,
              turn_count = turn_count + 1,
              version = version + 1,
              updated_at = now(),
              completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE NULL END
        WHERE id = $4 AND tenant_id = $5 AND user_id = $6
        RETURNING *`,
      [
        result.completed ? "completed" : "active",
        result.nextDifficulty,
        result.nextQuestion,
        input.session.id,
        principal.tenantId,
        principal.userId,
      ],
    );

    let storedReport = report;
    if (report) {
      const reportWithId = RecruiterReportSchema.parse({
        ...report,
        id: report.id ?? randomUUID(),
      });
      await client.query(
        `INSERT INTO reports
          (id, tenant_id, user_id, session_id, report, rubric_version)
         VALUES ($1, $2, $3, $4, $5, 'alpha-v1')
         ON CONFLICT (session_id) DO UPDATE
           SET report = EXCLUDED.report, updated_at = now()`,
        [
          reportWithId.id,
          principal.tenantId,
          principal.userId,
          input.session.id,
          JSON.stringify(reportWithId),
        ],
      );
      storedReport = reportWithId;
    }

    const response = SessionTurnResponseSchema.parse({
      session: mapSession(updated.rows[0]!),
      result,
      report: storedReport,
      replayed: false,
    });
    await client.query(
      `UPDATE turn_requests
          SET response = $1, completed_at = now()
        WHERE id = $2 AND tenant_id = $3 AND user_id = $4`,
      [
        JSON.stringify(response),
        input.requestId,
        principal.tenantId,
        principal.userId,
      ],
    );
    await audit(
      client,
      principal,
      "interview.turn_recorded",
      input.session.id,
      {
        turnNumber: input.session.turnCount + 1,
      },
    );
    if (result.completed) {
      await audit(client, principal, "interview.completed", input.session.id);
    }
    await client.query("COMMIT");
    return response;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setInterviewSessionStatus(
  principal: AuthenticatedPrincipal,
  sessionId: string,
  status: "active" | "paused" | "completed",
): Promise<SessionDetail | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE interview_sessions
          SET status = $1, updated_at = now(), version = version + 1
        WHERE id = $2
          AND tenant_id = $3
          AND user_id = $4
          AND status <> 'completed'
        RETURNING id`,
      [status, sessionId, principal.tenantId, principal.userId],
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    await audit(client, principal, `interview.${status}`, sessionId);
    await client.query("COMMIT");
    return getInterviewSession(principal, sessionId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteInterviewSession(
  principal: AuthenticatedPrincipal,
  sessionId: string,
): Promise<boolean> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query(
      `SELECT id FROM interview_sessions
        WHERE id = $1 AND tenant_id = $2 AND user_id = $3
        FOR UPDATE`,
      [sessionId, principal.tenantId, principal.userId],
    );
    if (owned.rowCount === 0) {
      await client.query("ROLLBACK");
      return false;
    }
    await audit(client, principal, "interview.deleted", sessionId, {
      checkpointDeleted: true,
    });
    await client.query("DELETE FROM checkpoint_writes WHERE thread_id = $1", [
      sessionId,
    ]);
    await client.query("DELETE FROM checkpoint_blobs WHERE thread_id = $1", [
      sessionId,
    ]);
    await client.query("DELETE FROM checkpoints WHERE thread_id = $1", [
      sessionId,
    ]);
    await client.query(
      `DELETE FROM interview_sessions
        WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [sessionId, principal.tenantId, principal.userId],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listProviderConnections(
  principal: AuthenticatedPrincipal,
): Promise<ProviderConnection[]> {
  const result = await getPool().query<
    QueryResultRow & { provider: string; updated_at: Date }
  >(
    `SELECT provider, updated_at
       FROM provider_connections
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY provider`,
    [principal.tenantId, principal.userId],
  );
  return result.rows.map((row) =>
    ProviderConnectionSchema.parse({
      provider: row.provider,
      configuredAt: iso(row.updated_at),
    }),
  );
}

export async function upsertProviderConnection(
  principal: AuthenticatedPrincipal,
  input: ProviderConnectionInput,
): Promise<ProviderConnection> {
  const parsed = ProviderConnectionInputSchema.parse(input);
  const encrypted = encryptProviderSecret(parsed.apiKey);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<
      QueryResultRow & { provider: string; updated_at: Date }
    >(
      `INSERT INTO provider_connections
        (id, tenant_id, user_id, provider, encrypted_secret, key_version)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, user_id, provider) DO UPDATE
         SET encrypted_secret = EXCLUDED.encrypted_secret,
             key_version = EXCLUDED.key_version,
             updated_at = now()
       RETURNING provider, updated_at`,
      [
        randomUUID(),
        principal.tenantId,
        principal.userId,
        parsed.provider,
        encrypted.encryptedSecret,
        encrypted.keyVersion,
      ],
    );
    await audit(
      client,
      principal,
      "provider_connection.saved",
      principal.userId,
      { provider: parsed.provider },
    );
    await client.query("COMMIT");
    return ProviderConnectionSchema.parse({
      provider: result.rows[0]!.provider,
      configuredAt: iso(result.rows[0]!.updated_at),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getProviderApiKey(
  principal: AuthenticatedPrincipal,
  provider: "openai",
): Promise<string | null> {
  const result = await getPool().query<
    QueryResultRow & { encrypted_secret: string }
  >(
    `SELECT encrypted_secret
       FROM provider_connections
      WHERE tenant_id = $1 AND user_id = $2 AND provider = $3`,
    [principal.tenantId, principal.userId, provider],
  );
  const row = result.rows[0];
  return row ? decryptProviderSecret(row.encrypted_secret) : null;
}

export async function deleteProviderConnection(
  principal: AuthenticatedPrincipal,
  provider: "openai",
): Promise<boolean> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `DELETE FROM provider_connections
        WHERE tenant_id = $1 AND user_id = $2 AND provider = $3`,
      [principal.tenantId, principal.userId, provider],
    );
    if (result.rowCount !== 0) {
      await audit(
        client,
        principal,
        "provider_connection.deleted",
        principal.userId,
        { provider },
      );
    }
    await client.query("COMMIT");
    return result.rowCount !== 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
