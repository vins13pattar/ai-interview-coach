import { CreateSessionRequestSchema } from "@interview-coach/contracts";
import {
  createInterviewSession,
  databaseConfigured,
  listInterviewSessions,
} from "@interview-coach/database";
import { openingQuestion } from "@interview-coach/interview-engine";

import { getOrCreatePrincipal } from "@/lib/server/auth";
import {
  apiError,
  assertMutationRequest,
  noStoreJson,
} from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  if (!databaseConfigured()) {
    return noStoreJson(
      { error: "Durable sessions are not configured." },
      { status: 503 },
    );
  }
  try {
    const principal = await getOrCreatePrincipal();
    return noStoreJson({
      sessions: await listInterviewSessions(principal),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if (!databaseConfigured()) {
    return noStoreJson(
      { error: "Durable sessions are not configured." },
      { status: 503 },
    );
  }
  try {
    assertMutationRequest(request);
    const input = CreateSessionRequestSchema.parse(await request.json());
    const principal = await getOrCreatePrincipal();
    const question = openingQuestion(
      input.role,
      input.focusAreas[0] ?? "system design",
      input.seniority,
    );
    return noStoreJson(
      await createInterviewSession(principal, input, question),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
