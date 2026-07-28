# Architecture

## System shape

Interview Coach uses one TypeScript contract from browser to graph to report.
Provider-specific behavior sits behind evaluator and voice adapters.

```mermaid
flowchart LR
    B["Next.js browser UI"] -->|"validated turn"| API["Next.js API boundary"]
    API --> G["LangGraph interview graph"]
    G --> E{"Evaluator adapter"}
    E --> D["Deterministic demo"]
    E --> O["OpenAI via LangChain.js"]
    G --> P["LangGraph PostgreSQL checkpointer"]
    API --> DB["Tenant-scoped PostgreSQL repositories"]
    G --> R["Evidence and report service"]
    V["Voice provider via WebRTC"] --> B
    B -->|"transcript events"| API
```

## Monorepo boundaries

- `apps/web`: UI, HTTP boundary, provider-key forwarding, security headers.
- `packages/contracts`: stable Zod schemas and inferred TypeScript types.
- `packages/database`: SQL migrations, tenant-scoped repositories, encrypted
  provider connections, and the LangGraph checkpointer.
- `packages/evaluation`: versioned dataset generation, deterministic execution,
  counterfactual tests, and computed reports.
- `packages/interview-engine`: graph, scorer adapters, difficulty logic, reports.
- `packages/voice`: provider-neutral events, device recovery, and OpenAI
  Realtime WebRTC.
- `evaluation`: public deterministic fixtures and expected score bounds.

## Interview graph

The reference graph makes model interpretation and deterministic application
policy separate:

```mermaid
flowchart TD
    S["START"] --> I["initialize session"]
    I --> C["verify consent"]
    C --> K["select competency and rubric"]
    K --> A["assess answer"]
    A --> F["safe fallback when degraded"]
    A --> V["validate evidence"]
    F --> V
    V --> D["adapt difficulty"]
    D --> Q["select follow up"]
    Q --> P["apply interruption policy"]
    P --> B["decide completion budget"]
    B --> N["prepare unique next question"]
    N --> R["prepare report state"]
    R --> E["END"]
```

OpenAI mode uses one versioned structured call to extract evidence and a second
to assess confidence, communication, and technical depth. Deterministic nodes
own evidence sufficiency, score caps, follow-up reason, difficulty hysteresis,
interruption eligibility, budgets, completion, and pronunciation availability.
Provider failure records deterministic-fallback provenance instead of silently
substituting scores.

The graph compiles with `PostgresSaver`; repository writes remain explicit
around it so authorization, idempotency, export, and deletion are independently
testable. Nodes return partial updates. Graph state never contains provider API
keys.

## Persistence

The durable path:

- compiles the graph with `PostgresSaver`;
- uses the stable interview session ID as LangGraph `thread_id`;
- stores transcript and evidence in tenant- and user-scoped relational tables;
- reserves an idempotency key before evaluating every candidate turn;
- persists the validated response with an optimistic session-version check;
- stores runtime provider keys outside checkpoints;
- deletes both product rows and LangGraph checkpoint rows on user request.

`MemorySaver` is acceptable only in tests and local experiments.

The legacy stateless API remains available when `DATABASE_URL` is absent, so
contributors can still run the keyless demo without PostgreSQL.

## Identity and request integrity

The durable alpha creates a private guest tenant and user behind a random opaque
cookie. Only a SHA-256 digest is stored in PostgreSQL. The cookie is `HttpOnly`,
`SameSite=Lax`, and secure in production. Every repository query scopes by both
tenant and user. Mutation routes require same-origin requests and the
`x-interview-coach-client` header.

This is durable pseudonymous identity, not a complete account system. Registered
accounts, recovery, organization membership, and an external identity provider
remain future work.

## Provider key boundary

The browser key mode is convenient, not zero-trust: a hosted backend forwarding
a key can technically observe it. The UI must say this plainly.

Preferred trust order:

1. local self-host with a server environment secret;
2. explicitly opted-in per-user secret encrypted with AES-256-GCM;
3. provider ephemeral token minted by the self-hosted backend;
4. tab-scoped key forwarded over TLS and discarded;
5. never: query string, analytics property, log field, or checkpoint.

Encrypted storage requires a 32-byte operator-managed
`PROVIDER_ENCRYPTION_KEY`. The database stores ciphertext, nonce, authentication
tag, and key version; list APIs expose metadata only.

## Voice

The browser speech-recognition feature in alpha is progressive enhancement, not
the production voice architecture. Production voice uses WebRTC and normalized
events:

```ts
type VoiceEvent =
  | { type: "speech.started"; atMs: number }
  | { type: "speech.stopped"; atMs: number }
  | { type: "transcript.final"; text: string; itemId: string }
  | { type: "interviewer.transcript.delta"; delta: string }
  | { type: "interruption.requested"; reason: string }
  | { type: "error"; code: string; recoverable: boolean };
```

Audio should travel directly between browser and provider when possible. The
backend owns authorization, ephemeral-token minting, interview state, and event
audit—not the media plane.

```mermaid
sequenceDiagram
    participant C as Candidate
    participant B as Browser
    participant A as Next.js API
    participant P as Realtime provider
    participant G as Interview graph
    C->>B: Accept processing and transcript retention
    B->>A: Request ephemeral grant with consent version
    A->>P: Create short-lived client secret
    P-->>A: Ephemeral secret and expiry
    A-->>B: Ephemeral secret only
    B->>P: Establish WebRTC media and event channels
    P-->>B: Final transcript
    B-->>C: Show editable transcript
    C->>B: Correct and submit
    B->>G: Persist validated text turn
    G-->>B: Evidence, policy decision, and next question
    B->>P: Speak the application-selected question
```

The browser never automatically scores a final transcript. The candidate can
review and correct it before submitting. Mute and leave controls operate on the
local media stream; reconnect requests a fresh ephemeral grant. Automatic
network recovery and real-device reliability measurement remain pending.

## Security controls

- Shared Zod validation at browser/API/graph boundaries.
- Server-only provider and database secrets.
- Security headers and a restrictive CSP.
- `Cache-Control: no-store` on assessment responses.
- Error logging by error class, never raw provider response or request headers.
- Bounded LangGraph recursion and provider retries.
- Opaque guest authentication, origin validation, CSRF defense, and tenant
  guards on durable objects.
- Rate limiting and an external identity provider remain required before a
  general internet-facing hosted service.

## Testing strategy

- Unit: deterministic scorer and difficulty boundary tests.
- Contract: every provider returns the same validated schema.
- Graph: state transition and retry fixtures.
- API: invalid input, missing key, idempotency, redaction.
- Browser: setup, five-turn interview, report, keyboard-only, reduced motion.
- Evaluation: public fixtures today; calibrated human labels before public v1.
- Operations: load, provider outage, database failover, backup/restore, deletion.

## Container runtime

`compose.yaml` is the canonical local orchestration entry point. It starts:

1. pinned PostgreSQL with a persistent named volume;
2. a one-shot migration image that also installs LangGraph checkpoint tables;
3. the Next.js standalone web image after migrations succeed.

Runtime controls:

- non-root `nextjs` user;
- read-only root filesystem and memory-backed `/tmp`;
- all Linux capabilities dropped;
- `no-new-privileges`;
- application and Docker health checks at `/api/health`;
- provider credentials injected only through runtime environment variables.
- database-aware liveness at `/api/health`.

Production deployments should use a managed PostgreSQL service, TLS, a secret
manager, rate limiting, backup/restore procedures, and monitored migration
rollouts.
