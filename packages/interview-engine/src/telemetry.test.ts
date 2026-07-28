import { InterviewTurnSchema } from "@interview-coach/contracts";
import { describe, expect, it } from "vitest";

import {
  runInterviewTurn,
  summarizeTelemetry,
  type InterviewTelemetryEvent,
} from "./index";

describe("content-free interview telemetry", () => {
  it("records node and turn latency without answer or key content", async () => {
    const events: InterviewTelemetryEvent[] = [];
    const answer =
      "I measured API latency and database throughput, tested failure recovery, and reduced p95 latency by 30 percent with an idempotent rollback.";
    await runInterviewTurn(
      InterviewTurnSchema.parse({
        questionId: "telemetry-q1",
        question: "How did you validate the decision?",
        answer,
        role: "Backend Engineer",
        seniority: "Senior",
        focusAreas: ["reliability"],
        difficulty: "advanced",
        provider: "demo",
        turnNumber: 1,
      }),
      undefined,
      undefined,
      {
        telemetry: (event) => {
          events.push(event);
        },
      },
    );

    expect(
      events.some((event) => event.eventName === "graph.node.completed"),
    ).toBe(true);
    expect(
      events.some((event) => event.eventName === "session.turn.completed"),
    ).toBe(true);
    expect(JSON.stringify(events)).not.toContain(answer);
    const summary = summarizeTelemetry(events);
    expect(summary.completedTurns).toBe(1);
    expect(summary.turnLatencyMs.p95).toBeGreaterThanOrEqual(0);
    expect(Object.keys(summary.nodes)).toContain("assess_answer");
  });
});
