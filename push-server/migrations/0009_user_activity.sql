PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS subscriber_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriber_id INTEGER NOT NULL,
  installation_id TEXT,
  activity_key TEXT NOT NULL,
  activity_label TEXT NOT NULL,
  detail TEXT,
  platform TEXT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(subscriber_id) REFERENCES email_subscribers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriber_activity_latest
  ON subscriber_activity(subscriber_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_subscriber_activity_installation
  ON subscriber_activity(installation_id, occurred_at DESC);
