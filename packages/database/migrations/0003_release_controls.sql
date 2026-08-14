CREATE TABLE IF NOT EXISTS usage_counters (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('session', 'turn')),
  bucket text NOT NULL CHECK (bucket IN ('minute', 'day')),
  bucket_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, user_id, action, bucket, bucket_start)
);

CREATE INDEX IF NOT EXISTS usage_counters_expiry_idx
  ON usage_counters (expires_at);

CREATE TABLE IF NOT EXISTS account_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_handle text NOT NULL UNIQUE
    CHECK (account_handle ~ '^aic_[a-z0-9]{16}$'),
  recovery_secret_hash text NOT NULL,
  recovery_secret_salt text NOT NULL,
  recovery_secret_version text NOT NULL
    CHECK (recovery_secret_version = 'scrypt-v1'),
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS auth_attempt_counters (
  key_hash text NOT NULL,
  bucket_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key_hash, bucket_start)
);

CREATE INDEX IF NOT EXISTS auth_attempt_counters_expiry_idx
  ON auth_attempt_counters (expires_at);

CREATE INDEX IF NOT EXISTS interview_sessions_retention_idx
  ON interview_sessions (updated_at, id);

CREATE INDEX IF NOT EXISTS audit_events_retention_idx
  ON audit_events (created_at, id);
