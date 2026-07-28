# Known Limitations

- Deterministic scoring is a reproducible engineering baseline, not semantic
  expert judgment. Current synthetic agreement metrics expose substantial
  evidence and follow-up gaps.
- No qualified-human calibration study has been completed.
- Counterfactual results cover synthetic text pairs only, not real
  populations, accents, disabilities, languages, or outcomes.
- OpenAI is the only hosted evaluator; public v1 requires another hosted
  provider or equivalent conformance evidence.
- Live voice has not been validated with real provider credentials across a
  documented browser/device matrix.
- Voice offers manual fresh-token reconnect, transcript correction, mute, and
  leave controls, but automatic reconnect and controlled mid-answer
  interviewer redirects remain incomplete.
- Pronunciation is never assessed. This is an intentional safety boundary.
- Guest identity is durable and tenant-scoped but is not a registered-account,
  recovery, organization, or enterprise identity system.
- Retention is delete-driven; automated expiry jobs are not implemented.
- The project has not completed load, failover, backup, or restore testing.
- Accessibility has not received an independent WCAG audit.
- The threat model and independent security review are pending contextual
  validation.
- No `LICENSE` exists until the maintainer selects one.
- No hosted deployment or release candidate has been approved.
