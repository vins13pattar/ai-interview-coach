import { InterviewTurnSchema } from "@interview-coach/contracts";
import { describe, expect, it } from "vitest";

import dataset from "../../../evaluation/alpha-v1.json";

import { evaluateDeterministically } from "./scoring";

describe(`evaluation dataset ${dataset.datasetVersion}`, () => {
  for (const fixture of dataset.cases) {
    it(fixture.description, () => {
      const evaluation = evaluateDeterministically(
        InterviewTurnSchema.parse(fixture.turn),
      );

      for (const dimension of [
        "confidence",
        "communication",
        "technicalDepth",
      ] as const) {
        expect(evaluation.scores[dimension]).toBeGreaterThanOrEqual(
          fixture.expected[dimension].min,
        );
        expect(evaluation.scores[dimension]).toBeLessThanOrEqual(
          fixture.expected[dimension].max,
        );
      }
      expect(evaluation.scores.pronunciation).toBeNull();
      expect(evaluation.shouldInterrupt).toBe(fixture.expected.shouldInterrupt);
    });
  }
});
