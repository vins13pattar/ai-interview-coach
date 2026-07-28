# Draft Reference Candidate Release Notes

Status: local, untagged, and not approved for publication.

This candidate turns the durable alpha into an evidence-oriented reference
implementation: a deterministic policy graph surrounds bounded model
interpretation, every score carries rubric/provider provenance, and evaluation
claims are generated from executable fixtures.

## Measured evidence

- 156/156 deterministic evaluation cases executed and terminated.
- 0/156 text cases fabricated pronunciation scores.
- 30/30 counterfactual pairs stayed within the technical-score tolerance of 2;
  mean and maximum delta were 0.
- 26 interview-engine tests, 5 evaluation tests, 7 voice tests, and 6
  PostgreSQL tests passed.
- Two Chromium journeys passed for durable completion/export/deletion and voice
  consent gating.
- Production dependency audit reported no known vulnerabilities after patched
  constraints were installed.

## Candidate-visible changes

- Explicit text or voice selection and clear evaluation-mode state.
- Targeted evidence follow-ups and difficulty hysteresis.
- Degraded-provider state and fallback provenance.
- Reports with evidence, uncertainty, limitations, and scoring versions.
- Voice transcript review before scoring, mute/leave/reconnect controls, and
  permanent text fallback.

## Deliberate non-claims

This candidate is not a validated hiring instrument. It has no qualified-human
calibration study, real-population fairness evidence, production-grade voice
device matrix, independent WCAG/security audit, hosted operations evidence, or
selected open-source license. It must not be pushed, tagged, deployed, or
released without maintainer approval.
