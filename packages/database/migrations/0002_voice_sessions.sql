CREATE TABLE IF NOT EXISTS voice_token_grants (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider = 'openai'),
  status text NOT NULL CHECK (status IN ('pending', 'issued', 'failed')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_token_grants_rate_limit_idx
  ON voice_token_grants (tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS consent_events_session_idx
  ON consent_events (tenant_id, user_id, session_id, created_at DESC);
