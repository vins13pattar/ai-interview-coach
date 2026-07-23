# Product Requirements Document: Interview Coach

| Field                 | Value                                     |
| --------------------- | ----------------------------------------- |
| Product               | Interview Coach                           |
| Status                | Durable alpha / proposed production scope |
| Version               | 0.2                                       |
| Last updated          | 2026-07-24                                |
| Product model         | Open source, self-hostable, BYOK          |
| Application languages | TypeScript and JavaScript only            |
| AI orchestration      | LangChain.js 1.x and LangGraph 1.x        |

## 1. Executive summary

Interview Coach is a natural, adaptive interview simulator. A candidate speaks
as they would to a human interviewer. The system asks relevant follow-ups,
interrupts or redirects when appropriate, changes difficulty based on observed
performance, and creates an evidence-backed report suitable for a recruiter or
coach to review.

Most interview-practice products are question playlists with timers, generic
feedback, or keyword matching. Interview Coach behaves as a stateful interviewer:
it remembers earlier claims, probes gaps, tests trade-offs, and distinguishes
between evidence it can observe and evidence it cannot.

The project is open and self-hostable. Users bring their own model and speech
provider keys. A deterministic local provider keeps development, CI, and basic
practice free.

## 2. Problem

Candidates cannot reliably practice the dynamic parts of a serious interview:

- follow-up questions based on the exact answer;
- interruptions and redirection;
- difficulty that rises or falls with performance;
- cross-question consistency checks;
- calibrated feedback tied to transcript evidence;
- useful reports that separate confidence from competence.

Recruiters and coaches also lack a reusable, inspectable practice tool. Closed
products hide prompts, scoring logic, retention policy, model choice, and cost.

## 3. Product vision

Create the most trustworthy open interview-simulation layer: realistic enough
to change candidate behavior, explainable enough to earn reviewer confidence,
and modular enough to run with multiple AI and speech providers.

### Product principles

1. **Conversation before choreography.** The candidate should not manage the UI
   while answering.
2. **Evidence before scores.** Every score must cite observable behavior.
3. **Calibrated uncertainty.** Unknown dimensions are `not assessed`, never
   invented.
4. **Challenge without hostility.** Interruptions test clarity and judgment, not
   emotional endurance.
5. **Candidate agency.** Consent, pause, delete, export, and provider choice are
   first-class.
6. **Provider portability.** Core interview logic must not depend on one model.
7. **Local-first contribution.** A contributor can run tests without paid keys.
8. **Human decision ownership.** The report supports a reviewer; it never makes
   an employment decision.

## 4. Personas and jobs to be done

### P1 — Candidate

When preparing for a specific role, I want a realistic interview that reacts to
my answers so I can find weaknesses before the real interview.

Needs:

- fast setup from role, level, job description, resume, and focus areas;
- natural voice conversation;
- a safe way to pause and retry;
- direct feedback with examples;
- private handling of recordings and keys;
- a practice plan after the report.

### P2 — Interview coach or mentor

When reviewing a candidate session, I want a concise report with transcript
evidence so I can spend time coaching the highest-leverage behaviors.

### P3 — Recruiter or hiring-team evaluator

When reviewing a mock interview, I want a structured, consistent report that
clearly states uncertainty and cannot be mistaken for an automated hiring
decision.

### P4 — Self-hoster or contributor

When running the project, I want provider-neutral interfaces, documented
security boundaries, deterministic tests, and no required vendor account.

## 5. Goals and non-goals

### Goals

- Deliver a fluid, adaptive interview loop for behavioral and technical roles.
- Support typed and voice sessions behind the same interview state machine.
- Detect when a follow-up, challenge, clarification, or interruption is useful.
- Score confidence, communication, and technical depth from text evidence.
- Score pronunciation only from a validated acoustic pipeline.
- Produce a recruiter-quality report with evidence, uncertainty, and next steps.
- Support BYOK and self-hosted server-managed keys.
- Provide observable, testable orchestration in LangGraph.
- Meet WCAG 2.2 AA for all non-audio workflows.

### Non-goals for v1

- Making autonomous hire/no-hire decisions.
- Inferring protected traits, personality, emotion, honesty, or culture fit.
- Clinical speech, accent, or disability assessment.
- Covert interview recording.
- Proctoring, gaze tracking, face analysis, or cheating detection.
- Training foundation models on candidate recordings.
- Replacing structured human interviews.
- Supporting every programming language execution sandbox in the first release.

## 6. Product scope

### P0 — v1 required

- Interview setup: role, seniority, focus areas, interview type, duration.
- Adaptive state machine with bounded turns.
- Text input and browser speech transcription.
- Model-backed and deterministic provider modes.
- Question generation, follow-up, difficulty adaptation, and redirect decisions.
- Confidence, communication, and technical-depth scoring.
- Evidence ledger linked to each question/answer turn.
- Recruiter report with strengths, risks, evidence, and disclaimer.
- Export to JSON and print/PDF-friendly HTML.
- BYOK with no plaintext server persistence.
- Pause, resume, abandon, and delete controls.
- Candidate consent before microphone or recording.
- Structured errors and graceful provider fallback.
- Evaluation dataset and regression tests for scoring prompts.

### P1 — immediately after v1

- Low-latency voice-to-voice over WebRTC.
- Controlled barge-in and interviewer interruption.
- Resume/job-description ingestion.
- Behavioral, system-design, frontend, backend, data, and leadership packs.
- Durable accounts and multi-device resume.
- Session replay with evidence bookmarks.
- Shareable report links with expiry and revocation.
- Pronunciation scoring using a validated acoustic provider.
- Multi-provider support for OpenAI, Anthropic, Google, and local Ollama.
- LangSmith tracing with PII-safe metadata.

### P2 — expansion

- Organization rubrics and interview templates.
- Human coach comments and report annotations.
- Pair-programming/code-execution interview mode.
- Localization and multilingual speech.
- Calibration dashboards by role and rubric version.
- Offline/local model deployment profile.

## 7. Core user journeys

### Journey A — keyless local practice

1. Candidate opens the application.
2. Candidate chooses role, level, focus areas, and local demo.
3. The system explains that text scores are heuristic and pronunciation is not
   assessed.
4. Candidate answers five adaptive questions.
5. Difficulty changes based on aggregate evidence.
6. Candidate receives a report and targeted practice actions.

Acceptance:

- No provider account or database is required.
- The same input produces the same score.
- The report labels heuristic output.

### Journey B — BYOK model-backed interview

1. Candidate chooses a supported provider.
2. The UI explains where the key is held and transmitted.
3. Candidate enters the key for the current tab.
4. The API validates input, invokes the provider, validates structured output,
   and discards the key.
5. Provider failures produce a useful retry/fallback choice without losing the
   transcript.

Acceptance:

- Keys never appear in URLs, analytics, traces, errors, or application logs.
- Responses use `Cache-Control: no-store`.
- Clearing the tab removes the key.

### Journey C — natural voice interview

1. Candidate reviews explicit microphone and retention consent.
2. Browser establishes WebRTC to a provider using a server-minted ephemeral
   credential.
3. Voice activity detection identifies candidate turns.
4. Partial transcripts update live without stealing focus.
5. The interviewer may issue a short barge-in only when policy allows.
6. Transcript and scoring events enter the same LangGraph state.
7. Candidate can mute, pause, repeat, or end at any time.

Acceptance:

- Median end-of-turn to first interviewer audio is below 900 ms; p95 below 1.8 s.
- Stop/mute controls remain keyboard reachable.
- Losing audio falls back to text without losing state.
- Audio is not retained unless the candidate explicitly opts in.

### Journey D — recruiter report review

1. Reviewer sees the overall recommendation and confidence level.
2. Reviewer sees score dimensions and `not assessed` values.
3. Each claim links to a transcript excerpt and question.
4. Reviewer sees rubric/model versions and session limitations.
5. Reviewer can export or delete according to authorization and retention.

## 8. Functional requirements

### 8.1 Interview configuration

| ID     | Priority | Requirement                                                                |
| ------ | -------- | -------------------------------------------------------------------------- |
| CFG-01 | P0       | Capture role, seniority, focus areas, interview type, and target duration. |
| CFG-02 | P0       | Validate all configuration with shared Zod schemas.                        |
| CFG-03 | P0       | Offer local demo and available provider choices.                           |
| CFG-04 | P1       | Accept a resume and job description with explicit parsing consent.         |
| CFG-05 | P1       | Preview the derived competency rubric before starting.                     |
| CFG-06 | P1       | Allow custom question packs without code changes.                          |

### 8.2 Conversation

| ID      | Priority | Requirement                                                                    |
| ------- | -------- | ------------------------------------------------------------------------------ |
| CONV-01 | P0       | Ask one unambiguous question at a time.                                        |
| CONV-02 | P0       | Preserve prior questions, answers, claims, and scores by stable session ID.    |
| CONV-03 | P0       | Bound each session by configured time and maximum graph recursion.             |
| CONV-04 | P0       | Generate follow-ups from observed gaps rather than a fixed list.               |
| CONV-05 | P0       | Support pause, resume, skip, repeat, and end actions.                          |
| CONV-06 | P1       | Stream transcript, interviewer tokens, and graph progress.                     |
| CONV-07 | P1       | Detect contradictions and invite clarification without accusing the candidate. |
| CONV-08 | P1       | Recover from provider timeout without duplicating a question.                  |

### 8.3 Interruption policy

Interruptions are a controlled product behavior, not an unrestricted model tool.

Allowed reasons:

- answer exceeds the role/rubric time budget with low information gain;
- candidate explicitly asks for clarification;
- answer evades the question after one prompt;
- candidate repeats a claim that needs immediate disambiguation;
- unsafe or disallowed content requires stopping.

Disallowed reasons:

- accent, speaking speed alone, disfluency, disability, emotion, or inferred
  personality;
- a model prediction of honesty or confidence;
- creating artificial stress without candidate opt-in.

| ID     | Priority | Requirement                                                                  |
| ------ | -------- | ---------------------------------------------------------------------------- |
| INT-01 | P0       | Emit a typed redirect decision with reason and evidence.                     |
| INT-02 | P0       | Limit redirects to one per answer and three per standard session.            |
| INT-03 | P0       | Keep redirects under 12 spoken words where possible.                         |
| INT-04 | P1       | Support actual audio barge-in and stop synthesis when the candidate resumes. |
| INT-05 | P1       | Log redirect policy version and reason.                                      |

### 8.4 Adaptive difficulty

Difficulty states: `foundation`, `intermediate`, `advanced`, `expert`.

Adaptation inputs:

- completeness and correctness against the current rubric;
- technical depth and trade-off reasoning;
- ability to ground claims in examples;
- performance trend across at least two turns;
- remaining time and competency coverage.

Adaptation must not use pronunciation, accent, emotion, protected traits, or
provider confidence as a proxy for competence.

| ID     | Priority | Requirement                                                |
| ------ | -------- | ---------------------------------------------------------- |
| ADP-01 | P0       | Raise at most one level per turn.                          |
| ADP-02 | P0       | Lower at most one level per turn.                          |
| ADP-03 | P0       | Preserve a reason code for each change.                    |
| ADP-04 | P0       | Avoid oscillation with trend smoothing in production mode. |
| ADP-05 | P1       | Calibrate thresholds by rubric version and interview pack. |

### 8.5 Scoring

Each dimension produces:

- numeric score from 0–100 or `not assessed`;
- confidence band (`low`, `medium`, `high`);
- one or more evidence references;
- strengths and improvement actions;
- scorer and rubric version.

#### Confidence

Observable definition: decisiveness, ownership language, directness, and ability
to defend choices. It is not an emotion or personality inference.

#### Communication

Observable definition: structure, relevance, concision, clarification, and
audience-aware explanation.

#### Technical depth

Observable definition: correctness, constraints, failure modes, trade-offs,
testing, measurement, and alternatives.

#### Pronunciation

Observable definition: acoustic intelligibility for the selected spoken
language. It must be `not assessed` without audio and a validated acoustic
scoring provider. Accent similarity is not a valid metric.

| ID       | Priority | Requirement                                                 |
| -------- | -------- | ----------------------------------------------------------- |
| SCORE-01 | P0       | Never generate a numeric score without supporting evidence. |
| SCORE-02 | P0       | Never score pronunciation from text.                        |
| SCORE-03 | P0       | Keep dimension scores separate; no hidden weighted total.   |
| SCORE-04 | P0       | Include scoring limitations in the report.                  |
| SCORE-05 | P1       | Run independent rubric graders and reconcile disagreements. |
| SCORE-06 | P1       | Track calibration by role, language, and rubric version.    |

### 8.6 Recruiter-quality report

Required sections:

1. session context and limitations;
2. concise recommendation language;
3. dimension scores and confidence;
4. evidence-backed strengths;
5. risks or areas requiring validation;
6. question-by-question evidence ledger;
7. candidate practice plan;
8. model, rubric, and policy versions;
9. decision-support disclaimer.

Reports must avoid:

- protected-class information;
- personality, emotion, honesty, or culture-fit claims;
- diagnoses or disability speculation;
- a definitive automated hire/no-hire decision.

## 9. AI orchestration requirements

The graph is the product control plane. Prompts do not own authorization,
retention, quotas, or interruption limits.

### Graph nodes

1. `load_session`
2. `plan_coverage`
3. `ask_question`
4. `capture_turn`
5. `assess_answer`
6. `decide_redirect`
7. `adapt_difficulty`
8. `choose_next_question`
9. `finalize_report`
10. `persist_and_emit`

### State

- stable tenant, user, and session identifiers;
- rubric and policy versions;
- interview configuration;
- transcript turns and acoustic references;
- question coverage and difficulty;
- answer evaluations and evidence;
- redirect counters;
- remaining time;
- provider metadata without credentials;
- consent and retention state.

### Guardrails

- Zod input and output validation on every boundary;
- maximum turn and recursion limits;
- retry only transient provider failures;
- idempotency key for turn submission;
- stable LangGraph `thread_id` equal to the interview session ID;
- PostgreSQL checkpointer in production, memory-only in tests;
- PII-redacted tracing;
- no API key in graph state or checkpoints.

## 10. BYOK and provider requirements

Supported modes:

1. **Local demo:** deterministic, no network provider.
2. **Browser session key:** key held in page memory and sent to the self-hosted
   backend over TLS.
3. **Server-managed key:** operator configures a server-only environment secret.
4. **Ephemeral voice credential:** backend exchanges the server key for a
   short-lived browser token where the provider supports it.

Rules:

- never accept keys in query strings;
- never persist plaintext keys in application data;
- redact authorization and provider-key headers;
- opt out keys and raw prompts from analytics;
- do not place keys in LangSmith metadata;
- return `no-store` responses;
- apply per-IP/user rate limits before provider invocation;
- document that a hosted operator can technically observe forwarded keys;
- recommend self-hosting or ephemeral tokens for stronger trust boundaries.

## 11. Data model

Core entities:

- `users`
- `provider_connections` (encrypted reference or metadata only)
- `interview_templates`
- `rubric_versions`
- `interview_sessions`
- `interview_turns`
- `answer_evaluations`
- `score_evidence`
- `reports`
- `consent_events`
- `audit_events`
- LangGraph checkpoint tables

Retention classes:

| Data                             | Default                  | Candidate control                |
| -------------------------------- | ------------------------ | -------------------------------- |
| Tab-scoped API key               | Until tab closes         | Clear immediately                |
| Raw audio                        | Not retained             | Explicit opt-in only             |
| Transcript                       | 30 days for hosted alpha | Export/delete                    |
| Report                           | 30 days for hosted alpha | Export/delete/share              |
| Security audit metadata          | 90 days                  | Subject to legal/security policy |
| De-identified evaluation metrics | Opt-in only              | Withdraw where feasible          |

## 12. API surface

Durable APIs are versioned under `/api/v1`. The unversioned deterministic turn
and report routes remain as a database-free contributor fallback.

| Method | Route                            | Purpose                                   |
| ------ | -------------------------------- | ----------------------------------------- |
| GET    | `/api/v1/sessions`               | List authorized interview sessions        |
| POST   | `/api/v1/sessions`               | Create a configured interview session     |
| GET    | `/api/v1/sessions/:id`           | Retrieve transcript and report            |
| POST   | `/api/v1/sessions/:id/turns`     | Submit a transcript turn idempotently     |
| POST   | `/api/v1/sessions/:id/pause`     | Pause durable execution                   |
| POST   | `/api/v1/sessions/:id/resume`    | Resume durable execution                  |
| GET    | `/api/v1/sessions/:id/export`    | Export authorized session data            |
| DELETE | `/api/v1/sessions/:id`           | Delete product and checkpoint data        |
| GET    | `/api/v1/provider-connections`   | List redacted connection metadata         |
| PUT    | `/api/v1/provider-connections`   | Encrypt and save an opted-in provider key |
| DELETE | `/api/v1/provider-connections?…` | Delete an authorized provider connection  |

SSE events, explicit early-finalization, report sharing, and voice-token routes
remain beta/public-v1 scope.

## 13. Non-functional requirements

### Performance

| SLI                                  | Target                     |
| ------------------------------------ | -------------------------- |
| Landing LCP p75                      | < 2.5 s on mid-tier mobile |
| Input responsiveness p75             | < 200 ms                   |
| Text turn response p50 / p95         | < 2.5 s / < 8 s            |
| Voice end-of-turn to audio p50 / p95 | < 0.9 s / < 1.8 s          |
| Report generation p95                | < 15 s                     |

### Reliability

- 99.9% monthly availability for session control APIs.
- No acknowledged turn lost after durable write.
- Provider outage must preserve transcript and offer retry/fallback.
- Idempotent turn submission must prevent duplicate scoring.
- Restore point objective: 24 hours; recovery time objective: 4 hours.

### Scale assumptions for v1

- 10,000 registered users;
- 500 concurrent interviews;
- 20 turns per session maximum;
- 60 minutes maximum session duration;
- audio transferred directly to the voice provider where possible.

### Accessibility

- WCAG 2.2 AA for setup, text interview, report, export, and account controls.
- Keyboard control for all session actions.
- Visible focus, reduced motion, minimum touch target, and sufficient contrast.
- Live transcript without forced auto-scroll.
- Text alternative for every voice interaction.
- No audio-only status or error.

### Security

- TLS in transit and managed encryption at rest.
- Strict CSP, frame denial, content-type protection, and scoped permissions.
- CSRF protection for cookie-authenticated mutations.
- Origin validation for voice token minting.
- Rate limits, request size limits, and schema validation.
- Dependency, secret, SAST, and container scanning in CI.
- Signed report share tokens with expiry and revocation.
- Audit trail for report access, export, and deletion.

## 14. Privacy, fairness, and safety

### Prohibited inference

The system must not infer or score race, ethnicity, religion, gender, sexual
orientation, age, disability, health, socioeconomic status, nationality,
emotion, personality, honesty, or “culture fit.”

### Fairness evaluation

Before hiring-adjacent production use:

- obtain diverse, consented evaluation data;
- test score stability across accent, dialect, speaking rate, device, and noise;
- measure false redirects and score deltas;
- require human review of outliers;
- publish a model/rubric card with known limitations;
- repeat evaluation after any model, prompt, rubric, or speech-provider change.

### Candidate rights

- informed consent;
- know when AI is used;
- access transcript and report;
- correct transcript errors;
- delete retained data;
- request a human review;
- use a text-only equivalent.

## 15. Observability

Metrics:

- session start/completion/abandonment;
- per-node latency and failure;
- provider latency, tokens, and estimated cost;
- retry and fallback rate;
- redirect frequency and candidate override rate;
- difficulty transitions and oscillation;
- report generation success;
- score distribution and calibration drift;
- accessibility and audio fallback events.

Logs and traces must use opaque identifiers and exclude keys, raw audio, resume
content, job descriptions, and full transcript by default.

## 16. Success metrics

### Product

- 65% of started practice interviews reach a report.
- 40% of candidates complete a second session within 14 days.
- 70% of surveyed candidates say follow-ups felt specific to their answer.
- 60% report that the practice plan changed how they prepared.

### Quality

- 90% schema-valid model responses without retry.
- < 3% unsupported report claims in a blinded expert audit.
- > = 0.75 inter-rater agreement between calibrated human graders and the
  > technical-depth band.
- < 5% difficulty oscillation rate.
- < 10% candidate-marked inappropriate redirects.

### Open source

- Keyless setup in under 10 minutes.
- All pull requests pass lint, type, unit, build, and secret scans.
- At least two supported model providers and one local provider by v1.
- Public rubric, model card, security policy, and contribution guide.

## 17. Release plan

### Phase 0 — Foundation

Implemented in the initial repository:

- monorepo and shared contracts;
- Next.js product shell;
- deterministic keyless evaluator;
- optional OpenAI structured evaluator;
- LangGraph assess/adapt/next-question flow;
- browser speech-to-text where supported;
- five-turn recruiter report;
- unit, type, lint, and build gates.

### Phase 1 — Durable alpha

Implemented:

- opaque guest authentication and tenant isolation;
- PostgreSQL schema and idempotent migrations;
- production LangGraph checkpointer with stable session threads;
- session API versioning and idempotency;
- optional AES-256-GCM provider connections;
- pause, resume, export, and verified deletion controls;
- baseline evaluation dataset and rubric card;
- Compose restart and Playwright browser acceptance coverage.

### Phase 2 — Real-time voice beta

- WebRTC voice provider;
- ephemeral token minting;
- VAD, barge-in, and interruption policy;
- acoustic scoring research;
- browser/device reliability matrix.

### Phase 3 — Calibrated public v1

- multi-provider adapters;
- calibrated role packs;
- fairness and accessibility audit;
- threat model and external security review;
- public model/rubric card;
- production operations runbooks and SLOs.

## 18. Risks and mitigations

| Risk                                   | Impact | Mitigation                                                       |
| -------------------------------------- | ------ | ---------------------------------------------------------------- |
| Plausible but unsupported scores       | High   | Evidence requirement, schema validation, human audits            |
| BYOK key exposure by a hosted operator | High   | Clear disclosure, self-host option, ephemeral voice tokens       |
| Accent or disability bias              | High   | No text-derived pronunciation, fairness testing, text equivalent |
| Voice latency breaks realism           | High   | WebRTC, streaming, regional provider routing, text fallback      |
| Model provider lock-in                 | Medium | Provider interfaces and contract tests                           |
| Cost runaway                           | Medium | Bounded turns, token budgets, local mode, quotas                 |
| Prompt injection from resume/JD        | Medium | Treat documents as data, isolate tools, no authority in prompts  |
| Report used as hiring decision         | High   | Product wording, reviewer workflow, policy and legal controls    |
| Contributor setup becomes complex      | Medium | Keyless path, fixtures, one-command checks                       |

## 19. Open decisions

1. Project license and copyright holder.
2. First production voice provider.
3. Whether hosted alpha stores transcripts by default or remains session-only.
4. Initial authentication provider.
5. Exact calibrated role packs for v1.
6. Legal review scope for hiring-adjacent deployments.

## 20. Definition of done for public v1

- P0 requirements implemented and acceptance-tested.
- Real-time voice meets latency and fallback targets.
- PostgreSQL durability and deletion verified end to end.
- At least two model providers pass contract tests.
- Pronunciation is either validated and documented or remains explicitly
  unavailable.
- Accessibility audit has no critical/high issues.
- Threat model and independent security review completed.
- Bias/calibration evaluation published with limitations.
- Production load, failover, backup, and restore tests pass.
- License selected and `LICENSE` present.
- Public deployment passes browser smoke tests on supported browsers.
