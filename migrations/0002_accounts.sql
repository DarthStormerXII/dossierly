-- Accounts: passkey or device sign-up, one-time plan choice, free-tier letter count. Additive only.

ALTER TABLE users ADD COLUMN account_kind TEXT CHECK (account_kind IN ('passkey','device'));
ALTER TABLE users ADD COLUMN plan_chosen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN active_case TEXT NOT NULL DEFAULT 'own';
ALTER TABLE users ADD COLUMN letters_used INTEGER NOT NULL DEFAULT 0;

CREATE TABLE webauthn_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX webauthn_credentials_user ON webauthn_credentials (user_id);
