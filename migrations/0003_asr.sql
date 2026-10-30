-- Speech-to-text jobs for Meet: the browser posts a WAV, the agent host (NVIDIA Parakeet) claims it through the bridge.
-- Audio is held only until transcription finishes; the result route sets it to NULL. Additive only.

CREATE TABLE asr_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  lang TEXT NOT NULL,
  audio TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  text TEXT,
  error TEXT,
  model TEXT,
  ms INTEGER,
  translate TEXT CHECK (translate IN ('en','pl')),
  translation TEXT,
  translation_model TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX asr_jobs_status_created ON asr_jobs (status, created_at);
