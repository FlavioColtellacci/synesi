-- Migration: Sigma Chat Phase 6 memory profile + release ring metadata

ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS memory_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS memory_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS memory_profile_updated_at timestamptz;

ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS release_ring text NOT NULL DEFAULT 'full'
    CHECK (release_ring IN ('internal', 'beta', 'full'));
