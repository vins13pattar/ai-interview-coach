# Reference Implementation Gap Matrix

This matrix reconciles the public-v1 roadmap with the reference-implementation
brief. It distinguishes verified behavior from code that exists but still
needs real-provider, device, scale, human-review, or independent-security
evidence.

Baseline date: 2026-07-28

## Evidence levels

| Level       | Meaning                                                                        |
| ----------- | ------------------------------------------------------------------------------ |
| Verified    | Automated tests or a measured runtime check currently pass.                    |
| Implemented | Code exists and passes static checks, but a required external test is pending. |
| Partial     | A useful slice exists; required behavior or evidence is incomplete.            |
| Pending     | No adequate implementation or evidence exists yet.                             |
| Decision    | Maintainer, legal, product, or external-review input is required.              |

## Requirement matrix

| Area                     | Current evidence                                                                                                                       | Status      | Required implementation or evidence                                                                                                 | Release gate                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| JS/TS-only stack         | Next.js/React/LangChain.js/LangGraph pnpm monorepo                                                                                     | Verified    | Preserve the boundary for all new runtime and evaluation tooling                                                                    | No non-JS/TS runtime service                                                    |
| Deterministic demo       | 156 versioned fixtures execute without a paid key                                                                                      | Verified    | Improve measured evidence and follow-up agreement before stronger quality claims                                                    | 100% fixture execution; no paid key in CI                                       |
| Explicit interview graph | Typed bounded graph, conditional fallback, deterministic policy nodes                                                                  | Verified    | Add restart/conflict fault injection around the existing state-transition suite                                                     | 100% graph termination and state-transition suite                               |
| Rubrics                  | Six executable role rubrics at version `1.0.0`; versions stored with turns/reports                                                     | Verified    | Qualified review of anchors and future version migration evidence                                                                   | Registry/schema tests and per-role fixtures                                     |
| Separated assessment     | Evidence extraction and dimension assessment are separate model calls; policy is local                                                 | Verified    | Provider-level quality and repeatability measurement                                                                                | Versioned schemas and provider contract tests                                   |
| Human calibration        | Versioned annotation import and computed synthetic demonstration                                                                       | Partial     | Collect qualified independent reviewer annotations and publish study design/results                                                 | Synthetic demo remains labelled synthetic; expert claims require real reviewers |
| Counterfactual fairness  | 30 synthetic pairs; computed mean/max technical-score delta 0                                                                          | Verified    | Extend to qualified, multilingual, voice, and real-population review without inferring traits                                       | Technical-score delta within documented tolerance                               |
| Provider reliability     | Timeout/rate-limit/invalid/empty/incomplete/refusal tests and fallback provenance                                                      | Partial     | Structured-output repair metrics, circuit state, stream/database fault injection                                                    | Automated provider failure cases                                                |
| Provider abstraction     | Demo and OpenAI evaluators                                                                                                             | Partial     | Public typed adapter contract plus one additional hosted adapter or fully tested adapter conformance kit                            | Two hosted adapters plus deterministic local mode for public v1                 |
| BYOK security            | Tab key, AES-256-GCM opt-in per-user storage, no operator-key fallback, redacted APIs                                                  | Verified    | Leakage regression tests, rotation/deletion guide, telemetry redaction verification                                                 | No key in persistence, checkpoints, logs, traces, or exports                    |
| Durable sessions         | PostgreSQL ownership, optimistic versioning, idempotency, PostgresSaver, export/delete                                                 | Verified    | Concurrent-tab conflict, server restart, browser reconnect, checkpoint cleanup, report regeneration tests                           | 100% deterministic recovery and duplicate-turn gates                            |
| Voice transport          | WebRTC, ephemeral token, semantic VAD, barge-in, transcript review, mute/leave/reconnect controls                                      | Implemented | Automatic reconnect, controlled mid-answer redirects, overlap tests, richer latency/error metrics                                   | Real browser/device matrix and p95 evidence before production claim             |
| Interruption policy      | Typed reasons, minimum duration, confidence/evidence, natural-boundary policy                                                          | Partial     | Candidate reaction/outcome audit and real false/missed interruption measurement                                                     | Policy evaluation fixtures and false/missed interruption metrics                |
| Privacy/governance       | Versioned consent, data inventory, raw-audio-off, export, session/checkpoint deletion                                                  | Partial     | Configurable retention scheduler, administrative boundary, hosted legal/provider review, derived-data subject workflow              | Deletion verification covers every retained data class                          |
| Observability            | Content-free graph/turn/provider/rubric latency and fallback events with p50/p95 summary                                               | Partial     | Durable sink, retry/token/cost/voice/completion/export/delete measurements                                                          | p50/p95 and rate reports generated from executed fixtures/runtime               |
| Accessibility            | Labels, visible focus, reduced-motion rules, text fallback                                                                             | Partial     | Keyboard, screen-reader, captions, contrast, zoom/responsive, reconnect/error audit                                                 | WCAG 2.2 AA report with no unresolved critical/high findings                    |
| Security                 | Threat model; 145-file internal scan; eight medium findings remediated; CSP, ownership, hardened container, Gitleaks, dependency audit | Partial     | SAST/container gates, hosted rate-limit review, maintainer assumption confirmation, independent security assessment                 | No unresolved critical/high issue without documented exception                  |
| CI                       | Format, lint, types, unit/PostgreSQL, dataset/fairness, Playwright, build, Docker, Gitleaks, dependency audit                          | Partial     | Add SAST/container scanning and baseline-based quality thresholds                                                                   | All required checks pass from a clean checkout                                  |
| Documentation            | Required ADRs, threat model, evaluation/calibration reports, privacy/accessibility/model cards, draft release notes and demo script    | Partial     | Maintainer assumption confirmation and independent evidence                                                                         | Every public claim links to current measured evidence                           |
| License                  | Licensing options documented; no `LICENSE`                                                                                             | Decision    | Maintainer selects license and copyright posture                                                                                    | Required before an actual open-source release                                   |
| Hosted production        | Local Compose only                                                                                                                     | Pending     | Target hosting architecture, identity, managed database, secrets, backups, monitoring, load/failover/restore and public smoke tests | Explicit approval before deploy or release                                      |

## Verified baseline

The following checks passed against the current working tree on 2026-07-28:

- Prettier formatting check.
- Lint and TypeScript checks across six workspace packages.
- Twenty-six interview-engine, five evaluation, seven voice, and three
  keyless database unit tests.
- Next.js production build including the voice-token route.
- Hardened three-service Docker Compose build and health gate.
- Six PostgreSQL unit/integration tests inside the migration image.
- Two Chromium journeys: durable five-turn completion/export/deletion and
  explicit voice consent gating.

These results do not validate live OpenAI voice behavior, hardware recovery,
latency targets, human calibration, fairness across real populations, WCAG
conformance, production scale, legal compliance, or independent security.

## Implementation order

1. Make the rubric and evaluation version first-class contracts.
2. Expand the turn graph into explicit, bounded deterministic-policy nodes.
3. Build the 150-case deterministic corpus and computed evaluation report.
4. Add counterfactual and synthetic calibration runners.
5. Add provider failure provenance, recovery tests, and content-free telemetry.
6. Complete concurrency, restart, deletion, and flagship-journey coverage.
7. Strengthen voice UX and collect real browser/device evidence.
8. Complete accessibility, privacy, and repository-grounded security reviews.
9. Prepare—but do not push, deploy, tag, license, or publish—the release
   candidate until explicitly approved.
