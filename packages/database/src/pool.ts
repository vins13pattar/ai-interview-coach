import { Pool } from "pg";

declare global {
  var interviewCoachPool: Pool | undefined;
}

export function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is required for durable sessions.");
  }
  return value;
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (!globalThis.interviewCoachPool) {
    globalThis.interviewCoachPool = new Pool({
      connectionString: databaseUrl(),
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: "ai-interview-coach",
    });
    globalThis.interviewCoachPool.on("error", (error) => {
      console.error("Unexpected PostgreSQL pool error", {
        name: error.name,
      });
    });
  }
  return globalThis.interviewCoachPool;
}
