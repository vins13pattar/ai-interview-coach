# ADR 0009: PostgreSQL Checkpointing and Explicit Repository Writes

Status: Accepted

Production LangGraph uses PostgresSaver with the stable interview session ID as
`thread_id`. Tenant-scoped repository writes remain outside graph checkpoints
for authorization, idempotency, optimistic concurrency, export, audit, and
verified deletion. Memory-only saving is limited to tests and experiments.
