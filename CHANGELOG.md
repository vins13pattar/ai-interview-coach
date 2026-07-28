# Changelog

All notable changes will be documented here. This project has not published a
tagged release.

## Unreleased — reference implementation candidate

### Added

- Explicit bounded LangGraph interview workflow with durable typed state.
- Six versioned executable role rubrics and evaluation provenance.
- 156-case deterministic reference dataset and computed report.
- 30 counterfactual pairs and computed score-delta report.
- Human-annotation import, calibration metrics, and labelled synthetic demo.
- Typed interruption and provider fallback policies.
- Content-free latency/fallback telemetry and aggregation.
- Consented OpenAI Realtime WebRTC beta with ephemeral credentials, mute,
  transcript review/correction, reconnect control, and text fallback.
- Privacy, reliability, accessibility, evaluation, ADR, and release-readiness
  documentation.

### Changed

- Reports now expose rubric/evaluation versions, uncertainty, limitations, and
  pronunciation availability.
- CI now checks formatting and high-severity production dependency advisories.
- Next.js and LangSmith dependencies were updated and vulnerable Sharp/PostCSS
  transitive versions were constrained to patched releases.

### Security

- Added encrypted opt-in provider connections, secret leakage regression
  assertions, provider provenance, consent audit events, and a hardened
  read-only container runtime.

### Not released

- No tag, push, deployment, license, or public release has been created.
- Human calibration, real voice device evidence, context-validated threat
  model, independent accessibility/security review, and production operations
  remain gates.
