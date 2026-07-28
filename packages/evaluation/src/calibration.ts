import {
  FollowUpReasonSchema,
  RoleFamilySchema,
  type FollowUpReason,
  type RoleFamily,
} from "@interview-coach/contracts";
import { z } from "zod";

const DimensionScoresSchema = z.object({
  confidence: z.number().min(0).max(100),
  communication: z.number().min(0).max(100),
  technicalDepth: z.number().min(0).max(100),
});

export const ReviewerAnnotationSchema = z.object({
  annotationVersion: z.literal("reviewer-annotation-v1"),
  caseId: z.string().min(1),
  reviewerId: z.string().regex(/^[a-zA-Z0-9_-]{3,80}$/),
  rubricVersion: z.string().min(1),
  dimensionScores: DimensionScoresSchema,
  evidenceAnnotations: z.array(z.string().min(3)).min(1),
  recommendedFollowUp: FollowUpReasonSchema,
  confidence: z.number().min(0).max(1),
  notes: z.string().max(2_000),
});

export const ReviewerAnnotationImportSchema = z.object({
  datasetVersion: z.string().min(1),
  synthetic: z.boolean(),
  annotations: z.array(ReviewerAnnotationSchema).min(1),
});

export type ReviewerAnnotation = z.infer<typeof ReviewerAnnotationSchema>;

export type CalibrationPrediction = {
  caseId: string;
  roleFamily: RoleFamily;
  seniority: string;
  category: string;
  dimensionScores: z.infer<typeof DimensionScoresSchema>;
  evidence: string[];
  followUpReason: FollowUpReason;
};

const dimensions = ["confidence", "communication", "technicalDepth"] as const;

function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rounded(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function ranks(values: number[]): number[] {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);
  const result = new Array<number>(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end]?.value === sorted[start]?.value) {
      end += 1;
    }
    const averageRank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) {
      result[sorted[index]!.index] = averageRank;
    }
    start = end;
  }
  return result;
}

export function spearmanCorrelation(
  leftValues: number[],
  rightValues: number[],
): number {
  if (leftValues.length !== rightValues.length || leftValues.length < 2) {
    return 0;
  }
  const left = ranks(leftValues);
  const right = ranks(rightValues);
  const leftMean = mean(left);
  const rightMean = mean(right);
  const numerator = left.reduce(
    (sum, value, index) =>
      sum + (value - leftMean) * ((right[index] ?? 0) - rightMean),
    0,
  );
  const denominator = Math.sqrt(
    left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0) *
      right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0),
  );
  return denominator === 0 ? 0 : rounded(numerator / denominator);
}

function ordinalBucket(score: number): number {
  if (score < 40) return 0;
  if (score < 60) return 1;
  if (score < 80) return 2;
  return 3;
}

export function weightedCohensKappa(
  predictedScores: number[],
  reviewerScores: number[],
): number {
  if (
    predictedScores.length !== reviewerScores.length ||
    predictedScores.length === 0
  ) {
    return 0;
  }
  const categories = 4;
  const observed = Array.from({ length: categories }, () =>
    Array<number>(categories).fill(0),
  );
  const predictedCounts = Array<number>(categories).fill(0);
  const reviewerCounts = Array<number>(categories).fill(0);
  for (let index = 0; index < predictedScores.length; index += 1) {
    const predicted = ordinalBucket(predictedScores[index] ?? 0);
    const reviewer = ordinalBucket(reviewerScores[index] ?? 0);
    observed[predicted]![reviewer] = (observed[predicted]?.[reviewer] ?? 0) + 1;
    predictedCounts[predicted] = (predictedCounts[predicted] ?? 0) + 1;
    reviewerCounts[reviewer] = (reviewerCounts[reviewer] ?? 0) + 1;
  }
  let observedDisagreement = 0;
  let expectedDisagreement = 0;
  const denominator = (categories - 1) ** 2;
  for (let left = 0; left < categories; left += 1) {
    for (let right = 0; right < categories; right += 1) {
      const weight = (left - right) ** 2 / denominator;
      observedDisagreement +=
        (weight * (observed[left]?.[right] ?? 0)) / predictedScores.length;
      expectedDisagreement +=
        weight *
        ((predictedCounts[left] ?? 0) / predictedScores.length) *
        ((reviewerCounts[right] ?? 0) / reviewerScores.length);
    }
  }
  return expectedDisagreement === 0
    ? observedDisagreement === 0
      ? 1
      : 0
    : rounded(1 - observedDisagreement / expectedDisagreement);
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

function evidenceMatches(left: string, right: string): boolean {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const overlap = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  return (
    overlap / Math.max(1, Math.min(leftTokens.size, rightTokens.size)) >= 0.45
  );
}

function evidenceMetrics(
  predictions: CalibrationPrediction[],
  annotations: ReviewerAnnotation[],
): { precision: number; recall: number } {
  let predictedCount = 0;
  let annotatedCount = 0;
  let matchedPredictions = 0;
  let matchedAnnotations = 0;
  const annotationsByCase = new Map(
    annotations.map((annotation) => [annotation.caseId, annotation]),
  );
  for (const prediction of predictions) {
    const annotation = annotationsByCase.get(prediction.caseId);
    if (!annotation) continue;
    predictedCount += prediction.evidence.length;
    annotatedCount += annotation.evidenceAnnotations.length;
    matchedPredictions += prediction.evidence.filter((predicted) =>
      annotation.evidenceAnnotations.some((expected) =>
        evidenceMatches(predicted, expected),
      ),
    ).length;
    matchedAnnotations += annotation.evidenceAnnotations.filter((expected) =>
      prediction.evidence.some((predicted) =>
        evidenceMatches(predicted, expected),
      ),
    ).length;
  }
  return {
    precision: rounded(matchedPredictions / Math.max(1, predictedCount)),
    recall: rounded(matchedAnnotations / Math.max(1, annotatedCount)),
  };
}

export function calculateCalibration(
  predictionsInput: CalibrationPrediction[],
  annotationsInput: ReviewerAnnotation[],
) {
  const predictions = predictionsInput.map((prediction) => ({
    ...prediction,
    roleFamily: RoleFamilySchema.parse(prediction.roleFamily),
    followUpReason: FollowUpReasonSchema.parse(prediction.followUpReason),
  }));
  const annotations = annotationsInput.map((annotation) =>
    ReviewerAnnotationSchema.parse(annotation),
  );
  const annotationByCase = new Map(
    annotations.map((annotation) => [annotation.caseId, annotation]),
  );
  const joined = predictions.flatMap((prediction) => {
    const annotation = annotationByCase.get(prediction.caseId);
    return annotation ? [{ prediction, annotation }] : [];
  });
  if (joined.length === 0) throw new Error("NO_CALIBRATION_MATCHES");

  const byDimension = Object.fromEntries(
    dimensions.map((dimension) => {
      const predicted = joined.map(
        ({ prediction }) => prediction.dimensionScores[dimension],
      );
      const reviewed = joined.map(
        ({ annotation }) => annotation.dimensionScores[dimension],
      );
      const errors = predicted.map((value, index) =>
        Math.abs(value - (reviewed[index] ?? 0)),
      );
      return [
        dimension,
        {
          meanAbsoluteError: rounded(mean(errors)),
          spearman: spearmanCorrelation(predicted, reviewed),
          weightedKappa: weightedCohensKappa(predicted, reviewed),
          overScoringRate: rounded(
            predicted.filter(
              (value, index) => value - (reviewed[index] ?? 0) > 5,
            ).length / predicted.length,
          ),
          underScoringRate: rounded(
            predicted.filter(
              (value, index) => (reviewed[index] ?? 0) - value > 5,
            ).length / predicted.length,
          ),
        },
      ];
    }),
  );
  const slices = Array.from(
    new Set(joined.map(({ prediction }) => prediction.roleFamily)),
  ).map((roleFamily) => {
    const rows = joined.filter(
      ({ prediction }) => prediction.roleFamily === roleFamily,
    );
    return {
      roleFamily,
      cases: rows.length,
      meanAbsoluteError: rounded(
        mean(
          rows.flatMap(({ prediction, annotation }) =>
            dimensions.map((dimension) =>
              Math.abs(
                prediction.dimensionScores[dimension] -
                  annotation.dimensionScores[dimension],
              ),
            ),
          ),
        ),
      ),
      followUpAgreement: rounded(
        rows.filter(
          ({ prediction, annotation }) =>
            prediction.followUpReason === annotation.recommendedFollowUp,
        ).length / rows.length,
      ),
    };
  });
  const evidence = evidenceMetrics(predictions, annotations);

  return {
    matchedCases: joined.length,
    dimensions: byDimension,
    evidencePrecision: evidence.precision,
    evidenceRecall: evidence.recall,
    followUpAgreement: rounded(
      joined.filter(
        ({ prediction, annotation }) =>
          prediction.followUpReason === annotation.recommendedFollowUp,
      ).length / joined.length,
    ),
    slices,
  };
}
