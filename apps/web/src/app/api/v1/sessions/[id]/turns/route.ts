import {
  InterviewTurnSchema,
  RecruiterReportRequestSchema,
  SessionTurnRequestSchema,
  type TranscriptTurn,
} from "@interview-coach/contracts";
import {
  abortTurnRequest,
  beginTurnRequest,
  commitTurnRequest,
  getProviderApiKey,
  getPostgresCheckpointer,
} from "@interview-coach/database";
import {
  createRecruiterReport,
  runInterviewTurn,
} from "@interview-coach/interview-engine";
import { z } from "zod";

import { getOrCreatePrincipal } from "@/lib/server/auth";
import {
  apiError,
  assertMutationRequest,
  HttpError,
  noStoreJson,
} from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 30;

const SessionIdSchema = z.uuid();
const IdempotencyKeySchema = z.uuid();

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  let requestId = "";
  let principal: Awaited<ReturnType<typeof getOrCreatePrincipal>> | null = null;
  try {
    assertMutationRequest(request);
    const sessionId = SessionIdSchema.parse((await context.params).id);
    const idempotencyKey = IdempotencyKeySchema.parse(
      request.headers.get("idempotency-key"),
    );
    const input = SessionTurnRequestSchema.parse(await request.json());
    principal = await getOrCreatePrincipal();
    const pending = await beginTurnRequest(
      principal,
      sessionId,
      idempotencyKey,
    );
    requestId = pending.requestId;

    if (pending.replayedResponse) {
      return noStoreJson({
        ...pending.replayedResponse,
        replayed: true,
      });
    }

    const session = pending.session;
    const requestKey = request.headers.get("x-provider-api-key") ?? undefined;
    const serverKey =
      session.provider === "openai" ? process.env.OPENAI_API_KEY : undefined;
    const storedKey =
      session.provider === "openai" && !requestKey && !serverKey
        ? await getProviderApiKey(principal, "openai")
        : undefined;
    const apiKey = requestKey ?? serverKey ?? storedKey ?? undefined;
    if (session.provider !== "demo" && !apiKey) {
      throw new HttpError(
        400,
        "No provider key was supplied. Add a tab-scoped key or use demo mode.",
      );
    }

    const turn = InterviewTurnSchema.parse({
      questionId: `q-${session.turnCount + 1}`,
      question: session.currentQuestion,
      answer: input.answer,
      role: session.role,
      seniority: session.seniority,
      focusAreas: session.focusAreas,
      difficulty: session.currentDifficulty,
      provider: session.provider,
      turnNumber: session.turnCount + 1,
    });
    const result = await runInterviewTurn(turn, apiKey, {
      checkpointer: getPostgresCheckpointer(),
      threadId: session.id,
    });

    const completedTurn: TranscriptTurn = {
      id: turn.questionId,
      question: turn.question,
      answer: turn.answer,
      difficulty: turn.difficulty,
      evaluation: result.evaluation,
    };
    const report = result.completed
      ? createRecruiterReport(
          RecruiterReportRequestSchema.parse({
            role: session.role,
            seniority: session.seniority,
            focusAreas: session.focusAreas,
            turns: [...session.turns, completedTurn],
          }),
        )
      : null;

    return noStoreJson(
      await commitTurnRequest(principal, {
        requestId,
        idempotencyKey,
        session,
        answer: input.answer,
        result,
        report,
      }),
    );
  } catch (error) {
    if (principal && requestId) {
      await abortTurnRequest(principal, requestId).catch(() => undefined);
    }
    return apiError(error);
  }
}
