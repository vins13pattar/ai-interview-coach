import {
  AnswerEvaluationSchema,
  type AnswerEvaluation,
  type Difficulty,
  type EvidenceSufficiency,
  type FollowUpReason,
  type InterruptionDecision,
  type InterviewTurn,
} from "@interview-coach/contracts";

const STRUCTURE_PATTERN =
  /\b(first|second|third|finally|because|therefore|for example|result|impact|trade-?off)\b/gi;
const EVIDENCE_PATTERN =
  /\b(measured|reduced|increased|decreased|percent|p\d{2}|users?|requests?|latency|throughput|cost|incident|experiment|baseline)\b/gi;
const UNSAFE_PATTERN =
  /\b(kill|attack|dox|exploit them|racial slur|sexual violence)\b/i;
const CANDIDATE_STOP_PATTERN =
  /\b(stop|pause|end the interview|skip this question)\b/i;

const difficulties: Difficulty[] = [
  "foundation",
  "intermediate",
  "advanced",
  "expert",
];

function count(input: string, pattern: RegExp): number {
  return input.match(pattern)?.length ?? 0;
}

function scoreAverage(evaluation: AnswerEvaluation): number {
  return (
    (evaluation.scores.confidence +
      evaluation.scores.communication +
      evaluation.scores.technicalDepth) /
    3
  );
}

export function classifyEvidenceSufficiency(
  turn: InterviewTurn,
  evaluation: AnswerEvaluation,
): EvidenceSufficiency {
  const wordCount = turn.answer.trim().split(/\s+/).filter(Boolean).length;
  const evidenceSignals = count(turn.answer, EVIDENCE_PATTERN);
  const assessableEvidence = evaluation.evidence.filter(
    (item) => !/\bno concrete|missing|not detected\b/i.test(item),
  ).length;
  if (wordCount < 20 || (evidenceSignals === 0 && assessableEvidence === 0)) {
    return "insufficient";
  }
  if (wordCount < 45 || evidenceSignals < 2 || assessableEvidence < 1) {
    return "partial";
  }
  return "sufficient";
}

export function enforceEvidencePolicy(
  turn: InterviewTurn,
  evaluation: AnswerEvaluation,
): AnswerEvaluation {
  const evidenceSufficiency = classifyEvidenceSufficiency(turn, evaluation);
  const maximum =
    evidenceSufficiency === "insufficient"
      ? 55
      : evidenceSufficiency === "partial"
        ? 74
        : 100;
  const scores = {
    confidence: Math.min(evaluation.scores.confidence, maximum),
    communication: Math.min(evaluation.scores.communication, maximum),
    technicalDepth: Math.min(evaluation.scores.technicalDepth, maximum),
    pronunciation: evaluation.scores.pronunciation,
  };
  return AnswerEvaluationSchema.parse({
    ...evaluation,
    scores,
    scoreConfidence:
      evidenceSufficiency === "sufficient"
        ? Math.max(evaluation.scoreConfidence, 0.75)
        : evidenceSufficiency === "partial"
          ? Math.min(evaluation.scoreConfidence, 0.69)
          : Math.min(evaluation.scoreConfidence, 0.45),
    evidenceSufficiency,
  });
}

export function selectFollowUpReason(
  evaluation: AnswerEvaluation,
): FollowUpReason {
  if (evaluation.evidenceSufficiency === "insufficient") {
    return "request_evidence";
  }
  if (evaluation.improvements.some((item) => /\btrade-?off\b/i.test(item))) {
    return "probe_tradeoff";
  }
  if (
    evaluation.demonstratedConcepts.some((item) =>
      /\b(failure|retry|recovery|reliability)\b/i.test(item),
    )
  ) {
    return "test_failure_mode";
  }
  if (evaluation.evidenceSufficiency === "partial") return "clarify";
  return "advance_competency";
}

export function decideInterruption(
  turn: InterviewTurn,
  priorAnswers: string[] = [],
): InterruptionDecision {
  const words = turn.answer.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const structureSignals = count(turn.answer, STRUCTURE_PATTERN);
  const minimumSpeakingTimeMet = wordCount >= 45;
  const normalized = normalizeText(turn.answer);
  const repeated = priorAnswers.some(
    (answer) => textSimilarity(normalized, normalizeText(answer)) >= 0.9,
  );

  let reason: InterruptionDecision["reason"] = null;
  let confidence = 0;
  let evidence: string[] = [];
  if (CANDIDATE_STOP_PATTERN.test(turn.answer)) {
    reason = "candidate_requested";
    confidence = 0.98;
    evidence = ["Candidate explicitly requested a stop, pause, end, or skip."];
  } else if (UNSAFE_PATTERN.test(turn.answer)) {
    reason = "unsafe_content";
    confidence = 0.9;
    evidence = ["Unsafe-content policy signal matched the transcript."];
  } else if (repeated && minimumSpeakingTimeMet) {
    reason = "repeated_non_answer";
    confidence = 0.88;
    evidence = ["Answer is substantially equivalent to a prior answer."];
  } else if (
    minimumSpeakingTimeMet &&
    wordCount > 125 &&
    structureSignals < 2
  ) {
    reason = "excessive_rambling";
    confidence = Math.min(0.95, 0.72 + (wordCount - 125) / 500);
    evidence = [
      `${wordCount} words with ${structureSignals} detected structure signals.`,
    ];
  }

  return {
    eligible: reason !== null,
    reason,
    confidence,
    evidence,
    minimumSpeakingTimeMet,
    naturalBoundaryPreferred: true,
  };
}

export function adaptDifficultyWithHysteresis(
  current: Difficulty,
  evaluation: AnswerEvaluation,
  history: Difficulty[],
): Difficulty {
  const currentIndex = difficulties.indexOf(current);
  const average = scoreAverage(evaluation);
  let proposed = current;
  if (
    evaluation.evidenceSufficiency === "sufficient" &&
    average >= 78 &&
    currentIndex < difficulties.length - 1
  ) {
    proposed = difficulties[currentIndex + 1] ?? current;
  } else if (
    average < 48 &&
    currentIndex > 0 &&
    evaluation.evidenceSufficiency !== "sufficient"
  ) {
    proposed = difficulties[currentIndex - 1] ?? current;
  }

  const prior = history.at(-2);
  const latest = history.at(-1);
  if (!prior || !latest || proposed === current) return proposed;
  const previousMovement =
    difficulties.indexOf(latest) - difficulties.indexOf(prior);
  const proposedMovement =
    difficulties.indexOf(proposed) - difficulties.indexOf(current);
  return previousMovement !== 0 &&
    proposedMovement !== 0 &&
    Math.sign(previousMovement) !== Math.sign(proposedMovement)
    ? current
    : proposed;
}

export function normalizeText(input: string): string {
  return input
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function textSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeText(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeText(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union;
}

export function isEquivalentQuestion(
  candidate: string,
  history: string[],
): boolean {
  return history.some(
    (question) => textSimilarity(candidate, question) >= 0.76,
  );
}
