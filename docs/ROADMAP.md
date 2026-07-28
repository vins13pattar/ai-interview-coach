# Roadmap

This roadmap separates a working alpha from production claims.

## Now — alpha foundation

- [x] TypeScript pnpm monorepo
- [x] Shared Zod contracts
- [x] LangGraph adaptive turn flow
- [x] Deterministic keyless evaluator
- [x] Optional OpenAI structured evaluator
- [x] Browser speech transcription as progressive enhancement
- [x] Evidence-backed dimension scores
- [x] Recruiter-style five-turn report
- [x] Product, architecture, security, and contributor documentation
- [ ] Select and add an open-source license

## Delivered — durable alpha

- [x] Guest authentication and tenant isolation
- [x] PostgreSQL schema and idempotent migrations
- [x] LangGraph PostgreSQL checkpointer
- [x] Versioned, idempotent session APIs
- [x] Resume, pause, delete, and export
- [x] Optional encrypted server-managed provider connections
- [x] CI browser tests and secret scanning
- [x] Initial evaluation dataset and [rubric card](RUBRIC_CARD.md)

Exit criteria: sessions survive restart; deletion is verified; authorization
tests cover every object; deterministic and provider contract suites pass.

Evidence: repository integration tests cover cross-tenant session and provider
connection access, Playwright covers the complete durable candidate journey,
and the Compose runtime applies migrations before admitting web traffic.
Registered accounts and an external identity provider remain public-v1 work.

## Implemented beta — real-time voice validation pending

- [x] WebRTC speech provider adapter
- [x] Ephemeral browser credentials
- [x] Voice activity detection and barge-in
- [x] Initial deterministic interruption policy
- [x] Audio/device recovery controls
- [x] Explicit provider-processing and transcript-retention consent
- [x] Acoustic-pronunciation evaluation explicitly deferred

Exit criteria: p95 voice response under 1.8 seconds, zero unconsented recording,
and keyboard/text fallback passes all critical flows.

Code and consent gating pass focused/unit and Chromium tests. Real OpenAI audio,
latency, reconnection, false/missed interruption, transcript-error, and
browser/device evidence remain required before calling voice production-ready.

## In progress — public reference implementation

- [x] Requirement-to-evidence [gap matrix](REFERENCE_IMPLEMENTATION_GAP_MATRIX.md)
- [x] Explicit bounded LangGraph turn state and deterministic policy nodes
- [x] Versioned executable rubrics for six role families
- [x] Split evidence extraction from dimension assessment
- [x] 156-case deterministic dataset with computed baseline metrics
- [x] Synthetic 30-pair counterfactual technical-score report
- [x] Human-annotation import and synthetic calibration statistics
- [x] Provider timeout/rate-limit/invalid-output/refusal conformance tests
- [x] Content-free graph/turn latency and fallback telemetry baseline
- [x] Patched production dependency audit with no known vulnerabilities
- [ ] Qualified-human calibration study
- [ ] Circuit-breaking and stream/database failure-injection suite
- [ ] Runtime persistence/export for telemetry, token, cost, and completion
      reporting
- [ ] Concurrent-tab, restart, reconnect, and report-regeneration matrix
- [ ] Retention scheduler and complete derived-data inventory
- [ ] WCAG 2.2 AA evidence
- [ ] Repository threat model and independent security review
- [ ] Real voice browser/device validation matrix

Current computed synthetic baseline: 156/156 cases terminate and fabricate zero
pronunciation scores. Dimension-range agreement is 76.92%,
evidence-sufficiency agreement is 42.31%, follow-up agreement is 34.62%, and
interruption agreement is 100%. These are engineering-fixture results, not
qualified-human calibration or hiring validity.

## Public v1 — calibrated and operable

- [ ] Two hosted LLM providers plus one local provider
- [ ] Calibrated role packs
- [ ] Bias and score-stability study
- [ ] WCAG 2.2 AA audit
- [ ] Threat model and independent security review
- [ ] Load, failover, backup, and restore evidence
- [ ] Public model/rubric card
- [ ] Hosted deployment and browser smoke verification

Exit criteria are defined in the [PRD](PRD.md).
