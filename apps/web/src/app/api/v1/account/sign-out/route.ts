import { deleteAuthSession } from "@interview-coach/database";

import { clearSessionCookie, requirePrincipal } from "@/lib/server/auth";
import { apiError, assertMutationRequest } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertMutationRequest(request);
    const principal = await requirePrincipal();
    await deleteAuthSession(principal);
    await clearSessionCookie();
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
