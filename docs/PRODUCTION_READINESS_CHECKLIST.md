# Production Readiness Checklist

## Verified locally

- [x] Formatting, lint, typecheck, tests, and production build
- [x] PostgreSQL migrations and repository integration tests
- [x] Stable session ID used as LangGraph `thread_id`
- [x] Tenant/user ownership, idempotency, optimistic concurrency
- [x] Session export and checkpoint-aware deletion
- [x] Hardened Compose runtime and health checks
- [x] Deterministic 156-case execution and counterfactual test
- [x] Explicit voice consent and text fallback browser journey
- [x] Content-free graph/turn latency and fallback telemetry contract
- [x] High-severity production dependency audit: no known vulnerabilities
- [x] Repository-grounded threat model and severity calibration
- [x] Repository-wide internal security scan: 145/145 files reviewed; eight
      medium findings remediated with focused regression coverage; no high or
      critical findings

## Required before release candidate approval

- [ ] Improve documented evaluation/calibration gaps
- [ ] Qualified-human annotation study
- [ ] Direct provider failure-injection/conformance suite
- [ ] Second hosted evaluator
- [ ] Durable observability backend and runtime cost/latency evidence
- [ ] Concurrent-tab, restart, backup, restore, and load tests
- [ ] Real browser/device voice matrix and latency report
- [ ] WCAG 2.2 AA audit
- [ ] Maintainer confirmation of hosting, identity, geography, and retention
      assumptions
- [ ] Independent security review and dependency/container findings disposition
- [ ] Hosted identity, retention, administrative access, and incident runbooks
- [ ] License selection and `LICENSE`
- [ ] Maintainer approval to push, deploy, tag, or publish
