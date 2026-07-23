# Alpha Rubric Card

Version: `alpha-v1`

## Purpose

The alpha rubric gives candidates immediate coaching feedback and gives
maintainers a deterministic baseline for regression testing. It is not a
validated hiring instrument and must not be used as the sole basis for an
employment decision.

## Dimensions

| Dimension       | Evidence considered in text mode                                                                | Explicit limitation                                                        |
| --------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Confidence      | Direct language, answer completeness, concrete examples, and filler frequency                   | Does not infer personality, anxiety, identity, or truthfulness             |
| Communication   | Structure markers, causal explanations, examples, and concision                                 | English-language heuristic; not calibrated across dialects or disabilities |
| Technical depth | Technical concepts, trade-offs, failure modes, testing, scale, security, and measurable results | Keyword evidence can miss valid domain-specific reasoning                  |
| Pronunciation   | Acoustic evidence only                                                                          | Always `null` for typed or browser-transcribed text in the alpha           |

Scores range from 0 to 100. A score is a coaching signal, not a probability or
employment recommendation. Every report includes supporting observations and a
human-review disclaimer.

## Difficulty policy

The engine averages confidence, communication, technical depth, and a neutral
pronunciation value of 75 when acoustic evidence is absent:

- 78 or higher: increase one difficulty level;
- below 48: decrease one difficulty level;
- otherwise: keep the current level.

Difficulty is bounded to foundation, intermediate, advanced, and expert.

## Interruption policy

The deterministic alpha suggests a redirect when an answer is longer than 125
words without enough structure, or when it detects at least seven filler
phrases. The text experience shows coaching feedback; real-time voice barge-in
is a beta feature and requires separate consent and latency validation.

## Evaluation dataset

[`evaluation/alpha-v1.json`](../evaluation/alpha-v1.json) contains the initial
public regression set:

- a concrete, structured system-design answer;
- unsupported generalities;
- a filler-heavy ramble that should trigger a redirect.

The suite checks bounded score expectations, interruption behavior, and the
requirement that pronunciation remains unscored without acoustic evidence.

## Known gaps before public v1

- Expand the dataset across roles, seniority levels, dialects, and answer styles.
- Run inter-rater studies with qualified interviewers.
- Measure score stability across providers and repeated runs.
- Perform accessibility, adverse-impact, and bias reviews.
- Publish calibration methodology, subgroup limitations, and change history.

Rubric or threshold changes require a version bump, fixture updates, and a
documented rationale.
