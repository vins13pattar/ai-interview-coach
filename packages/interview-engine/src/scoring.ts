import type {
  AnswerEvaluation,
  Difficulty,
  InterviewTurn,
} from "@interview-coach/contracts";
import { AnswerEvaluationSchema } from "@interview-coach/contracts";

import { resolveInterviewRubric } from "./rubrics";

const FILLERS = /\b(um+|uh+|like|basically|actually|you know|sort of)\b/gi;
const TECHNICAL_SIGNALS =
  /\b(trade-?off|latency|throughput|consisten|cache|queue|database|index|failure|retry|idempot|complexity|security|observability|scale|test|deploy|api|state)\w*/gi;
const STRUCTURE_SIGNALS =
  /\b(first|second|finally|because|therefore|for example|result|impact|trade-?off)\b/gi;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function matches(input: string, pattern: RegExp): number {
  return input.match(pattern)?.length ?? 0;
}

export function evaluateDeterministically(
  turn: InterviewTurn,
): AnswerEvaluation {
  const rubric = resolveInterviewRubric(turn);
  const words = turn.answer.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const fillers = matches(turn.answer, FILLERS);
  const technicalSignals = matches(turn.answer, TECHNICAL_SIGNALS);
  const structureSignals = matches(turn.answer, STRUCTURE_SIGNALS);
  const hasConcreteExample =
    /\b(example|when I|we built|I built|resulted|reduced|increased|measured)\b/i.test(
      turn.answer,
    );

  const confidence = clamp(
    54 +
      Math.min(wordCount, 90) * 0.28 -
      fillers * 5 +
      (hasConcreteExample ? 8 : 0),
  );
  const communication = clamp(
    48 +
      Math.min(structureSignals, 7) * 7 +
      (hasConcreteExample ? 10 : 0) -
      fillers * 3,
  );
  const technicalDepth = clamp(
    40 + Math.min(technicalSignals, 10) * 5 + (hasConcreteExample ? 8 : 0),
  );

  const shouldInterrupt =
    (wordCount > 125 && structureSignals < 2) || fillers >= 7;

  return AnswerEvaluationSchema.parse({
    provenance: {
      schemaVersion: "answer-evaluation-v2",
      rubricId: rubric.id,
      rubricVersion: rubric.version,
      promptVersion: "deterministic-signals-v2",
      provider: "demo",
      model: "deterministic-v2",
      mode: "deterministic",
      fallbackReason: null,
    },
    scores: {
      confidence,
      pronunciation: null,
      communication,
      technicalDepth,
    },
    scoreConfidence: Math.min(
      0.95,
      0.35 +
        Math.min(technicalSignals, 6) * 0.06 +
        Math.min(structureSignals, 5) * 0.05 +
        (hasConcreteExample ? 0.12 : 0),
    ),
    evidence: [
      `${wordCount} words with ${technicalSignals} technical signals`,
      hasConcreteExample
        ? "Used a concrete experience or measurable outcome"
        : "No concrete example or measurable outcome was detected",
    ],
    strengths: [
      ...(technicalSignals >= 3 ? ["Uses relevant technical language"] : []),
      ...(hasConcreteExample ? ["Grounds the answer in experience"] : []),
      ...(structureSignals >= 3 ? ["Organizes the response clearly"] : []),
    ],
    improvements: [
      ...(technicalSignals < 3
        ? ["Explain the design choices and their trade-offs"]
        : []),
      ...(!hasConcreteExample
        ? ["Add a concrete example and quantify the outcome"]
        : []),
      ...(fillers >= 4 ? ["Pause briefly instead of using filler words"] : []),
    ],
    shouldInterrupt,
    interruptionReason: shouldInterrupt
      ? "The answer is becoming long or repetitive; redirect to the core decision."
      : null,
    demonstratedConcepts: Array.from(
      new Set(
        (turn.answer.match(TECHNICAL_SIGNALS) ?? []).map((item) =>
          item.toLowerCase(),
        ),
      ),
    ).slice(0, 8),
  });
}

const DIFFICULTIES: Difficulty[] = [
  "foundation",
  "intermediate",
  "advanced",
  "expert",
];

export function adaptDifficulty(
  current: Difficulty,
  evaluation: AnswerEvaluation,
): Difficulty {
  const average =
    (evaluation.scores.confidence +
      evaluation.scores.communication +
      evaluation.scores.technicalDepth) /
    3;
  const currentIndex = DIFFICULTIES.indexOf(current);

  if (average >= 78 && currentIndex < DIFFICULTIES.length - 1) {
    return DIFFICULTIES[currentIndex + 1] ?? current;
  }
  if (average < 48 && currentIndex > 0) {
    return DIFFICULTIES[currentIndex - 1] ?? current;
  }
  return current;
}
