# Reliability and Failure Matrix

| Failure                     | Current behavior                                                 | Automated evidence                             | Remaining work                            |
| --------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| Provider timeout            | Two bounded attempts, then recorded deterministic fallback       | Injected-adapter contract and graph provenance | Provider sandbox acceptance               |
| Provider rate limit         | Bounded retry, classified degraded status, explicit fallback     | Injected-adapter contract                      | Retry-after support and circuit breaker   |
| Invalid structured output   | Zod rejection, classified invalid output, explicit fallback      | Invalid-schema adapter contract                | Repair attempt metrics                    |
| Content refusal             | Classified refusal and explicit fallback                         | Injected-adapter contract                      | Provider sandbox acceptance               |
| Empty/incomplete response   | Classified invalid output and explicit fallback                  | Empty and incomplete adapter contracts         | Real stream fault injection               |
| Database interruption       | Request fails without committing a turn                          | Transactional repository code                  | Restart/fault integration test            |
| Checkpoint/session conflict | Optimistic conflict returns 409                                  | Repository conflict path                       | Concurrent-tab browser test               |
| Duplicate request           | Replays stored response by idempotency key                       | PostgreSQL integration test                    | Multi-process load test                   |
| Browser reload              | Session loads from PostgreSQL and stable LangGraph thread        | Chromium pause/reload journey                  | Offline/reconnect status UX               |
| Voice connection loss       | Manual fresh-token reconnect and permanent text fallback         | Device-error unit tests                        | Automatic reconnect and real-network test |
| Missing transcript          | No substantive turn is submitted; candidate can type             | 156-case corpus                                | Real ASR uncertainty measurement          |
| Report failure              | Error is surfaced; durable turn is not falsely reported complete | Complete-state schema and transaction boundary | Explicit regeneration endpoint/test       |

No provider SLO, circuit-breaker effectiveness, failover, or production
availability claim is made from this matrix.
