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

## Next — durable alpha

- [ ] Authentication and tenant isolation
- [ ] PostgreSQL schema and migrations
- [ ] LangGraph PostgreSQL checkpointer
- [ ] Versioned, idempotent session APIs
- [ ] Resume, pause, delete, and export
- [ ] Encrypted server-managed provider connections
- [ ] CI browser tests and secret scanning
- [ ] Initial evaluation dataset and rubric card

Exit criteria: sessions survive restart; deletion is verified; authorization
tests cover every object; deterministic and provider contract suites pass.

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
