# Contributing

Thanks for helping build Interview Coach.

## Development

1. Use Node.js 20.9+ and pnpm 11.
2. Fork and clone the repository.
3. Run `pnpm install`.
4. Run `pnpm dev` for the application.
5. Run `pnpm check` before opening a pull request.
6. Run the Compose stack and `pnpm test:e2e` for browser-facing changes.

The local demo must remain keyless and deterministic. Tests must not call paid
providers unless they are explicitly marked and excluded from default CI.

## Pull requests

- Keep changes focused and explain user impact.
- Add or update tests for behavior changes.
- Update the PRD/architecture when a public contract changes.
- Never commit API keys, transcripts, resumes, recordings, or candidate PII.
- Mark AI scoring changes with the rubric/prompt version and evaluation evidence.
- Preserve the rule that pronunciation is not scored from text.

## Commit style

Use a clear imperative subject, for example:

```text
feat(engine): add bounded difficulty smoothing
fix(api): redact provider errors
docs(prd): clarify report evidence policy
```

## Responsible AI changes

Changes to scoring, interruption, speech, or reports require:

- explicit intended behavior;
- known failure modes;
- representative test fixtures;
- fairness impact assessment;
- rollback or versioning plan.

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
