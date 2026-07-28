# ADR 0008: WebRTC and Application Interruption Policy

Status: Accepted for beta

Browser voice uses provider-neutral events and OpenAI Realtime WebRTC with
server-minted ephemeral credentials. Provider VAD detects speech and cancels
overlapping interviewer output, while application policy owns candidate-answer
interruption reasons and thresholds. Raw audio is not retained and text remains
available. Production claims wait for real device evidence.
