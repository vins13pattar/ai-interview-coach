import {
  AnswerEvaluationSchema,
  InterviewTurnSchema,
} from "@interview-coach/contracts";
import { describe, expect, it } from "vitest";

import { buildNextQuestion } from "./questions";

const evaluation = AnswerEvaluationSchema.parse({
  scores: {
    confidence: 75,
    pronunciation: null,
    communication: 75,
    technicalDepth: 75,
  },
  evidence: ["Observable answer"],
  strengths: [],
  improvements: [],
  shouldInterrupt: false,
  interruptionReason: null,
  demonstratedConcepts: [],
});

describe("adaptive question copy", () => {
  it("uses a leadership-specific frame", () => {
    const question = buildNextQuestion(
      InterviewTurnSchema.parse({
        questionId: "q-2",
        question: "Prior question",
        answer: "Prior answer",
        role: "Software Engineer",
        seniority: "Senior",
        focusAreas: ["system design", "leadership"],
        difficulty: "advanced",
        provider: "demo",
        turnNumber: 1,
      }),
      evaluation,
      "advanced",
    );

    expect(question).toContain("Several teams disagree");
    expect(question).not.toContain("leadership system");
  });

  it("does not repeat system in technical prompts", () => {
    const question = buildNextQuestion(
      InterviewTurnSchema.parse({
        questionId: "q-5",
        question: "Prior question",
        answer: "Prior answer",
        role: "Software Engineer",
        seniority: "Senior",
        focusAreas: ["distributed systems"],
        difficulty: "advanced",
        provider: "demo",
        turnNumber: 2,
      }),
      evaluation,
      "advanced",
    );

    expect(question).toContain("solution for distributed systems");
    expect(question).not.toContain("systems system");
  });
});
