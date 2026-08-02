import { z } from "zod";

export const DifficultySchema = z.enum([
  "foundation",
  "intermediate",
  "advanced",
  "expert",
]);

export const ProviderSchema = z.enum(["demo", "openai"]);

export const SessionStatusSchema = z.enum(["active", "paused", "completed"]);

export const RoleFamilySchema = z.enum([
  "frontend-engineer",
  "backend-engineer",
  "full-stack-engineer",
  "technical-lead",
  "principal-engineer",
  "genai-engineer",
]);

export const ScoringDimensionSchema = z.enum([
  "confidence",
  "communication",
  "technicalDepth",
  "pronunciation",
]);

export const EvidenceSufficiencySchema = z.enum([
  "insufficient",
  "partial",
  "sufficient",
]);

export const FollowUpReasonSchema = z.enum([
  "clarify",
  "probe_tradeoff",
  "request_evidence",
  "test_failure_mode",
  "resolve_contradiction",
  "advance_competency",
]);

export const InterruptionReasonSchema = z.enum([
  "excessive_rambling",
  "repeated_non_answer",
  "unsafe_content",
  "severe_topic_drift",
  "session_time_exhaustion",
  "candidate_requested",
]);

export const ProviderStatusSchema = z.enum([
  "available",
  "degraded",
  "rate_limited",
  "timed_out",
  "invalid_output",
  "refused",
  "unavailable",
]);

export const EvaluationModeSchema = z.enum([
  "deterministic",
  "model",
  "deterministic_fallback",
]);

export const CompletionReasonSchema = z.enum([
  "turn_budget_exhausted",
  "time_budget_exhausted",
  "token_budget_exhausted",
  "candidate_ended",
  "provider_unavailable",
]);

export const ReportStatusSchema = z.enum([
  "not_ready",
  "ready",
  "generated",
  "failed",
]);

export const InterruptionDecisionSchema = z.object({
  eligible: z.boolean(),
  reason: InterruptionReasonSchema.nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().min(1).max(2_000)).max(4),
  minimumSpeakingTimeMet: z.boolean(),
  naturalBoundaryPreferred: z.literal(true),
});

export const EvaluationProvenanceSchema = z.object({
  schemaVersion: z.string().min(1).max(120),
  rubricId: z.string().min(1).max(120),
  rubricVersion: z.string().min(1).max(120),
  promptVersion: z.string().min(1).max(120),
  provider: ProviderSchema,
  model: z.string().min(1).max(200),
  mode: EvaluationModeSchema,
  fallbackReason: z.string().max(2_000).nullable(),
});

export const EvidenceExtractionSchema = z.object({
  schemaVersion: z.literal("evidence-extraction-v1"),
  relevance: z.enum(["off_topic", "partial", "relevant"]),
  evidence: z.array(z.string().min(3).max(2_000)).min(1).max(4),
  demonstratedConcepts: z.array(z.string().min(1).max(200)).max(8),
  insufficiencies: z.array(z.string().min(3).max(2_000)).max(6),
});

export const DimensionAssessmentSchema = z.object({
  schemaVersion: z.literal("dimension-assessment-v1"),
  scores: z.object({
    confidence: z.number().min(0).max(100),
    communication: z.number().min(0).max(100),
    technicalDepth: z.number().min(0).max(100),
  }),
  scoreConfidence: z.number().min(0).max(1),
  strengths: z.array(z.string().min(3).max(2_000)).max(4),
  improvements: z.array(z.string().min(3).max(2_000)).max(4),
});

export const ScoreSchema = z.object({
  confidence: z.number().min(0).max(100),
  pronunciation: z.number().min(0).max(100).nullable(),
  communication: z.number().min(0).max(100),
  technicalDepth: z.number().min(0).max(100),
});

export const AnswerEvaluationSchema = z.object({
  provenance: EvaluationProvenanceSchema.default({
    schemaVersion: "answer-evaluation-v1",
    rubricId: "general-interview",
    rubricVersion: "alpha-v1",
    promptVersion: "assessment-v1",
    provider: "demo",
    model: "deterministic-v1",
    mode: "deterministic",
    fallbackReason: null,
  }),
  scores: ScoreSchema,
  scoreConfidence: z.number().min(0).max(1).default(0.5),
  evidenceSufficiency: EvidenceSufficiencySchema.default("partial"),
  evidence: z.array(z.string().min(1).max(2_000)).min(1).max(4),
  strengths: z.array(z.string().max(2_000)).max(4),
  improvements: z.array(z.string().max(2_000)).max(4),
  shouldInterrupt: z.boolean(),
  interruptionReason: z.string().max(2_000).nullable(),
  interruption: InterruptionDecisionSchema.default({
    eligible: false,
    reason: null,
    confidence: 0,
    evidence: [],
    minimumSpeakingTimeMet: false,
    naturalBoundaryPreferred: true,
  }),
  followUpReason: FollowUpReasonSchema.nullable().default(null),
  demonstratedConcepts: z.array(z.string().max(200)).max(8),
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
  consentVersion: z.string().min(1).default("text-practice-v1"),
  maxTurns: z.number().int().min(1).max(30).default(5),
  timeBudgetSeconds: z.number().int().min(60).max(7_200).default(1_800),
  tokenBudget: z.number().int().min(100).max(200_000).default(12_000),
  questionHistory: z.array(z.string().min(4).max(2_000)).max(30).default([]),
});

export const InterviewTurnResultSchema = z.object({
  evaluation: AnswerEvaluationSchema,
  nextDifficulty: DifficultySchema,
  nextQuestion: z.string().min(4).max(2_000),
  coachNote: z.string().min(4).max(2_000),
  completed: z.boolean(),
  currentCompetency: z.string().min(1).max(120).default("general"),
  followUpReason: FollowUpReasonSchema,
  providerStatus: ProviderStatusSchema.default("available"),
  remainingTurnBudget: z.number().int().min(0).max(30).default(0),
  remainingTimeBudgetSeconds: z.number().int().min(0).max(7_200).default(0),
  remainingTokenBudget: z.number().int().min(0).max(200_000).default(0),
  completionReason: CompletionReasonSchema.nullable().default(null),
  reportStatus: ReportStatusSchema.default("not_ready"),
});

export const TranscriptTurnSchema = z.object({
  id: z.string().min(1).max(100),
  question: z.string().min(4).max(2_000),
  answer: z.string().min(3).max(20_000),
  difficulty: DifficultySchema,
  evaluation: AnswerEvaluationSchema,
});

export const RecruiterReportRequestSchema = z.object({
  role: z.string().min(2).max(120),
  seniority: z.string().min(2).max(80),
  focusAreas: z.array(z.string().min(1).max(80)).min(1).max(12),
  turns: z.array(TranscriptTurnSchema).min(5).max(30),
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
  rubricVersions: z.array(z.string()).min(1).default(["alpha-v1"]),
  evaluationVersion: z.string().min(1).default("answer-evaluation-v1"),
  completionReason: CompletionReasonSchema.default("turn_budget_exhausted"),
  uncertainty: z.array(z.string()).default([]),
  limitations: z
    .array(z.string())
    .default(["This report has not been calibrated for employment decisions."]),
  generatedFromCompleteState: z.literal(true).default(true),
  disclaimer: z.string(),
});

export const RubricAnchorSchema = z.object({
  level: z.enum(["insufficient", "developing", "proficient", "advanced"]),
  scoreRange: z.tuple([
    z.number().int().min(0).max(100),
    z.number().int().min(0).max(100),
  ]),
  description: z.string().min(10),
  observableSignals: z.array(z.string().min(3)).min(1).max(6),
});

export const RubricDimensionSchema = z.object({
  dimension: ScoringDimensionSchema,
  weight: z.number().min(0).max(1),
  requiredEvidence: z.array(z.string().min(3)).min(1).max(8),
  anchors: z.array(RubricAnchorSchema).length(4),
});

export const InterviewRubricSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  roleFamily: RoleFamilySchema,
  supportedSeniorities: z.array(z.string().min(2)).min(1),
  competencies: z.array(z.string().min(2)).min(3).max(10),
  dimensions: z.array(RubricDimensionSchema).min(3).max(4),
  disqualifyingInsufficiencies: z.array(z.string().min(5)).min(1).max(8),
  followUpRules: z.array(z.string().min(5)).min(1).max(8),
  confidenceCalculation: z.string().min(10),
  limitations: z.array(z.string().min(10)).min(1).max(8),
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

export const VoiceConsentRequestSchema = z.object({
  sessionId: z.uuid(),
  policyVersion: z.literal("voice-beta-v1"),
  providerProcessingAccepted: z.literal(true),
  transcriptRetentionAccepted: z.literal(true),
  rawAudioRetentionAccepted: z.literal(false),
});

export const DictationConsentRequestSchema = z.object({
  policyVersion: z.literal("text-dictation-v1"),
  browserProcessingAccepted: z.literal(true),
  transcriptUseAccepted: z.literal(true),
  rawAudioRetentionAccepted: z.literal(false),
});

export const VoiceClientSecretSchema = z.object({
  value: z.string().min(1),
  expiresAt: z.number().int().positive(),
  model: z.string().min(1),
  voice: z.string().min(1),
  rawAudioRetained: z.literal(false),
  acousticPronunciationAssessed: z.literal(false),
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
export type RoleFamily = z.infer<typeof RoleFamilySchema>;
export type ScoringDimension = z.infer<typeof ScoringDimensionSchema>;
export type EvidenceSufficiency = z.infer<typeof EvidenceSufficiencySchema>;
export type FollowUpReason = z.infer<typeof FollowUpReasonSchema>;
export type InterruptionReason = z.infer<typeof InterruptionReasonSchema>;
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
export type EvaluationMode = z.infer<typeof EvaluationModeSchema>;
export type CompletionReason = z.infer<typeof CompletionReasonSchema>;
export type ReportStatus = z.infer<typeof ReportStatusSchema>;
export type InterruptionDecision = z.infer<typeof InterruptionDecisionSchema>;
export type EvaluationProvenance = z.infer<typeof EvaluationProvenanceSchema>;
export type EvidenceExtraction = z.infer<typeof EvidenceExtractionSchema>;
export type DimensionAssessment = z.infer<typeof DimensionAssessmentSchema>;
export type InterviewRubric = z.infer<typeof InterviewRubricSchema>;
export type RubricAnchor = z.infer<typeof RubricAnchorSchema>;
export type RubricDimension = z.infer<typeof RubricDimensionSchema>;
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
export type VoiceConsentRequest = z.infer<typeof VoiceConsentRequestSchema>;
export type DictationConsentRequest = z.infer<
  typeof DictationConsentRequestSchema
>;
export type VoiceClientSecret = z.infer<typeof VoiceClientSecretSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type SessionDetail = z.infer<typeof SessionDetailSchema>;
export type SessionTurnResponse = z.infer<typeof SessionTurnResponseSchema>;
export type SessionExport = z.infer<typeof SessionExportSchema>;
