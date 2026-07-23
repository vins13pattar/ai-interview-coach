# Interview Coach

An open-source foundation for natural, adaptive AI interviews.

Candidates speak or type naturally. The interviewer follows up, changes
difficulty, redirects rambling answers, scores observable evidence, and produces
a recruiter-style report. The current vertical slice is deliberately usable
without an API key and supports an optional bring-your-own OpenAI key.

> Project status: **alpha foundation**. The text interview, adaptive scoring
> loop, and report are implemented. Production voice-to-voice interruption,
> durable accounts, calibrated pronunciation scoring, and hiring-grade
> validation remain roadmap items. See the [PRD](docs/PRD.md) and
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
- PostgreSQL and the LangGraph Postgres checkpointer are the planned durable
  runtime; they are not required for the current local demo

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
your own key. The key is kept only in page memory, sent in a request header, and
not persisted by this application. Self-hosters may instead set
`OPENAI_API_KEY` in a server-only environment.

## Repository map

```text
apps/
  web/                  Next.js product UI and API boundary
packages/
  contracts/            Shared Zod schemas and TypeScript types
  interview-engine/     LangGraph orchestration, scoring, report logic
docs/
  PRD.md                Detailed product requirements
  ARCHITECTURE.md       Runtime design and security boundaries
  ROADMAP.md            Delivery phases and exit criteria
```

## Quality commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

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
