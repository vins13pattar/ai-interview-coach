import "server-only";

import { createHash, randomBytes } from "node:crypto";

import {
  createGuestPrincipal,
  findPrincipalByTokenHash,
  type AuthenticatedPrincipal,
} from "@interview-coach/database";
import { cookies } from "next/headers";

const sessionCookieName = "interview_coach_session";
const dayMs = 24 * 60 * 60 * 1_000;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionCredentials(userKind: "guest" | "registered"): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const lifetimeDays = userKind === "registered" ? 90 : 30;
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + lifetimeDays * dayMs),
  };
}

function secureCookiesEnabled(): boolean {
  if (process.env.SESSION_COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export async function getOrCreatePrincipal(): Promise<AuthenticatedPrincipal> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(sessionCookieName)?.value;
  if (existingToken) {
    const principal = await findPrincipalByTokenHash(
      hashSessionToken(existingToken),
    );
    if (principal) return principal;
  }

  const credentials = createSessionCredentials("guest");
  const principal = await createGuestPrincipal(
    credentials.tokenHash,
    credentials.expiresAt,
  );
  await setSessionCookie(credentials.token, credentials.expiresAt);
  return principal;
}

export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    expires: expiresAt,
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled(),
    path: "/",
    priority: "high",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, "", {
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled(),
    path: "/",
  });
}

export async function getPrincipal(): Promise<AuthenticatedPrincipal | null> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(sessionCookieName)?.value;
  if (!existingToken) return null;
  return findPrincipalByTokenHash(hashSessionToken(existingToken));
}

export async function requirePrincipal(): Promise<AuthenticatedPrincipal> {
  const principal = await getPrincipal();
  if (!principal) throw new Error("AUTHENTICATION_REQUIRED");
  return principal;
}
