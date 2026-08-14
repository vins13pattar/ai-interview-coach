# Hosted Alpha Release Acceptance

This file separates automated repository evidence from checks that require a
maintainer, physical device, provider-funded call, or independent reviewer.

## Automated gates

- [x] `pnpm check`
- [x] `pnpm test:e2e`
- [x] `pnpm audit:dependencies`
- [x] repository-scoped secret scan
- [x] migration `0003_release_controls.sql` applied to hosted PostgreSQL
- [x] authenticated retention endpoint rejects missing and invalid secrets
- [x] hosted smoke: health, account registration/deletion, session
      create/deletion, zero residual sessions, and cross-origin rejection
- [x] daily quotas and bounded JSON bodies verified by regression tests

## Maintainer-operated gates

- [ ] Configure a Vercel usage notification and confirm the Hobby hard cap
- [ ] Verify Neon compute/storage limits and owner notification routing
- [ ] Verify custom-domain DNS, TLS, canonical origin, and redirect behavior
- [ ] Run backup creation and restore into an isolated database
- [ ] Run current Chrome, Firefox, Safari, mobile Safari, and mobile Chrome text
      journeys
- [ ] Run a real BYOK OpenAI text journey and confirm the key is absent from
      logs, database records, checkpoints, exports, and browser storage
- [ ] Record physical-device voice results for permission, interruption,
      reconnect, transcript error, latency, and text fallback

## Independent gates

These cannot be approved by the implementation author alone.

- [ ] Independent security and privacy review, with findings disposition
- [ ] WCAG 2.2 AA audit by a qualified accessibility reviewer
- [ ] Qualified-human calibration and score-stability study
- [ ] Employment/privacy legal review for every intended operating geography

Until these boxes have named reviewers, dated evidence, and linked findings,
the release remains a public hosted alpha—not hiring-grade, calibrated,
pronunciation-validated, WCAG-certified, or production-ready.
