CREATE TABLE IF NOT EXISTS connection_accounts (
  account_id TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('mail','calendar')),
  provider TEXT NOT NULL, broker_id TEXT NOT NULL, auth_config_id TEXT NOT NULL,
  label TEXT NOT NULL, scopes TEXT NOT NULL DEFAULT '[]', connected_at INTEGER NOT NULL,
  PRIMARY KEY(account_id, category)
);
CREATE TABLE IF NOT EXISTS connection_intents (
  state_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, session_hash TEXT NOT NULL,
  category TEXT NOT NULL, provider TEXT NOT NULL, auth_config_id TEXT NOT NULL,
  broker_id TEXT NOT NULL, return_path TEXT NOT NULL, expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS connection_intents_expiry ON connection_intents(expires_at);
CREATE TABLE IF NOT EXISTS connection_event_receipts (
  account_id TEXT NOT NULL, request_key TEXT NOT NULL, request_hash TEXT NOT NULL,
  broker_id TEXT NOT NULL, calendar_id TEXT NOT NULL, event_id TEXT NOT NULL, result TEXT, created_at INTEGER NOT NULL,
  PRIMARY KEY(account_id, request_key)
);
CREATE TABLE IF NOT EXISTS connection_usage (
  account_id TEXT NOT NULL, day TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(account_id, day)
);
-- Retain only opaque provider IDs while retrying cleanup; never lose an old authorization pointer on replacement.
CREATE TABLE IF NOT EXISTS connection_retirements (
  account_id TEXT NOT NULL, broker_id TEXT NOT NULL, provider TEXT NOT NULL,
  auth_config_id TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY(account_id, broker_id)
);
