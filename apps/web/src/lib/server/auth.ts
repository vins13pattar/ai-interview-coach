import "server-only";

import { createHash, randomBytes } from "node:crypto";

import {
  createGuestPrincipal,
  findPrincipalByTokenHash,
  type AuthenticatedPrincipal,
} from "@interview-coach/database";
import { cookies } from "next/headers";

const sessionCookieName = "interview_coach_session";
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1_000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function secureCookiesEnabled(): boolean {
  if (process.env.SESSION_COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export async function getOrCreatePrincipal(): Promise<AuthenticatedPrincipal> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(sessionCookieName)?.value;
  if (existingToken) {
    const principal = await findPrincipalByTokenHash(hashToken(existingToken));
    if (principal) return principal;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  const principal = await createGuestPrincipal(hashToken(token), expiresAt);
  cookieStore.set(sessionCookieName, token, {
    expires: expiresAt,
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookiesEnabled(),
    path: "/",
    priority: "high",
  });
  return principal;
}

export async function getPrincipal(): Promise<AuthenticatedPrincipal | null> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(sessionCookieName)?.value;
  if (!existingToken) return null;
  return findPrincipalByTokenHash(hashToken(existingToken));
}

export async function requirePrincipal(): Promise<AuthenticatedPrincipal> {
  const principal = await getPrincipal();
  if (!principal) throw new Error("AUTHENTICATION_REQUIRED");
  return principal;
}
