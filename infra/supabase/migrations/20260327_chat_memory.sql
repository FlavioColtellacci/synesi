-- Migration: Sigma Chat Memory
-- Tables: chat_threads, chat_messages
-- Apply via: Supabase SQL editor

CREATE TABLE IF NOT EXISTS chat_threads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL DEFAULT 'Sigma conversation',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid        NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_created_idx
  ON chat_messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_user_idx
  ON chat_messages (user_id);

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own chat_threads" ON chat_threads;
CREATE POLICY "Users can read own chat_threads"
  ON chat_threads
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own chat_threads" ON chat_threads;
CREATE POLICY "Users can insert own chat_threads"
  ON chat_threads
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own chat_threads" ON chat_threads;
CREATE POLICY "Users can update own chat_threads"
  ON chat_threads
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own chat_threads" ON chat_threads;
CREATE POLICY "Users can delete own chat_threads"
  ON chat_threads
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own chat_messages" ON chat_messages;
CREATE POLICY "Users can read own chat_messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own chat_messages" ON chat_messages;
CREATE POLICY "Users can insert own chat_messages"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own chat_messages" ON chat_messages;
CREATE POLICY "Users can delete own chat_messages"
  ON chat_messages
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION set_chat_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_chat_threads_updated_at_trigger ON chat_threads;
CREATE TRIGGER set_chat_threads_updated_at_trigger
  BEFORE UPDATE ON chat_threads
  FOR EACH ROW
  EXECUTE FUNCTION set_chat_threads_updated_at();

CREATE OR REPLACE FUNCTION touch_chat_thread_on_message_write()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_threads
  SET updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS touch_chat_thread_on_message_write_trigger ON chat_messages;
CREATE TRIGGER touch_chat_thread_on_message_write_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION touch_chat_thread_on_message_write();
