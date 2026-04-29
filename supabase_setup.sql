-- ============================================================
-- Verified People – Supabase setup
-- Run this entire file in the Supabase SQL editor once.
-- ============================================================

-- ── Verified creators ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verified_creators (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  twitter_handle TEXT        UNIQUE NOT NULL,
  display_name  TEXT,
  verified      BOOLEAN     NOT NULL DEFAULT true,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'active' | 'pending' | 'removed'  — future nomination workflow ready
  status        TEXT        NOT NULL DEFAULT 'active'
);

-- ── Analytics: badge impressions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge_impressions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  twitter_handle TEXT        NOT NULL,
  session_id     TEXT        NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Analytics: profile visits ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_visits (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  twitter_handle TEXT        NOT NULL,
  session_id     TEXT        NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE verified_creators  ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_impressions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_visits     ENABLE ROW LEVEL SECURITY;

-- Public: read active verified creators only (no writes via anon key)
CREATE POLICY "public read verified creators"
  ON verified_creators FOR SELECT
  USING (verified = true AND status = 'active');

-- Public: insert-only for analytics (no reads, no updates, no deletes)
CREATE POLICY "public insert badge_impressions"
  ON badge_impressions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "public insert profile_visits"
  ON profile_visits FOR INSERT
  WITH CHECK (true);

-- ── Useful queries for the team dashboard ────────────────────────────────────

-- Badge impressions per creator (last 7 days)
-- SELECT twitter_handle, COUNT(*) AS impressions
-- FROM badge_impressions
-- WHERE timestamp > now() - INTERVAL '7 days'
-- GROUP BY twitter_handle ORDER BY impressions DESC;

-- Profile visit rate per creator (last 7 days)
-- SELECT
--   i.twitter_handle,
--   COUNT(DISTINCT i.id)           AS impressions,
--   COUNT(DISTINCT v.id)           AS visits,
--   ROUND(COUNT(DISTINCT v.id)::numeric / NULLIF(COUNT(DISTINCT i.id), 0) * 100, 1) AS visit_rate_pct
-- FROM badge_impressions i
-- LEFT JOIN profile_visits v
--   ON v.twitter_handle = i.twitter_handle
--  AND v.session_id     = i.session_id
--  AND v.timestamp BETWEEN i.timestamp AND i.timestamp + INTERVAL '1 hour'
-- WHERE i.timestamp > now() - INTERVAL '7 days'
-- GROUP BY i.twitter_handle ORDER BY visit_rate_pct DESC;

-- Weekly active sessions
-- SELECT date_trunc('week', timestamp) AS week, COUNT(DISTINCT session_id) AS wau
-- FROM badge_impressions
-- GROUP BY week ORDER BY week DESC;
