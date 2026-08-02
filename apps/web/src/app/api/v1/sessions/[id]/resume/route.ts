import { setInterviewSessionStatus } from "@interview-coach/database";
import { z } from "zod";

import { requirePrincipal } from "@/lib/server/auth";
import {
  apiError,
  assertMutationRequest,
  noStoreJson,
} from "@/lib/server/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertMutationRequest(request);
    const sessionId = z.uuid().parse((await context.params).id);
    const principal = await requirePrincipal();
    const session = await setInterviewSessionStatus(
      principal,
      sessionId,
      "active",
    );
    return session
      ? noStoreJson(session)
      : noStoreJson({ error: "Interview session not found." }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
