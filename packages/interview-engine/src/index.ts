import {
  AnswerEvaluationSchema,
  InterviewTurnResultSchema,
  type AnswerEvaluation,
  type InterviewTurn,
  type InterviewTurnResult,
  type RecruiterReportRequest,
} from "@interview-coach/contracts";
import { ChatOpenAI } from "@langchain/openai";
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { createAgent, toolStrategy } from "langchain";
import { z } from "zod";

import { adaptDifficulty, evaluateDeterministically } from "./scoring";
import { buildNextQuestion, openingQuestion } from "./questions";

type Evaluator = (turn: InterviewTurn) => Promise<AnswerEvaluation>;

const GraphState = new StateSchema({
  turn: z.custom<InterviewTurn>(),
  evaluation: z.custom<AnswerEvaluation>().optional(),
  nextDifficulty: z
    .enum(["foundation", "intermediate", "advanced", "expert"])
    .optional(),
  nextQuestion: z.string().optional(),
  coachNote: z.string().optional(),
  completed: z.boolean().default(false),
});

function createOpenAiEvaluator(apiKey: string): Evaluator {
  const model = new ChatOpenAI({
    apiKey,
    model: "gpt-4.1-mini",
    temperature: 0,
  });
  const evaluator = createAgent({
    model,
    tools: [],
    systemPrompt:
      "You are a rigorous interview assessor. Score only observable evidence in the candidate answer. Pronunciation must be null unless acoustic evidence exists. Flag interruption only for rambling, evasion, or unsafe content.",
    responseFormat: toolStrategy(AnswerEvaluationSchema),
  });

  return async (turn) => {
    const result = await evaluator.invoke(
      {
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              role: turn.role,
              seniority: turn.seniority,
              difficulty: turn.difficulty,
              question: turn.question,
              answer: turn.answer,
            }),
          },
        ],
      },
      { recursionLimit: 6 },
    );
    return AnswerEvaluationSchema.parse(result.structuredResponse);
  };
}

function createInterviewGraph(evaluate: Evaluator) {
  const assess: typeof GraphState.Node = async (state) => ({
    evaluation: await evaluate(state.turn),
  });

  const adapt: typeof GraphState.Node = (state) => {
    if (!state.evaluation) {
      throw new Error("Evaluation is required before difficulty adaptation.");
    }
    const nextDifficulty = adaptDifficulty(
      state.turn.difficulty,
      state.evaluation,
    );
    return {
      nextDifficulty,
      completed: state.turn.turnNumber >= 5,
    };
  };

  const prepareNext: typeof GraphState.Node = (state) => {
    if (!state.evaluation || !state.nextDifficulty) {
      throw new Error("Evaluation and difficulty are required.");
    }
    return {
      nextQuestion: buildNextQuestion(
        state.turn,
        state.evaluation,
        state.nextDifficulty,
      ),
      coachNote:
        state.evaluation.improvements[0] ??
        "Keep connecting your decisions to measurable outcomes.",
    };
  };

  return new StateGraph(GraphState)
    .addNode("assess_answer", assess, {
      retryPolicy: { maxAttempts: 2, initialInterval: 0.25 },
    })
    .addNode("adapt_difficulty", adapt)
    .addNode("prepare_next_question", prepareNext)
    .addEdge(START, "assess_answer")
    .addEdge("assess_answer", "adapt_difficulty")
    .addEdge("adapt_difficulty", "prepare_next_question")
    .addEdge("prepare_next_question", END)
    .compile();
}

export async function runInterviewTurn(
  turn: InterviewTurn,
  apiKey?: string,
): Promise<InterviewTurnResult> {
  const evaluator =
    turn.provider === "openai" && apiKey
      ? createOpenAiEvaluator(apiKey)
      : async (input: InterviewTurn) => evaluateDeterministically(input);
  const graph = createInterviewGraph(evaluator);
  const state = await graph.invoke({ turn }, { recursionLimit: 8 });

  return InterviewTurnResultSchema.parse({
    evaluation: state.evaluation,
    nextDifficulty: state.nextDifficulty,
    nextQuestion: state.nextQuestion,
    coachNote: state.coachNote,
    completed: state.completed,
  });
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
    disclaimer:
      "Decision support only. Do not use this report as the sole basis for employment decisions.",
  };
}

export { openingQuestion };
