# Privacy, Data Inventory, and Retention

This document describes implemented behavior; it is not legal certification.

| Data class                    | Purpose                              | Current retention                                        | Candidate/operator control        |
| ----------------------------- | ------------------------------------ | -------------------------------------------------------- | --------------------------------- |
| Guest session token           | Pseudonymous authentication          | Browser cookie up to 30 days; expired rows deleted daily | Clear cookie; scheduled expiry    |
| Registered session token      | Pseudonymous account authentication  | Browser cookie up to 90 days; expired rows deleted daily | Sign out; account deletion        |
| Recovery credential           | Cross-browser account recovery       | Salted scrypt hash until rotation/account deletion       | Rotate or delete account          |
| Interview configuration       | Resume and role-specific coaching    | Guest inactivity: 30 days; registered: until deletion    | Export and delete                 |
| Transcript and evaluation     | Adaptive state, evidence, and report | Guest inactivity: 30 days; registered: until deletion    | Export and delete                 |
| LangGraph checkpoints         | Durable workflow resumption          | Same as owned interview session                          | Explicit checkpoint-table cleanup |
| Recruiter-style report        | Candidate coaching output            | Same as owned interview session                          | Export and delete                 |
| Tab-scoped provider key       | Provider invocation                  | Page memory only                                         | Close/reload tab                  |
| Encrypted provider connection | Explicit reusable BYOK connection    | Until separately removed                                 | Dedicated remove control          |
| Voice client grant metadata   | Consent and abuse control            | Expired grants deleted daily; otherwise tied to session  | Session deletion cascade          |
| Raw voice audio               | Realtime provider processing         | Not retained by this application                         | No opt-in retention exists        |
| Voice transcript              | Scoring and durable resume           | Same as interview transcript                             | Export and delete                 |
| Audit metadata                | Security and lifecycle evidence      | 30 days by default; contains no answer text              | Configurable operator policy      |
| Usage/auth counters           | Abuse and recovery-attempt controls  | Minute/day buckets expire automatically and daily        | Scheduled expiry                  |
| Evaluation reports            | Engineering regression evidence      | Repository fixtures contain no candidate data            | Maintainer review                 |

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
- The daily authenticated retention job deletes at most the configured batch
  size per run and never extends retention on its own. Operators with a backlog
  must schedule additional bounded invocations or reduce the backlog before
  launch.

Before use outside the hosted alpha, define an administrative-access policy,
provider-specific data handling, backup expiry, data-subject request process,
and DPDPA/GDPR-oriented legal review. The implementation is not legal
certification.
