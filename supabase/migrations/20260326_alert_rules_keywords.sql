-- Migration: Alert Rule Keyword Filters (Phase 2)
-- Adds include/exclude keyword chips to alert_rules.
-- Apply via: Supabase SQL editor

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS include_keywords text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS exclude_keywords text[] NOT NULL DEFAULT '{}'::text[];

