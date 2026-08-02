import { createHash } from "node:crypto";

import {
  VoiceClientSecretSchema,
  VoiceConsentRequestSchema,
} from "@interview-coach/contracts";
import {
  beginVoiceTokenGrant,
  completeVoiceTokenGrant,
  failVoiceTokenGrant,
  getProviderApiKey,
} from "@interview-coach/database";
import {
  buildOpenAiRealtimeSessionRequest,
  parseOpenAiClientSecretResponse,
} from "@interview-coach/voice";
import { z } from "zod";

import { requirePrincipal } from "@/lib/server/auth";
import {
  apiError,
  assertMutationRequest,
  HttpError,
  noStoreJson,
} from "@/lib/server/http";

export const runtime = "nodejs";

const ProviderKeySchema = z.string().min(20).max(500);
const realtimeClientSecretUrl =
  "https://api.openai.com/v1/realtime/client_secrets";

function privacyPreservingSafetyIdentifier(userId: string): string {
  return createHash("sha256")
    .update(`interview-coach-voice-v1:${userId}`)
    .digest("hex");
}

export async function POST(request: Request) {
  let grantId = "";
  let principal: Awaited<ReturnType<typeof requirePrincipal>> | null = null;

  try {
    assertMutationRequest(request);
    const consent = VoiceConsentRequestSchema.parse(await request.json());
    principal = await requirePrincipal();
    const pending = await beginVoiceTokenGrant(principal, consent);
    grantId = pending.grantId;

    const requestKeyHeader = request.headers.get("x-provider-api-key");
    const requestKey = requestKeyHeader
      ? ProviderKeySchema.parse(requestKeyHeader)
      : undefined;
    const storedKey = !requestKey
      ? await getProviderApiKey(principal, "openai")
      : undefined;
    const apiKey = requestKey ?? storedKey ?? undefined;
    if (!apiKey) {
      throw new HttpError(
        400,
        "No provider key was supplied. Add a tab-scoped key or save an encrypted connection.",
      );
    }

    const model = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1";
    const voice = process.env.OPENAI_REALTIME_VOICE ?? "marin";
    const response = await fetch(realtimeClientSecretUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "OpenAI-Safety-Identifier": privacyPreservingSafetyIdentifier(
          principal.userId,
        ),
      },
      body: JSON.stringify(
        buildOpenAiRealtimeSessionRequest({
          model,
          voice,
          role: pending.session.role,
          seniority: pending.session.seniority,
          focusAreas: pending.session.focusAreas,
        }),
      ),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new HttpError(
        502,
        "The voice provider could not create a temporary connection. Check the key and retry.",
      );
    }

    const secret = parseOpenAiClientSecretResponse(await response.json());
    await completeVoiceTokenGrant(
      principal,
      grantId,
      new Date(secret.expiresAt * 1_000),
    );
    return noStoreJson(
      VoiceClientSecretSchema.parse({
        ...secret,
        model,
        voice,
        rawAudioRetained: false,
        acousticPronunciationAssessed: false,
      }),
    );
  } catch (error) {
    if (principal && grantId) {
      await failVoiceTokenGrant(principal, grantId).catch(() => undefined);
    }
    return apiError(error);
  }
}
