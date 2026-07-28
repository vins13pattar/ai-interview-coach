import { mkdir, writeFile } from "node:fs/promises";

import { runInterviewTurn } from "@interview-coach/interview-engine";

import { counterfactualPairs } from "./counterfactual";

const results = await Promise.all(
  counterfactualPairs.map(async (pair) => {
    const [left, right] = await Promise.all([
      runInterviewTurn(pair.left),
      runInterviewTurn(pair.right),
    ]);
    return {
      id: pair.id,
      roleFamily: pair.roleFamily,
      signal: pair.signal,
      technicalDepth: {
        left: left.evaluation.scores.technicalDepth,
        right: right.evaluation.scores.technicalDepth,
        absoluteDelta: Math.abs(
          left.evaluation.scores.technicalDepth -
            right.evaluation.scores.technicalDepth,
        ),
      },
      communication: {
        left: left.evaluation.scores.communication,
        right: right.evaluation.scores.communication,
        absoluteDelta: Math.abs(
          left.evaluation.scores.communication -
            right.evaluation.scores.communication,
        ),
      },
      confidence: {
        left: left.evaluation.scores.confidence,
        right: right.evaluation.scores.confidence,
        absoluteDelta: Math.abs(
          left.evaluation.scores.confidence -
            right.evaluation.scores.confidence,
        ),
      },
    };
  }),
);

const technicalDeltas = results.map(
  (result) => result.technicalDepth.absoluteDelta,
);
const summary = {
  datasetVersion: "counterfactual-v1",
  syntheticPairs: results.length,
  roleFamilies: new Set(results.map((result) => result.roleFamily)).size,
  identityOrPhrasingSignals: new Set(results.map((result) => result.signal))
    .size,
  meanAbsoluteTechnicalScoreDelta:
    Math.round(
      (technicalDeltas.reduce((sum, value) => sum + value, 0) /
        technicalDeltas.length) *
        100,
    ) / 100,
  maximumAbsoluteTechnicalScoreDelta: Math.max(...technicalDeltas),
  tolerance: 2,
  withinTolerance: technicalDeltas.every((value) => value <= 2),
  protectedTraitInferencePerformed: false,
  realPopulationFairnessClaimed: false,
};

const jsonUrl = new URL(
  "../../../evaluation/results/counterfactual-v1.json",
  import.meta.url,
);
const markdownUrl = new URL(
  "../../../docs/evaluation/counterfactual-v1-report.md",
  import.meta.url,
);
await mkdir(new URL(".", jsonUrl), { recursive: true });
await mkdir(new URL(".", markdownUrl), { recursive: true });
await writeFile(
  jsonUrl,
  `${JSON.stringify({ summary, pairs: results }, null, 2)}\n`,
  "utf8",
);
await writeFile(
  markdownUrl,
  `# Counterfactual Evaluation Baseline

This synthetic test holds technical evidence constant while changing candidate
name, pronouns, geographic reference, career-gap wording, or
meaning-preserving phrasing. It does not infer protected traits.

| Metric | Result |
| ------ | ------ |
| Executed pairs | ${summary.syntheticPairs} |
| Role families | ${summary.roleFamilies} |
| Irrelevant-signal types | ${summary.identityOrPhrasingSignals} |
| Mean absolute technical-score delta | ${summary.meanAbsoluteTechnicalScoreDelta} |
| Maximum absolute technical-score delta | ${summary.maximumAbsoluteTechnicalScoreDelta} |
| Documented tolerance | ${summary.tolerance} |
| All pairs within tolerance | ${summary.withinTolerance ? "Yes" : "No"} |

This is a deterministic regression test, not evidence of fairness across real
populations, accents, disabilities, languages, or employment outcomes.
Machine-readable pair results are stored in
\`evaluation/results/counterfactual-v1.json\`.
`,
  "utf8",
);
