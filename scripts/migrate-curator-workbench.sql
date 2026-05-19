-- Curator workbench: per-intake AI summary, meeting notes, and curator overrides
-- of original supplier-submitted content (so we can show diff + restore).
-- Idempotent — adds columns only if missing.

-- intakes-level fields
ALTER TABLE intakes ADD COLUMN ai_summary_zh TEXT;
ALTER TABLE intakes ADD COLUMN ai_summary_en TEXT;
ALTER TABLE intakes ADD COLUMN ai_summary_at TEXT;
ALTER TABLE intakes ADD COLUMN meeting_notes TEXT;
ALTER TABLE intakes ADD COLUMN meeting_notes_at TEXT;
ALTER TABLE intakes ADD COLUMN meeting_date TEXT;

-- Per-section curator overrides for Original Submission. JSON keyed by section
-- so curator edits + restore button can work without trampling supplier data.
-- Sections: 'industry', 'website', 'free_text', 'service_pricing', plus
-- per-rolepack 'rp:<id>' and per-capability 'cap:<id>' keys.
ALTER TABLE intakes ADD COLUMN curator_overrides_json TEXT;

-- Pending Copilot suggestions awaiting curator approval (so changes don't
-- write straight to questionnaires anymore). One row per pending update.
CREATE TABLE IF NOT EXISTS curator_pending_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intake_id   TEXT NOT NULL REFERENCES intakes(id) ON DELETE CASCADE,
  rolepack_id TEXT REFERENCES rolepacks_v2(id) ON DELETE CASCADE,
  field_id    TEXT NOT NULL,            -- 'profile.daily_activities' etc.
  current_value_json TEXT,              -- snapshot of pre-change value (for diff)
  proposed_value_json TEXT NOT NULL,    -- {value_zh, value_en, confidence, ...}
  reason      TEXT,                     -- why Copilot suggests this
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  rejected_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pending_intake ON curator_pending_updates(intake_id, created_at);
