-- Add verified email identities without rebuilding users or changing existing account data.
-- The legacy users.account_kind CHECK remains; email identity takes precedence on read.
CREATE TABLE email_identities (
  email TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  verified_at INTEGER NOT NULL
);

CREATE TABLE email_login_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  browser_hash TEXT NOT NULL,
  attach_user_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX email_challenges_expiry ON email_login_challenges(expires_at);
CREATE INDEX email_challenges_address ON email_login_challenges(email, created_at);
