import { InterviewTurnSchema } from "@interview-coach/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { runInterviewTurn, type InterviewEvaluatorAdapter } from "./index";

const turn = InterviewTurnSchema.parse({
  questionId: "provider-contract-q1",
  question: "How did you validate the reliability decision?",
  answer:
    "I measured API latency and database throughput, tested an idempotent retry and regional failure, then reduced p95 recovery by 35 percent.",
  role: "Backend Engineer",
  seniority: "Senior",
  focusAreas: ["reliability"],
  difficulty: "advanced",
  provider: "openai",
  turnNumber: 1,
});

describe("provider adapter failure contract", () => {
  it.each([
    [
      "timed_out",
      Object.assign(new Error("provider timeout"), { name: "TimeoutError" }),
    ],
    ["rate_limited", new Error("provider returned 429 rate limit")],
    ["invalid_output", new z.ZodError([])],
    ["invalid_output", new Error("provider returned an empty response")],
    ["invalid_output", new Error("provider returned an incomplete stream")],
    ["refused", new Error("provider content filter refusal")],
  ] as const)(
    "records %s and uses an explicit deterministic fallback",
    async (expectedStatus, providerError) => {
      const evaluator: InterviewEvaluatorAdapter = async () => {
        throw providerError;
      };
      const result = await runInterviewTurn(turn, undefined, undefined, {
        evaluator,
      });

      expect(result.providerStatus).toBe(expectedStatus);
      expect(result.evaluation.provenance.mode).toBe("deterministic_fallback");
      expect(result.evaluation.provenance.fallbackReason).toBe(expectedStatus);
      expect(result.evaluation.provenance.provider).toBe("openai");
      expect(result.evaluation.scores.pronunciation).toBeNull();
    },
  );

  it("rejects a successful adapter response that violates the schema", async () => {
    const evaluator = (async () => ({
      evaluation: undefined,
      providerStatus: "available",
    })) as unknown as InterviewEvaluatorAdapter;

    const result = await runInterviewTurn(turn, undefined, undefined, {
      evaluator,
    });

    expect(result.providerStatus).toBe("invalid_output");
    expect(result.evaluation.provenance.mode).toBe("deterministic_fallback");
    expect(result.evaluation.provenance.fallbackReason).toBe("invalid_output");
  });
});
