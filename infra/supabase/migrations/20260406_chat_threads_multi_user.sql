-- Multi-thread chat: allow many chat_threads per user; fast recent-thread listing.
-- Replaces UNIQUE (user_id) from 20260327_chat_memory.sql.

ALTER TABLE chat_threads DROP CONSTRAINT IF EXISTS chat_threads_user_id_key;

CREATE INDEX IF NOT EXISTS chat_threads_user_id_updated_at_desc_idx
  ON chat_threads (user_id, updated_at DESC);
