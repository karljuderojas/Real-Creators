-- ============================================================
-- Verified People – AI creators table
-- Run this in the Supabase SQL editor after supabase_setup.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_creators (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  twitter_handle TEXT        UNIQUE NOT NULL,
  display_name  TEXT,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'active' | 'removed'
  status        TEXT        NOT NULL DEFAULT 'active'
);

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE ai_creators ENABLE ROW LEVEL SECURITY;

-- Public anon key: read-only, active accounts only
CREATE POLICY "public read ai creators"
  ON ai_creators FOR SELECT
  USING (status = 'active');

-- ── Seed data ─────────────────────────────────────────────────────────────────
INSERT INTO ai_creators (twitter_handle, display_name) VALUES
  ('monomidechu',  'monomidechu'),
  ('LifelongOrca98', 'LifelongOrca98')
ON CONFLICT (twitter_handle) DO NOTHING;
