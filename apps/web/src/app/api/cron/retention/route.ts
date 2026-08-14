import { timingSafeEqual } from "node:crypto";

import { runRetentionBatch } from "@interview-coach/database";

import { noStoreJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const maxDuration = 30;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }
  const result = await runRetentionBatch();
  return noStoreJson({ ok: true, deleted: result });
}
