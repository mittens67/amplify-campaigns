-- Campaign Amplification schema. Idempotent: safe to run on every boot.
-- Principals are identified by an owner key: 'u:<user id>' for accounts, 'g:<guest id>' for guests.

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'reviewer')),
  show_name_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY,
  creator_key text NOT NULL,
  creator_user_id uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'draft',
  draft_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_content jsonb,
  version int NOT NULL DEFAULT 1,
  current_step text NOT NULL DEFAULT 'basics',
  goal_cents int NOT NULL DEFAULT 0,
  raised_cents int NOT NULL DEFAULT 0,
  backer_count int NOT NULL DEFAULT 0,
  reach_model_version int NOT NULL DEFAULT 1,
  reviewer_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_message text,
  ad_setup_confirmed boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  published_at timestamptz,
  funding_ends_at timestamptz,
  launched_at timestamptz,
  completed_at timestamptz,
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status);
CREATE INDEX IF NOT EXISTS campaigns_creator_idx ON campaigns (creator_key);

-- Audit log of every lifecycle transition and significant change.
CREATE TABLE IF NOT EXISTS campaign_events (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  event text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor_key text,
  actor_role text NOT NULL,
  note text,
  at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS campaign_events_campaign_idx ON campaign_events (campaign_id, at);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  round int NOT NULL,
  layer text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('pass', 'concern', 'fail')),
  notes text NOT NULL DEFAULT '',
  reviewer_id uuid REFERENCES users(id),
  at timestamptz NOT NULL,
  UNIQUE (campaign_id, round, layer)
);

CREATE TABLE IF NOT EXISTS contributions (
  id uuid PRIMARY KEY,
  receipt_no text NOT NULL UNIQUE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  owner_key text NOT NULL,
  user_id uuid REFERENCES users(id),
  email text,
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  platform_fee_cents int NOT NULL,
  ad_budget_cents int NOT NULL,
  processing_cents int NOT NULL,
  total_cents int NOT NULL,
  refund_cents int NOT NULL DEFAULT 0,
  est_reach int NOT NULL,
  status text NOT NULL,
  failure_reason text,
  public_name text,
  idempotency_key text NOT NULL,
  provider_ref text,
  pending_outcome text,
  settle_at timestamptz,
  created_at timestamptz NOT NULL,
  settled_at timestamptz,
  UNIQUE (owner_key, idempotency_key)
);
CREATE INDEX IF NOT EXISTS contributions_campaign_idx ON contributions (campaign_id, status);
CREATE INDEX IF NOT EXISTS contributions_owner_idx ON contributions (owner_key);

CREATE TABLE IF NOT EXISTS distribution_metrics (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  day int NOT NULL,
  date date NOT NULL,
  spend_cents int NOT NULL,
  impressions int NOT NULL,
  reach int NOT NULL,
  clicks int NOT NULL,
  source text NOT NULL DEFAULT 'simulated',
  PRIMARY KEY (campaign_id, day)
);

CREATE TABLE IF NOT EXISTS campaign_updates (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('creator', 'milestone')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY,
  owner_key text NOT NULL,
  type text NOT NULL,
  audience text NOT NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  dedupe_key text NOT NULL,
  read_at timestamptz,
  at timestamptz NOT NULL,
  UNIQUE (owner_key, dedupe_key)
);
CREATE INDEX IF NOT EXISTS notifications_owner_idx ON notifications (owner_key, at DESC);

CREATE TABLE IF NOT EXISTS notification_prefs (
  owner_key text NOT NULL,
  category text NOT NULL,
  enabled boolean NOT NULL,
  PRIMARY KEY (owner_key, category)
);

CREATE TABLE IF NOT EXISTS follows (
  owner_key text NOT NULL,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_key, campaign_id)
);

CREATE TABLE IF NOT EXISTS saves (
  owner_key text NOT NULL,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_key, campaign_id)
);

CREATE TABLE IF NOT EXISTS feedback_votes (
  owner_key text NOT NULL,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (question IN ('visuals', 'mind')),
  answer text NOT NULL CHECK (answer IN ('no', 'somewhat', 'yes')),
  PRIMARY KEY (owner_key, campaign_id, question)
);

CREATE TABLE IF NOT EXISTS campaign_reports (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  owner_key text NOT NULL,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  resolved boolean NOT NULL DEFAULT false,
  at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  clock_offset_days int NOT NULL DEFAULT 0
);
INSERT INTO demo_state (id, clock_offset_days) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

-- Defence in depth on Supabase: the API connects as the database owner; the public API roles get nothing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'ALTER TABLE users ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE campaign_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE reviews ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE contributions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE distribution_metrics ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE campaign_updates ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE notifications ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE follows ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE saves ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE feedback_votes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE campaign_reports ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE demo_state ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
