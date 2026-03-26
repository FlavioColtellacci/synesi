-- Migration: Trusted Sources Alerting Pipeline (Step A)
-- Tables: source_documents, thesis_source_matches
-- Apply via: Supabase SQL editor

-- ============================================================
-- source_documents
-- Normalized ingested content. Global (not user-scoped).
-- Deduplication key: content_hash (sha256 of url + title).
-- ============================================================
CREATE TABLE IF NOT EXISTS source_documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name     text        NOT NULL,
  source_type     text        NOT NULL CHECK (source_type IN ('analyst', 'news_outlet', 'newsletter', 'sec_filing', 'other')),
  url             text        NOT NULL,
  title           text        NOT NULL,
  published_at    timestamptz,
  content_excerpt text,
  content_hash    text        NOT NULL,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Dedupe index: one document per unique content_hash
CREATE UNIQUE INDEX IF NOT EXISTS source_documents_content_hash_idx
  ON source_documents (content_hash);

-- Query helpers
CREATE INDEX IF NOT EXISTS source_documents_published_at_idx
  ON source_documents (published_at DESC);

CREATE INDEX IF NOT EXISTS source_documents_source_name_idx
  ON source_documents (source_name);

-- RLS: readable by all authenticated users (no user-scope needed)
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read source_documents"
  ON source_documents
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role (cron) can insert
CREATE POLICY "Service role can insert source_documents"
  ON source_documents
  FOR INSERT
  TO service_role
  WITH CHECK (true);


-- ============================================================
-- thesis_source_matches
-- Per-thesis matching decisions (written by matching cron).
-- Unique constraint: one match record per (thesis, document) pair.
-- ============================================================
CREATE TABLE IF NOT EXISTS thesis_source_matches (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  thesis_id          uuid        NOT NULL REFERENCES theses(id)         ON DELETE CASCADE,
  trusted_source_id  uuid        NOT NULL REFERENCES trusted_sources(id) ON DELETE CASCADE,
  source_document_id uuid        NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  relevance_score    numeric,
  match_reason       text,
  confidence         text        CHECK (confidence IN ('high', 'medium', 'low')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Dedupe: prevent duplicate match records for same thesis+document
CREATE UNIQUE INDEX IF NOT EXISTS thesis_source_matches_dedup_idx
  ON thesis_source_matches (thesis_id, source_document_id);

CREATE INDEX IF NOT EXISTS thesis_source_matches_user_idx
  ON thesis_source_matches (user_id);

CREATE INDEX IF NOT EXISTS thesis_source_matches_thesis_idx
  ON thesis_source_matches (thesis_id);

-- RLS: users can only read their own match records
ALTER TABLE thesis_source_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own thesis_source_matches"
  ON thesis_source_matches
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role (cron) can insert match records
CREATE POLICY "Service role can insert thesis_source_matches"
  ON thesis_source_matches
  FOR INSERT
  TO service_role
  WITH CHECK (true);
