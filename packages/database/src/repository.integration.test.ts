import { randomUUID } from "node:crypto";

import {
  AnswerEvaluationSchema,
  InterviewTurnResultSchema,
} from "@interview-coach/contracts";
import { afterAll, describe, expect, it } from "vitest";

import {
  beginVoiceTokenGrant,
  beginTurnRequest,
  commitTurnRequest,
  completeVoiceTokenGrant,
  createGuestPrincipal,
  createInterviewSession,
  deleteRegisteredAccount,
  deleteProviderConnection,
  deleteInterviewSession,
  getProviderApiKey,
  getInterviewSession,
  getPool,
  getAccountProfile,
  listProviderConnections,
  recordDictationConsent,
  registerAccount,
  rotateRecoveryCode,
  runRetentionBatch,
  setInterviewSessionStatus,
  signInWithRecovery,
  upsertProviderConnection,
} from "./index";

const databaseAvailable = Boolean(process.env.DATABASE_URL);
const tenantIds: string[] = [];

describe.skipIf(!databaseAvailable)("durable interview repository", () => {
  it("isolates, resumes, idempotently replays, and deletes a session", async () => {
    const principal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "0"),
      new Date(Date.now() + 60_000),
    );
    const otherPrincipal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "1"),
      new Date(Date.now() + 60_000),
    );
    tenantIds.push(principal.tenantId, otherPrincipal.tenantId);

    const session = await createInterviewSession(
      principal,
      {
        role: "Platform Engineer",
        seniority: "Senior",
        focusAreas: ["distributed systems"],
        difficulty: "intermediate",
        provider: "demo",
      },
      "Describe the hardest distributed systems decision you made.",
    );

    expect(await getInterviewSession(otherPrincipal, session.id)).toBeNull();

    const idempotencyKey = randomUUID();
    const pending = await beginTurnRequest(
      principal,
      session.id,
      idempotencyKey,
    );
    const committed = await commitTurnRequest(principal, {
      requestId: pending.requestId,
      idempotencyKey,
      session: pending.session,
      answer:
        "I measured latency, throughput, and failure recovery before choosing a replicated event log.",
      result: InterviewTurnResultSchema.parse({
        evaluation: AnswerEvaluationSchema.parse({
          scores: {
            confidence: 80,
            communication: 82,
            pronunciation: null,
            technicalDepth: 84,
          },
          evidence: ["Compared measurable reliability constraints."],
          strengths: ["Used production evidence."],
          improvements: ["Quantify the cost trade-off."],
          shouldInterrupt: false,
          interruptionReason: null,
          demonstratedConcepts: ["replication"],
        }),
        nextDifficulty: "advanced",
        nextQuestion: "What fails first when a region is isolated?",
        coachNote: "Defend the cost trade-off.",
        followUpReason: "probe_tradeoff",
        completed: false,
      }),
      report: null,
    });

    expect(committed.session.turnCount).toBe(1);
    expect(committed.session.currentDifficulty).toBe("advanced");

    const replay = await beginTurnRequest(
      principal,
      session.id,
      idempotencyKey,
    );
    expect(replay.replayedResponse?.session.turnCount).toBe(1);

    const paused = await setInterviewSessionStatus(
      principal,
      session.id,
      "paused",
    );
    expect(paused?.status).toBe("paused");
    const resumed = await setInterviewSessionStatus(
      principal,
      session.id,
      "active",
    );
    expect(resumed?.status).toBe("active");

    expect(await deleteInterviewSession(otherPrincipal, session.id)).toBe(
      false,
    );
    expect(await deleteInterviewSession(principal, session.id)).toBe(true);
    expect(await getInterviewSession(principal, session.id)).toBeNull();
  });

  it("encrypts provider connections and isolates them by owner", async () => {
    const principal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "2"),
      new Date(Date.now() + 60_000),
    );
    const otherPrincipal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "3"),
      new Date(Date.now() + 60_000),
    );
    tenantIds.push(principal.tenantId, otherPrincipal.tenantId);
    const apiKey = "fixture-provider-connection-is-encrypted";

    await upsertProviderConnection(principal, {
      provider: "openai",
      apiKey,
    });

    expect(await getProviderApiKey(principal, "openai")).toBe(apiKey);
    expect(await getProviderApiKey(otherPrincipal, "openai")).toBeNull();
    const publicConnections = await listProviderConnections(principal);
    expect(publicConnections).toHaveLength(1);
    expect(JSON.stringify(publicConnections)).not.toContain(apiKey);
    expect(JSON.stringify(publicConnections)).not.toContain("encrypted_secret");
    const stored = await getPool().query<{ encrypted_secret: string }>(
      "SELECT encrypted_secret FROM provider_connections WHERE tenant_id = $1",
      [principal.tenantId],
    );
    expect(stored.rows[0]?.encrypted_secret).not.toContain(apiKey);
    const auditRows = await getPool().query<{ metadata: unknown }>(
      "SELECT metadata FROM audit_events WHERE tenant_id = $1",
      [principal.tenantId],
    );
    expect(JSON.stringify(auditRows.rows)).not.toContain(apiKey);
    expect(await deleteProviderConnection(principal, "openai")).toBe(true);
    expect(await getProviderApiKey(principal, "openai")).toBeNull();
  });

  it("records voice consent and isolates temporary grants by session owner", async () => {
    const principal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "4"),
      new Date(Date.now() + 60_000),
    );
    const otherPrincipal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "5"),
      new Date(Date.now() + 60_000),
    );
    tenantIds.push(principal.tenantId, otherPrincipal.tenantId);
    const session = await createInterviewSession(
      principal,
      {
        role: "Site Reliability Engineer",
        seniority: "Staff",
        focusAreas: ["incident response"],
        difficulty: "advanced",
        provider: "openai",
      },
      "How would you lead recovery from a multi-region control plane outage?",
    );
    const consent = {
      sessionId: session.id,
      policyVersion: "voice-beta-v1",
      providerProcessingAccepted: true,
      transcriptRetentionAccepted: true,
      rawAudioRetentionAccepted: false,
    } as const;

    await expect(beginVoiceTokenGrant(otherPrincipal, consent)).rejects.toThrow(
      "SESSION_NOT_FOUND",
    );

    const pending = await beginVoiceTokenGrant(principal, consent);
    const expiresAt = new Date(Date.now() + 60_000);
    await completeVoiceTokenGrant(principal, pending.grantId, expiresAt);

    const grants = await getPool().query<{
      status: string;
      expires_at: Date;
    }>(
      `SELECT status, expires_at
         FROM voice_token_grants
        WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [pending.grantId, principal.tenantId, principal.userId],
    );
    expect(grants.rows[0]?.status).toBe("issued");
    expect(grants.rows[0]?.expires_at.toISOString()).toBe(
      expiresAt.toISOString(),
    );

    const consentEvents = await getPool().query<{
      consent_type: string;
      granted: boolean;
    }>(
      `SELECT consent_type, granted
         FROM consent_events
        WHERE tenant_id = $1 AND user_id = $2 AND session_id = $3
        ORDER BY consent_type`,
      [principal.tenantId, principal.userId, session.id],
    );
    expect(consentEvents.rows).toEqual([
      { consent_type: "voice.provider_processing", granted: true },
      { consent_type: "voice.raw_audio_retention", granted: false },
      { consent_type: "voice.transcript_retention", granted: true },
    ]);
  });

  it("serializes concurrent voice grant quota decisions", async () => {
    const principal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "6"),
      new Date(Date.now() + 60_000),
    );
    tenantIds.push(principal.tenantId);
    const session = await createInterviewSession(
      principal,
      {
        role: "Platform Engineer",
        seniority: "Staff",
        focusAreas: ["reliability"],
        difficulty: "advanced",
        provider: "openai",
      },
      "How would you contain a cascading multi-region failure?",
    );
    const consent = {
      sessionId: session.id,
      policyVersion: "voice-beta-v1",
      providerProcessingAccepted: true,
      transcriptRetentionAccepted: true,
      rawAudioRetentionAccepted: false,
    } as const;

    const attempts = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        beginVoiceTokenGrant(principal, consent),
      ),
    );
    const fulfilled = attempts.filter(
      (attempt) => attempt.status === "fulfilled",
    );
    const rejected = attempts.filter(
      (attempt) => attempt.status === "rejected",
    );
    expect(fulfilled).toHaveLength(3);
    expect(rejected).toHaveLength(9);
    expect(
      rejected.every(
        (attempt) =>
          attempt.status === "rejected" &&
          attempt.reason instanceof Error &&
          attempt.reason.message === "VOICE_TOKEN_RATE_LIMITED",
      ),
    ).toBe(true);

    const grants = await getPool().query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM voice_token_grants
        WHERE tenant_id = $1 AND user_id = $2`,
      [principal.tenantId, principal.userId],
    );
    expect(Number(grants.rows[0]?.count ?? 0)).toBe(3);
  });

  it("records versioned dictation consent only for the session owner", async () => {
    const principal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "7"),
      new Date(Date.now() + 60_000),
    );
    const otherPrincipal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "8"),
      new Date(Date.now() + 60_000),
    );
    tenantIds.push(principal.tenantId, otherPrincipal.tenantId);
    const session = await createInterviewSession(
      principal,
      {
        role: "Backend Engineer",
        seniority: "Senior",
        focusAreas: ["data systems"],
        difficulty: "intermediate",
        provider: "demo",
      },
      "How did you validate your database migration strategy?",
    );
    const consent = {
      policyVersion: "text-dictation-v1",
      browserProcessingAccepted: true,
      transcriptUseAccepted: true,
      rawAudioRetentionAccepted: false,
    } as const;

    await expect(
      recordDictationConsent(otherPrincipal, session.id, consent),
    ).rejects.toThrow("SESSION_NOT_FOUND");
    await recordDictationConsent(principal, session.id, consent);

    const consentEvents = await getPool().query<{
      consent_type: string;
      granted: boolean;
      policy_version: string;
    }>(
      `SELECT consent_type, granted, policy_version
         FROM consent_events
        WHERE tenant_id = $1 AND user_id = $2 AND session_id = $3
        ORDER BY consent_type`,
      [principal.tenantId, principal.userId, session.id],
    );
    expect(consentEvents.rows).toEqual([
      {
        consent_type: "dictation.browser_processing",
        granted: true,
        policy_version: "text-dictation-v1",
      },
      {
        consent_type: "dictation.raw_audio_retention",
        granted: false,
        policy_version: "text-dictation-v1",
      },
      {
        consent_type: "dictation.transcript_use",
        granted: true,
        policy_version: "text-dictation-v1",
      },
    ]);
  });

  it("enforces atomic guest session budgets", async () => {
    const principal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "9"),
      new Date(Date.now() + 60_000),
    );
    tenantIds.push(principal.tenantId);
    const previousMinute = process.env.GUEST_SESSION_LIMIT_PER_MINUTE;
    const previousDay = process.env.GUEST_SESSION_LIMIT_PER_DAY;
    process.env.GUEST_SESSION_LIMIT_PER_MINUTE = "100";
    process.env.GUEST_SESSION_LIMIT_PER_DAY = "2";
    const createSession = () =>
      createInterviewSession(
        principal,
        {
          role: "Backend Engineer",
          seniority: "Senior",
          focusAreas: ["reliability"],
          difficulty: "intermediate",
          provider: "demo",
        },
        "How do you validate a reliability trade-off?",
      );

    try {
      await createSession();
      await createSession();
      await expect(createSession()).rejects.toThrow("DAILY_BUDGET_EXCEEDED");
      const counters = await getPool().query<{ count: number }>(
        `SELECT count FROM usage_counters
          WHERE tenant_id = $1 AND user_id = $2
            AND action = 'session' AND bucket = 'day'`,
        [principal.tenantId, principal.userId],
      );
      expect(counters.rows[0]?.count).toBe(2);
    } finally {
      if (previousMinute === undefined) {
        delete process.env.GUEST_SESSION_LIMIT_PER_MINUTE;
      } else {
        process.env.GUEST_SESSION_LIMIT_PER_MINUTE = previousMinute;
      }
      if (previousDay === undefined) {
        delete process.env.GUEST_SESSION_LIMIT_PER_DAY;
      } else {
        process.env.GUEST_SESSION_LIMIT_PER_DAY = previousDay;
      }
    }
  });

  it("registers, recovers, rotates, and deletes an account without storing the raw code", async () => {
    const principal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "a"),
      new Date(Date.now() + 60_000),
    );
    tenantIds.push(principal.tenantId);
    const kit = await registerAccount(
      principal,
      "Release candidate",
      randomUUID().replaceAll("-", "").padEnd(64, "b"),
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000),
    );

    expect(await getAccountProfile(kit.principal)).toEqual(kit.profile);
    const stored = await getPool().query(
      `SELECT recovery_secret_hash, recovery_secret_salt
         FROM account_credentials WHERE user_id = $1`,
      [principal.userId],
    );
    expect(JSON.stringify(stored.rows)).not.toContain(kit.recoveryCode);
    const audit = await getPool().query(
      "SELECT metadata FROM audit_events WHERE tenant_id = $1",
      [principal.tenantId],
    );
    expect(JSON.stringify(audit.rows)).not.toContain(kit.recoveryCode);

    const recovered = await signInWithRecovery(
      kit.profile.accountHandle!,
      kit.recoveryCode,
      randomUUID().replaceAll("-", "").padEnd(64, "c"),
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000),
    );
    expect(recovered.tenantId).toBe(principal.tenantId);
    const rotatedCode = await rotateRecoveryCode(recovered);
    await expect(
      signInWithRecovery(
        kit.profile.accountHandle!,
        kit.recoveryCode,
        randomUUID().replaceAll("-", "").padEnd(64, "d"),
        new Date(Date.now() + 60_000),
      ),
    ).rejects.toThrow("INVALID_RECOVERY_CREDENTIALS");
    expect(await deleteRegisteredAccount(recovered, rotatedCode)).toBe(true);
    expect(
      await getPool().query("SELECT 1 FROM tenants WHERE id = $1", [
        principal.tenantId,
      ]),
    ).toHaveProperty("rowCount", 0);
  });

  it("deletes expired guest data in a bounded retention batch", async () => {
    const principal = await createGuestPrincipal(
      randomUUID().replaceAll("-", "").padEnd(64, "e"),
      new Date(Date.now() + 60_000),
    );
    tenantIds.push(principal.tenantId);
    const session = await createInterviewSession(
      principal,
      {
        role: "Platform Engineer",
        seniority: "Staff",
        focusAreas: ["operations"],
        difficulty: "advanced",
        provider: "demo",
      },
      "How do you operate an aging service safely?",
    );
    await getPool().query(
      "UPDATE interview_sessions SET updated_at = now() - interval '2 days' WHERE id = $1",
      [session.id],
    );
    await getPool().query(
      "UPDATE auth_sessions SET expires_at = now() - interval '1 minute' WHERE id = $1",
      [principal.authSessionId],
    );
    const previousDays = process.env.GUEST_RETENTION_DAYS;
    process.env.GUEST_RETENTION_DAYS = "1";
    try {
      const result = await runRetentionBatch();
      expect(result.sessions).toBeGreaterThanOrEqual(1);
      expect(
        await getPool().query(
          "SELECT 1 FROM interview_sessions WHERE id = $1",
          [session.id],
        ),
      ).toHaveProperty("rowCount", 0);
      expect(
        await getPool().query("SELECT 1 FROM tenants WHERE id = $1", [
          principal.tenantId,
        ]),
      ).toHaveProperty("rowCount", 0);
    } finally {
      if (previousDays === undefined) {
        delete process.env.GUEST_RETENTION_DAYS;
      } else {
        process.env.GUEST_RETENTION_DAYS = previousDays;
      }
    }
  });
});

afterAll(async () => {
  if (!databaseAvailable || tenantIds.length === 0) return;
  await getPool().query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [
    tenantIds,
  ]);
  await getPool().end();
});
