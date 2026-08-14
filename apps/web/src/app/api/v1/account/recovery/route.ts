import {
  AccountRecoveryRotationRequestSchema,
  RecoveryKitSchema,
} from "@interview-coach/contracts";
import {
  getAccountProfile,
  rotateRecoveryCode,
} from "@interview-coach/database";

import { requirePrincipal } from "@/lib/server/auth";
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
    AccountRecoveryRotationRequestSchema.parse(
      await readJsonBody(request, 1_024),
    );
    const principal = await requirePrincipal();
    const recoveryCode = await rotateRecoveryCode(principal);
    const profile = await getAccountProfile(principal);
    return noStoreJson(RecoveryKitSchema.parse({ profile, recoveryCode }));
  } catch (error) {
    return apiError(error);
  }
}
