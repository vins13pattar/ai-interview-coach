CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('guest', 'registered')),
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx
  ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS interview_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
  role text NOT NULL,
  seniority text NOT NULL,
  focus_areas jsonb NOT NULL,
  provider text NOT NULL CHECK (provider IN ('demo', 'openai')),
  current_difficulty text NOT NULL
    CHECK (current_difficulty IN ('foundation', 'intermediate', 'advanced', 'expert')),
  current_question text NOT NULL,
  turn_count integer NOT NULL DEFAULT 0 CHECK (turn_count BETWEEN 0 AND 30),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS interview_sessions_owner_idx
  ON interview_sessions (tenant_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS interview_turns (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  turn_number integer NOT NULL CHECK (turn_number BETWEEN 1 AND 30),
  idempotency_key uuid NOT NULL,
  question_id text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  difficulty text NOT NULL
    CHECK (difficulty IN ('foundation', 'intermediate', 'advanced', 'expert')),
  evaluation jsonb NOT NULL,
  next_difficulty text NOT NULL
    CHECK (next_difficulty IN ('foundation', 'intermediate', 'advanced', 'expert')),
  next_question text NOT NULL,
  coach_note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, turn_number),
  UNIQUE (session_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS interview_turns_owner_idx
  ON interview_turns (tenant_id, user_id, session_id, turn_number);

CREATE TABLE IF NOT EXISTS turn_requests (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  expected_turn integer NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (session_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS turn_requests_one_inflight_idx
  ON turn_requests (session_id)
  WHERE response IS NULL;

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL UNIQUE REFERENCES interview_sessions(id) ON DELETE CASCADE,
  report jsonb NOT NULL,
  rubric_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES interview_sessions(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  granted boolean NOT NULL,
  policy_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_connections (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  encrypted_secret text NOT NULL,
  key_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, provider)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  subject_id uuid,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_owner_idx
  ON audit_events (tenant_id, user_id, created_at DESC);
