# ADR 0001: Deterministic Workflow over Autonomous Agents

Status: Accepted

Use an explicit LangGraph workflow. Model reasoning interprets answer evidence
and assesses anchored dimensions; deterministic TypeScript owns consent,
evidence sufficiency, score bounds, follow-up routing, interruption, budgets,
completion, and fallback. Multiple agents are not added for architectural
appearance. This improves termination, testing, auditability, and safety at the
cost of more explicit policy code.
