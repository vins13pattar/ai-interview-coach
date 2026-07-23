import { z } from "zod";

export const DifficultySchema = z.enum([
  "foundation",
  "intermediate",
  "advanced",
  "expert",
]);

export const ProviderSchema = z.enum(["demo", "openai"]);

export const SessionStatusSchema = z.enum(["active", "paused", "completed"]);

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
  id: z.string().min(1),
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

export const RecruiterReportSchema = z.object({
  id: z.uuid().optional(),
  title: z.string(),
  recommendation: z.string(),
  summary: z.string(),
  scores: ScoreSchema,
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  evidence: z.array(
    z.object({
      question: z.string(),
      observation: z.string(),
    }),
  ),
  disclaimer: z.string(),
});

export const CreateSessionRequestSchema = z.object({
  role: z.string().min(2).max(120),
  seniority: z.string().min(2).max(80),
  focusAreas: z.array(z.string().min(1).max(80)).min(1).max(12),
  difficulty: DifficultySchema,
  provider: ProviderSchema.default("demo"),
});

export const SessionTurnRequestSchema = z.object({
  answer: z.string().min(20).max(20_000),
});

export const ProviderConnectionInputSchema = z.object({
  provider: z.literal("openai"),
  apiKey: z.string().min(20).max(500),
});

export const ProviderConnectionSchema = z.object({
  provider: z.literal("openai"),
  configuredAt: z.iso.datetime(),
});

export const SessionSummarySchema = z.object({
  id: z.uuid(),
  status: SessionStatusSchema,
  role: z.string(),
  seniority: z.string(),
  focusAreas: z.array(z.string()),
  provider: ProviderSchema,
  currentDifficulty: DifficultySchema,
  currentQuestion: z.string(),
  turnCount: z.number().int().min(0).max(30),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});

export const SessionDetailSchema = SessionSummarySchema.extend({
  turns: z.array(TranscriptTurnSchema),
  report: RecruiterReportSchema.nullable(),
});

export const SessionTurnResponseSchema = z.object({
  session: SessionSummarySchema,
  result: InterviewTurnResultSchema,
  report: RecruiterReportSchema.nullable(),
  replayed: z.boolean(),
});

export const SessionExportSchema = z.object({
  exportedAt: z.iso.datetime(),
  session: SessionDetailSchema,
  dataPolicy: z.object({
    rawAudioRetained: z.literal(false),
    providerKeyRetained: z.literal(false),
  }),
});

export type Difficulty = z.infer<typeof DifficultySchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type AnswerEvaluation = z.infer<typeof AnswerEvaluationSchema>;
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;
export type InterviewTurnResult = z.infer<typeof InterviewTurnResultSchema>;
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;
export type RecruiterReportRequest = z.infer<
  typeof RecruiterReportRequestSchema
>;
export type RecruiterReport = z.infer<typeof RecruiterReportSchema>;
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type SessionTurnRequest = z.infer<typeof SessionTurnRequestSchema>;
export type ProviderConnectionInput = z.infer<
  typeof ProviderConnectionInputSchema
>;
export type ProviderConnection = z.infer<typeof ProviderConnectionSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type SessionDetail = z.infer<typeof SessionDetailSchema>;
export type SessionTurnResponse = z.infer<typeof SessionTurnResponseSchema>;
export type SessionExport = z.infer<typeof SessionExportSchema>;
