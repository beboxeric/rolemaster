-- AI Features Redesign §0.3 — new tables + column extensions.
-- Idempotent: re-runs are safe.

CREATE TABLE IF NOT EXISTS submission_splits (
  submission_id TEXT PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
  areas_json TEXT NOT NULL,
  recommended_grouping_json TEXT NOT NULL,
  alternatives_json TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_grouping_json TEXT,
  confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS prefill_runs (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  product_id TEXT,
  area_ids_json TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  fields_filled_count INTEGER DEFAULT 0,
  raw_response_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_prefill_runs_submission ON prefill_runs(submission_id, generated_at);

-- Extend platform_logs with AI-call telemetry columns. ALTER TABLE ADD COLUMN
-- errors if the column already exists; that's tolerated by retry.
ALTER TABLE platform_logs ADD COLUMN surface TEXT;
ALTER TABLE platform_logs ADD COLUMN submission_id TEXT;
ALTER TABLE platform_logs ADD COLUMN product_id TEXT;
ALTER TABLE platform_logs ADD COLUMN duration_ms INTEGER;
ALTER TABLE platform_logs ADD COLUMN prompt_tokens INTEGER;
ALTER TABLE platform_logs ADD COLUMN completion_tokens INTEGER;

-- Track field provenance: 'ai_prefilled' | 'copilot_filled' | 'copilot_weak' |
-- 'user_confirmed' | 'user_edited'. NULL on legacy rows.
ALTER TABLE submission_fields ADD COLUMN state TEXT;
