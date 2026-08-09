import { databaseConfigured, getPool } from "@interview-coach/database";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = databaseConfigured();
  if (database) {
    try {
      await getPool().query("SELECT 1");
    } catch {
      return NextResponse.json(
        {
          status: "degraded",
          service: "interview-coach-web",
          database: "unavailable",
        },
        {
          status: 503,
          headers: { "cache-control": "no-store" },
        },
      );
    }
  }
  return NextResponse.json(
    {
      status: "ok",
      service: "interview-coach-web",
      database: database ? "connected" : "not-configured",
      version:
        process.env.APP_VERSION ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        "development",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
