-- Non-sensitive progress only. Profiles, letters and case results remain in the account's encrypted browser vault.
CREATE TABLE onboarding_progress (
  account_id TEXT PRIMARY KEY REFERENCES users(id),
  step INTEGER NOT NULL DEFAULT 1 CHECK (step BETWEEN 1 AND 6),
  language TEXT NOT NULL DEFAULT 'en',
  needs TEXT NOT NULL DEFAULT '[]',
  reviewed_needs TEXT NOT NULL DEFAULT '[]',
  revision INTEGER NOT NULL DEFAULT 0,
  case_id TEXT,
  completed_at INTEGER,
  updated_at INTEGER NOT NULL
);
