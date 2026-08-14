import { AccountRecoverySignInRequestSchema } from "@interview-coach/contracts";
import { signInWithRecovery } from "@interview-coach/database";

import { createSessionCredentials, setSessionCookie } from "@/lib/server/auth";
import {
  apiError,
  assertMutationRequest,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertMutationRequest(request);
    const input = AccountRecoverySignInRequestSchema.parse(
      await readJsonBody(request, 2_048),
    );
    const credentials = createSessionCredentials("registered");
    await signInWithRecovery(
      input.accountHandle,
      input.recoveryCode,
      credentials.tokenHash,
      credentials.expiresAt,
    );
    await setSessionCookie(credentials.token, credentials.expiresAt);
    return noStoreJson({ signedIn: true });
  } catch (error) {
    return apiError(error);
  }
}
