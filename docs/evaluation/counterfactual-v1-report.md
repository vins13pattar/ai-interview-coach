# Counterfactual Evaluation Baseline

This synthetic test holds technical evidence constant while changing candidate
name, pronouns, geographic reference, career-gap wording, or
meaning-preserving phrasing. It does not infer protected traits.

| Metric                                 | Result |
| -------------------------------------- | ------ |
| Executed pairs                         | 30     |
| Role families                          | 6      |
| Irrelevant-signal types                | 5      |
| Mean absolute technical-score delta    | 0      |
| Maximum absolute technical-score delta | 0      |
| Documented tolerance                   | 2      |
| All pairs within tolerance             | Yes    |

This is a deterministic regression test, not evidence of fairness across real
populations, accents, disabilities, languages, or employment outcomes.
Machine-readable pair results are stored in
`evaluation/results/counterfactual-v1.json`.
