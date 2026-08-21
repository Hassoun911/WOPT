ALTER TABLE email_subscribers ADD COLUMN installation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_email_subscribers_installation
  ON email_subscribers(installation_id);
