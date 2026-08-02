import { DictationConsentRequestSchema } from "@interview-coach/contracts";
import { recordDictationConsent } from "@interview-coach/database";
import { z } from "zod";

import { requirePrincipal } from "@/lib/server/auth";
import {
  apiError,
  assertMutationRequest,
  noStoreJson,
} from "@/lib/server/http";

export const runtime = "nodejs";

const SessionIdSchema = z.uuid();
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertMutationRequest(request);
    const sessionId = SessionIdSchema.parse((await context.params).id);
    const consent = DictationConsentRequestSchema.parse(await request.json());
    const principal = await requirePrincipal();
    await recordDictationConsent(principal, sessionId, consent);
    return noStoreJson({ recorded: true });
  } catch (error) {
    return apiError(error);
  }
}
