import type {
  EvaluationMode,
  Provider,
  ProviderStatus,
} from "@interview-coach/contracts";

export type InterviewTelemetryEvent = {
  schemaVersion: "interview-telemetry-v1";
  eventName:
    | "session.turn.started"
    | "graph.node.completed"
    | "graph.node.failed"
    | "provider.fallback"
    | "session.turn.completed";
  occurredAt: string;
  sessionId: string;
  provider: Provider;
  providerStatus: ProviderStatus;
  rubricVersion: string | null;
  evaluationMode: EvaluationMode | null;
  durationMs: number | null;
  nodeName: string | null;
  turnNumber: number;
};

export type InterviewTelemetrySink = (
  event: InterviewTelemetryEvent,
) => void | Promise<void>;

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileValue / 100) * sorted.length) - 1,
  );
  return Math.round((sorted[index] ?? 0) * 100) / 100;
}

export function summarizeTelemetry(events: InterviewTelemetryEvent[]) {
  const completedTurns = events.filter(
    (event) => event.eventName === "session.turn.completed",
  );
  const turnDurations = completedTurns.flatMap((event) =>
    event.durationMs === null ? [] : [event.durationMs],
  );
  const nodeDurations = events
    .filter(
      (event) =>
        event.eventName === "graph.node.completed" &&
        event.durationMs !== null &&
        event.nodeName,
    )
    .reduce<Record<string, number[]>>((groups, event) => {
      const name = event.nodeName!;
      groups[name] ??= [];
      groups[name]!.push(event.durationMs!);
      return groups;
    }, {});

  return {
    eventCount: events.length,
    completedTurns: completedTurns.length,
    fallbackRate:
      completedTurns.length === 0
        ? 0
        : events.filter((event) => event.eventName === "provider.fallback")
            .length / completedTurns.length,
    turnLatencyMs: {
      p50: percentile(turnDurations, 50),
      p95: percentile(turnDurations, 95),
    },
    nodes: Object.fromEntries(
      Object.entries(nodeDurations).map(([name, values]) => [
        name,
        {
          count: values.length,
          p50: percentile(values, 50),
          p95: percentile(values, 95),
        },
      ]),
    ),
  };
}
