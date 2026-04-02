-- Migration: Sigma chat exports
-- Purpose: Persist generated downloadable artifacts and keep user-scoped access.

CREATE TABLE IF NOT EXISTS chat_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  format text NOT NULL CHECK (format IN ('csv', 'docx', 'pdf', 'xlsx')),
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  source_request_id text,
  signed_url_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_exports_storage_path_idx
  ON chat_exports (storage_path);

CREATE INDEX IF NOT EXISTS chat_exports_user_created_idx
  ON chat_exports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_exports_user_expires_idx
  ON chat_exports (user_id, signed_url_expires_at DESC);

ALTER TABLE chat_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat exports"
  ON chat_exports
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat exports"
  ON chat_exports
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chat exports"
  ON chat_exports
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own chat exports"
  ON chat_exports
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('sigma-chat-exports', 'sigma-chat-exports', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can read own sigma chat exports'
  ) THEN
    CREATE POLICY "Users can read own sigma chat exports"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'sigma-chat-exports'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can upload own sigma chat exports'
  ) THEN
    CREATE POLICY "Users can upload own sigma chat exports"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'sigma-chat-exports'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own sigma chat exports'
  ) THEN
    CREATE POLICY "Users can delete own sigma chat exports"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'sigma-chat-exports'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;
END
$$;
