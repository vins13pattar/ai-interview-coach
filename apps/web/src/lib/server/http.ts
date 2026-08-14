import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const MAX_REPORT_BODY_BYTES = 1_048_576;

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

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new HttpError(413, "Request body is too large.");
    }
  }

  if (!request.body) {
    throw new HttpError(400, "A JSON request body is required.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new HttpError(400, "Request body must be valid UTF-8 JSON.");
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
      AUTHENTICATION_REQUIRED: [
        401,
        "An active interview session is required.",
      ],
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
      VOICE_PROVIDER_NOT_SUPPORTED: [
        409,
        "Live voice is currently available only for OpenAI interview sessions.",
      ],
      VOICE_TOKEN_RATE_LIMITED: [
        429,
        "Too many live voice connection attempts. Wait a minute and retry.",
      ],
      REQUEST_RATE_LIMITED: [
        429,
        "Too many requests. Wait a minute and try again.",
      ],
      DAILY_BUDGET_EXCEEDED: [
        429,
        "The daily hosted-alpha usage limit has been reached.",
      ],
      AUTH_RATE_LIMITED: [
        429,
        "Too many recovery attempts. Wait a minute and try again.",
      ],
      INVALID_RECOVERY_CREDENTIALS: [
        401,
        "The account handle or recovery code is invalid.",
      ],
      ACCOUNT_ALREADY_REGISTERED: [
        409,
        "This workspace is already registered.",
      ],
      REGISTERED_ACCOUNT_REQUIRED: [
        409,
        "A registered account is required for this action.",
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
