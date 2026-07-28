import {
  AnswerEvaluationSchema,
  InterviewTurnSchema,
} from "@interview-coach/contracts";
import { describe, expect, it } from "vitest";

import { adaptDifficulty, evaluateDeterministically } from "./scoring";

const baseTurn = {
  questionId: "q-1",
  question: "How did you design the service?",
  role: "Backend Engineer",
  seniority: "Senior",
  focusAreas: ["distributed systems"],
  difficulty: "intermediate" as const,
  provider: "demo" as const,
  turnNumber: 1,
};

describe("deterministic evaluation", () => {
  it("rewards concrete technical evidence", () => {
    const evaluation = evaluateDeterministically(
      InterviewTurnSchema.parse({
        ...baseTurn,
        answer:
          "First, I measured API latency and database throughput. We added an index and cache, tested failure retries, and reduced p95 latency by 42 percent.",
      }),
    );

    expect(evaluation.scores.technicalDepth).toBeGreaterThan(65);
    expect(evaluation.scores.communication).toBeGreaterThan(60);
    expect(evaluation.scores.pronunciation).toBeNull();
  });

  it("adapts upward only with a strong aggregate signal", () => {
    expect(
      adaptDifficulty(
        "intermediate",
        AnswerEvaluationSchema.parse({
          scores: {
            confidence: 88,
            pronunciation: null,
            communication: 90,
            technicalDepth: 91,
          },
          evidence: ["Strong"],
          strengths: [],
          improvements: [],
          shouldInterrupt: false,
          interruptionReason: null,
          demonstratedConcepts: [],
        }),
      ),
    ).toBe("advanced");
  });
});
