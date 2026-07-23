import { z } from "zod";

export const DifficultySchema = z.enum([
  "foundation",
  "intermediate",
  "advanced",
  "expert",
]);

export const ProviderSchema = z.enum(["demo", "openai"]);

export const ScoreSchema = z.object({
  confidence: z.number().min(0).max(100),
  pronunciation: z.number().min(0).max(100).nullable(),
  communication: z.number().min(0).max(100),
  technicalDepth: z.number().min(0).max(100),
});

export const AnswerEvaluationSchema = z.object({
  scores: ScoreSchema,
  evidence: z.array(z.string()).min(1).max(4),
  strengths: z.array(z.string()).max(4),
  improvements: z.array(z.string()).max(4),
  shouldInterrupt: z.boolean(),
  interruptionReason: z.string().nullable(),
  demonstratedConcepts: z.array(z.string()).max(8),
});

export const InterviewTurnSchema = z.object({
  questionId: z.string().min(1).max(100),
  question: z.string().min(4).max(2_000),
  answer: z.string().min(3).max(20_000),
  role: z.string().min(2).max(120),
  seniority: z.string().min(2).max(80),
  focusAreas: z.array(z.string().min(1).max(80)).min(1).max(12),
  difficulty: DifficultySchema,
  provider: ProviderSchema.default("demo"),
  turnNumber: z.number().int().min(1).max(30),
});

export const InterviewTurnResultSchema = z.object({
  evaluation: AnswerEvaluationSchema,
  nextDifficulty: DifficultySchema,
  nextQuestion: z.string().min(4),
  coachNote: z.string().min(4),
  completed: z.boolean(),
});

export const TranscriptTurnSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  difficulty: DifficultySchema,
  evaluation: AnswerEvaluationSchema,
});

export const RecruiterReportRequestSchema = z.object({
  role: z.string().min(2).max(120),
  seniority: z.string().min(2).max(80),
  focusAreas: z.array(z.string()).min(1).max(12),
  turns: z.array(TranscriptTurnSchema).min(1).max(30),
});

export type Difficulty = z.infer<typeof DifficultySchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type AnswerEvaluation = z.infer<typeof AnswerEvaluationSchema>;
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;
export type InterviewTurnResult = z.infer<typeof InterviewTurnResultSchema>;
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;
export type RecruiterReportRequest = z.infer<
  typeof RecruiterReportRequestSchema
>;
