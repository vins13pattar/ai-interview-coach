# Privacy, Data Inventory, and Retention

This document describes implemented behavior; it is not legal certification.

| Data class                    | Purpose                              | Current retention                                        | Candidate/operator control                          |
| ----------------------------- | ------------------------------------ | -------------------------------------------------------- | --------------------------------------------------- |
| Guest session token           | Pseudonymous authentication          | Browser cookie up to 30 days; only SHA-256 digest stored | Clear cookie; expired rows require operator cleanup |
| Interview configuration       | Resume and role-specific coaching    | Until session deletion; no scheduler yet                 | Export and delete                                   |
| Transcript and evaluation     | Adaptive state, evidence, and report | Until session deletion; no hosted default asserted       | Export and delete                                   |
| LangGraph checkpoints         | Durable workflow resumption          | Until session deletion                                   | Explicit checkpoint-table cleanup                   |
| Recruiter-style report        | Candidate coaching output            | Until session deletion                                   | Export and delete                                   |
| Tab-scoped provider key       | Provider invocation                  | Page memory only                                         | Close/reload tab                                    |
| Encrypted provider connection | Explicit reusable BYOK connection    | Until separately removed                                 | Dedicated remove control                            |
| Voice client grant metadata   | Consent and abuse control            | Tied to session/tenant rows                              | Session deletion cascade                            |
| Raw voice audio               | Realtime provider processing         | Not retained by this application                         | No opt-in retention exists                          |
| Voice transcript              | Scoring and durable resume           | Same as interview transcript                             | Export and delete                                   |
| Audit metadata                | Security and lifecycle evidence      | No automated expiry yet; contains no answer text         | Operator policy; subject access process pending     |
| Evaluation reports            | Engineering regression evidence      | Repository fixtures contain no candidate data            | Maintainer review                                   |

## Purpose and boundaries

- Answers are used for coaching, evidence extraction, adaptive follow-up, and
  report generation.
- Provider keys never belong in graph state, transcripts, exports, analytics,
  or logs.
- Raw audio travels directly from the browser to the voice provider when
  possible and is not stored by this application.
- A session deletion removes session rows, turns, evaluations, reports, consent
  rows, voice-grant rows, and LangGraph checkpoints. Reusable encrypted provider
  connections are user-scoped and require the separate removal action.
- No derived candidate analytics warehouse exists in the current repository.

Before public hosting, add configurable retention jobs, account deletion,
administrative-access policy, audit retention, provider-specific data handling,
and DPDPA/GDPR-oriented legal review.
