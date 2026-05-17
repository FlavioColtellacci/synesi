-- Migration: Sigma Autonomous Monitor
-- Tables: sigma_monitor_runs
-- Apply via: Supabase SQL editor

CREATE TABLE IF NOT EXISTS sigma_monitor_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_key text NOT NULL,
  trigger_source text NOT NULL CHECK (trigger_source IN ('manual', 'cron')),
  status text NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  summary jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, run_key)
);

CREATE INDEX IF NOT EXISTS sigma_monitor_runs_user_created_idx
  ON sigma_monitor_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sigma_monitor_runs_status_idx
  ON sigma_monitor_runs (status, created_at DESC);

ALTER TABLE sigma_monitor_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own sigma_monitor_runs" ON sigma_monitor_runs;
CREATE POLICY "Users can read own sigma_monitor_runs"
  ON sigma_monitor_runs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own sigma_monitor_runs" ON sigma_monitor_runs;
CREATE POLICY "Users can insert own sigma_monitor_runs"
  ON sigma_monitor_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own sigma_monitor_runs" ON sigma_monitor_runs;
CREATE POLICY "Users can update own sigma_monitor_runs"
  ON sigma_monitor_runs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
