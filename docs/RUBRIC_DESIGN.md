# Rubric Design Guide

Executable rubrics live in
`packages/interview-engine/src/rubrics.ts` and validate against
`InterviewRubricSchema`.

## Required structure

Every rubric has a stable identifier and semantic version, one role family,
supported seniorities, a short competency set, weighted dimensions, four
behavioral anchors per dimension, required evidence, disqualifying
insufficiencies, follow-up rules, a confidence method, and limitations.

The registry currently covers:

- Frontend Engineer
- Backend Engineer
- Full-Stack Engineer
- Technical Lead
- Principal Engineer
- GenAI Engineer

## Scoring boundary

Confidence means calibrated clarity of claims and ownership—not personality,
emotion, extroversion, or certainty. Communication measures structure,
relevance, concision, and audience fit. Technical depth measures constraints,
causal reasoning, alternatives, failure modes, validation, and outcomes.

Pronunciation is absent from executable text rubrics. It remains `null` unless a
separately validated acoustic rubric and evidence source are explicitly
enabled.

## Change process

1. Create a new semantic rubric version; do not mutate historical meaning.
2. Add or update role-specific fixtures with rationales.
3. Run `pnpm evaluation:generate` and `pnpm evaluation:report`.
4. Review range, evidence, follow-up, counterfactual, and calibration changes.
5. Record the new rubric version in every evaluated turn and report.
6. Treat a material score or follow-up change as a release-note and fairness
   event.

Rubrics are coaching instruments. They are not validated selection procedures
and must not be used as autonomous hiring rules.
