import { runInterviewTurn } from "@interview-coach/interview-engine";
import { describe, expect, it } from "vitest";

import { counterfactualPairs } from "./counterfactual";

describe("counterfactual technical-score stability", () => {
  it("executes all identity-signal pairs without changing technical meaning", async () => {
    expect(counterfactualPairs).toHaveLength(30);
    const results = await Promise.all(
      counterfactualPairs.map(async (pair) => ({
        left: await runInterviewTurn(pair.left),
        right: await runInterviewTurn(pair.right),
      })),
    );
    const deltas = results.map(({ left, right }) =>
      Math.abs(
        left.evaluation.scores.technicalDepth -
          right.evaluation.scores.technicalDepth,
      ),
    );
    expect(Math.max(...deltas)).toBeLessThanOrEqual(2);
    expect(
      results.every(
        ({ left, right }) =>
          left.evaluation.scores.pronunciation === null &&
          right.evaluation.scores.pronunciation === null,
      ),
    ).toBe(true);
  });
});
