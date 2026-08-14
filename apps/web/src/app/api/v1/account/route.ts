import {
  AccountDeletionRequestSchema,
  AccountRegistrationRequestSchema,
  RecoveryKitSchema,
} from "@interview-coach/contracts";
import {
  deleteRegisteredAccount,
  getAccountProfile,
  registerAccount,
} from "@interview-coach/database";

import {
  clearSessionCookie,
  createSessionCredentials,
  getOrCreatePrincipal,
  getPrincipal,
  requirePrincipal,
  setSessionCookie,
} from "@/lib/server/auth";
import {
  apiError,
  assertMutationRequest,
  noStoreJson,
  readJsonBody,
} from "@/lib/server/http";

export const runtime = "nodejs";

const accountBodyLimit = 2_048;

export async function GET() {
  try {
    const principal = await getPrincipal();
    return noStoreJson({
      profile: principal
        ? await getAccountProfile(principal)
        : {
            kind: "guest" as const,
            displayName: "Guest candidate",
            accountHandle: null,
          },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertMutationRequest(request);
    const input = AccountRegistrationRequestSchema.parse(
      await readJsonBody(request, accountBodyLimit),
    );
    const principal = await getOrCreatePrincipal();
    const credentials = createSessionCredentials("registered");
    const kit = await registerAccount(
      principal,
      input.displayName,
      credentials.tokenHash,
      credentials.expiresAt,
    );
    await setSessionCookie(credentials.token, credentials.expiresAt);
    return noStoreJson(RecoveryKitSchema.parse(kit), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertMutationRequest(request);
    const input = AccountDeletionRequestSchema.parse(
      await readJsonBody(request, accountBodyLimit),
    );
    const principal = await requirePrincipal();
    await deleteRegisteredAccount(principal, input.recoveryCode);
    await clearSessionCookie();
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
