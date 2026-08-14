import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

import type { QueryResultRow } from "pg";

import { getPool } from "./pool";
import type { AuthenticatedPrincipal } from "./repository";

const recoveryCodePattern = /^aicr_[A-Za-z0-9_-]{32}$/;

export type AccountProfile = {
  kind: "guest" | "registered";
  displayName: string;
  accountHandle: string | null;
};

export type RecoveryKit = {
  profile: AccountProfile;
  recoveryCode: string;
  principal: AuthenticatedPrincipal;
};

function generateRecoveryCode(): string {
  return `aicr_${randomBytes(24).toString("base64url")}`;
}

function generateAccountHandle(): string {
  return `aic_${randomBytes(8).toString("hex")}`;
}

async function hashRecoveryCode(
  recoveryCode: string,
  salt = randomBytes(16).toString("base64url"),
): Promise<{ hash: string; salt: string }> {
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      recoveryCode,
      salt,
      32,
      {
        N: 32_768,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024,
      },
      (error, value) => (error ? reject(error) : resolve(value)),
    );
  });
  return { hash: derived.toString("base64url"), salt };
}

async function verifyRecoveryCode(
  recoveryCode: string,
  expectedHash: string,
  salt: string,
): Promise<boolean> {
  if (!recoveryCodePattern.test(recoveryCode)) return false;
  const actual = Buffer.from(
    (await hashRecoveryCode(recoveryCode, salt)).hash,
    "base64url",
  );
  const expected = Buffer.from(expectedHash, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function profileFromRow(row: {
  kind: "guest" | "registered";
  display_name: string;
  account_handle: string | null;
}): AccountProfile {
  return {
    kind: row.kind,
    displayName: row.display_name,
    accountHandle: row.account_handle,
  };
}

export async function getAccountProfile(
  principal: AuthenticatedPrincipal,
): Promise<AccountProfile> {
  const result = await getPool().query<
    QueryResultRow & {
      kind: "guest" | "registered";
      display_name: string;
      account_handle: string | null;
    }
  >(
    `SELECT users.kind, users.display_name, account_credentials.account_handle
       FROM users
       LEFT JOIN account_credentials
         ON account_credentials.user_id = users.id
      WHERE users.id = $1 AND users.tenant_id = $2`,
    [principal.userId, principal.tenantId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("AUTHENTICATION_REQUIRED");
  return profileFromRow(row);
}

export async function registerAccount(
  principal: AuthenticatedPrincipal,
  displayName: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<RecoveryKit> {
  const recoveryCode = generateRecoveryCode();
  const accountHandle = generateAccountHandle();
  const recovery = await hashRecoveryCode(recoveryCode);
  const authSessionId = randomUUID();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<
      QueryResultRow & { kind: "guest" | "registered" }
    >(
      `SELECT kind FROM users
        WHERE id = $1 AND tenant_id = $2
        FOR UPDATE`,
      [principal.userId, principal.tenantId],
    );
    if (!user.rows[0]) throw new Error("AUTHENTICATION_REQUIRED");
    if (user.rows[0].kind === "registered") {
      throw new Error("ACCOUNT_ALREADY_REGISTERED");
    }

    await client.query(
      `UPDATE users
          SET kind = 'registered', display_name = $1
        WHERE id = $2 AND tenant_id = $3`,
      [displayName, principal.userId, principal.tenantId],
    );
    await client.query(
      `INSERT INTO account_credentials
        (user_id, tenant_id, account_handle, recovery_secret_hash,
         recovery_secret_salt, recovery_secret_version)
       VALUES ($1, $2, $3, $4, $5, 'scrypt-v1')`,
      [
        principal.userId,
        principal.tenantId,
        accountHandle,
        recovery.hash,
        recovery.salt,
      ],
    );
    await client.query(
      "DELETE FROM auth_sessions WHERE tenant_id = $1 AND user_id = $2",
      [principal.tenantId, principal.userId],
    );
    await client.query(
      `INSERT INTO auth_sessions
        (id, tenant_id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        authSessionId,
        principal.tenantId,
        principal.userId,
        tokenHash,
        expiresAt,
      ],
    );
    await client.query(
      `INSERT INTO audit_events
        (id, tenant_id, user_id, subject_id, event_type, metadata)
       VALUES ($1, $2, $3, $3, 'account.registered', '{}')`,
      [randomUUID(), principal.tenantId, principal.userId],
    );
    await client.query("COMMIT");
    return {
      profile: {
        kind: "registered",
        displayName,
        accountHandle,
      },
      recoveryCode,
      principal: {
        authSessionId,
        tenantId: principal.tenantId,
        userId: principal.userId,
        userKind: "registered",
        expiresAt,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function consumeSignInAttempt(accountHandle: string): Promise<void> {
  const keyHash = createHash("sha256").update(accountHandle).digest("hex");
  const result = await getPool().query(
    `INSERT INTO auth_attempt_counters
      (key_hash, bucket_start, count, expires_at)
     VALUES ($1, date_trunc('minute', now()), 1, now() + interval '2 hours')
     ON CONFLICT (key_hash, bucket_start)
     DO UPDATE SET count = auth_attempt_counters.count + 1
       WHERE auth_attempt_counters.count < 5
     RETURNING count`,
    [keyHash],
  );
  if (result.rowCount === 0) throw new Error("AUTH_RATE_LIMITED");
}

export async function signInWithRecovery(
  accountHandle: string,
  recoveryCode: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<AuthenticatedPrincipal> {
  await consumeSignInAttempt(accountHandle);
  const result = await getPool().query<
    QueryResultRow & {
      tenant_id: string;
      user_id: string;
      recovery_secret_hash: string;
      recovery_secret_salt: string;
    }
  >(
    `SELECT tenant_id, user_id, recovery_secret_hash, recovery_secret_salt
       FROM account_credentials
      WHERE account_handle = $1`,
    [accountHandle],
  );
  const credential = result.rows[0];
  if (
    !credential ||
    !(await verifyRecoveryCode(
      recoveryCode,
      credential.recovery_secret_hash,
      credential.recovery_secret_salt,
    ))
  ) {
    if (!credential && recoveryCodePattern.test(recoveryCode)) {
      await hashRecoveryCode(recoveryCode, "invalid-account-handle");
    }
    throw new Error("INVALID_RECOVERY_CREDENTIALS");
  }

  const authSessionId = randomUUID();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO auth_sessions
        (id, tenant_id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        authSessionId,
        credential.tenant_id,
        credential.user_id,
        tokenHash,
        expiresAt,
      ],
    );
    await client.query(
      `INSERT INTO audit_events
        (id, tenant_id, user_id, subject_id, event_type, metadata)
       VALUES ($1, $2, $3, $3, 'account.signed_in', '{}')`,
      [randomUUID(), credential.tenant_id, credential.user_id],
    );
    await client.query("COMMIT");
    return {
      authSessionId,
      tenantId: credential.tenant_id,
      userId: credential.user_id,
      userKind: "registered",
      expiresAt,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function rotateRecoveryCode(
  principal: AuthenticatedPrincipal,
): Promise<string> {
  if (principal.userKind !== "registered") {
    throw new Error("REGISTERED_ACCOUNT_REQUIRED");
  }
  const recoveryCode = generateRecoveryCode();
  const recovery = await hashRecoveryCode(recoveryCode);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE account_credentials
          SET recovery_secret_hash = $1,
              recovery_secret_salt = $2,
              rotated_at = now()
        WHERE tenant_id = $3 AND user_id = $4`,
      [recovery.hash, recovery.salt, principal.tenantId, principal.userId],
    );
    if (updated.rowCount === 0) throw new Error("REGISTERED_ACCOUNT_REQUIRED");
    await client.query(
      `INSERT INTO audit_events
        (id, tenant_id, user_id, subject_id, event_type, metadata)
       VALUES ($1, $2, $3, $3, 'account.recovery_rotated', '{}')`,
      [randomUUID(), principal.tenantId, principal.userId],
    );
    await client.query("COMMIT");
    return recoveryCode;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRegisteredAccount(
  principal: AuthenticatedPrincipal,
  recoveryCode: string,
): Promise<boolean> {
  if (principal.userKind !== "registered") {
    throw new Error("REGISTERED_ACCOUNT_REQUIRED");
  }
  const credential = await getPool().query<
    QueryResultRow & {
      recovery_secret_hash: string;
      recovery_secret_salt: string;
    }
  >(
    `SELECT recovery_secret_hash, recovery_secret_salt
       FROM account_credentials
      WHERE tenant_id = $1 AND user_id = $2`,
    [principal.tenantId, principal.userId],
  );
  const row = credential.rows[0];
  if (
    !row ||
    !(await verifyRecoveryCode(
      recoveryCode,
      row.recovery_secret_hash,
      row.recovery_secret_salt,
    ))
  ) {
    throw new Error("INVALID_RECOVERY_CREDENTIALS");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sessions = await client.query<{ id: string }>(
      "SELECT id FROM interview_sessions WHERE tenant_id = $1 AND user_id = $2 FOR UPDATE",
      [principal.tenantId, principal.userId],
    );
    const sessionIds = sessions.rows.map(({ id }) => id);
    if (sessionIds.length > 0) {
      await client.query(
        "DELETE FROM checkpoint_writes WHERE thread_id = ANY($1::text[])",
        [sessionIds],
      );
      await client.query(
        "DELETE FROM checkpoint_blobs WHERE thread_id = ANY($1::text[])",
        [sessionIds],
      );
      await client.query(
        "DELETE FROM checkpoints WHERE thread_id = ANY($1::text[])",
        [sessionIds],
      );
    }
    const deleted = await client.query("DELETE FROM tenants WHERE id = $1", [
      principal.tenantId,
    ]);
    await client.query("COMMIT");
    return deleted.rowCount !== 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteAuthSession(
  principal: AuthenticatedPrincipal,
): Promise<void> {
  await getPool().query(
    `DELETE FROM auth_sessions
      WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
    [principal.authSessionId, principal.tenantId, principal.userId],
  );
}
