-- Idempotent chat sync metadata for zero-loss client ↔ server reconciliation

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS client_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_client_dedup
  ON chat_messages (session_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS local_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_local_id
  ON chat_sessions (user_id, local_session_id)
  WHERE local_session_id IS NOT NULL;
