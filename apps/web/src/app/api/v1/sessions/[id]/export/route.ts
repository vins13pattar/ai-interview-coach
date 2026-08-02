import { SessionExportSchema } from "@interview-coach/contracts";
import { getInterviewSession } from "@interview-coach/database";
import { z } from "zod";

import { requirePrincipal } from "@/lib/server/auth";
import { apiError, noStoreJson } from "@/lib/server/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const sessionId = z.uuid().parse((await context.params).id);
    const principal = await requirePrincipal();
    const session = await getInterviewSession(principal, sessionId);
    if (!session) {
      return noStoreJson(
        { error: "Interview session not found." },
        { status: 404 },
      );
    }
    const body = SessionExportSchema.parse({
      exportedAt: new Date().toISOString(),
      session,
      dataPolicy: {
        rawAudioRetained: false,
        providerKeyRetained: false,
      },
    });
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="interview-${session.id}.json"`,
        "content-type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
