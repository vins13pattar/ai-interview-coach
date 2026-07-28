import { InterviewTurnSchema } from "@interview-coach/contracts";
import { runInterviewTurn } from "@interview-coach/interview-engine";
import { describe, expect, it } from "vitest";

import referenceDataset from "../../../evaluation/reference-v1.json";

import { EvaluationDatasetSchema } from "./dataset";

const dataset = EvaluationDatasetSchema.parse(referenceDataset);

describe(`reference dataset ${dataset.datasetVersion}`, () => {
  it("contains at least 150 versioned cases across all required slices", () => {
    expect(dataset.cases.length).toBeGreaterThanOrEqual(150);
    expect(new Set(dataset.cases.map((item) => item.roleFamily)).size).toBe(6);
    expect(new Set(dataset.cases.map((item) => item.category)).size).toBe(26);
    expect(dataset.cases.every((item) => item.rationale.length >= 15)).toBe(
      true,
    );
  });

  it("executes every case, always terminates, and never fabricates pronunciation", async () => {
    const results = await Promise.all(
      dataset.cases.map((item) =>
        runInterviewTurn(InterviewTurnSchema.parse(item.turn)),
      ),
    );
    expect(results).toHaveLength(dataset.cases.length);
    expect(
      results.every(
        (result) => result.evaluation.scores.pronunciation === null,
      ),
    ).toBe(true);
    expect(
      results.every(
        (result) =>
          result.remainingTurnBudget >= 0 &&
          result.remainingTimeBudgetSeconds >= 0 &&
          result.remainingTokenBudget >= 0,
      ),
    ).toBe(true);
  });
});
