import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import {
  beginTurnRequest,
  commitTurnRequest,
  createGuestPrincipal,
  createInterviewSession,
  deleteProviderConnection,
  deleteInterviewSession,
  getProviderApiKey,
  getInterviewSession,
  getPool,
  listProviderConnections,
  setInterviewSessionStatus,
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
      result: {
        evaluation: {
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
        },
        nextDifficulty: "advanced",
        nextQuestion: "What fails first when a region is isolated?",
        coachNote: "Defend the cost trade-off.",
        completed: false,
      },
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
    expect(await listProviderConnections(principal)).toHaveLength(1);
    const stored = await getPool().query<{ encrypted_secret: string }>(
      "SELECT encrypted_secret FROM provider_connections WHERE tenant_id = $1",
      [principal.tenantId],
    );
    expect(stored.rows[0]?.encrypted_secret).not.toContain(apiKey);
    expect(await deleteProviderConnection(principal, "openai")).toBe(true);
    expect(await getProviderApiKey(principal, "openai")).toBeNull();
  });
});

afterAll(async () => {
  if (!databaseAvailable || tenantIds.length === 0) return;
  await getPool().query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [
    tenantIds,
  ]);
  await getPool().end();
});
