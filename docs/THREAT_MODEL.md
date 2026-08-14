# Repository Threat Model

## Overview

AI Interview Coach is a TypeScript/JavaScript-only coaching and interview
decision-support application. The deployed product surface is a Next.js web
application backed by PostgreSQL and a durable LangGraph workflow. Candidates
can use a deterministic keyless evaluator or bring an OpenAI key for model
assessment. An opt-in voice beta mints an ephemeral OpenAI Realtime credential
and establishes browser-to-provider WebRTC.

The system stores interview configuration, transcripts, evaluations, reports,
consent records, audit metadata, provider-connection ciphertext, and LangGraph
checkpoints. It must not be the sole basis for employment decisions. Its most
important security properties are candidate-data confidentiality, strict
tenant/user isolation, provider-key secrecy, consent enforcement, workflow and
scoring integrity, verified deletion, and bounded provider/compute use.

Primary runtime components:

- `apps/web`: browser UI and Next.js HTTP/API boundary.
- `packages/contracts`: Zod schemas and length/range limits shared across
  browser, API, graph, and persistence.
- `packages/database`: PostgreSQL repositories, migrations, guest sessions,
  encrypted provider connections, audit records, and LangGraph checkpointer.
- `packages/interview-engine`: model adapters, deterministic policy, rubrics,
  fallback behavior, report aggregation, and content-free telemetry contracts.
- `packages/voice`: OpenAI Realtime ephemeral-session request builder, WebRTC
  client, event validation, device handling, barge-in, mute, and reconnect
  controls.
- `Dockerfile`, `compose.yaml`, and `.github/workflows/ci.yml`: build, local
  runtime, dependency/secret checks, and release-supply-chain surfaces.

The GitHub Pages content under `docs/` is a public documentation surface. It
does not process candidate data and is lower risk than the application runtime.

## Threat Model, Trust Boundaries, and Assumptions

### Assets and privileges

1. Candidate transcripts, questions, extracted evidence, scores, coaching
   feedback, reports, role/level selections, and session history.
2. Guest/registered session cookies, server-side SHA-256 token digests, opaque
   account handles, and salted scrypt recovery hashes.
3. Long-lived provider API keys supplied by the browser, deployment
   environment, or encrypted provider connection.
4. Short-lived OpenAI Realtime client secrets and voice grant metadata.
5. `PROVIDER_ENCRYPTION_KEY`, `DATABASE_URL`, database credentials, CI tokens,
   deployment credentials, and any LangSmith credential.
6. Consent and audit records, including the evidence required to demonstrate
   that voice processing and transcript retention were accepted.
7. LangGraph checkpoints and relational session state, whose integrity controls
   resume, turn order, report completeness, and deletion.
8. Versioned rubrics, prompt versions, deterministic policy, evaluation
   datasets, and generated reports. Unauthorized modification could silently
   change candidate outcomes.
9. Provider quota, compute capacity, database availability, and operator cost.
10. Build and release integrity for the source repository, lockfile, container
    images, GitHub Actions, and published documentation.

### Actors

- **Candidate/user:** controls their browser, role, seniority, focus areas,
  answers, API key, voice actions, request timing, and all values sent from the
  client. A candidate may be curious, abusive, or deliberately try to alter a
  score.
- **Unauthenticated internet attacker:** can create arbitrary guest sessions,
  call public/stateless endpoints, replay or parallelize requests, submit
  oversized values up to schema limits, and probe public health/version data.
- **Session-cookie attacker:** if a guest cookie is stolen through browser,
  endpoint, extension, proxy, or device compromise, the attacker gains that
  pseudonymous user's application privileges until expiry or deletion.
- **Repository contributor or dependency attacker:** can attempt malicious
  source, lockfile, workflow, package, or container changes.
- **Deployment operator:** controls environment secrets, database access,
  backups, logs, TLS, retention, provider configuration, and network policy.
  The current design necessarily trusts this actor more than candidates.
- **External AI/voice/telemetry provider:** receives selected prompts,
  transcripts, audio, pseudonymous safety identifiers, and possibly operator or
  user credentials according to the enabled mode.
- **Qualified human reviewer:** may inspect exported reports or calibration
  annotations, but has no runtime administrative role in the current
  repository.

### Trust boundaries

1. **Browser to Next.js API.** All browser state and request data are untrusted.
   The API receives a bearer-like guest cookie and, in BYOK mode, a provider key
   in `x-provider-api-key`.
2. **Next.js API to PostgreSQL.** API code holds database authority. Repository
   queries must preserve tenant and user predicates, transactions,
   idempotency, optimistic concurrency, and checkpoint cleanup.
3. **Interview engine to model provider.** Candidate text is attacker-controlled
   prompt content. Model output is untrusted structured data and must not decide
   authorization, persistence ownership, deletion, completion limits, or
   pronunciation availability.
4. **Browser to OpenAI Realtime.** The browser receives a short-lived client
   secret and sends microphone audio directly to the external provider over
   WebRTC. Provider events and transcripts are untrusted until validated and
   reviewed by the candidate.
5. **Application to LangSmith or future observability backends.** Telemetry may
   leave the application boundary. Only the closed content-free event contract
   is appropriate without a separate PII policy.
6. **Runtime to deployment operator.** Environment variables, database
   snapshots, reverse-proxy logs, infrastructure metrics, and backups are
   operator-controlled and outside candidate control.
7. **Source/CI to runtime artifact.** GitHub Actions, registry packages, base
   images, build scripts, and the lockfile cross a software-supply-chain
   boundary before producing a deployable image.
8. **Self-hosted instance to internet-hosted instance.** Local Compose is a
   development/reference deployment. It does not by itself supply TLS,
   distributed rate limiting, managed identity, backup policy, secrets
   management, or administrative access controls.

### Attacker-controlled inputs

- Every HTTP path parameter, query parameter, header, cookie, JSON body, role,
  seniority, focus area, answer, idempotency key, and candidate-supplied
  provider key.
- Candidate text that may contain prompt injection, score manipulation,
  instructions impersonating system messages, unsafe content, extreme
  repetition, code, markup, or multilingual text.
- Browser and OpenAI Realtime events, SDP, transcript text, device identifiers,
  timing, connection state, and reconnection behavior.
- Request concurrency, duplicated requests, abandoned requests, provider
  failures, and interruption/reload timing.
- Pull requests, issue attachments, package metadata, and dependency update
  proposals in the public repository.

Operator-controlled inputs include environment variables, encryption keys,
database/network endpoints, provider model and voice names, image tags,
retention settings, TLS/reverse-proxy behavior, and observability sinks.
Developer-controlled inputs include source, rubrics, prompts, migrations,
evaluation fixtures, lockfiles, CI definitions, and generated documentation.

### Security invariants

- Every durable object read, mutation, export, and deletion is scoped by both
  `tenant_id` and `user_id`; knowledge of a UUID is never authorization.
- Guest tokens remain unpredictable, only their digest is persisted, expired
  tokens are rejected, and internet-hosted cookies are `Secure`, `HttpOnly`,
  and `SameSite`.
- Mutation routes reject cross-origin browser requests and require the
  application client header. Public hosting additionally supplies TLS and edge
  abuse controls.
- Long-lived provider keys never enter graph state, checkpoints, transcript
  rows, reports, exports, telemetry, audit metadata, client logs, or error
  bodies.
- Stored provider credentials are explicit opt-in, authenticated ciphertext
  under an operator-managed key, user-scoped, metadata-only in list APIs, and
  independently deletable.
- Voice credentials are short-lived and issued only for an owned, active,
  OpenAI session after versioned affirmative processing/transcript consent and
  explicit raw-audio-retention rejection.
- Raw voice audio is not retained by this application. A transcript is shown
  for candidate correction before it becomes a scored durable turn.
- Model outputs are schema-validated, time-bounded, retry-bounded, and treated
  as evidence interpretation only. Deterministic code owns score caps,
  evidence sufficiency, difficulty, follow-ups, interruptions, budgets,
  completion, and missing-data policy.
- Text and browser-transcribed answers never receive a pronunciation score.
- Duplicate or concurrent submissions create at most one durable turn.
  Completion and reports cannot be generated from partial state.
- Session deletion removes relational session data, voice grants/consent tied
  to the session, and all LangGraph checkpoint tables for the thread. Reusable
  provider connections require a distinct user action and must not appear in
  session exports.
- Error handling and telemetry record classifications and provenance without
  raw answers, provider payloads, credentials, cookies, or request headers.
- Candidate-generated strings are rendered as text, not trusted HTML, and must
  not gain script execution in the application origin.

### Deployment and governance assumptions

- This baseline covers both self-hosting and a future internet-hosted
  multi-user reference service.
- Until the maintainer specifies otherwise, assume real transcripts may contain
  personal data, India is the initial operating context, and DPDPA-oriented
  controls are required. GDPR-oriented controls may also apply by user
  geography. This is not legal certification.
- Hosted guest sessions use a 30-day inactivity window and audit metadata uses
  a 30-day default. A daily authenticated bounded job enforces expiry. Backup
  retention and legal approval remain operator gates.
- Optional pseudonymous recovery-code accounts support cross-browser access,
  rotation, sign-out, and deletion without collecting email. This is not
  verified identity; organization-managed identity and administrative
  boundaries remain future requirements for employer deployments.
- TLS termination, a secret manager, database encryption/backups, least
  privilege, rate limiting, monitoring, incident response, and provider data
  agreements are operator obligations not supplied by local Compose.
- OpenAI, browser speech services, LangSmith, GitHub, package registries, and
  container registries are external processors/supply-chain dependencies.
- A malicious deployment operator with database and environment-secret access
  can read transcripts and active long-lived provider keys. Preventing a fully
  privileged operator from doing so is outside the current architecture;
  access governance and auditability are required compensating controls.

## Attack Surface, Mitigations, and Attacker Stories

### HTTP APIs, guest sessions, and cross-tenant access

The durable API surface under `apps/web/src/app/api/v1` creates, lists, resumes,
pauses, mutates, exports, and deletes sessions; it also manages provider
connections and voice grants. Stateless `/api/interviews/turn` and
`/api/reports` endpoints support local keyless use and return `410` when the
durable database is configured.

Relevant attacker stories:

- An attacker guesses or obtains another session UUID and attempts IDOR against
  detail, turn, export, pause, resume, or deletion routes.
- A malicious site tries CSRF against mutation endpoints using a candidate's
  guest cookie.
- A stolen guest cookie is replayed to read transcripts, export reports, use a
  stored provider connection, or delete data.
- An unauthenticated actor creates many guest identities or repeatedly invokes
  stateless/model/voice endpoints to consume database, provider, or compute
  quota.

Existing controls include 256-bit random guest tokens, hash-only token storage,
expiry checks, `HttpOnly`/`SameSite=Lax` cookies, UUID validation, Zod body
limits, streamed request-size enforcement, tenant-and-user SQL predicates,
uniform not-found behavior, origin checks, a non-simple mutation header,
non-mutating cookie-less discovery, no-store responses, transaction-serialized
voice grant limits, PostgreSQL minute/day session and turn budgets, recovery
attempt throttling, idempotency keys, and transactional uniqueness constraints.

Important residual conditions:

- `SESSION_COOKIE_SECURE=false` and default Compose credentials are safe only
  with the default loopback binding. Any non-loopback deployment must add TLS,
  secure cookies, and production credentials explicitly.
- Per-user PostgreSQL quotas are cookie-scoped and can be bypassed by creating a
  fresh guest identity. Public and guest routes do not use operator-funded
  provider keys, but internet hosting still requires an edge/IP abuse control
  to protect compute and database capacity.
- Origin validation accepts requests without an `Origin` header because
  non-browser clients legitimately omit it. The custom header protects normal
  browser CSRF, but a stolen cookie remains sufficient for a direct client.
- Guest sessions still have no recovery; candidates must register before losing
  the guest cookie. Registered recovery material is intentionally displayed
  once and cannot be retrieved by an operator.

### Provider credentials and outbound AI calls

Long-lived keys can arrive from browser memory or AES-256-GCM encrypted
per-user PostgreSQL storage. The server can necessarily observe a
browser-supplied key while forwarding it. Public and guest routes never fall
back to an operator-funded key, and public list responses contain only provider
metadata.

Relevant attacker stories:

- A key appears in a URL, browser storage, exception, provider response, trace,
  audit row, graph checkpoint, export, or reverse-proxy log.
- An attacker with database-only access steals ciphertext and attempts
  decryption or tampering.
- An attacker who gains both database and `PROVIDER_ENCRYPTION_KEY` recovers
  every stored provider key.
- A candidate supplies a victim's key and uses the application as a proxy.
- A malicious provider response attempts to inject unexpected structured
  fields, oversized content, or secrets into persistence.

Existing controls include server-side provider calls, header rather than URL
transport, no browser storage for tab keys, AES-256-GCM with random 96-bit IVs,
strict response schemas, bounded model timeouts/retries, metadata-only list
contracts, error redaction, no-store responses, Gitleaks, dependency audit, and
tests that reject plaintext leakage into ciphertext serialization or audit
metadata.

Key rotation is not automated. A provider master-key compromise, operator log
misconfiguration, reverse proxy that records sensitive headers, or
internet-accessible database remains severe. Hosted deployments must disable
header logging, segregate secrets, restrict egress, meter provider use, and
define rotation/revocation procedures.

### Prompt injection, scoring integrity, and unsafe model output

Candidate answers, roles, seniority, and focus areas are model input.
Model-backed assessment uses no tools and separates evidence extraction from
dimension scoring. Structured output passes Zod validation before deterministic
evidence caps and workflow policy. Provider failure falls back with explicit
provider/evaluation provenance.

Relevant attacker stories:

- An answer instructs the model to ignore the rubric, award a perfect score,
  emit invalid JSON, reveal hidden prompts, or treat fluent wording as
  technical evidence.
- Candidate-controlled role/focus text alters voice-session instructions and
  causes the interviewer voice to say unwanted content.
- A provider returns plausible but unsupported evidence that passes basic
  schema validation.
- A malicious answer triggers high token usage, retry storms, repeated
  follow-ups, difficulty oscillation, or a report from insufficient state.

Controls include no model tools, separate prompts, versioned output schemas,
answer/focus length limits, evidence sufficiency, deterministic score caps,
typed follow-up/interruption reasons, difficulty hysteresis, question
deduplication, bounded recursion, turn/time/token budgets, five-turn minimum
for reports, explicit fallback provenance, and pronunciation remaining `null`.

Prompt injection can still manipulate coaching quality because the LLM remains
probabilistic and schema validity is not semantic truth. This normally affects
the attacker's own coaching session and is medium or lower unless a hosted
organization improperly relies on the score for employment decisions.
Provider prompt isolation, adversarial fixtures, human review, calibration,
and the prohibition on sole-use employment decisions are essential controls.

### PostgreSQL, LangGraph state, concurrency, export, and deletion

PostgreSQL contains the highest-value concentration of candidate data.
LangGraph checkpoints duplicate parts of the interview state for recovery.

Relevant attacker stories:

- A missing ownership predicate exposes or changes another tenant's session.
- Parallel tabs create duplicate turns, overwrite newer state, or produce a
  report with repeated/missing answers.
- A failed model call leaves an orphaned in-flight request that permanently
  blocks the session.
- Deletion removes relational rows but leaves checkpoint blobs, audit
  derivatives, backups, or provider-side copies.
- A crafted export causes header injection, script execution, or accidental
  inclusion of credentials.

Controls include parameterized SQL, typed UUIDs, tenant/user predicates,
transactions, row locks, unique `(session_id, turn_number)` and
`(session_id, idempotency_key)` constraints, one-in-flight request index,
optimistic turn-count checks, stable session IDs as LangGraph `thread_id`,
schema validation on persistence and load, explicit deletion from all
checkpoint tables, cascade deletion, fixed UUID-derived export filenames, and
provider-key exclusion from export schemas.

Residual risk includes operator/database compromise, absent row-level security,
no backup-deletion implementation, no automated retention expiry, no
account-wide subject deletion workflow, and incomplete database
failure/conflict/load testing. Database access must remain private and
least-privileged; backups require encryption, retention, restore tests, and
legally appropriate erasure procedures.

### Voice, microphone, WebRTC, and external media processing

The browser requests microphone access only after an owned active OpenAI
session and explicit versioned consent. The backend creates a short-lived
Realtime secret; the browser then sends audio directly to OpenAI and validates
incoming event shapes.

Relevant attacker stories:

- Microphone access or provider processing starts without consent.
- A stolen or replayed ephemeral secret is used outside its intended session.
- Malicious/replayed provider events inject a transcript, overlap responses,
  or submit text without candidate review.
- Audio, transcript, device data, or a safety identifier leaks through logs or
  retained artifacts.
- A candidate's accent or ASR error reduces technical scores or produces a
  fabricated pronunciation score.

Controls include literal consent schemas, owned-session checks, three-grants
per-minute issuance limit, temporary credentials, privacy-preserving hashed
user identifier, semantic VAD with application-controlled response creation,
barge-in cancellation, transcript visibility/correction before manual
submission, mute/leave/reconnect/text controls, no application raw-audio
storage, and pronunciation always unassessed.

Real provider/browser/device evidence, automatic reconnect, replay-binding
validation, transcript uncertainty/error measurement, false/missed
interruption rates, and provider retention verification remain pending. The
voice beta must not be described as production-ready until those controls are
measured on supported hardware.

### Browser rendering, CSP, and client-side secrets

Candidate strings are rendered through React rather than raw HTML, and no
`dangerouslySetInnerHTML`, `innerHTML`, `localStorage`, or `sessionStorage`
usage exists in the application source. Security headers deny framing, objects,
camera/geolocation, and cross-origin media/connect destinations outside the
declared policy.

Relevant attacker stories:

- Stored transcript content becomes stored XSS and captures a tab-scoped key,
  guest session actions, or an ephemeral voice secret.
- A compromised dependency or injected inline script reads React state and
  provider headers.
- A malicious external origin establishes unauthorized WebRTC or API
  connections.

React escaping, Zod bounds, `X-Content-Type-Options`, `X-Frame-Options`,
frame-ancestors, restrictive connect/media policies, and no persistent
client-side key storage reduce risk. The production CSP still permits
`'unsafe-inline'` for scripts and styles, so it is not a complete XSS boundary.
A nonce/hash-based CSP and dependency review would materially improve hosted
deployment defense.

### Build, CI, container, and operator configuration

CI performs formatting, linting, types, tests, PostgreSQL integration,
deterministic evaluation, Playwright journeys, production build, Docker build,
Gitleaks, and high-severity production dependency auditing. The runtime image
is pinned, non-root, read-only, drops capabilities, uses
`no-new-privileges`, and exposes a minimal health endpoint.

Relevant attacker stories:

- A compromised package, lifecycle script, GitHub Action, or registry artifact
  steals CI credentials or inserts code into the production image.
- A malicious pull request changes rubrics/evaluation fixtures and makes
  degraded scoring look acceptable.
- Default Compose database passwords, insecure cookies, open host port, or
  plaintext HTTP are reused for internet deployment.
- Logs, backups, traces, or crash dumps contain answers or provider headers.

The lockfile, package-age/supply-chain policy, Gitleaks, dependency audit,
pinned Node/PostgreSQL image digests, read-only runtime, minimal GitHub token
permissions, and deterministic tests are meaningful controls. GitHub Actions
are referenced by moving major tags rather than immutable commit SHAs, the
build stage runs dependency lifecycle scripts, and no SAST/container-signing or
provenance attestation gate is enforced. Production requires reviewed immutable
actions, artifact signing/SBOM, protected branches, environment approvals,
secret scanning of artifacts, and hardened infrastructure configuration.

### Out-of-scope or lower-relevance stories

- A fully privileged deployment operator, database administrator, or host root
  user is outside the application's isolation boundary. Their misuse is a
  governance/audit problem, not an application authorization bypass.
- Security defects inside OpenAI, GitHub, a browser vendor, PostgreSQL, or a
  package registry are external, although the application must minimize data
  and remain resilient to provider failure.
- Compromise of the candidate's operating system, browser profile, malicious
  extensions, microphone driver, or physical device is not prevented here.
- The public GitHub Pages site contains no candidate data or authenticated
  operations; ordinary content defects there are normally low severity unless
  they create repository/supply-chain compromise.
- Gaming one's own deterministic coaching score without crossing a tenant,
  leaking data, spending another party's funds, or influencing a real hiring
  decision is an integrity limitation, not a high-severity security issue.

## Internal Review Status

An internal repository-wide security scan completed on 2026-08-02 against 145
files. It reported eight medium findings and no high or critical findings. The
current remediation closes those paths with focused HTTP, browser, PostgreSQL
concurrency, configuration, and full-regression evidence. This was not an
independent assessment and does not replace the hosted identity, edge-control,
TLS, real-provider, or browser/device acceptance gates below.

## Severity Calibration (Critical, High, Medium, Low)

### Critical

Critical issues enable broad compromise with little additional privilege, for
example:

- unauthenticated remote code execution in the internet-facing Next.js runtime
  or migration container;
- compromise of CI/release credentials that produces a trusted malicious
  release;
- cross-tenant extraction of most transcripts plus recoverable provider
  credentials;
- exposure of both provider ciphertext and the deployment encryption key at
  scale;
- arbitrary database command execution from a public request.

Impact must be systemic: broad confidentiality loss, control of the runtime or
release channel, or mass credential compromise.

### High

High issues compromise a specific tenant/user or enable substantial paid
provider/availability abuse, for example:

- IDOR or authorization bypass that reads, exports, changes, or deletes another
  candidate's interview;
- guest-session forgery or cookie disclosure that provides durable access to a
  victim's transcripts or stored provider connection;
- stored XSS on the application origin that captures tab-scoped provider keys
  or performs authenticated destructive actions;
- plaintext provider-key leakage through application logs, exports,
  checkpoints, public API responses, or telemetry;
- unbounded anonymous use of an operator-paid model/voice key causing material
  cost or denial of service in a hosted deployment;
- deletion that falsely reports success while leaving live, application-
  accessible checkpoints or transcripts.

### Medium

Medium issues require meaningful preconditions, primarily affect one user's
coaching integrity, or cause bounded availability/privacy harm, for example:

- prompt injection that changes one candidate's assessment but cannot execute
  tools, cross tenants, or alter deterministic authorization/policy;
- CSRF-like mutation requiring a stolen cookie or a non-browser client because
  normal cross-origin browser requests cannot set the required header;
- a concurrency or stale-state flaw that loses or repeats one user's turn
  without exposing another tenant;
- consent/audit inconsistency that does not start raw-audio retention but makes
  proof of processing consent unreliable;
- bounded endpoint or database resource exhaustion;
- provider-event spoofing that inserts a transcript but still requires
  candidate review before scoring;
- sensitive operational metadata disclosure that does not include transcript
  content or credentials.

### Low

Low issues have minimal confidentiality/integrity impact or affect only
developer/reference behavior, for example:

- exact application version or health-state disclosure without exploitable
  follow-on information;
- cosmetic CSP/header inconsistencies on the unauthenticated documentation
  site;
- low-volume guest-row accumulation in a local/self-hosted instance;
- malformed provider events causing a recoverable voice error with permanent
  text fallback;
- candidate-only score gaming that is clearly labelled as coaching and never
  used for employment decisions.

Severity increases when a behavior becomes cross-tenant, exposes provider
credentials or real candidate data, affects an approved hiring workflow,
bypasses explicit voice consent, persists across sessions, or scales through a
public hosted deployment. Severity decreases when the behavior is confined to
the attacker's own deterministic demo, requires a fully privileged operator,
or is prevented by the documented deployment model.

Repository: target_sha256_c0b0f0e0a238944a80cbd9fc534bda96a5f1cdd310360571262626132073ec2e
Version: b3a0160dd6b5fda7c3a6d4944da0bcb692b77b78
