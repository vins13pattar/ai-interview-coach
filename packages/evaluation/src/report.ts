import { mkdir, writeFile } from "node:fs/promises";

import { runInterviewTurn } from "@interview-coach/interview-engine";

import { buildReferenceDataset } from "./dataset";

function within(value: number, range: { min: number; max: number }): boolean {
  return value >= range.min && value <= range.max;
}

const dataset = buildReferenceDataset();
const results = await Promise.all(
  dataset.cases.map(async (fixture) => ({
    fixture,
    result: await runInterviewTurn(fixture.turn),
  })),
);

const caseResults = results.map(({ fixture, result }) => {
  const dimensionPass = {
    confidence: within(
      result.evaluation.scores.confidence,
      fixture.expected.confidence,
    ),
    communication: within(
      result.evaluation.scores.communication,
      fixture.expected.communication,
    ),
    technicalDepth: within(
      result.evaluation.scores.technicalDepth,
      fixture.expected.technicalDepth,
    ),
  };
  return {
    id: fixture.id,
    roleFamily: fixture.roleFamily,
    category: fixture.category,
    scores: result.evaluation.scores,
    dimensionPass,
    evidenceSufficiency: {
      expected: fixture.expected.evidenceSufficiency,
      actual: result.evaluation.evidenceSufficiency,
      pass:
        fixture.expected.evidenceSufficiency ===
        result.evaluation.evidenceSufficiency,
    },
    followUpReason: {
      expected: fixture.expected.followUpReason,
      actual: result.followUpReason,
      pass: fixture.expected.followUpReason === result.followUpReason,
    },
    interruption: {
      expected: fixture.expected.shouldInterrupt,
      actual: result.evaluation.shouldInterrupt,
      pass:
        fixture.expected.shouldInterrupt === result.evaluation.shouldInterrupt,
    },
  };
});

const totalDimensionChecks = caseResults.length * 3;
const passedDimensionChecks = caseResults.reduce(
  (sum, item) => sum + Object.values(item.dimensionPass).filter(Boolean).length,
  0,
);
const percentage = (value: number, total: number) =>
  Math.round((value / total) * 10_000) / 100;
const summary = {
  datasetVersion: dataset.datasetVersion,
  executedCases: caseResults.length,
  roleFamilies: new Set(caseResults.map((item) => item.roleFamily)).size,
  categories: new Set(caseResults.map((item) => item.category)).size,
  graphTerminationRate: 100,
  pronunciationFabricationCount: results.filter(
    ({ result }) => result.evaluation.scores.pronunciation !== null,
  ).length,
  dimensionRangePassRate: percentage(
    passedDimensionChecks,
    totalDimensionChecks,
  ),
  evidenceSufficiencyAgreement: percentage(
    caseResults.filter((item) => item.evidenceSufficiency.pass).length,
    caseResults.length,
  ),
  followUpAgreement: percentage(
    caseResults.filter((item) => item.followUpReason.pass).length,
    caseResults.length,
  ),
  interruptionAgreement: percentage(
    caseResults.filter((item) => item.interruption.pass).length,
    caseResults.length,
  ),
  syntheticLabels: true,
  expertCalibrationClaimed: false,
};

const jsonUrl = new URL(
  "../../../evaluation/results/reference-v1.json",
  import.meta.url,
);
const markdownUrl = new URL(
  "../../../docs/evaluation/reference-v1-report.md",
  import.meta.url,
);
await mkdir(new URL(".", jsonUrl), { recursive: true });
await mkdir(new URL(".", markdownUrl), { recursive: true });
await writeFile(
  jsonUrl,
  `${JSON.stringify({ summary, cases: caseResults }, null, 2)}\n`,
  "utf8",
);
await writeFile(
  markdownUrl,
  `# Deterministic Evaluation Baseline

Generated from executed dataset version \`${dataset.datasetVersion}\`.

> These labels are synthetic engineering fixtures, not qualified-human
> calibration and not evidence of hiring validity.

| Metric | Result |
| ------ | ------ |
| Executed cases | ${summary.executedCases} |
| Role families | ${summary.roleFamilies} |
| Answer/failure categories | ${summary.categories} |
| Graph termination | ${summary.graphTerminationRate}% |
| Fabricated pronunciation scores | ${summary.pronunciationFabricationCount} |
| Dimension range agreement | ${summary.dimensionRangePassRate}% |
| Evidence-sufficiency agreement | ${summary.evidenceSufficiencyAgreement}% |
| Follow-up agreement | ${summary.followUpAgreement}% |
| Interruption agreement | ${summary.interruptionAgreement}% |

The machine-readable per-case output is stored in
\`evaluation/results/reference-v1.json\`. Thresholds should be tightened only
after reviewing failures and, for calibration claims, collecting qualified
human annotations.
`,
  "utf8",
);
