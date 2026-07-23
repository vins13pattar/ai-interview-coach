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

## Beta — real-time voice

- [ ] WebRTC speech provider adapter
- [ ] Ephemeral browser credentials
- [ ] Voice activity detection and barge-in
- [ ] Interruption policy enforcement
- [ ] Audio/device recovery matrix
- [ ] Explicit recording and retention consent
- [ ] Acoustic-pronunciation evaluation or explicit deferral

Exit criteria: p95 voice response under 1.8 seconds, zero unconsented recording,
and keyboard/text fallback passes all critical flows.

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
