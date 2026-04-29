-- Run this in the Supabase SQL Editor to create the crowdsourced submissions table.

CREATE TABLE creator_submissions (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  twitter_handle text        NOT NULL,
  vote           text        NOT NULL CHECK (vote IN ('human', 'ai', 'unsure')),
  session_id     text,
  created_at     timestamptz DEFAULT now(),
  status         text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected'))
);

ALTER TABLE creator_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone (extension users) can submit — no login required
CREATE POLICY "Public can submit"
  ON creator_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only the logged-in admin can read and action submissions
CREATE POLICY "Admin can read submissions"
  ON creator_submissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can update submissions"
  ON creator_submissions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
