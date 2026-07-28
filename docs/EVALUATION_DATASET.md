# Evaluation Dataset

`evaluation/reference-v1.json` is generated from typed scenarios in
`packages/evaluation/src/dataset.ts`.

Version 1.0.0 contains 156 cases: 26 answer or provider-failure categories
across six role families. Each case includes a rationale, expected score ranges,
evidence-sufficiency and follow-up labels, interruption behavior, fallback
expectation, and an explicit `pronunciation: null`.

Covered categories include excellent, shallow, partially correct, confidently
incorrect, vague, rambling, buzzword-heavy, measurable, honest-unknown,
clarifying, prompt-injection, score-manipulation, unsafe, off-topic, code-mixed,
provider-failure, missing/partial transcript, repeated, and contradictory
answers.

## Commands

```bash
pnpm evaluation:generate
pnpm test
pnpm evaluation:report
```

The test gate requires every case to execute, graph budgets to remain bounded,
and pronunciation fabrication to remain zero. Range and policy agreement are
reported rather than hidden:

- dimension range agreement: 76.92%;
- evidence-sufficiency agreement: 42.31%;
- follow-up agreement: 34.62%;
- interruption agreement: 100%.

These synthetic fixtures are useful regression evidence, not qualified-human
labels, production voice evidence, population fairness evidence, or hiring
validity.
