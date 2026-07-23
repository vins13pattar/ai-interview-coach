import type {
  AnswerEvaluation,
  Difficulty,
  InterviewTurn,
} from "@interview-coach/contracts";

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

  return {
    scores: {
      confidence,
      pronunciation: null,
      communication,
      technicalDepth,
    },
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
  };
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
  const pronunciation = evaluation.scores.pronunciation ?? 75;
  const average =
    (evaluation.scores.confidence +
      pronunciation +
      evaluation.scores.communication +
      evaluation.scores.technicalDepth) /
    4;
  const currentIndex = DIFFICULTIES.indexOf(current);

  if (average >= 78 && currentIndex < DIFFICULTIES.length - 1) {
    return DIFFICULTIES[currentIndex + 1] ?? current;
  }
  if (average < 48 && currentIndex > 0) {
    return DIFFICULTIES[currentIndex - 1] ?? current;
  }
  return current;
}
