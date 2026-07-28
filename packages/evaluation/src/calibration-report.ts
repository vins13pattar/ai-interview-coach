import { mkdir, writeFile } from "node:fs/promises";

import { runInterviewTurn } from "@interview-coach/interview-engine";

import {
  calculateCalibration,
  ReviewerAnnotationImportSchema,
  type CalibrationPrediction,
} from "./calibration";
import { buildReferenceDataset } from "./dataset";

const dataset = buildReferenceDataset();
const rows = await Promise.all(
  dataset.cases.map(async (fixture) => ({
    fixture,
    result: await runInterviewTurn(fixture.turn),
  })),
);
const annotations = ReviewerAnnotationImportSchema.parse({
  datasetVersion: dataset.datasetVersion,
  synthetic: true,
  annotations: rows.map(({ fixture }) => ({
    annotationVersion: "reviewer-annotation-v1",
    caseId: fixture.id,
    reviewerId: "synthetic_expected_range_midpoint",
    rubricVersion: dataset.rubricRegistryVersion,
    dimensionScores: {
      confidence: Math.round(
        (fixture.expected.confidence.min + fixture.expected.confidence.max) / 2,
      ),
      communication: Math.round(
        (fixture.expected.communication.min +
          fixture.expected.communication.max) /
          2,
      ),
      technicalDepth: Math.round(
        (fixture.expected.technicalDepth.min +
          fixture.expected.technicalDepth.max) /
          2,
      ),
    },
    evidenceAnnotations: [fixture.rationale],
    recommendedFollowUp: fixture.expected.followUpReason,
    confidence: 0.5,
    notes:
      "Synthetic demonstration label derived from the engineering fixture; not a qualified-human annotation.",
  })),
});
const predictions: CalibrationPrediction[] = rows.map(
  ({ fixture, result }) => ({
    caseId: fixture.id,
    roleFamily: fixture.roleFamily,
    seniority: fixture.turn.seniority,
    category: fixture.category,
    dimensionScores: {
      confidence: result.evaluation.scores.confidence,
      communication: result.evaluation.scores.communication,
      technicalDepth: result.evaluation.scores.technicalDepth,
    },
    evidence: result.evaluation.evidence,
    followUpReason: result.followUpReason,
  }),
);
const report = calculateCalibration(predictions, annotations.annotations);

const annotationUrl = new URL(
  "../../../evaluation/calibration/synthetic-annotations-v1.json",
  import.meta.url,
);
const reportUrl = new URL(
  "../../../evaluation/results/synthetic-calibration-v1.json",
  import.meta.url,
);
const markdownUrl = new URL(
  "../../../docs/evaluation/synthetic-calibration-v1.md",
  import.meta.url,
);
await mkdir(new URL(".", annotationUrl), { recursive: true });
await mkdir(new URL(".", reportUrl), { recursive: true });
await mkdir(new URL(".", markdownUrl), { recursive: true });
await writeFile(
  annotationUrl,
  `${JSON.stringify(annotations, null, 2)}\n`,
  "utf8",
);
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const dimensions = report.dimensions as Record<
  string,
  {
    meanAbsoluteError: number;
    spearman: number;
    weightedKappa: number;
    overScoringRate: number;
    underScoringRate: number;
  }
>;
await writeFile(
  markdownUrl,
  `# Synthetic Calibration Demonstration

> This report proves the annotation-import and metric-computation workflow. Its
> labels are derived from engineering fixture ranges, not qualified reviewers.
> It must not be cited as expert calibration or hiring validity.

| Dimension | MAE | Spearman | Weighted kappa | Over-score rate | Under-score rate |
| --------- | ---: | -------: | -------------: | --------------: | ---------------: |
${Object.entries(dimensions)
  .map(
    ([dimension, value]) =>
      `| ${dimension} | ${value.meanAbsoluteError} | ${value.spearman} | ${value.weightedKappa} | ${value.overScoringRate} | ${value.underScoringRate} |`,
  )
  .join("\n")}

| Additional metric | Result |
| ----------------- | -----: |
| Matched cases | ${report.matchedCases} |
| Evidence precision | ${report.evidencePrecision} |
| Evidence recall | ${report.evidenceRecall} |
| Follow-up agreement | ${report.followUpAgreement} |

Role-family slices and the full machine-readable result are stored in
\`evaluation/results/synthetic-calibration-v1.json\`. Replace the synthetic
annotation file with anonymized qualified-reviewer imports before making any
calibration claim.
`,
  "utf8",
);
