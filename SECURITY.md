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
- Durable objects are tenant- and user-scoped behind an opaque, hashed guest
  session cookie. A production identity provider and account recovery are not
  implemented.
- Stored provider connections are optional, encrypted with AES-256-GCM, and
  unavailable unless the operator supplies `PROVIDER_ENCRYPTION_KEY`.
- Origin validation and a required client header protect mutation routes;
  internet-facing deployments still require TLS, rate limiting, and edge abuse
  controls.
- Browser speech recognition may use a browser vendor service.
- Do not deploy the alpha as an autonomous employment decision system.

Never include real candidate transcripts, resumes, audio, or provider keys in a
security report.
