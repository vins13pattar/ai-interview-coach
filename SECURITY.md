# Security Policy

## Supported versions

The project is pre-1.0. Security fixes are applied to the latest `main` branch.

## Reporting a vulnerability

Do not open a public issue for vulnerabilities involving authentication,
provider keys, candidate data, report authorization, prompt injection, or
remote execution.

Use GitHub private vulnerability reporting in the repository Security tab. If
that channel is unavailable, contact the maintainer privately through their
verified GitHub profile.

Include:

- affected commit and component;
- reproduction steps;
- impact;
- any proof of concept with secrets and personal data removed;
- suggested mitigation if known.

Please allow 7 days for acknowledgment and 90 days for coordinated remediation
before public disclosure.

## Security boundaries

- Browser-provided API keys are visible to the backend that forwards them.
- The alpha is not ready for sensitive hiring data or untrusted multi-tenancy.
- Browser speech recognition may use a browser vendor service.
- Do not deploy the alpha as an autonomous employment decision system.

Never include real candidate transcripts, resumes, audio, or provider keys in a
security report.
