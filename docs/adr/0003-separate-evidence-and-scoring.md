# ADR 0003: Separate Evidence Extraction and Scoring

Status: Accepted

OpenAI evaluation uses one versioned structured response for relevance and
observable evidence and a second for confidence, communication, and technical
depth. Deterministic policy validates evidence and may cap unsupported scores.
The extra provider call increases latency and cost but prevents one prompt from
owning interpretation and application policy.
