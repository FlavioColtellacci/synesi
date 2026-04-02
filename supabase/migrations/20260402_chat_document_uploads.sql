-- Migration: Sigma chat document uploads
-- Purpose: Store user-scoped uploads and extracted text for chat context grounding.

CREATE TABLE IF NOT EXISTS chat_uploaded_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_extension text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  sha256 text NOT NULL,
  status text NOT NULL CHECK (status IN ('ready', 'failed')),
  malware_scan_status text NOT NULL CHECK (malware_scan_status IN ('clean', 'blocked', 'skipped')),
  extracted_text text,
  extracted_chars integer NOT NULL DEFAULT 0 CHECK (extracted_chars >= 0),
  extraction_error text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_uploaded_documents_storage_path_idx
  ON chat_uploaded_documents (storage_path);

CREATE INDEX IF NOT EXISTS chat_uploaded_documents_user_created_idx
  ON chat_uploaded_documents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_uploaded_documents_user_status_idx
  ON chat_uploaded_documents (user_id, status);

ALTER TABLE chat_uploaded_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat uploads"
  ON chat_uploaded_documents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chat uploads"
  ON chat_uploaded_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own chat uploads"
  ON chat_uploaded_documents
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own chat uploads"
  ON chat_uploaded_documents
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
