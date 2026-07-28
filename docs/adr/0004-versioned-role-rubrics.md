# ADR 0004: Versioned Role Rubrics

Status: Accepted

Six small executable rubrics replace one generic prompt. Every evaluated turn
stores rubric, prompt, schema, provider, model, and evaluation-mode provenance.
Rubric changes use semantic versions and evaluation diffs. Organization-specific
rubrics remain future extension points.
