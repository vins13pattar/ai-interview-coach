# Provider and BYOK Security Model

## Trust boundary

Provider credentials enter through a request header or an explicitly opted-in
server-side connection. Provider calls originate on the server except for the
ephemeral OpenAI Realtime client secret used to establish browser-to-provider
WebRTC. The long-lived API key is never returned to the browser by the server.

## Credential modes

| Mode                      | Persistence                         | Exposure boundary                                       |
| ------------------------- | ----------------------------------- | ------------------------------------------------------- |
| Deterministic demo        | No credential                       | No paid provider call                                   |
| Tab-scoped BYOK           | React memory until reload/close     | Request header to this server; never browser storage    |
| Server-managed BYOK       | AES-256-GCM encrypted PostgreSQL    | Explicit opt-in; scoped by tenant and pseudonymous user |
| Realtime ephemeral secret | Temporary grant and expiry metadata | Browser receives only short-lived provider secret       |

`PROVIDER_ENCRYPTION_KEY` is deployment configuration and must be a
base64-encoded 32-byte key. Rotating it requires decrypting and re-encrypting
stored provider connections under a controlled migration; deleting a
connection is available in the product UI and API.

## Redaction and evidence

- Public provider-connection contracts contain provider, timestamps, and
  persistence state only.
- Database integration tests assert that plaintext keys do not appear in
  stored ciphertext, public connection serialization, or audit metadata.
- Interview telemetry has a closed content-free schema with provider status,
  model/rubric mode, timings, and node names; it has no answer or credential
  field.
- Provider, model, prompt, schema, rubric, fallback reason, and evaluation mode
  are recorded without recording credentials.
- Gitleaks runs against repository history in CI.

## Failure behavior

Provider timeouts, rate limits, refusals, empty responses, incomplete streams,
and invalid structured output are classified. A deterministic fallback is
allowed only with explicit degraded provider status and
`deterministic_fallback` provenance. Retries are bounded and use backoff with
jitter.

## Operator responsibilities

- Supply secrets through the deployment secret manager, never image layers or
  source control.
- Set TLS and secure cookies for internet hosting.
- Restrict database and administrative access.
- Establish key rotation, incident response, access review, backup encryption,
  and provider-specific data-processing policies.
- Confirm provider retention and training settings before processing real
  candidate data.

This design has not received an independent security assessment.
