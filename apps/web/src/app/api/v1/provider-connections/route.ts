import {
  ProviderConnectionInputSchema,
  ProviderSchema,
} from "@interview-coach/contracts";
import {
  deleteProviderConnection,
  listProviderConnections,
  providerEncryptionConfigured,
  upsertProviderConnection,
} from "@interview-coach/database";

import {
  getOrCreatePrincipal,
  getPrincipal,
  requirePrincipal,
} from "@/lib/server/auth";
import {
  apiError,
  assertMutationRequest,
  HttpError,
  noStoreJson,
} from "@/lib/server/http";

export const runtime = "nodejs";

function assertEncryptionAvailable(): void {
  if (!providerEncryptionConfigured()) {
    throw new HttpError(
      503,
      "Encrypted provider connections are not configured on this deployment.",
    );
  }
}

export async function GET() {
  try {
    const principal = await getPrincipal();
    return noStoreJson({
      available: providerEncryptionConfigured(),
      connections: principal ? await listProviderConnections(principal) : [],
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertMutationRequest(request);
    assertEncryptionAvailable();
    const input = ProviderConnectionInputSchema.parse(await request.json());
    const principal = await getOrCreatePrincipal();
    return noStoreJson(await upsertProviderConnection(principal, input));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertMutationRequest(request);
    assertEncryptionAvailable();
    const provider = ProviderSchema.extract(["openai"]).parse(
      new URL(request.url).searchParams.get("provider"),
    );
    const principal = await requirePrincipal();
    const deleted = await deleteProviderConnection(principal, provider);
    return deleted
      ? new Response(null, { status: 204 })
      : noStoreJson(
          { error: "Provider connection not found." },
          { status: 404 },
        );
  } catch (error) {
    return apiError(error);
  }
}
