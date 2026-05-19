-- v2 Copilot chat history (rolepack-scoped).
-- Replaces use of legacy chat_messages (which has FK to submissions).

CREATE TABLE IF NOT EXISTS rolepack_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rolepack_id TEXT NOT NULL REFERENCES rolepacks_v2(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rpchat_rp ON rolepack_chat_messages(rolepack_id, created_at);
