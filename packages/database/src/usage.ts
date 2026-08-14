import type { PoolClient } from "pg";

export type UsagePrincipal = {
  tenantId: string;
  userId: string;
  userKind: "guest" | "registered";
};

export type UsageAction = "session" | "turn";

type Budget = {
  minute: number;
  day: number;
};

function positiveInteger(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function budgetFor(principal: UsagePrincipal, action: UsageAction): Budget {
  const prefix = principal.userKind === "registered" ? "REGISTERED" : "GUEST";
  const actionName = action.toUpperCase();
  const fallback =
    principal.userKind === "registered"
      ? action === "session"
        ? { minute: 5, day: 25 }
        : { minute: 20, day: 500 }
      : action === "session"
        ? { minute: 3, day: 5 }
        : { minute: 12, day: 75 };

  return {
    minute: positiveInteger(
      `${prefix}_${actionName}_LIMIT_PER_MINUTE`,
      fallback.minute,
    ),
    day: positiveInteger(`${prefix}_${actionName}_LIMIT_PER_DAY`, fallback.day),
  };
}

async function incrementBucket(
  client: PoolClient,
  principal: UsagePrincipal,
  action: UsageAction,
  bucket: "minute" | "day",
  limit: number,
): Promise<void> {
  const result = await client.query(
    `INSERT INTO usage_counters
      (tenant_id, user_id, action, bucket, bucket_start, count, expires_at)
     VALUES (
       $1,
       $2,
       $3,
       $4,
       date_trunc($4, now()),
       1,
       date_trunc($4, now()) +
         CASE WHEN $4 = 'minute' THEN interval '2 hours' ELSE interval '2 days' END
     )
     ON CONFLICT (tenant_id, user_id, action, bucket, bucket_start)
     DO UPDATE SET count = usage_counters.count + 1
       WHERE usage_counters.count < $5
     RETURNING count`,
    [principal.tenantId, principal.userId, action, bucket, limit],
  );
  if (result.rowCount === 0) {
    throw new Error(
      bucket === "minute" ? "REQUEST_RATE_LIMITED" : "DAILY_BUDGET_EXCEEDED",
    );
  }
}

export async function consumeUsageBudget(
  client: PoolClient,
  principal: UsagePrincipal,
  action: UsageAction,
): Promise<void> {
  const budget = budgetFor(principal, action);
  await incrementBucket(client, principal, action, "minute", budget.minute);
  await incrementBucket(client, principal, action, "day", budget.day);
}
