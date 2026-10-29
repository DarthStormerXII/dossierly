-- Settla platform schema. Times are epoch milliseconds (UTC). Money is stored in micro-units.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  plan_kind TEXT NOT NULL DEFAULT 'free' CHECK (plan_kind IN ('free','case_pass','judge')),
  plan_expires_at INTEGER,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  family INTEGER NOT NULL DEFAULT 0,
  free_letter_used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  ran_on TEXT,
  sandbox TEXT,
  input TEXT,
  trace TEXT NOT NULL DEFAULT '[]',
  result TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX tasks_user ON tasks (user_id, created_at DESC);
CREATE INDEX tasks_open ON tasks (status, created_at);

-- Append-only, hash-chained per chain (a user id, or 'global' when no user).
CREATE TABLE ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  user_id TEXT,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('model','egress','job')),
  what TEXT NOT NULL,
  region TEXT,
  action TEXT,
  bytes INTEGER,
  masked INTEGER,
  detail TEXT,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  UNIQUE (chain_id, seq)
);
CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  ts INTEGER NOT NULL,
  feature TEXT,
  model TEXT NOT NULL,
  ms INTEGER NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  cost_micro INTEGER NOT NULL DEFAULT 0,
  ran_on TEXT NOT NULL
);
CREATE INDEX runs_user ON runs (user_id, ts DESC);

CREATE TABLE hub_snapshots (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  source_url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content TEXT,
  fetched_at INTEGER NOT NULL
);
CREATE INDEX hub_snapshots_src ON hub_snapshots (country, source_url, fetched_at DESC);

CREATE TABLE hub_changes (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  detected_at INTEGER NOT NULL,
  snapshot_id TEXT,
  sample INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX hub_changes_country ON hub_changes (country, detected_at DESC);

CREATE TABLE budgets (
  day TEXT NOT NULL,
  scope TEXT NOT NULL,
  kind TEXT NOT NULL,
  spent_micro INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, scope, kind)
);

CREATE TABLE payments (
  webhook_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payment_id TEXT,
  user_id TEXT,
  product TEXT,
  amount INTEGER,
  currency TEXT,
  granted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX payments_user ON payments (user_id);

CREATE TABLE redemptions (
  user_id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  redeemed_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX payments_payment_granted ON payments (payment_id) WHERE granted = 1 AND payment_id IS NOT NULL;
