-- Run this in the Supabase SQL Editor ONCE to enable admin write access.
-- After running, go to Authentication → Users in your Supabase dashboard
-- and click "Invite user" to create your admin account.

-- ── Human creators ──────────────────────────────────────────────────────────

CREATE POLICY "Admin can insert human creators"
  ON verified_creators
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update human creators"
  ON verified_creators
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── AI creators ─────────────────────────────────────────────────────────────

CREATE POLICY "Admin can insert ai creators"
  ON ai_creators
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update ai creators"
  ON ai_creators
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
