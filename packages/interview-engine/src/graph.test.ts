import { InterviewTurnSchema } from "@interview-coach/contracts";
import { describe, expect, it } from "vitest";

import { runInterviewTurn } from "./index";

const baseTurn = {
  questionId: "flagship-q",
  question:
    "Describe a consequential architecture decision and how you validated it.",
  role: "Principal Engineer",
  seniority: "Principal",
  focusAreas: ["technical strategy", "reliability"],
  provider: "demo" as const,
  maxTurns: 5,
  timeBudgetSeconds: 1_800,
  tokenBudget: 12_000,
};

describe("bounded deterministic interview graph", () => {
  it("raises difficulty for sufficient evidence and records rubric provenance", async () => {
    const result = await runInterviewTurn(
      InterviewTurnSchema.parse({
        ...baseTurn,
        difficulty: "intermediate",
        turnNumber: 1,
        answer:
          "First, I measured API latency, throughput, and recovery time across three regions. I owned the decision to adopt an event log instead of a queue because replay and idempotent recovery reduced incident restoration from 90 minutes to 18 minutes. We tested region isolation, tracked cost, and kept a rollback path because the additional state increased operational complexity.",
      }),
    );

    expect(result.nextDifficulty).toBe("advanced");
    expect(result.evaluation.evidenceSufficiency).toBe("sufficient");
    expect(result.evaluation.scores.pronunciation).toBeNull();
    expect(result.evaluation.provenance.rubricId).toBe(
      "principal-engineer-interview",
    );
    expect(result.currentCompetency).not.toBe("general");
    expect(result.remainingTurnBudget).toBe(4);
    expect(result.completed).toBe(false);
  });

  it("targets missing evidence instead of only lowering a score", async () => {
    const result = await runInterviewTurn(
      InterviewTurnSchema.parse({
        ...baseTurn,
        difficulty: "advanced",
        turnNumber: 2,
        answer:
          "We discussed the options with everyone and eventually chose the approach that seemed best for the project.",
      }),
    );

    expect(result.evaluation.evidenceSufficiency).toBe("insufficient");
    expect(result.followUpReason).toBe("request_evidence");
    expect(result.nextQuestion).toMatch(/specific example|quantify/i);
  });

  it("records a natural-boundary rambling interruption and terminates at budget", async () => {
    const ramble = Array.from(
      { length: 22 },
      () =>
        "Um basically we discussed many ideas with the team and kept talking about the general approach without choosing a measurable technical constraint.",
    ).join(" ");
    const result = await runInterviewTurn(
      InterviewTurnSchema.parse({
        ...baseTurn,
        difficulty: "intermediate",
        turnNumber: 5,
        answer: ramble,
      }),
    );

    expect(result.evaluation.interruption.eligible).toBe(true);
    expect(result.evaluation.interruption.reason).toBe("excessive_rambling");
    expect(result.evaluation.interruption.naturalBoundaryPreferred).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.completionReason).toBe("turn_budget_exhausted");
    expect(result.reportStatus).toBe("ready");
  });
});
