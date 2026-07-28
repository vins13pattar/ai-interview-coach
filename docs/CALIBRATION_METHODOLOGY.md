# Human Calibration Methodology

The calibration implementation is in
`packages/evaluation/src/calibration.ts`. It imports anonymized
`reviewer-annotation-v1` records containing reviewer identifier, case and
rubric version, dimension scores, evidence annotations, recommended follow-up,
confidence, and notes.

## Proposed study

1. Recruit qualified reviewers and document their role-specific experience.
2. Train reviewers on one frozen rubric version using examples outside the
   study set.
3. Remove names and unnecessary identity signals from candidate material.
4. Assign every case to at least two independent reviewers.
5. Resolve only data-quality issues before calculation; preserve disagreement.
6. Freeze model, prompt, rubric, and dataset versions.
7. Calculate overall and role/seniority/category slices.
8. Publish limitations, reviewer counts, missingness, and confidence intervals.

Computed metrics:

- mean absolute error;
- Spearman rank correlation;
- weighted Cohen’s kappa on four ordinal anchor bands;
- evidence precision and recall;
- follow-up agreement;
- over-scoring and under-scoring rates;
- agreement slices by role family, with seniority/category available to the
  machine-readable workflow.

`docs/evaluation/synthetic-calibration-v1.md` demonstrates the complete import
and calculation path with synthetic fixture-derived labels. It is intentionally
marked as non-expert data and must not be cited as calibration or employment
validity.
