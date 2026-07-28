import {
  AnswerEvaluationSchema,
  InterviewTurnSchema,
  type Difficulty,
  type TranscriptTurn,
} from "@interview-coach/contracts";
import { MemorySaver } from "@langchain/langgraph";
import { describe, expect, it } from "vitest";

import {
  createRecruiterReport,
  runInterviewTurn,
  type InterviewEvaluatorAdapter,
} from "./index";
import { evaluateDeterministically } from "./scoring";

const answers = [
  "First, I measured API latency, throughput, and recovery time across three regions. I owned the event-log decision because replay and idempotent recovery reduced restoration from 90 minutes to 18 minutes. We tested region isolation, tracked cost, and preserved a rollback path because the extra state increased operational complexity.",
  "We discussed the options with everyone and eventually chose the approach that seemed best for the project.",
  Array.from(
    { length: 22 },
    () =>
      "Um basically we discussed many ideas with the team and kept talking about the general approach without choosing a measurable technical constraint.",
  ).join(" "),
  "The provider may fail during this answer, so the application must preserve explicit provenance and continue under its configured policy.",
  "I do not know the exact limit. I would state that uncertainty, test the failure mode, measure latency and throughput, and review the evidence with the interviewer.",
];

describe("flagship adaptive recovery journey", () => {
  it("adapts, redirects, falls back, terminates, and reports from durable state", async () => {
    const checkpointer = new MemorySaver();
    const threadId = "flagship-reference-journey";
    const transcript: TranscriptTurn[] = [];
    const questions: string[] = [
      "Describe a consequential architecture decision and how you validated it.",
    ];
    let difficulty: Difficulty = "intermediate";

    const evaluator: InterviewEvaluatorAdapter = async (turn) => {
      if (turn.turnNumber === 4) {
        throw Object.assign(new Error("provider timeout"), {
          name: "TimeoutError",
        });
      }
      const evaluation = evaluateDeterministically(turn);
      return {
        evaluation: AnswerEvaluationSchema.parse({
          ...evaluation,
          provenance: {
            ...evaluation.provenance,
            provider: "openai",
            model: "fixture-adapter-v1",
            mode: "model",
          },
        }),
        providerStatus: "available",
      };
    };

    for (let index = 0; index < answers.length; index += 1) {
      const question = questions.at(-1)!;
      const turn = InterviewTurnSchema.parse({
        questionId: `flagship-${index + 1}`,
        question,
        answer: answers[index],
        role: "Principal Engineer",
        seniority: "Principal",
        focusAreas: ["technical strategy", "reliability"],
        difficulty,
        provider: "openai",
        turnNumber: index + 1,
        maxTurns: 5,
        timeBudgetSeconds: 1_800,
        tokenBudget: 12_000,
      });
      const result = await runInterviewTurn(
        turn,
        undefined,
        { checkpointer, threadId },
        { evaluator },
      );
      transcript.push({
        id: turn.questionId,
        question,
        answer: turn.answer,
        difficulty: turn.difficulty,
        evaluation: result.evaluation,
      });
      questions.push(result.nextQuestion);
      difficulty = result.nextDifficulty;

      if (turn.turnNumber === 1) {
        expect(result.nextDifficulty).toBe("advanced");
      }
      if (turn.turnNumber === 2) {
        expect(result.followUpReason).toBe("request_evidence");
        expect(result.nextQuestion).toMatch(/specific example|quantify/i);
      }
      if (turn.turnNumber === 3) {
        expect(result.evaluation.interruption.reason).toBe(
          "excessive_rambling",
        );
        expect(result.evaluation.interruption.naturalBoundaryPreferred).toBe(
          true,
        );
      }
      if (turn.turnNumber === 4) {
        expect(result.providerStatus).toBe("timed_out");
        expect(result.evaluation.provenance.mode).toBe(
          "deterministic_fallback",
        );
      }
      if (turn.turnNumber === 5) {
        expect(result.completed).toBe(true);
        expect(result.completionReason).toBe("turn_budget_exhausted");
        expect(result.reportStatus).toBe("ready");
      }
    }

    expect(new Set(questions.slice(0, -1)).size).toBe(5);
    const report = createRecruiterReport({
      role: "Principal Engineer",
      seniority: "Principal",
      focusAreas: ["technical strategy", "reliability"],
      turns: transcript,
    });
    expect(report.generatedFromCompleteState).toBe(true);
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.uncertainty.join(" ")).toContain(
      "deterministic provider fallback",
    );
    expect(report.scores.pronunciation).toBeNull();
  });
});
