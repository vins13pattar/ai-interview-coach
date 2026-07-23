import {
  deleteInterviewSession,
  getInterviewSession,
} from "@interview-coach/database";
import { z } from "zod";

import { getOrCreatePrincipal } from "@/lib/server/auth";
import {
  apiError,
  assertMutationRequest,
  noStoreJson,
} from "@/lib/server/http";

export const runtime = "nodejs";

const SessionIdSchema = z.uuid();

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const sessionId = SessionIdSchema.parse((await context.params).id);
    const principal = await getOrCreatePrincipal();
    const session = await getInterviewSession(principal, sessionId);
    return session
      ? noStoreJson(session)
      : noStoreJson({ error: "Interview session not found." }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertMutationRequest(request);
    const sessionId = SessionIdSchema.parse((await context.params).id);
    const principal = await getOrCreatePrincipal();
    const deleted = await deleteInterviewSession(principal, sessionId);
    return deleted
      ? new Response(null, { status: 204 })
      : noStoreJson({ error: "Interview session not found." }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
