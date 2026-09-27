-- Daily build allowance per user. One row per user per UTC day.

CREATE TABLE IF NOT EXISTS usage_counters (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  count      INT NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
