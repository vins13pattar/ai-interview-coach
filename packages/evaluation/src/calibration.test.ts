import { describe, expect, it } from "vitest";

import {
  calculateCalibration,
  spearmanCorrelation,
  weightedCohensKappa,
} from "./calibration";

describe("human-calibration metrics", () => {
  it("returns perfect rank and ordinal agreement for identical labels", () => {
    const values = [20, 50, 70, 90];
    expect(spearmanCorrelation(values, values)).toBe(1);
    expect(weightedCohensKappa(values, values)).toBe(1);
  });

  it("imports annotations and computes score, evidence, follow-up, and slice metrics", () => {
    const report = calculateCalibration(
      [
        {
          caseId: "case-1",
          roleFamily: "backend-engineer",
          seniority: "Senior",
          category: "excellent",
          dimensionScores: {
            confidence: 80,
            communication: 75,
            technicalDepth: 85,
          },
          evidence: ["Reduced p95 latency by 40 percent"],
          followUpReason: "test_failure_mode",
        },
      ],
      [
        {
          annotationVersion: "reviewer-annotation-v1",
          caseId: "case-1",
          reviewerId: "reviewer_001",
          rubricVersion: "1.0.0",
          dimensionScores: {
            confidence: 80,
            communication: 75,
            technicalDepth: 85,
          },
          evidenceAnnotations: ["Reduced p95 latency by 40 percent"],
          recommendedFollowUp: "test_failure_mode",
          confidence: 0.9,
          notes: "Synthetic metric fixture.",
        },
      ],
    );

    expect(report.matchedCases).toBe(1);
    expect(report.evidencePrecision).toBe(1);
    expect(report.evidenceRecall).toBe(1);
    expect(report.followUpAgreement).toBe(1);
    expect(report.slices[0]?.meanAbsoluteError).toBe(0);
  });
});
