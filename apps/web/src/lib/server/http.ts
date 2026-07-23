import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function assertMutationRequest(request: Request): void {
  if (request.headers.get("x-interview-coach-client") !== "web") {
    throw new HttpError(403, "Missing required client request header.");
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  const configuredOrigin = process.env.APP_ORIGIN;
  const requestOrigin = new URL(request.url).origin;
  const allowedOrigins = new Set(
    [configuredOrigin, requestOrigin].filter((value): value is string =>
      Boolean(value),
    ),
  );
  if (!allowedOrigins.has(origin)) {
    throw new HttpError(403, "Cross-origin mutation request rejected.");
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message },
      {
        status: error.status,
        headers: { "cache-control": "no-store" },
      },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request.", issues: error.issues },
      {
        status: 422,
        headers: { "cache-control": "no-store" },
      },
    );
  }
  if (error instanceof Error) {
    const knownErrors: Record<string, [number, string]> = {
      SESSION_NOT_FOUND: [404, "Interview session not found."],
      SESSION_NOT_ACTIVE: [409, "Interview session is not active."],
      SESSION_VERSION_CONFLICT: [
        409,
        "The session changed while this turn was being evaluated. Reload and retry.",
      ],
      TURN_IN_PROGRESS: [
        409,
        "Another turn is already being evaluated for this session.",
      ],
      PROVIDER_ENCRYPTION_NOT_CONFIGURED: [
        503,
        "Encrypted provider connections are not configured.",
      ],
      PROVIDER_ENCRYPTION_KEY_INVALID: [
        503,
        "The provider encryption key is invalid.",
      ],
    };
    const known = knownErrors[error.message];
    if (known) {
      return NextResponse.json(
        { error: known[1] },
        {
          status: known[0],
          headers: { "cache-control": "no-store" },
        },
      );
    }
  }

  console.error("API request failed", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  return NextResponse.json(
    { error: "The request could not be completed." },
    {
      status: 500,
      headers: { "cache-control": "no-store" },
    },
  );
}

export function noStoreJson(
  body: unknown,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: { "cache-control": "no-store" },
  });
}
