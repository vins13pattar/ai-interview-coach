# Interview Coach

An open-source foundation for natural, adaptive AI interviews.

[Project website](https://vinodspattar.in/ai-interview-coach/) ·
[Product requirements](docs/PRD.md) ·
[Architecture](docs/ARCHITECTURE.md) ·
[Roadmap](docs/ROADMAP.md) ·
[Threat model](docs/THREAT_MODEL.md)

Candidates speak or type naturally. The interviewer follows up, changes
difficulty, redirects rambling answers, scores observable evidence, and produces
a recruiter-style report. The current vertical slice is deliberately usable
without an API key and supports an optional bring-your-own OpenAI key.

> Project status: **reference-implementation alpha with an unvalidated voice
> beta**. Durable text interviews, explicit workflow policy, six versioned role
> rubrics, 156 deterministic evaluation cases, export, and verified deletion
> are implemented. Real-provider voice reliability, qualified-human
> calibration, registered accounts, accessibility certification, and
> hiring-grade validation remain roadmap items. See the [PRD](docs/PRD.md) and
> [roadmap](docs/ROADMAP.md).

## Why this is different

- Adaptive questions instead of a fixed script
- Evidence-backed scores instead of unexplained numbers
- No fabricated pronunciation score in text-only sessions
- A deterministic local evaluator for free development and CI
- BYOK model access: contributors provide their own provider credentials
- TypeScript throughout the application and AI orchestration stack

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS 4
- LangChain.js 1.x and LangGraph 1.x
- Zod contracts shared across UI, API, and engine
- pnpm workspaces and Turborepo
- Vitest for deterministic engine tests
- PostgreSQL repositories, SQL migrations, and LangGraph Postgres checkpoints
- Six executable versioned role rubrics and a 156-case evaluation workspace
- Provider-neutral WebRTC voice adapter with consented ephemeral credentials
- Playwright browser journeys and Vitest unit/integration suites

## Quick start

Requirements:

- Node.js 20.9 or newer (Node 22 LTS recommended)
- pnpm 11

```bash
corepack enable
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and choose **Local demo**.
No API key is required.

To use model-backed evaluation, select **OpenAI** in the setup form and provide
your own key. The key is tab-scoped by default, sent in a request header, and
not persisted. Self-hosters may explicitly enable encrypted per-user
connections. Public and guest routes never fall back to an operator-funded
provider key.

## Run with Docker

Docker is the simplest way to boot the complete application. No local Node.js
installation or API key is required:

```bash
docker compose up --build --detach --wait
```

Open [http://localhost:3000](http://localhost:3000). The command builds the
production images, starts PostgreSQL, applies idempotent migrations, starts the
web service, and waits for `/api/health` to report a database-backed healthy
state. The named database volume survives `docker compose down`.

Useful operations:

```bash
docker compose logs --follow web
docker compose down
```

To use a different host port or provider integration, create an untracked
`.env` file:

```dotenv
PORT=8080
PROVIDER_ENCRYPTION_KEY=base64-encoded-32-byte-key
```

Generate the optional storage key with `openssl rand -base64 32`. Keep it in a
secret manager; losing it makes stored provider connections unreadable.

Then run the same `docker compose up --build --detach --wait` command and open
`http://localhost:8080`.

The runtime container:

- runs as an unprivileged user;
- drops Linux capabilities and prevents privilege escalation;
- uses a read-only filesystem with an isolated temporary directory;
- includes only Next.js standalone production output;
- exposes a Docker health check.
- stores interview state and LangGraph checkpoints in PostgreSQL;
- runs migrations as a one-shot service before the web container starts.
- binds the host port to `127.0.0.1` by default; non-loopback deployments must
  add TLS and secure-cookie configuration explicitly.

## Repository map

```text
apps/
  web/                  Next.js product UI and API boundary
packages/
  contracts/            Shared Zod schemas and TypeScript types
  database/             Tenant-scoped repositories, migrations, checkpointer
  evaluation/           Dataset generation, metrics, counterfactual tests
  interview-engine/     LangGraph orchestration, scoring, report logic
  voice/                Provider-neutral voice events and WebRTC adapter
evaluation/
  reference-v1.json     156-case versioned reference dataset
  results/              Computed machine-readable evaluation reports
docs/
  PRD.md                Detailed product requirements
  ARCHITECTURE.md       Runtime design and security boundaries
  ROADMAP.md            Delivery phases and exit criteria
  RUBRIC_CARD.md        Intended use, measured evidence, and limitations
  PROVIDER_SECURITY.md  BYOK trust boundaries and redaction model
```

## Quality commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm check
pnpm evaluation:generate
pnpm evaluation:report
pnpm audit:dependencies
```

The current synthetic deterministic baseline executes all 156 cases with 100%
graph termination and zero fabricated pronunciation scores. Its 76.92%
dimension-range, 42.31% evidence-sufficiency, and 34.62% follow-up agreement
show why this remains an alpha. See the
[evaluation report](docs/evaluation/reference-v1-report.md) and
[counterfactual report](docs/evaluation/counterfactual-v1-report.md). These
fixtures are not qualified-human calibration or evidence of fairness across
real populations.

## Responsible use

Interview Coach is coaching and decision-support software. It must not be the
sole basis for employment decisions. Production adopters are responsible for
candidate consent, retention rules, local employment law, accessibility, bias
testing, and human review.

## Open-source status

Governance documents are included, but a project license has not yet been
selected. Until a `LICENSE` is added, the repository is publicly readable but
does **not** grant open-source reuse rights. See [licensing](docs/LICENSING.md).

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md),
and [SECURITY.md](SECURITY.md) before participating.
