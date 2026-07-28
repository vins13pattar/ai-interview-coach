import {
  AnswerEvaluationSchema,
  CompletionReasonSchema,
  DifficultySchema,
  DimensionAssessmentSchema,
  EvidenceExtractionSchema,
  FollowUpReasonSchema,
  InterviewTurnResultSchema,
  InterruptionDecisionSchema,
  ProviderStatusSchema,
  ReportStatusSchema,
  type AnswerEvaluation,
  type InterviewRubric,
  type InterviewTurn,
  type InterviewTurnResult,
  type ProviderStatus,
  type RecruiterReportRequest,
} from "@interview-coach/contracts";
import { ChatOpenAI } from "@langchain/openai";
import {
  END,
  START,
  StateGraph,
  StateSchema,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import { createAgent, toolStrategy } from "langchain";
import { z } from "zod";

import { buildNextQuestion, openingQuestion } from "./questions";
import {
  adaptDifficultyWithHysteresis,
  decideInterruption,
  enforceEvidencePolicy,
  selectFollowUpReason,
} from "./policy";
import { resolveInterviewRubric, RUBRIC_REGISTRY_VERSION } from "./rubrics";
import { evaluateDeterministically } from "./scoring";
import {
  type InterviewTelemetryEvent,
  type InterviewTelemetrySink,
} from "./telemetry";

type EvaluatorOutcome = {
  evaluation: AnswerEvaluation;
  providerStatus: ProviderStatus;
};

export type InterviewEvaluatorAdapter = (
  turn: InterviewTurn,
  rubric: InterviewRubric,
) => Promise<EvaluatorOutcome>;

type Evaluator = InterviewEvaluatorAdapter;

const GraphState = new StateSchema({
  turn: z.custom<InterviewTurn>(),
  initialized: z.boolean().default(false),
  sessionId: z.string().min(1).default("stateless"),
  consentVersion: z.string().min(1).default("text-practice-v1"),
  consentVerified: z.boolean().default(false),
  rubric: z.custom<InterviewRubric>().optional(),
  currentCompetency: z.string().default("general"),
  questionHistory: z.array(z.string()).default([]),
  answerHistory: z.array(z.string()).default([]),
  answerEvidence: z.array(z.string()).default([]),
  difficultyHistory: z.array(DifficultySchema).default([]),
  evaluation: z.custom<AnswerEvaluation>().optional(),
  nextDifficulty: DifficultySchema.optional(),
  followUpReason: FollowUpReasonSchema.optional(),
  interruption: InterruptionDecisionSchema.optional(),
  remainingTurnBudget: z.number().int().min(0).max(30).default(0),
  remainingTimeBudgetSeconds: z.number().int().min(0).max(7_200).default(0),
  remainingTokenBudget: z.number().int().min(0).max(200_000).default(0),
  providerStatus: ProviderStatusSchema.default("available"),
  evaluationVersion: z.string().default("answer-evaluation-v2"),
  completionReason: CompletionReasonSchema.nullable().default(null),
  reportStatus: ReportStatusSchema.default("not_ready"),
  nextQuestion: z.string().optional(),
  coachNote: z.string().optional(),
  completed: z.boolean().default(false),
});

function classifyProviderFailure(error: unknown): ProviderStatus {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("429") || message.includes("rate"))
    return "rate_limited";
  if (
    message.includes("timeout") ||
    (error instanceof Error && error.name === "TimeoutError")
  ) {
    return "timed_out";
  }
  if (
    message.includes("refusal") ||
    message.includes("content filter") ||
    message.includes("safety")
  ) {
    return "refused";
  }
  if (error instanceof z.ZodError || message.includes("structured")) {
    return "invalid_output";
  }
  if (message.includes("empty response") || message.includes("incomplete")) {
    return "invalid_output";
  }
  return "unavailable";
}

async function withBoundedProviderRetry<T>(
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation(AbortSignal.timeout(10_000));
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        const backoffMs = 150 * 2 ** attempt + Math.floor(Math.random() * 75);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }
  throw lastError;
}

function createOpenAiEvaluator(apiKey: string): Evaluator {
  const model = new ChatOpenAI({
    apiKey,
    model: "gpt-4.1-mini",
    temperature: 0,
    maxRetries: 0,
    timeout: 10_000,
  });
  const evidenceExtractor = createAgent({
    model,
    tools: [],
    systemPrompt:
      "Extract only observable evidence relevant to the interview question and supplied rubric. Do not score, infer protected traits, infer personality, or treat fluent wording as technical correctness.",
    responseFormat: toolStrategy(EvidenceExtractionSchema),
  });
  const dimensionAssessor = createAgent({
    model,
    tools: [],
    systemPrompt:
      "Assess confidence, communication, and technical depth only from the supplied extracted evidence and rubric anchors. Do not score pronunciation or decide interruption, difficulty, completion, or hiring outcomes.",
    responseFormat: toolStrategy(DimensionAssessmentSchema),
  });

  return async (turn, rubric) => {
    try {
      const extraction = await withBoundedProviderRetry(async (signal) => {
        const result = await evidenceExtractor.invoke(
          {
            messages: [
              {
                role: "user",
                content: JSON.stringify({
                  schemaVersion: "evidence-extraction-v1",
                  role: turn.role,
                  seniority: turn.seniority,
                  difficulty: turn.difficulty,
                  question: turn.question,
                  answer: turn.answer,
                  rubric: {
                    id: rubric.id,
                    version: rubric.version,
                    competencies: rubric.competencies,
                    requiredEvidence: rubric.dimensions.map((dimension) => ({
                      dimension: dimension.dimension,
                      requiredEvidence: dimension.requiredEvidence,
                    })),
                  },
                }),
              },
            ],
          },
          { recursionLimit: 6, signal },
        );
        return EvidenceExtractionSchema.parse(result.structuredResponse);
      });
      const assessment = await withBoundedProviderRetry(async (signal) => {
        const result = await dimensionAssessor.invoke(
          {
            messages: [
              {
                role: "user",
                content: JSON.stringify({
                  schemaVersion: "dimension-assessment-v1",
                  role: turn.role,
                  seniority: turn.seniority,
                  question: turn.question,
                  evidence: extraction,
                  rubric: {
                    id: rubric.id,
                    version: rubric.version,
                    dimensions: rubric.dimensions,
                    limitations: rubric.limitations,
                  },
                }),
              },
            ],
          },
          { recursionLimit: 6, signal },
        );
        return DimensionAssessmentSchema.parse(result.structuredResponse);
      });

      return {
        evaluation: AnswerEvaluationSchema.parse({
          provenance: {
            schemaVersion: "answer-evaluation-v2",
            rubricId: rubric.id,
            rubricVersion: rubric.version,
            promptVersion: "split-assessment-v2",
            provider: "openai",
            model: "gpt-4.1-mini",
            mode: "model",
            fallbackReason: null,
          },
          scores: {
            ...assessment.scores,
            pronunciation: null,
          },
          scoreConfidence: assessment.scoreConfidence,
          evidence: extraction.evidence,
          strengths: assessment.strengths,
          improvements: [
            ...assessment.improvements,
            ...extraction.insufficiencies,
          ].slice(0, 4),
          shouldInterrupt: false,
          interruptionReason: null,
          demonstratedConcepts: extraction.demonstratedConcepts,
        }),
        providerStatus: "available",
      };
    } catch (error) {
      const providerStatus = classifyProviderFailure(error);
      const fallback = evaluateDeterministically(turn);
      return {
        evaluation: AnswerEvaluationSchema.parse({
          ...fallback,
          provenance: {
            ...fallback.provenance,
            provider: "openai",
            model: "gpt-4.1-mini",
            mode: "deterministic_fallback",
            fallbackReason: providerStatus,
          },
        }),
        providerStatus,
      };
    }
  };
}

function createInterviewGraph(
  evaluate: Evaluator,
  checkpointer?: BaseCheckpointSaver,
  telemetry?: InterviewTelemetrySink,
) {
  const instrument = (
    nodeName: string,
    node: typeof GraphState.Node,
  ): typeof GraphState.Node => {
    return async (state, config) => {
      if (typeof node !== "function") {
        throw new Error(`Graph node ${nodeName} is not directly callable.`);
      }
      const startedAt = performance.now();
      try {
        const update = await node(state, config);
        await telemetry?.({
          schemaVersion: "interview-telemetry-v1",
          eventName: "graph.node.completed",
          occurredAt: new Date().toISOString(),
          sessionId: state.sessionId,
          provider: state.turn.provider,
          providerStatus: state.providerStatus,
          rubricVersion: state.rubric?.version ?? null,
          evaluationMode: state.evaluation?.provenance.mode ?? null,
          durationMs: performance.now() - startedAt,
          nodeName,
          turnNumber: state.turn.turnNumber,
        });
        return update;
      } catch (error) {
        await telemetry?.({
          schemaVersion: "interview-telemetry-v1",
          eventName: "graph.node.failed",
          occurredAt: new Date().toISOString(),
          sessionId: state.sessionId,
          provider: state.turn.provider,
          providerStatus: state.providerStatus,
          rubricVersion: state.rubric?.version ?? null,
          evaluationMode: state.evaluation?.provenance.mode ?? null,
          durationMs: performance.now() - startedAt,
          nodeName,
          turnNumber: state.turn.turnNumber,
        });
        throw error;
      }
    };
  };

  const initializeSession: typeof GraphState.Node = (state) => {
    const currentQuestionAlreadyStored = state.questionHistory.some(
      (question) => question === state.turn.question,
    );
    const estimatedTokens = Math.ceil(state.turn.answer.length / 4);
    const estimatedSpeakingSeconds = Math.max(
      1,
      Math.ceil(
        state.turn.answer.trim().split(/\s+/).filter(Boolean).length / 2.5,
      ),
    );
    return {
      initialized: true,
      consentVersion: state.turn.consentVersion,
      questionHistory: currentQuestionAlreadyStored
        ? state.questionHistory
        : [...state.questionHistory, state.turn.question],
      answerHistory: [...state.answerHistory, state.turn.answer],
      difficultyHistory: [
        ...state.difficultyHistory,
        state.turn.difficulty,
      ].slice(-6),
      remainingTurnBudget: Math.max(
        0,
        state.turn.maxTurns - state.turn.turnNumber,
      ),
      remainingTimeBudgetSeconds: Math.max(
        0,
        (state.initialized
          ? state.remainingTimeBudgetSeconds
          : state.turn.timeBudgetSeconds) - estimatedSpeakingSeconds,
      ),
      remainingTokenBudget: Math.max(
        0,
        (state.initialized
          ? state.remainingTokenBudget
          : state.turn.tokenBudget) - estimatedTokens,
      ),
      providerStatus: "available",
      completionReason: null,
      reportStatus: "not_ready",
      completed: false,
    };
  };

  const verifyConsent: typeof GraphState.Node = (state) => {
    if (!state.consentVersion.trim()) {
      throw new Error("CONSENT_REQUIRED");
    }
    return { consentVerified: true };
  };

  const selectCompetency: typeof GraphState.Node = (state) => {
    const rubric = resolveInterviewRubric(state.turn);
    const configuredFocus =
      state.turn.focusAreas[
        (state.turn.turnNumber - 1) % state.turn.focusAreas.length
      ];
    const matchingCompetency = rubric.competencies.find(
      (competency) =>
        configuredFocus &&
        (competency.includes(configuredFocus.toLocaleLowerCase()) ||
          configuredFocus
            .toLocaleLowerCase()
            .includes(competency.toLocaleLowerCase())),
    );
    return {
      rubric,
      currentCompetency:
        matchingCompetency ??
        rubric.competencies[
          (state.turn.turnNumber - 1) % rubric.competencies.length
        ] ??
        "general",
    };
  };

  const assess: typeof GraphState.Node = async (state) => {
    if (!state.rubric) throw new Error("RUBRIC_REQUIRED");
    try {
      const outcome = await evaluate(state.turn, state.rubric);
      return {
        evaluation: AnswerEvaluationSchema.parse(outcome.evaluation),
        providerStatus: ProviderStatusSchema.parse(outcome.providerStatus),
      };
    } catch (error) {
      return {
        evaluation: undefined,
        providerStatus: classifyProviderFailure(error),
      };
    }
  };

  const safeFallback: typeof GraphState.Node = (state) => {
    if (state.evaluation) return {};
    const fallback = evaluateDeterministically(state.turn);
    return {
      evaluation: AnswerEvaluationSchema.parse({
        ...fallback,
        provenance: {
          ...fallback.provenance,
          provider: state.turn.provider,
          mode: "deterministic_fallback",
          fallbackReason: state.providerStatus,
        },
      }),
    };
  };

  const validateEvidence: typeof GraphState.Node = (state) => {
    if (!state.evaluation) {
      throw new Error("Evaluation is required for evidence validation.");
    }
    const evaluation = enforceEvidencePolicy(state.turn, state.evaluation);
    return {
      evaluation,
      answerEvidence: [...state.answerEvidence, ...evaluation.evidence].slice(
        -30,
      ),
    };
  };

  const adapt: typeof GraphState.Node = (state) => {
    if (!state.evaluation) {
      throw new Error("Evaluation is required before difficulty adaptation.");
    }
    const nextDifficulty = adaptDifficultyWithHysteresis(
      state.turn.difficulty,
      state.evaluation,
      state.difficultyHistory,
    );
    return { nextDifficulty };
  };

  const selectFollowUp: typeof GraphState.Node = (state) => {
    if (!state.evaluation) {
      throw new Error("Evaluation is required for follow-up selection.");
    }
    const followUpReason = selectFollowUpReason(state.evaluation);
    return {
      followUpReason,
      evaluation: AnswerEvaluationSchema.parse({
        ...state.evaluation,
        followUpReason,
      }),
    };
  };

  const applyInterruptionPolicy: typeof GraphState.Node = (state) => {
    if (!state.evaluation) {
      throw new Error("Evaluation is required for interruption policy.");
    }
    const interruption = decideInterruption(
      state.turn,
      state.answerHistory.slice(0, -1),
    );
    return {
      interruption,
      evaluation: AnswerEvaluationSchema.parse({
        ...state.evaluation,
        shouldInterrupt: interruption.eligible,
        interruptionReason: interruption.reason,
        interruption,
      }),
    };
  };

  const decideCompletion: typeof GraphState.Node = (state) => {
    let completionReason: typeof CompletionReasonSchema._output | null = null;
    if (state.remainingTurnBudget === 0) {
      completionReason = "turn_budget_exhausted";
    } else if (state.remainingTimeBudgetSeconds === 0) {
      completionReason = "time_budget_exhausted";
    } else if (state.remainingTokenBudget === 0) {
      completionReason = "token_budget_exhausted";
    }
    return {
      completed: completionReason !== null,
      completionReason,
    };
  };

  const prepareNext: typeof GraphState.Node = (state) => {
    if (!state.evaluation || !state.nextDifficulty || !state.followUpReason) {
      throw new Error(
        "Evaluation, difficulty, and follow-up reason are required.",
      );
    }
    return {
      nextQuestion: buildNextQuestion(
        state.turn,
        state.evaluation,
        state.nextDifficulty,
        state.followUpReason,
        state.questionHistory,
      ),
      coachNote:
        state.evaluation.improvements[0] ??
        "Keep connecting your decisions to measurable outcomes.",
    };
  };

  const prepareReportState: typeof GraphState.Node = (state) => ({
    reportStatus: state.completed ? "ready" : "not_ready",
  });

  const graph = new StateGraph(GraphState)
    .addNode(
      "initialize_session",
      instrument("initialize_session", initializeSession),
    )
    .addNode("verify_consent", instrument("verify_consent", verifyConsent))
    .addNode(
      "select_competency",
      instrument("select_competency", selectCompetency),
    )
    .addNode("assess_answer", instrument("assess_answer", assess))
    .addNode("safe_fallback", instrument("safe_fallback", safeFallback))
    .addNode(
      "validate_evidence",
      instrument("validate_evidence", validateEvidence),
    )
    .addNode("adapt_difficulty", instrument("adapt_difficulty", adapt))
    .addNode("select_follow_up", instrument("select_follow_up", selectFollowUp))
    .addNode(
      "apply_interruption_policy",
      instrument("apply_interruption_policy", applyInterruptionPolicy),
    )
    .addNode(
      "decide_completion",
      instrument("decide_completion", decideCompletion),
    )
    .addNode(
      "prepare_next_question",
      instrument("prepare_next_question", prepareNext),
    )
    .addNode(
      "prepare_report_state",
      instrument("prepare_report_state", prepareReportState),
    )
    .addEdge(START, "initialize_session")
    .addEdge("initialize_session", "verify_consent")
    .addEdge("verify_consent", "select_competency")
    .addEdge("select_competency", "assess_answer")
    .addConditionalEdges(
      "assess_answer",
      (state) =>
        state.providerStatus === "available"
          ? "validate_evidence"
          : "safe_fallback",
      ["validate_evidence", "safe_fallback"],
    )
    .addEdge("safe_fallback", "validate_evidence")
    .addEdge("validate_evidence", "adapt_difficulty")
    .addEdge("adapt_difficulty", "select_follow_up")
    .addEdge("select_follow_up", "apply_interruption_policy")
    .addEdge("apply_interruption_policy", "decide_completion")
    .addEdge("decide_completion", "prepare_next_question")
    .addEdge("prepare_next_question", "prepare_report_state")
    .addEdge("prepare_report_state", END);

  return graph.compile(checkpointer ? { checkpointer } : undefined);
}

export async function runInterviewTurn(
  turn: InterviewTurn,
  apiKey?: string,
  persistence?: {
    checkpointer: BaseCheckpointSaver;
    threadId: string;
  },
  runtime?: {
    evaluator?: InterviewEvaluatorAdapter;
    telemetry?: InterviewTelemetrySink;
  },
): Promise<InterviewTurnResult> {
  const turnStartedAt = performance.now();
  const sessionId = persistence?.threadId ?? `stateless:${turn.questionId}`;
  const emit = async (
    event: Omit<
      InterviewTelemetryEvent,
      "schemaVersion" | "occurredAt" | "sessionId" | "provider" | "turnNumber"
    >,
  ) => {
    await runtime?.telemetry?.({
      schemaVersion: "interview-telemetry-v1",
      occurredAt: new Date().toISOString(),
      sessionId,
      provider: turn.provider,
      turnNumber: turn.turnNumber,
      ...event,
    });
  };
  await emit({
    eventName: "session.turn.started",
    providerStatus: "available",
    rubricVersion: null,
    evaluationMode: null,
    durationMs: null,
    nodeName: null,
  });
  const evaluator =
    runtime?.evaluator ??
    (turn.provider === "openai" && apiKey
      ? createOpenAiEvaluator(apiKey)
      : async (input: InterviewTurn): Promise<EvaluatorOutcome> => ({
          evaluation: evaluateDeterministically(input),
          providerStatus: "available",
        }));
  const graph = createInterviewGraph(
    evaluator,
    persistence?.checkpointer,
    runtime?.telemetry,
  );
  const state = await graph.invoke(
    {
      turn,
      sessionId,
    },
    {
      recursionLimit: 24,
      ...(persistence
        ? { configurable: { thread_id: persistence.threadId } }
        : {}),
    },
  );

  const result = InterviewTurnResultSchema.parse({
    evaluation: state.evaluation,
    nextDifficulty: state.nextDifficulty,
    nextQuestion: state.nextQuestion,
    coachNote: state.coachNote,
    completed: state.completed,
    currentCompetency: state.currentCompetency,
    followUpReason: state.followUpReason,
    providerStatus: state.providerStatus,
    remainingTurnBudget: state.remainingTurnBudget,
    remainingTimeBudgetSeconds: state.remainingTimeBudgetSeconds,
    remainingTokenBudget: state.remainingTokenBudget,
    completionReason: state.completionReason,
    reportStatus: state.reportStatus,
  });
  if (result.evaluation.provenance.mode === "deterministic_fallback") {
    await emit({
      eventName: "provider.fallback",
      providerStatus: result.providerStatus,
      rubricVersion: result.evaluation.provenance.rubricVersion,
      evaluationMode: result.evaluation.provenance.mode,
      durationMs: null,
      nodeName: null,
    });
  }
  await emit({
    eventName: "session.turn.completed",
    providerStatus: result.providerStatus,
    rubricVersion: result.evaluation.provenance.rubricVersion,
    evaluationMode: result.evaluation.provenance.mode,
    durationMs: performance.now() - turnStartedAt,
    nodeName: null,
  });
  return result;
}

export function createRecruiterReport(input: RecruiterReportRequest) {
  const dimensions = ["confidence", "communication", "technicalDepth"] as const;
  const averages = Object.fromEntries(
    dimensions.map((dimension) => [
      dimension,
      Math.round(
        input.turns.reduce(
          (sum, turn) => sum + turn.evaluation.scores[dimension],
          0,
        ) / input.turns.length,
      ),
    ]),
  ) as Record<(typeof dimensions)[number], number>;
  const pronunciationValues = input.turns.flatMap((turn) =>
    turn.evaluation.scores.pronunciation === null
      ? []
      : [turn.evaluation.scores.pronunciation],
  );
  const pronunciation =
    pronunciationValues.length === 0
      ? null
      : Math.round(
          pronunciationValues.reduce((sum, value) => sum + value, 0) /
            pronunciationValues.length,
        );
  const strongest = [...dimensions].sort(
    (a, b) => averages[b] - averages[a],
  )[0];
  const weakest = [...dimensions].sort((a, b) => averages[a] - averages[b])[0];
  const dimensionLabels: Record<(typeof dimensions)[number], string> = {
    confidence: "confidence",
    communication: "communication",
    technicalDepth: "technical depth",
  };
  const strengths = Array.from(
    new Set(input.turns.flatMap((turn) => turn.evaluation.strengths)),
  ).slice(0, 5);
  const risks = Array.from(
    new Set(input.turns.flatMap((turn) => turn.evaluation.improvements)),
  ).slice(0, 5);
  const rubricVersions = Array.from(
    new Set(
      input.turns.map(
        (turn) =>
          `${turn.evaluation.provenance.rubricId}@${turn.evaluation.provenance.rubricVersion}`,
      ),
    ),
  );
  const evaluationVersions = Array.from(
    new Set(
      input.turns.map((turn) => turn.evaluation.provenance.schemaVersion),
    ),
  );
  const fallbackTurns = input.turns.filter(
    (turn) => turn.evaluation.provenance.mode === "deterministic_fallback",
  ).length;

  return {
    title: `${input.seniority} ${input.role} interview assessment`,
    recommendation:
      averages.technicalDepth >= 75 && averages.communication >= 70
        ? "Strong signal — advance to the next interview stage"
        : averages.technicalDepth >= 58
          ? "Mixed-positive signal — continue with targeted validation"
          : "Insufficient signal — additional preparation recommended",
    summary: `The candidate demonstrated their strongest signal in ${strongest ? dimensionLabels[strongest] : "communication"} and should improve ${weakest ? dimensionLabels[weakest] : "technical depth"}. Evidence is based on ${input.turns.length} adaptive interview turns.`,
    scores: { ...averages, pronunciation },
    strengths:
      strengths.length > 0
        ? strengths
        : ["Completed the adaptive interview and provided assessable answers"],
    risks:
      risks.length > 0
        ? risks
        : ["Validate performance with a role-specific follow-up interview"],
    evidence: input.turns.flatMap((turn) =>
      turn.evaluation.evidence.map((item) => ({
        question: turn.question,
        observation: item,
      })),
    ),
    rubricVersions,
    evaluationVersion: evaluationVersions.join(", "),
    completionReason: "turn_budget_exhausted" as const,
    uncertainty: [
      "Pronunciation was not assessed because no validated acoustic evidence was supplied.",
      ...(fallbackTurns > 0
        ? [
            `${fallbackTurns} turn${fallbackTurns === 1 ? "" : "s"} used the recorded deterministic provider fallback.`,
          ]
        : []),
    ],
    limitations: [
      "Scores are coaching signals and have not been calibrated for employment decisions.",
      "Candidate claims were not independently verified.",
      `Rubric registry ${RUBRIC_REGISTRY_VERSION} may not cover every organization-specific expectation.`,
    ],
    generatedFromCompleteState: true as const,
    disclaimer:
      "Decision support only. Do not use this report as the sole basis for employment decisions.",
  };
}

export {
  interviewRubrics,
  resolveInterviewRubric,
  resolveRoleFamily,
  RUBRIC_REGISTRY_VERSION,
} from "./rubrics";
export {
  summarizeTelemetry,
  type InterviewTelemetryEvent,
  type InterviewTelemetrySink,
} from "./telemetry";
export { openingQuestion };
