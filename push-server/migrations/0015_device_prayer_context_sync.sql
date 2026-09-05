PRAGMA foreign_keys = ON;

ALTER TABLE email_subscribers ADD COLUMN high_latitude INTEGER NOT NULL DEFAULT 3;
ALTER TABLE email_subscribers ADD COLUMN tune TEXT NOT NULL DEFAULT '0,0,0,0,0,0,0,0,0';

CREATE INDEX IF NOT EXISTS idx_email_subscribers_prayer_context
  ON email_subscribers(status, timezone, calculation_method, madhab, high_latitude);
