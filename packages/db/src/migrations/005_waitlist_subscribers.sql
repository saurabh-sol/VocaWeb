CREATE TABLE IF NOT EXISTS waitlist_subscribers (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email      TEXT NOT NULL,
  name       TEXT,
  message    TEXT,
  source     TEXT NOT NULL DEFAULT 'footer',
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_subscribers_email_lower_idx
  ON waitlist_subscribers (LOWER(email));

CREATE INDEX IF NOT EXISTS waitlist_subscribers_created_at_idx
  ON waitlist_subscribers (created_at DESC);
