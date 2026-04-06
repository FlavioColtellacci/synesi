-- Sigma projects: group chat threads (ChatGPT-style folders).

CREATE TABLE IF NOT EXISTS sigma_projects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sigma_projects_user_id_updated_at_desc_idx
  ON sigma_projects (user_id, updated_at DESC);

ALTER TABLE sigma_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own sigma_projects" ON sigma_projects;
CREATE POLICY "Users can read own sigma_projects"
  ON sigma_projects
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own sigma_projects" ON sigma_projects;
CREATE POLICY "Users can insert own sigma_projects"
  ON sigma_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own sigma_projects" ON sigma_projects;
CREATE POLICY "Users can update own sigma_projects"
  ON sigma_projects
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own sigma_projects" ON sigma_projects;
CREATE POLICY "Users can delete own sigma_projects"
  ON sigma_projects
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION set_sigma_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_sigma_projects_updated_at_trigger ON sigma_projects;
CREATE TRIGGER set_sigma_projects_updated_at_trigger
  BEFORE UPDATE ON sigma_projects
  FOR EACH ROW
  EXECUTE FUNCTION set_sigma_projects_updated_at();

ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES sigma_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chat_threads_user_project_idx
  ON chat_threads (user_id, project_id);

-- Ensure project_id, when set, references a project owned by the same user as the thread.
CREATE OR REPLACE FUNCTION chat_threads_project_must_match_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM sigma_projects p
    WHERE p.id = NEW.project_id
      AND p.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'chat_threads.project_id must reference a sigma_project owned by the same user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_threads_project_must_match_user_trigger ON chat_threads;
CREATE TRIGGER chat_threads_project_must_match_user_trigger
  BEFORE INSERT OR UPDATE OF project_id ON chat_threads
  FOR EACH ROW
  EXECUTE FUNCTION chat_threads_project_must_match_user();
