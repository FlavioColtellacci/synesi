-- Web Push (VAPID): one row per browser endpoint per user.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own push_subscriptions" ON push_subscriptions;
CREATE POLICY "Users can select own push_subscriptions"
  ON push_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own push_subscriptions" ON push_subscriptions;
CREATE POLICY "Users can insert own push_subscriptions"
  ON push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own push_subscriptions" ON push_subscriptions;
CREATE POLICY "Users can update own push_subscriptions"
  ON push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own push_subscriptions" ON push_subscriptions;
CREATE POLICY "Users can delete own push_subscriptions"
  ON push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE push_subscriptions IS 'Browser Web Push subscription keys (VAPID).';
