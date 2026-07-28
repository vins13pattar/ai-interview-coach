# Model and Rubric Card

- Reference registry: `interview-rubric-registry-v1`
- Evaluation schema: `answer-evaluation-v2`
- Current role-rubric version: `1.0.0`

## Intended use

AI Interview Coach provides practice, evidence-backed coaching, and
interview decision support. Its output may help a candidate reflect on an
answer or help a qualified reviewer inspect the evidence. It is not a
validated hiring instrument and must not replace a qualified interviewer or
be the sole basis for an employment decision.

## Supported role families

The executable registry contains separate, deliberately small rubrics for
Frontend Engineer, Backend Engineer, Full-Stack Engineer, Technical Lead,
Principal Engineer, and GenAI Engineer. Each rubric declares competencies,
dimension-specific behavioral anchors, required evidence, disqualifying
insufficiencies, follow-up rules, confidence guidance, and limitations.

Rubric identifier and version are stored in every evaluated turn and final
report. A behavioral or threshold change requires a version bump and updated
evaluation evidence.

## Assessment boundary

| Dimension       | Evidence used                                                        | Safety boundary                                                        |
| --------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Confidence      | Answer completeness, directness, specificity, and admitted unknowns  | Does not infer personality, anxiety, identity, honesty, or hireability |
| Communication   | Structure, causal reasoning, relevance, examples, and concision      | Fluency and accent are not proxies for competence                      |
| Technical depth | Decisions, constraints, trade-offs, failure modes, tests, and impact | Unsupported terminology is not treated as technical evidence           |
| Pronunciation   | Acoustic evidence from a separately calibrated optional assessment   | Always `null` in the current implementation                            |

The model may extract evidence and assess dimensions against anchors.
Deterministic policy owns score bounds and evidence caps, difficulty
hysteresis, follow-up selection, interruption eligibility, completion budgets,
missing-data behavior, and pronunciation availability.

## Evaluation evidence

The versioned reference dataset contains 156 synthetic engineering fixtures
across the six role families and 26 answer/failure categories. Executed
baseline results:

- graph termination: 156/156;
- text-only pronunciation fabrication: 0/156;
- dimension-range agreement: 76.92%;
- evidence-sufficiency agreement: 42.31%;
- follow-up agreement: 34.62%;
- interruption agreement: 100%.

The 30-pair counterfactual suite changes only irrelevant name, pronoun,
geography, career-gap, or meaning-preserving phrasing signals. Its current
deterministic technical-score mean and maximum delta are both 0 within a
documented tolerance of 2.

These results are regression evidence on synthetic fixtures. They are not
qualified-human calibration, adverse-impact evidence, or proof of validity
for employment decisions.

## Calibration status

The repository can import anonymized reviewer annotations and compute MAE,
Spearman correlation, weighted Cohen's kappa, evidence precision/recall,
follow-up agreement, over/under-scoring rates, and role/category slices. The
published demonstration uses synthetic labels and intentionally exposes poor
agreement in several dimensions. No expert-calibration claim is made.

## Known limitations

- Deterministic mode is reproducible but shallow and English-centric.
- OpenAI is the only implemented hosted evaluator.
- Real-population, multilingual, disability, dialect, and accent studies are
  absent.
- Voice provider/browser/device and latency validation is pending.
- No pronunciation model or calibrated acoustic dataset exists.
- Prompt injection and manipulation cases are regression fixtures, not a
  complete adversarial evaluation.
- Scores describe answer evidence for coaching; they do not estimate job
  performance or candidate potential.

See [Rubric Design](RUBRIC_DESIGN.md),
[Evaluation Dataset](EVALUATION_DATASET.md),
[Calibration Methodology](CALIBRATION_METHODOLOGY.md), and
[Known Limitations](KNOWN_LIMITATIONS.md).
