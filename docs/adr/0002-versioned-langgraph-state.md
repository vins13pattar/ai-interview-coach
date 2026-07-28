# ADR 0002: Versioned Typed LangGraph State

Status: Accepted

The graph state explicitly carries session identity, consent, rubric,
competency, question/answer/evidence and difficulty history, follow-up and
interruption decisions, remaining budgets, provider status, evaluation
version, completion reason, and report status. Nodes return partial updates.
Graph evolution requires compatible defaults or a migration plan for existing
checkpoints.
