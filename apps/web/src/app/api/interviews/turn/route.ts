import { InterviewTurnSchema } from "@interview-coach/contracts";
import { databaseConfigured } from "@interview-coach/database";
import { runInterviewTurn } from "@interview-coach/interview-engine";

import {
  apiError,
  assertMutationRequest,
  HttpError,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertMutationRequest(request);
    if (databaseConfigured()) {
      throw new HttpError(410, "Use the durable interview session API.");
    }
    const payload = InterviewTurnSchema.parse(
      await readJsonBody(request, 32_768),
    );
    const requestKey = request.headers.get("x-provider-api-key") ?? undefined;
    const apiKey = requestKey;

    if (payload.provider !== "demo" && !apiKey) {
      return noStoreJson(
        {
          error:
            "No provider key was supplied. Add a key in this browser tab or use demo mode.",
        },
        { status: 400 },
      );
    }

    const result = await runInterviewTurn(payload, apiKey);
    return noStoreJson(result);
  } catch (error) {
    return apiError(error);
  }
}
