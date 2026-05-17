-- Migration: Personalized Alert Rules (Phase 1)
-- Tables: alert_rules, alert_rule_sources
-- Apply via: Supabase SQL editor

CREATE TABLE IF NOT EXISTS alert_rules (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thesis_id      uuid        NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  mode           text        NOT NULL CHECK (mode IN ('only_sources', 'include_sources', 'exclude_sources')),
  min_confidence text        NOT NULL CHECK (min_confidence IN ('high', 'medium')),
  is_enabled     boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_rules_user_thesis_idx
  ON alert_rules (user_id, thesis_id);

CREATE INDEX IF NOT EXISTS alert_rules_thesis_enabled_idx
  ON alert_rules (thesis_id, is_enabled);

CREATE TABLE IF NOT EXISTS alert_rule_sources (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id     uuid        NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  trusted_source_id uuid        NOT NULL REFERENCES trusted_sources(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_rule_id, trusted_source_id)
);

CREATE INDEX IF NOT EXISTS alert_rule_sources_rule_idx
  ON alert_rule_sources (alert_rule_id);

CREATE INDEX IF NOT EXISTS alert_rule_sources_source_idx
  ON alert_rule_sources (trusted_source_id);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rule_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own alert_rules"
  ON alert_rules
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own alert_rules"
  ON alert_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own alert_rules"
  ON alert_rules
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own alert_rules"
  ON alert_rules
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can read own alert_rule_sources"
  ON alert_rule_sources
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM alert_rules ar
      WHERE ar.id = alert_rule_sources.alert_rule_id
        AND ar.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own alert_rule_sources"
  ON alert_rule_sources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM alert_rules ar
      WHERE ar.id = alert_rule_sources.alert_rule_id
        AND ar.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own alert_rule_sources"
  ON alert_rule_sources
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM alert_rules ar
      WHERE ar.id = alert_rule_sources.alert_rule_id
        AND ar.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_alert_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_alert_rules_updated_at_trigger ON alert_rules;
CREATE TRIGGER set_alert_rules_updated_at_trigger
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_alert_rules_updated_at();
