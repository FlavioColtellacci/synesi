-- Allow PNG/JPEG and document MIME types on the chat uploads bucket.
-- Without image/png (and peers), Supabase Storage rejects uploads with:
-- "mime type image/png is not supported" even when the app accepts the file.

INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES (
  'sigma-chat-uploads',
  'sigma-chat-uploads',
  false,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'text/csv',
    'application/csv',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can read own sigma chat uploads'
  ) THEN
    CREATE POLICY "Users can read own sigma chat uploads"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'sigma-chat-uploads'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can upload own sigma chat uploads'
  ) THEN
    CREATE POLICY "Users can upload own sigma chat uploads"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'sigma-chat-uploads'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own sigma chat uploads'
  ) THEN
    CREATE POLICY "Users can delete own sigma chat uploads"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'sigma-chat-uploads'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;
END
$$;
